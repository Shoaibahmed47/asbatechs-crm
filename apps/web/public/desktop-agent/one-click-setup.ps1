param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,
  [string]$AgentExeUrl = "",
  [string]$AgentExePath = "",
  [string]$Email = "",
  [string]$Password = "",
  [string]$Token = "",
  [string]$TaskName = "ASBA Attendance Agent"
)

function Test-IsAdmin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Escape-Arg([string]$value) {
  return '"' + ($value -replace '"', '\"') + '"'
}

if (-not (Test-IsAdmin)) {
  Write-Host "Re-launching as Administrator..."
  $argList = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", (Escape-Arg $PSCommandPath),
    "-BaseUrl", (Escape-Arg $BaseUrl)
  )
  if ($AgentExeUrl) { $argList += @("-AgentExeUrl", (Escape-Arg $AgentExeUrl)) }
  if ($AgentExePath) { $argList += @("-AgentExePath", (Escape-Arg $AgentExePath)) }
  if ($Email) { $argList += @("-Email", (Escape-Arg $Email)) }
  if ($Password) { $argList += @("-Password", (Escape-Arg $Password)) }
  if ($Token) { $argList += @("-Token", (Escape-Arg $Token)) }
  if ($TaskName) { $argList += @("-TaskName", (Escape-Arg $TaskName)) }
  Start-Process powershell.exe -Verb RunAs -ArgumentList ($argList -join " ")
  exit
}

$normalizedBaseUrl = $BaseUrl.TrimEnd("/")
$setupDir = Join-Path $env:ProgramData "AsbaTechs\AttendanceAgent\setup"
New-Item -ItemType Directory -Path $setupDir -Force | Out-Null

$installScriptPath = Join-Path $setupDir "install-agent-task.ps1"
$verifyScriptPath = Join-Path $setupDir "verify-agent.ps1"
$uninstallScriptPath = Join-Path $setupDir "uninstall-agent-task.ps1"
$launcherScriptPath = Join-Path $setupDir "start-agent.ps1"

Write-Host "Downloading setup scripts..."
Invoke-WebRequest -UseBasicParsing -Uri "$normalizedBaseUrl/desktop-agent/install-agent-task.ps1" -OutFile $installScriptPath
Invoke-WebRequest -UseBasicParsing -Uri "$normalizedBaseUrl/desktop-agent/start-agent.ps1" -OutFile $launcherScriptPath
Invoke-WebRequest -UseBasicParsing -Uri "$normalizedBaseUrl/desktop-agent/verify-agent.ps1" -OutFile $verifyScriptPath
Invoke-WebRequest -UseBasicParsing -Uri "$normalizedBaseUrl/desktop-agent/uninstall-agent-task.ps1" -OutFile $uninstallScriptPath

# Default agent download URL (no manual typing needed for most users).
if (-not $AgentExeUrl) {
  $AgentExeUrl = "$normalizedBaseUrl/desktop-agent/AttendanceAgent.exe"
}

if (-not $AgentExePath -and $AgentExeUrl) {
  $AgentExePath = Join-Path $setupDir "AttendanceAgent.exe"
  Write-Host "Downloading AttendanceAgent.exe..."
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $AgentExeUrl -OutFile $AgentExePath
  } catch {
    Write-Warning "Could not download AttendanceAgent.exe from URL: $AgentExeUrl"
    Write-Warning "You can still continue by entering local path manually."
    $AgentExePath = ""
  }
}

if (-not $AgentExePath) {
  $AgentExePath = Read-Host "Enter local path to AttendanceAgent.exe"
}

if (-not (Test-Path -LiteralPath $AgentExePath)) {
  throw "AttendanceAgent.exe not found at path: $AgentExePath"
}

if (-not $Email -and -not $Token) {
  $Email = Read-Host "Employee email"
}
if (-not $Password -and -not $Token) {
  $Password = Read-Host "Employee password"
}

$args = @(
  "-AgentExePath", $AgentExePath,
  "-BaseUrl", $normalizedBaseUrl,
  "-TaskName", $TaskName
)
if ($Token) {
  $args += @("-Token", $Token)
} else {
  $args += @("-Email", $Email, "-Password", $Password)
}

Write-Host "Installing scheduled task..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installScriptPath @args
if ($LASTEXITCODE -ne 0) {
  throw "Scheduled task install failed (exit code $LASTEXITCODE). See errors above."
}

Write-Host "Verifying..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $verifyScriptPath -TaskName $TaskName
if ($LASTEXITCODE -ne 0) {
  Write-Warning "Verify script reported an issue. Re-download verify-agent.ps1 or click Verify Agent on the Attendance page."
}

Write-Host "One-click setup complete."
