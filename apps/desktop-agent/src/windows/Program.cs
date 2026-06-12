using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;

var options = AgentOptions.LoadFromEnvironment();
if (!options.HasValidConfiguration)
{
  AgentLogger.Write(
    "Missing configuration. Set ATT_AGENT_BASE_URL and either ATT_AGENT_TOKEN or ATT_AGENT_EMAIL + ATT_AGENT_PASSWORD."
  );
  return;
}

AgentLogger.Write("Attendance agent starting...");
AgentLogger.Write($"Base URL: {options.BaseUrl}");
AgentLogger.Write(
  $"Cursor away: {options.CursorIdleAwaySeconds}s, laptop sleep away: {options.LaptopSleepAwaySeconds}s"
);

var cancellation = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
  e.Cancel = true;
  cancellation.Cancel();
};

using var client = new HttpClient
{
  BaseAddress = new Uri(options.BaseUrl.TrimEnd('/') + "/")
};

var auth = new AgentAuthTokenProvider(options);
if (!await auth.TryEnsureTokenAsync(client, forceRefresh: false, cancellation.Token))
{
  AgentLogger.Write("Unable to initialize auth token. Exiting.");
  return;
}

var state = new AgentRuntimeState();

SessionSwitchEventHandler sessionSwitchHandler = (_, e) =>
{
  if (e.Reason == SessionSwitchReason.SessionLock)
  {
    state.SessionLocked = true;
    state.LockStartedAt = DateTimeOffset.UtcNow;
    state.LockAwaySent = false;
    state.CursorAwaySent = false;
  }
  else if (e.Reason == SessionSwitchReason.SessionUnlock)
  {
    if (state.LockAwaySent)
    {
      _ = PostEventAsync(client, auth, "unlock", options, null, "sleep", cancellation.Token);
    }
    ResetSleepTrackingState(state);
  }
};
SystemEvents.SessionSwitch += sessionSwitchHandler;

PowerModeChangedEventHandler powerModeHandler = (_, e) =>
{
  if (e.Mode == PowerModes.Suspend)
  {
    state.PowerSuspended = true;
    state.SuspendStartedAt = DateTimeOffset.UtcNow;
    state.CursorAwaySent = false;
    // Laptop lid close / OS sleep suspends the process — send lock immediately.
    _ = PostEventAsync(client, auth, "lock", options, null, "sleep", cancellation.Token);
    state.LockAwaySent = true;
    AgentLogger.Write("power suspend detected; sleep lock sent");
  }
  else if (e.Mode == PowerModes.Resume)
  {
    if (state.LockAwaySent || state.PowerSuspended)
    {
      _ = PostEventAsync(client, auth, "unlock", options, null, "sleep", cancellation.Token);
      AgentLogger.Write("power resume detected; sleep unlock sent");
    }
    ResetSleepTrackingState(state);
  }
};
SystemEvents.PowerModeChanged += powerModeHandler;

try
{
  while (!cancellation.Token.IsCancellationRequested)
  {
    await RunTickAsync(client, auth, options, state, cancellation.Token);
    await Task.Delay(TimeSpan.FromSeconds(options.PollSeconds), cancellation.Token);
  }
}
catch (OperationCanceledException)
{
  // Graceful shutdown.
}
finally
{
  SystemEvents.SessionSwitch -= sessionSwitchHandler;
  SystemEvents.PowerModeChanged -= powerModeHandler;
  AgentLogger.Write("Attendance agent stopped.");
}

static async Task RunTickAsync(
  HttpClient client,
  AgentAuthTokenProvider auth,
  AgentOptions options,
  AgentRuntimeState state,
  CancellationToken cancellationToken
)
{
  var now = DateTimeOffset.UtcNow;
  var idleSeconds = WindowsIdle.GetIdleSeconds();
  var cursorAwaySeconds = options.CursorIdleAwaySeconds;
  var skipCursorIdle = state.SessionLocked || state.PowerSuspended;

  if (options.CursorIdleEnabled)
  {
    if (
      !skipCursorIdle &&
      !state.CursorAwaySent &&
      idleSeconds >= cursorAwaySeconds
    )
    {
      state.CursorAwaySent = true;
      await PostEventAsync(
        client,
        auth,
        "away_start",
        options,
        null,
        "cursor_idle",
        cancellationToken
      );
    }

    if (
      !skipCursorIdle &&
      state.CursorAwaySent &&
      idleSeconds < cursorAwaySeconds
    )
    {
      state.CursorAwaySent = false;
      await PostEventAsync(
        client,
        auth,
        "away_end",
        options,
        null,
        "cursor_idle",
        cancellationToken
      );
    }

    if (
      !skipCursorIdle &&
      state.CursorAwaySent &&
      idleSeconds >= cursorAwaySeconds &&
      now >= state.NextAwayCheckAt
    )
    {
      await PostEventAsync(client, auth, "activity", options, null, null, cancellationToken);
      state.NextAwayCheckAt = now.AddSeconds(3);
    }

    if (
      !skipCursorIdle &&
      now >= state.NextActivityPingAt &&
      idleSeconds < cursorAwaySeconds &&
      !state.CursorAwaySent
    )
    {
      await PostEventAsync(client, auth, "activity", options, null, null, cancellationToken);
      state.NextActivityPingAt = now.AddSeconds(options.ActivityPingSeconds);
    }
  }
  else if (now >= state.NextActivityPingAt)
  {
    await PostEventAsync(client, auth, "activity", options, null, null, cancellationToken);
    state.NextActivityPingAt = now.AddSeconds(options.ActivityPingSeconds);
  }

  if (
    state.SessionLocked &&
    !state.LockAwaySent &&
    state.LockStartedAt.HasValue &&
    (now - state.LockStartedAt.Value).TotalSeconds >= options.LaptopSleepAwaySeconds
  )
  {
    state.LockAwaySent = true;
    await PostEventAsync(client, auth, "lock", options, null, "sleep", cancellationToken);
  }
}

