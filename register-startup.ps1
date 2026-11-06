# Register TeamManagementSystem to run at Windows startup via Task Scheduler
# Run this script once as Administrator

$taskName = "TeamManagementSystem"
$scriptPath = Join-Path $PSScriptRoot "start-app.bat"

# Remove existing task if present
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Removed existing task: $taskName"
}

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$scriptPath`""

# Trigger: At logon of current user
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Auto-start Team Management System (server + client) on login" `
    -RunLevel Highest

Write-Host ""
Write-Host "Task '$taskName' registered successfully." -ForegroundColor Green
Write-Host "The app will start automatically when you log in to Windows."
