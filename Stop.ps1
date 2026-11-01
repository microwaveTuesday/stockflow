$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
if (Test-Path '.local/processes.json') {
    $running=Get-Content '.local/processes.json' -Raw | ConvertFrom-Json
    foreach ($processId in @($running.api,$running.web)) {
        $process=Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
        if ($process -and $process.CommandLine -match 'dotnet.+run.+backend|npm.+run.+dev.+frontend') { taskkill /PID $processId /T /F | Out-Null }
    }
}
# A terminal can exit while Vite/esbuild remains running. Match this checkout only.
$projectPrefix=[IO.Path]::GetFullPath($PSScriptRoot)+[IO.Path]::DirectorySeparatorChar
Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -in @('node.exe','esbuild.exe','StockFlow.Api.exe')) -and
    (($_.ExecutablePath -and $_.ExecutablePath.StartsWith($projectPrefix,[StringComparison]::OrdinalIgnoreCase)) -or
     ($_.CommandLine -and $_.CommandLine.IndexOf($projectPrefix,[StringComparison]::OrdinalIgnoreCase) -ge 0))
} | ForEach-Object { taskkill /PID $_.ProcessId /T /F 2>$null | Out-Null }
Write-Host 'StockFlow app processes stopped. Database kept running to preserve your work. Use docker compose stop to stop it.'
