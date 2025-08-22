@echo off
echo Setting up GitHub repository...

REM Add remote if not exists
git remote add origin https://github.com/rossguagua/T46-Matching.git 2>nul
if %errorlevel% neq 0 (
    echo Remote already exists, setting URL...
    git remote set-url origin https://github.com/rossguagua/T46-Matching.git
)

echo.
echo Adding all files...
git add .

echo.
echo Creating commit...
git commit -m "Initial commit: T46 Matching System - Intelligent grouping and validation system"

echo.
echo Pushing to GitHub...
git push -u origin main

echo.
echo Done! Your project has been uploaded to GitHub.
pause