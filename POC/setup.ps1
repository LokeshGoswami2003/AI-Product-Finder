$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 20.6 or newer is required."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm is required."
}

$VersionText = (& node --version).TrimStart("v")
$NodeMajor = [int]($VersionText.Split(".")[0])
if ($NodeMajor -lt 20) {
  throw "Node.js 20.6 or newer is required; found $VersionText."
}

Write-Host "Installing backend dependencies..."
& npm --prefix (Join-Path $Root "Backend") ci
if ($LASTEXITCODE -ne 0) { throw "Backend dependency installation failed." }

Write-Host "Installing frontend dependencies..."
& npm --prefix (Join-Path $Root "Frontend") ci
if ($LASTEXITCODE -ne 0) { throw "Frontend dependency installation failed." }

Write-Host "Verifying the offline corpus and chat protocol..."
& npm --prefix (Join-Path $Root "Backend") run smoke
if ($LASTEXITCODE -ne 0) { throw "Offline smoke test failed." }

Write-Host "POC setup complete. Run .\start-demo.ps1"
