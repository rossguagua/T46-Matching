# PowerShell script to upload to GitHub
Write-Host "Starting GitHub upload process..." -ForegroundColor Green

# Check if git is available
try {
    $gitVersion = & git --version 2>&1
    Write-Host "Git version: $gitVersion" -ForegroundColor Cyan
} catch {
    Write-Host "Git not found or not responding" -ForegroundColor Red
    exit 1
}

# Configure remote
Write-Host "`nConfiguring remote repository..." -ForegroundColor Yellow
& git remote remove origin 2>$null
& git remote add origin https://github.com/rossguagua/T46-Matching.git

# Check remote
$remotes = & git remote -v
Write-Host "Remote configured: $remotes" -ForegroundColor Cyan

# Add all files
Write-Host "`nAdding all files..." -ForegroundColor Yellow
& git add -A

# Create commit
Write-Host "`nCreating commit..." -ForegroundColor Yellow
& git commit -m "feat: Initial upload of T46 Matching System - Intelligent grouping and validation platform"

# Push to GitHub
Write-Host "`nPushing to GitHub (this may take a moment)..." -ForegroundColor Yellow
& git push -u origin main --force

Write-Host "`nUpload complete!" -ForegroundColor Green
Write-Host "Repository: https://github.com/rossguagua/T46-Matching" -ForegroundColor Cyan