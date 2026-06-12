param(
  [Parameter(Mandatory = $true)]
  [string]$AgentExePath,
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,
  [string]$Token = "",
  [string]$Email = "",
  [string]$Password = "",
  [string]$TaskName = "ASBA Attendance Agent",
  [int]$IdleWarningMinutes = 7,
  [int]$IdleStartMinutes = 10,
  [int]$ActivityPingSeconds = 60,
  [int]$PollSeconds = 10,
  [int]$TokenRefreshLeadMinutes = 15
)

$ErrorActionPreference = 'Stop'

function Escape-SingleQuoted([string]$value) {
  return ($value -replace "'", "''")
}

function Test-AtSessionUnlockSupported {
  $cmd = Get-Command New-ScheduledTaskTrigger -ErrorAction SilentlyContinue
  return ($null -ne $cmd) -and $cmd.Parameters.ContainsKey('AtSessionUnlock')
}

function New-AgentTaskTriggers {
  $triggers = @((New-ScheduledTaskTrigger -AtLogOn))
  if (Test-AtSessionUnlockSupported) {
    $triggers += New-ScheduledTaskTrigger -AtSessionUnlock
  }
  return $triggers
}

function Add-SessionUnlockTriggerFromXml {
  param([string]$TaskName)

  $existing = Export-ScheduledTask -TaskName $TaskName
  if ($existing -match '<StateChange>SessionUnlock</StateChange>') {
    return
  }

  if ($existing -notmatch '</Triggers>') {
    throw "Could not patch scheduled task XML (missing </Triggers>)."
  }

  $unlockXml = @'
    <SessionStateChangeTrigger>
      <Enabled>true</Enabled>
      <StateChange>SessionUnlock</StateChange>
    </SessionStateChangeTrigger>
'@

  $patched = $existing -replace '</Triggers>', ($unlockXml + '</Triggers>')
  Register-ScheduledTask -TaskName $TaskName -Xml $patched -Force | Out-Null
  Write-Host "Added SessionUnlock trigger (XML fallback for this PowerShell version)."
}

function Prepare-AgentConfigWriteAccess {
  param(
    [string]$ConfigPath,
    [string]$WorkDir
  )

  New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null

  try {
    icacls $WorkDir /grant "${env:USERNAME}:(OI)(CI)M" "Administrators:(OI)(CI)F" "SYSTEM:(OI)(CI)M" /T /C 2>$null | Out-Null
  } catch {
    Write-Warning "Could not update ACL on setup folder."
  }

  if (-not (Test-Path -LiteralPath $ConfigPath)) {
    return
  }

  attrib -R $ConfigPath 2>$null | Out-Null
  try {
    icacls $ConfigPath /grant "${env:USERNAME}:(M)" "Administrators:(F)" "SYSTEM:(M)" /C 2>$null | Out-Null
  } catch {
    # Continue and try delete.
  }

  try {
    Remove-Item -LiteralPath $ConfigPath -Force -ErrorAction Stop
  } catch {
    cmd /c "takeown /f `"$ConfigPath`" /a" 2>$null | Out-Null
    icacls $ConfigPath /grant "Administrators:(F)" /C 2>$null | Out-Null
    Remove-Item -LiteralPath $ConfigPath -Force
  }
}

function Lock-AgentConfigFile {
  param([string]$ConfigPath)

  try {
    icacls $ConfigPath /inheritance:r /grant:r "${env:USERNAME}:(R)" "SYSTEM:(R)" "Administrators:(F)" /C 2>$null | Out-Null
  } catch {
    Write-Warning "Could not restrict ACL on agent config file."
  }
}

function Write-AgentConfigFile {
  param(
    [string]$ConfigPath,
    [string]$WorkDir,
    [string]$BaseUrl,
    [string]$Token,
    [string]$Email,
    [string]$Password,
    [int]$IdleWarningMinutes,
    [int]$IdleStartMinutes,
    [int]$ActivityPingSeconds,
    [int]$PollSeconds,
    [int]$TokenRefreshLeadMinutes
  )

  Prepare-AgentConfigWriteAccess -ConfigPath $ConfigPath -WorkDir $WorkDir

  $lines = @(
    "`$env:ATT_AGENT_BASE_URL = '$((Escape-SingleQuoted $BaseUrl))'"
    "`$env:ATT_AGENT_IDLE_WARNING_MINUTES = '$IdleWarningMinutes'"
    "`$env:ATT_AGENT_IDLE_START_MINUTES = '$IdleStartMinutes'"
    "`$env:ATT_AGENT_ACTIVITY_PING_SECONDS = '$ActivityPingSeconds'"
    "`$env:ATT_AGENT_POLL_SECONDS = '$PollSeconds'"
    "`$env:ATT_AGENT_TOKEN_REFRESH_LEAD_MINUTES = '$TokenRefreshLeadMinutes'"
    "`$env:ATT_AGENT_CURSOR_IDLE_ENABLED = 'false'"
  )

  if (-not [string]::IsNullOrWhiteSpace($Token)) {
    $lines += "`$env:ATT_AGENT_TOKEN = '$((Escape-SingleQuoted $Token))'"
  }
  if (-not [string]::IsNullOrWhiteSpace($Email)) {
    $lines += "`$env:ATT_AGENT_EMAIL = '$((Escape-SingleQuoted $Email))'"
  }
  if (-not [string]::IsNullOrWhiteSpace($Password)) {
    $lines += "`$env:ATT_AGENT_PASSWORD = '$((Escape-SingleQuoted $Password))'"
  }

  Set-Content -Path $ConfigPath -Value ($lines -join [Environment]::NewLine) -Encoding UTF8
  Lock-AgentConfigFile -ConfigPath $ConfigPath
}

