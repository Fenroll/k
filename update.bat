@echo off
setlocal

echo Generating courses...
node generate_courses.js
if %ERRORLEVEL% neq 0 (
    echo Error during course generation. Aborting.
    pause
    exit /b %ERRORLEVEL%
)

echo Adding changes...
if exist NUL (
    del /f /q "\\?\%CD%\NUL" >nul 2>nul
)
if exist files\NUL (
    del /f /q "\\?\%CD%\files\NUL" >nul 2>nul
)

git add -A -- . ":(exclude)files"
if %ERRORLEVEL% neq 0 (
    echo Error during git add. Aborting.
    pause
    exit /b %ERRORLEVEL%
)

git diff --cached --quiet
if %ERRORLEVEL% equ 0 (
    echo No staged changes to commit.
    echo Done!
    pause
    exit /b 0
)

echo Committing...
git commit -m "update"
if %ERRORLEVEL% neq 0 (
    echo Error during git commit. Aborting.
    pause
    exit /b %ERRORLEVEL%
)

echo Pushing...
git push
if %ERRORLEVEL% neq 0 (
    echo Error during git push.
    pause
    exit /b %ERRORLEVEL%
)

echo Done!
pause