static async Task PostEventAsync(
  HttpClient client,
  AgentAuthTokenProvider auth,
  string eventName,
  AgentOptions options,
  string? reason,
  string? awayCause,
  CancellationToken cancellationToken
)
{
  try
  {
    var token = await auth.GetTokenAsync(client, cancellationToken);
    if (string.IsNullOrWhiteSpace(token))
    {
      AgentLogger.Write($"event={eventName} skipped (no auth token)");
      return;
    }

    var payload = JsonSerializer.Serialize(new
    {
      @event = eventName,
      source = "agent",
      reason,
      awayCause,
      observedAt = DateTimeOffset.UtcNow
    });

    var response = await SendEventAsync(client, token, payload, cancellationToken);
    if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized && auth.CanRefresh)
    {
      response.Dispose();
      var refreshed = await auth.TryEnsureTokenAsync(client, forceRefresh: true, cancellationToken);
      if (refreshed)
      {
        var retryToken = await auth.GetTokenAsync(client, cancellationToken);
        if (!string.IsNullOrWhiteSpace(retryToken))
        {
          response = await SendEventAsync(client, retryToken, payload, cancellationToken);
        }
      }
    }

    using (response)
    {
      if (!response.IsSuccessStatusCode)
      {
        AgentLogger.Write($"event={eventName} failed status={(int)response.StatusCode}");
        return;
      }
    }

    if (options.Verbose)
    {
      AgentLogger.Write($"event={eventName} sent");
    }
  }
  catch (Exception ex) when (ex is not OperationCanceledException)
  {
    AgentLogger.Write($"event={eventName} error={ex.Message}");
  }
}

static async Task<HttpResponseMessage> SendEventAsync(
  HttpClient client,
  string token,
  string payload,
  CancellationToken cancellationToken
)
{
  using var request = new HttpRequestMessage(HttpMethod.Post, "api/attendance/activity");
  request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
  request.Content = new StringContent(payload, Encoding.UTF8, "application/json");
  return await client.SendAsync(request, cancellationToken);
}

static void ResetSleepTrackingState(AgentRuntimeState state)
{
  state.SessionLocked = false;
  state.LockStartedAt = null;
  state.LockAwaySent = false;
  state.PowerSuspended = false;
  state.SuspendStartedAt = null;
  state.CursorAwaySent = false;
}

sealed class AgentAuthTokenProvider
{
  private readonly AgentOptions _options;
  private readonly SemaphoreSlim _mutex = new(1, 1);
  private string? _token;
  private DateTimeOffset? _tokenExpiryUtc;

  public AgentAuthTokenProvider(AgentOptions options)
  {
    _options = options;
    _token = string.IsNullOrWhiteSpace(options.Token) ? null : options.Token.Trim();
    _tokenExpiryUtc = TryReadJwtExpiryUtc(_token);
  }

  public bool CanRefresh => _options.CanUseCredentialLogin;

  public async Task<string?> GetTokenAsync(HttpClient client, CancellationToken cancellationToken)
  {
    await TryEnsureTokenAsync(client, forceRefresh: false, cancellationToken);
    return _token;
  }

  public async Task<bool> TryEnsureTokenAsync(
    HttpClient client,
    bool forceRefresh,
    CancellationToken cancellationToken
  )
  {
    await _mutex.WaitAsync(cancellationToken);
    try
    {
      if (!forceRefresh && IsTokenUsable(_token, _tokenExpiryUtc, _options.TokenRefreshLeadMinutes))
      {
        return true;
      }

      if (!CanRefresh)
      {
        // Static token mode only; continue with available token if present.
        return !string.IsNullOrWhiteSpace(_token);
      }

      var refreshed = await RefreshFromLoginAsync(client, cancellationToken);
      if (refreshed)
      {
        return true;
      }

      return !string.IsNullOrWhiteSpace(_token);
    }
    finally
    {
      _mutex.Release();
    }
  }

