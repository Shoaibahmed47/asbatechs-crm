ASBA Attendance Desktop Agent
=============================

1) Build or get AttendanceAgent.exe from IT
2) Run install command in PowerShell (Admin):

.\install-agent-task.ps1 `
  -AgentExePath "C:\Path\To\AttendanceAgent.exe" `
  -BaseUrl "http://localhost:3000" `
  -Email "employee@company.com" `
  -Password "employee_login_password"

3) Verify:

.\verify-agent.ps1

Files in this folder:
- one-click-setup.ps1
- install-agent-task.ps1
- verify-agent.ps1
- uninstall-agent-task.ps1
