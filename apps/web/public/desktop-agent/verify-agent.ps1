param(
  [string]$TaskName = "ASBA Attendance Agent"
)

function Get-LatestAuthStatusFromLog {
  param([string[]]$Lines)

  $authLines = @(
    $Lines | Where-Object {
      $_ -match 'auth refreshed' -or
      $_ -match 'auth refresh failed' -or
      $_ -match 'Unable to initialize auth token'
    }
  )

  if ($authLines.Count -eq 0) {
    return 'unknown'
  }

  $last = $authLines[$authLines.Count - 1]
  if ($last -match 'auth refreshed') {
    return 'ok'
  }
  return 'failed'
}

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
  $tail = Get-Content -Path $logPath -Tail 15
  $tail | ForEach-Object { Write-Host $_ }

  $authStatus = Get-LatestAuthStatusFromLog -Lines $tail
  $hasRecentActivity = @($tail | Where-Object { $_ -match 'event=activity sent' }).Count -gt 0

  Write-Host ""
  if ($authStatus -eq 'ok') {
    Write-Host "Auth: OK (token refreshed)"
    if ($hasRecentActivity) {
      Write-Host "Heartbeat: OK (activity reaching server)"
      Write-Host "Next: Open Attendance page and click Verify Agent."
    }
  } elseif ($authStatus -eq 'failed') {
    Write-Host "Auth: FAILED - re-run install with correct CRM password, then Verify Agent on Attendance page."
  } else {
    Write-Host "Auth: waiting (agent just started - check again in 10 seconds)"
  }
} else {
  Write-Host "Log file not found yet: $logPath"
}