  private async Task<bool> RefreshFromLoginAsync(HttpClient client, CancellationToken cancellationToken)
  {
    if (!_options.CanUseCredentialLogin)
    {
      return false;
    }

    var body = JsonSerializer.Serialize(
      new
      {
        email = _options.Email,
        password = _options.Password
      }
    );

    using var request = new HttpRequestMessage(HttpMethod.Post, "api/auth/login");
    request.Content = new StringContent(body, Encoding.UTF8, "application/json");
    using var response = await client.SendAsync(request, cancellationToken);

    if (!response.IsSuccessStatusCode)
    {
      AgentLogger.Write($"auth refresh failed status={(int)response.StatusCode}");
      return false;
    }

    var token = await TryExtractAuthTokenAsync(response, cancellationToken);
    if (string.IsNullOrWhiteSpace(token))
    {
      AgentLogger.Write("auth refresh failed: token not found in login response");
      return false;
    }

    _token = token;
    _tokenExpiryUtc = TryReadJwtExpiryUtc(token);

    if (_tokenExpiryUtc.HasValue)
    {
      AgentLogger.Write($"auth refreshed; token expiry={_tokenExpiryUtc.Value:O}");
    }
    else
    {
      AgentLogger.Write("auth refreshed; token expiry unknown");
    }

    return true;
  }

  private static bool IsTokenUsable(
    string? token,
    DateTimeOffset? expiryUtc,
    int refreshLeadMinutes
  )
  {
    if (string.IsNullOrWhiteSpace(token))
    {
      return false;
    }

    if (!expiryUtc.HasValue)
    {
      return true;
    }

    return expiryUtc.Value > DateTimeOffset.UtcNow.AddMinutes(refreshLeadMinutes);
  }

  private static async Task<string?> TryExtractAuthTokenAsync(
    HttpResponseMessage response,
    CancellationToken cancellationToken
  )
  {
    if (response.Headers.TryGetValues("Set-Cookie", out var values))
    {
      foreach (var header in values)
      {
        var cookieToken = TryExtractCookieValue(header, "crm_token");
        if (!string.IsNullOrWhiteSpace(cookieToken))
        {
          return cookieToken;
        }
      }
    }

    var body = await response.Content.ReadAsStringAsync(cancellationToken);
    if (string.IsNullOrWhiteSpace(body))
    {
      return null;
    }

    try
    {
      using var doc = JsonDocument.Parse(body);
      if (
        doc.RootElement.TryGetProperty("token", out var tokenElement) &&
        tokenElement.ValueKind == JsonValueKind.String
      )
      {
        return tokenElement.GetString();
      }
    }
    catch
    {
      // Fall through to null.
    }

    return null;
  }

  private static string? TryExtractCookieValue(string setCookieHeader, string cookieName)
  {
    if (string.IsNullOrWhiteSpace(setCookieHeader))
    {
      return null;
    }

    var parts = setCookieHeader.Split(';', StringSplitOptions.RemoveEmptyEntries);
    if (parts.Length == 0)
    {
      return null;
    }

    var first = parts[0].Trim();
    var prefix = cookieName + "=";
    if (!first.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
    {
      return null;
    }

    var raw = first[prefix.Length..];
    return Uri.UnescapeDataString(raw);
  }

  private static DateTimeOffset? TryReadJwtExpiryUtc(string? token)
  {
    if (string.IsNullOrWhiteSpace(token))
    {
      return null;
    }

    var parts = token.Split('.');
    if (parts.Length < 2)
    {
      return null;
    }

    try
    {
      var payloadBytes = Base64UrlDecode(parts[1]);
      using var doc = JsonDocument.Parse(payloadBytes);
      if (!doc.RootElement.TryGetProperty("exp", out var expElement))
      {
        return null;
      }

      long seconds;
      if (expElement.ValueKind == JsonValueKind.Number && expElement.TryGetInt64(out seconds))
      {
        return DateTimeOffset.FromUnixTimeSeconds(seconds);
      }

      if (expElement.ValueKind == JsonValueKind.String && long.TryParse(expElement.GetString(), out seconds))
      {
        return DateTimeOffset.FromUnixTimeSeconds(seconds);
      }

      return null;
    }
    catch
    {
      return null;
    }
  }

  private static byte[] Base64UrlDecode(string value)
  {
    var base64 = value.Replace('-', '+').Replace('_', '/');
    switch (base64.Length % 4)
    {
      case 2:
        base64 += "==";
        break;
      case 3:
        base64 += "=";
        break;
    }
    return Convert.FromBase64String(base64);
  }
}

sealed class AgentRuntimeState
{
  public bool CursorAwaySent { get; set; }
  public DateTimeOffset NextActivityPingAt { get; set; } = DateTimeOffset.UtcNow;
  public DateTimeOffset NextAwayCheckAt { get; set; } = DateTimeOffset.UtcNow;
  public bool SessionLocked { get; set; }
  public DateTimeOffset? LockStartedAt { get; set; }
  public bool LockAwaySent { get; set; }
  public bool PowerSuspended { get; set; }
  public DateTimeOffset? SuspendStartedAt { get; set; }
}

sealed class AgentOptions
{
  public string BaseUrl { get; init; } = "";
  public string Token { get; init; } = "";
  public string Email { get; init; } = "";
  public string Password { get; init; } = "";
  public bool CursorIdleEnabled { get; init; } = false;
  public int CursorIdleAwaySeconds { get; init; } = 10;
  public int ActivityPingSeconds { get; init; } = 60;
  public int PollSeconds { get; init; } = 10;
  public int LaptopSleepAwaySeconds { get; init; } = 10;
  public int TokenRefreshLeadMinutes { get; init; } = 15;
  public bool Verbose { get; init; } = true;

