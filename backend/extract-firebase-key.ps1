# Script to extract Firebase private key from JSON and format it for .env file

$jsonPath = "config/firebase-service-account.json.json"

if (-not (Test-Path $jsonPath)) {
    Write-Host "Error: $jsonPath not found!" -ForegroundColor Red
    exit 1
}

# Read JSON as raw text to preserve \n characters
$jsonContent = Get-Content $jsonPath -Raw
$json = $jsonContent | ConvertFrom-Json

# Get the private key - it may have actual newlines or \n characters
# We need to ensure it's on one line with \n for .env file
$key = $json.private_key

# If the key has actual newlines (from JSON parsing), replace them with \n
# If it already has \n, keep them
# Use single backslash, not double (PowerShell will escape it correctly in the output)
$key = $key -replace "`r?`n", "\n"

Write-Host "`nCopy this line to your .env file (it should be on ONE line):`n" -ForegroundColor Green
Write-Host "FIREBASE_PRIVATE_KEY=`"$key`"" -ForegroundColor Yellow
Write-Host "`nAlso make sure you have:`n" -ForegroundColor Green
Write-Host "FIREBASE_PROJECT_ID=$($json.project_id)" -ForegroundColor Yellow
Write-Host "FIREBASE_CLIENT_EMAIL=$($json.client_email)" -ForegroundColor Yellow
Write-Host "`nNote: The key above should be on a SINGLE line in your .env file!`n" -ForegroundColor Cyan
