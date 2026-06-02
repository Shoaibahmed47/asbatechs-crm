param(
  [string]$TaskName = "ASBA Attendance Agent"
)

Write-Host "=== Scheduled Task ==="
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  $info = Get-ScheduledTaskInfo -TaskName $TaskName
  Write-Host "Task Name   : $TaskName"
  Write-Host "Task State  : $($task.State)"
  Write-Host "Last Run    : $($info.LastRunTime)"
  Write-Host "Last Result : $($info.LastTaskResult)"
  Write-Host "Next Run    : $($info.NextRunTime)"
} else {
  Write-Host "Task not found: $TaskName"
}

Write-Host ""
Write-Host "=== Process ==="
$proc = Get-Process AttendanceAgent -ErrorAction SilentlyContinue
if ($proc) {
  $proc | Select-Object Id, ProcessName, StartTime | Format-Table -AutoSize
} else {
  Write-Host "AttendanceAgent process is not running."
}

$logPath = Join-Path $env:ProgramData "AsbaTechs\AttendanceAgent\agent.log"
Write-Host ""
Write-Host "=== Log File ==="
if (Test-Path $logPath) {
  Write-Host "Log path: $logPath"
  Get-Content -Path $logPath -Tail 20
} else {
  Write-Host "Log file not found yet: $logPath"
}