  public bool CanUseCredentialLogin =>
    !string.IsNullOrWhiteSpace(Email) && !string.IsNullOrWhiteSpace(Password);

  public bool HasValidConfiguration =>
    !string.IsNullOrWhiteSpace(BaseUrl) &&
    (!string.IsNullOrWhiteSpace(Token) || CanUseCredentialLogin);

  public static AgentOptions LoadFromEnvironment()
  {
    return new AgentOptions
    {
      BaseUrl = Environment.GetEnvironmentVariable("ATT_AGENT_BASE_URL") ?? "",
      Token = Environment.GetEnvironmentVariable("ATT_AGENT_TOKEN") ?? "",
      Email = Environment.GetEnvironmentVariable("ATT_AGENT_EMAIL") ?? "",
      Password = Environment.GetEnvironmentVariable("ATT_AGENT_PASSWORD") ?? "",
      CursorIdleEnabled = ParseBool("ATT_AGENT_CURSOR_IDLE_ENABLED", false),
      CursorIdleAwaySeconds = ParseInt("ATT_AGENT_CURSOR_IDLE_AWAY_SECONDS", 10),
      ActivityPingSeconds = ParseInt("ATT_AGENT_ACTIVITY_PING_SECONDS", 60),
      PollSeconds = ParseInt("ATT_AGENT_POLL_SECONDS", 10),
      LaptopSleepAwaySeconds = ParseInt("ATT_AGENT_LAPTOP_SLEEP_AWAY_SECONDS", 10),
      TokenRefreshLeadMinutes = ParseInt("ATT_AGENT_TOKEN_REFRESH_LEAD_MINUTES", 15),
      Verbose = ParseBool("ATT_AGENT_VERBOSE", true)
    };
  }

  private static int ParseInt(string key, int fallback)
  {
    var raw = Environment.GetEnvironmentVariable(key);
    return int.TryParse(raw, out var parsed) && parsed > 0 ? parsed : fallback;
  }

  private static bool ParseBool(string key, bool fallback)
  {
    var raw = Environment.GetEnvironmentVariable(key);
    if (string.IsNullOrWhiteSpace(raw))
    {
      return fallback;
    }
    return raw.Trim().Equals("true", StringComparison.OrdinalIgnoreCase) || raw == "1";
  }
}

static class WindowsIdle
{
  [StructLayout(LayoutKind.Sequential)]
  private struct LASTINPUTINFO
  {
    public uint cbSize;
    public uint dwTime;
  }

  [DllImport("user32.dll")]
  private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

  public static int GetIdleSeconds()
  {
    var info = new LASTINPUTINFO
    {
      cbSize = (uint)Marshal.SizeOf<LASTINPUTINFO>()
    };

    if (!GetLastInputInfo(ref info))
    {
      return 0;
    }

    var tickNow = Environment.TickCount;
    var idleMs = unchecked((uint)tickNow - info.dwTime);
    return (int)(idleMs / 1000);
  }
}

static class AgentLogger
{
  private static readonly object Sync = new();
  private static readonly string LogDirectory = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
    "AsbaTechs",
    "AttendanceAgent"
  );
  private static readonly string LogPath = Path.Combine(LogDirectory, "agent.log");

  public static void Write(string message)
  {
    var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}";
    Console.WriteLine(line);
    try
    {
      lock (Sync)
      {
        Directory.CreateDirectory(LogDirectory);
        File.AppendAllText(LogPath, line + Environment.NewLine);
      }
    }
    catch
    {
      // Avoid crashing the agent because of logging IO failures.
    }
  }
}