$resolvedExe = (Resolve-Path -LiteralPath $AgentExePath).Path
$workDir = Split-Path -Path $resolvedExe -Parent

$hasToken = -not [string]::IsNullOrWhiteSpace($Token)
$hasCreds = (-not [string]::IsNullOrWhiteSpace($Email)) -and (-not [string]::IsNullOrWhiteSpace($Password))
if (-not $hasToken -and -not $hasCreds) {
  throw "Provide either -Token OR (-Email and -Password)."
}

$launcherPath = Join-Path $workDir "start-agent.ps1"
$configPath = Join-Path $workDir "agent-config.ps1"
if (-not (Test-Path -LiteralPath $launcherPath)) {
  throw "start-agent.ps1 not found in $workDir. Re-run one-click setup to download it."
}

Write-AgentConfigFile `
  -ConfigPath $configPath `
  -WorkDir $workDir `
  -BaseUrl $BaseUrl.TrimEnd('/') `
  -Token $Token `
  -Email $Email `
  -Password $Password `
  -IdleWarningMinutes $IdleWarningMinutes `
  -IdleStartMinutes $IdleStartMinutes `
  -ActivityPingSeconds $ActivityPingSeconds `
  -PollSeconds $PollSeconds `
  -TokenRefreshLeadMinutes $TokenRefreshLeadMinutes

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`"" -WorkingDirectory $workDir
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$description = "ASBA attendance desktop agent (per-user logon + unlock task)."

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$triggers = New-AgentTaskTriggers
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Settings $settings -Description $description -Force | Out-Null

if (-not (Test-AtSessionUnlockSupported)) {
  try {
    Add-SessionUnlockTriggerFromXml -TaskName $TaskName
  } catch {
    Write-Warning "Session unlock trigger not added (logon trigger still active): $_"
  }
}

Get-Process AttendanceAgent -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName $TaskName

$started = $false
for ($i = 0; $i -lt 10; $i++) {
  Start-Sleep -Seconds 1
  if (Get-Process AttendanceAgent -ErrorAction SilentlyContinue) {
    $started = $true
    break
  }
}

Write-Host "Installed scheduled task: $TaskName"
Write-Host "Agent path: $resolvedExe"
if ($hasCreds) {
  Write-Host "Auth mode: auto login (email/password with auto token refresh)"
} elseif ($hasToken) {
  Write-Host "Auth mode: static token"
}

if (-not $started) {
  Write-Warning "Scheduled task started but AttendanceAgent.exe is not running yet. Check agent.log after a few seconds."
}
