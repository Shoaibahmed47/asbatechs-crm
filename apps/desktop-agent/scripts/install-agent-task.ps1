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

$resolvedExe = (Resolve-Path -LiteralPath $AgentExePath).Path
$workDir = Split-Path -Path $resolvedExe -Parent

function Escape-SingleQuoted([string]$value) {
  return ($value -replace "'", "''")
}

$hasToken = -not [string]::IsNullOrWhiteSpace($Token)
$hasCreds = (-not [string]::IsNullOrWhiteSpace($Email)) -and (-not [string]::IsNullOrWhiteSpace($Password))
if (-not $hasToken -and -not $hasCreds) {
  throw "Provide either -Token OR (-Email and -Password)."
}

$baseUrlEsc = Escape-SingleQuoted $BaseUrl
$tokenEsc = Escape-SingleQuoted $Token
$emailEsc = Escape-SingleQuoted $Email
$passwordEsc = Escape-SingleQuoted $Password
$exeEsc = Escape-SingleQuoted $resolvedExe

$cmdParts = @(
  "`$env:ATT_AGENT_BASE_URL='$baseUrlEsc';",
  "`$env:ATT_AGENT_IDLE_WARNING_MINUTES='$IdleWarningMinutes';",
  "`$env:ATT_AGENT_IDLE_START_MINUTES='$IdleStartMinutes';",
  "`$env:ATT_AGENT_ACTIVITY_PING_SECONDS='$ActivityPingSeconds';",
  "`$env:ATT_AGENT_POLL_SECONDS='$PollSeconds';",
  "`$env:ATT_AGENT_TOKEN_REFRESH_LEAD_MINUTES='$TokenRefreshLeadMinutes';"
)
if ($hasToken) {
  $cmdParts += "`$env:ATT_AGENT_TOKEN='$tokenEsc';"
}
if ($hasCreds) {
  $cmdParts += "`$env:ATT_AGENT_EMAIL='$emailEsc';"
  $cmdParts += "`$env:ATT_AGENT_PASSWORD='$passwordEsc';"
}
$cmdParts += "& '$exeEsc'"
$cmd = $cmdParts -join " "

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command $cmd" -WorkingDirectory $workDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "ASBA attendance desktop agent (per-user logon task)." -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "Installed scheduled task: $TaskName"
Write-Host "Agent path: $resolvedExe"
if ($hasCreds) {
  Write-Host "Auth mode: auto login (email/password with auto token refresh)"
} elseif ($hasToken) {
  Write-Host "Auth mode: static token"
}
