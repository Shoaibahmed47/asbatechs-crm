$ErrorActionPreference = 'Stop'

$setupDir = $PSScriptRoot
$configPath = Join-Path $setupDir "agent-config.ps1"
$agentExe = Join-Path $setupDir "AttendanceAgent.exe"

if (-not (Test-Path -LiteralPath $configPath)) {
  Write-Error "Agent config not found: $configPath"
  exit 1
}

if (-not (Test-Path -LiteralPath $agentExe)) {
  Write-Error "AttendanceAgent.exe not found: $agentExe"
  exit 1
}

. $configPath
& $agentExe
exit $LASTEXITCODE
