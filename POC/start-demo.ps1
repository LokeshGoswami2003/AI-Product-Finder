$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Backend = Join-Path $Root "Backend"
$Frontend = Join-Path $Root "Frontend"
$ExpectedRelease = (Get-Content (Join-Path $Root "artifacts\current.json") -Raw | ConvertFrom-Json).releaseId

if (-not (Test-Path (Join-Path $Backend "node_modules")) -or
    -not (Test-Path (Join-Path $Frontend "node_modules"))) {
  Write-Host "Dependencies are missing; running first-time setup..."
  & (Join-Path $Root "setup.ps1")
  if ($LASTEXITCODE -ne 0) { throw "First-time setup failed." }
}

$backendProcess = $null
try {
  try {
    $existingBackend = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health/ready" -TimeoutSec 1
    throw "Port 3000 is already serving corpus $($existingBackend.corpusVersion). Stop that backend before starting this POC."
  } catch {
    if ($_.Exception.Message -like "Port 3000 is already serving corpus*") { throw }
  }
  try {
    Invoke-WebRequest -Uri "http://localhost:5173/" -TimeoutSec 1 -UseBasicParsing | Out-Null
    throw "Port 5173 is already in use. Stop that frontend before starting this POC."
  } catch {
    if ($_.Exception.Message -like "Port 5173 is already in use*") { throw }
  }

  Write-Host "Starting offline backend at http://127.0.0.1:3000 ..."
  $backendProcess = Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("--prefix", $Backend, "start") `
    -WorkingDirectory $Root -PassThru -NoNewWindow

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health/ready" -TimeoutSec 1
      if ($health.ready -and $health.corpusVersion -eq $ExpectedRelease) {
        $ready = $true
        break
      }
    } catch {
      # The backend may still be loading the local corpus.
    }
    if ($backendProcess.HasExited) {
      throw "Backend exited before becoming ready. Check whether port 3000 is available."
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) {
    throw "Backend did not become ready with corpus $ExpectedRelease."
  }

  Write-Host "Backend ready. Vite will open http://localhost:5173 when ready."
  Write-Host "Press Ctrl+C to stop the demo."
  & npm --prefix $Frontend run dev -- --open
} finally {
  if ($backendProcess -and -not $backendProcess.HasExited) {
    & taskkill.exe /PID $backendProcess.Id /T /F 2>$null | Out-Null
  }
}
