param([switch]$SkipInstall,[switch]$Reinstall)
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
foreach ($port in @(5088,5178)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.OwningProcess -gt 0}) { throw "Port $port is already in use. Stop the existing StockFlow processes before starting another copy." }
}
$localDir=Join-Path $PSScriptRoot '.local'
New-Item -ItemType Directory -Force $localDir | Out-Null
$secretFile=Join-Path $localDir 'settings.json'
if (!(Test-Path -LiteralPath $secretFile)) {
    $dbPassword=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
    $initialPassword='Sf!'+[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(12))+'a9'
    @{databasePassword=$dbPassword;initialPassword=$initialPassword} | ConvertTo-Json | Set-Content -LiteralPath $secretFile
}
$settings=Get-Content -LiteralPath $secretFile -Raw | ConvertFrom-Json
$env:STOCKFLOW_DB_PASSWORD=$settings.databasePassword
docker compose up -d --wait
if ($LASTEXITCODE -ne 0) {throw 'Database could not start. Check Docker Desktop and whether port 55432 is already in use.'}
if (!$SkipInstall) {
    $env:NODE_USE_SYSTEM_CA='1'
    dotnet tool restore
    if ($LASTEXITCODE -ne 0) {throw 'EF tools could not be restored.'}
    dotnet restore backend
    if ($LASTEXITCODE -ne 0) {throw 'Backend dependencies could not be restored.'}
    $lockHash=(Get-FileHash 'frontend/package-lock.json' -Algorithm SHA256).Hash
    $installMarker=Join-Path $localDir 'frontend-lock.sha256'
    $installedHash=if (Test-Path -LiteralPath $installMarker) {(Get-Content -LiteralPath $installMarker -Raw).Trim()} else {''}
    if ($Reinstall -or !(Test-Path 'frontend/node_modules/.package-lock.json') -or $installedHash -ne $lockHash) {
        # Release binaries from an orphaned development server before npm replaces them.
        & (Join-Path $PSScriptRoot 'Stop.ps1')
        npm ci --prefix frontend
        if ($LASTEXITCODE -ne 0) {throw 'Frontend installation failed. Run .\Stop.ps1, then retry .\Start.ps1. A running editor task or antivirus may be holding a frontend file.'}
        Set-Content -LiteralPath $installMarker -Value $lockHash
    } else { Write-Host 'Frontend dependencies are already up to date.' }
}
$env:ASPNETCORE_ENVIRONMENT='Development'
$env:ASPNETCORE_URLS='http://127.0.0.1:5088'
$env:ConnectionStrings__Database="Host=127.0.0.1;Port=55432;Database=stockflow;Username=stockflow;Password=$($settings.databasePassword)"
$env:Seed__Password=$settings.initialPassword
$env:Seed__Demo='true'
$apiProcess=Start-Process dotnet -ArgumentList @('run','--project','backend','--no-launch-profile') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "$localDir/api.log" -RedirectStandardError "$localDir/api-error.log"
$npmPath=(Get-Command npm.cmd).Source
$webProcess=Start-Process $npmPath -ArgumentList @('run','dev','--prefix','frontend') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "$localDir/web.log" -RedirectStandardError "$localDir/web-error.log"
@{api=$apiProcess.Id;web=$webProcess.Id} | ConvertTo-Json | Set-Content "$localDir/processes.json"
$ready=$false
for ($attempt=0;$attempt -lt 40;$attempt++) {
    try {
        $apiReady=Invoke-WebRequest 'http://127.0.0.1:5088/health' -TimeoutSec 1 -UseBasicParsing
        $webReady=Invoke-WebRequest 'http://127.0.0.1:5178' -TimeoutSec 1 -UseBasicParsing
        if ($apiReady.StatusCode -eq 200 -and $webReady.StatusCode -eq 200) {$ready=$true;break}
    } catch {}
    Start-Sleep -Milliseconds 500
}
if (!$ready) {throw 'StockFlow did not become ready. Check .local/api-error.log and .local/web-error.log, then run Stop.ps1 before retrying.'}
Write-Host 'StockFlow: http://127.0.0.1:5178'
Write-Host 'Swagger: http://127.0.0.1:5088/swagger'
Write-Host 'Accounts: admin@stockflow.local, sales@stockflow.local, inventory@stockflow.local'
Write-Host "Initial password: $($settings.initialPassword)"
Write-Host 'First startup applies migrations and creates the demonstration records. See .local logs if startup fails.'
