@echo off
echo Generating courses...
node generate_courses.js
if %ERRORLEVEL% neq 0 (
    echo Error during course generation. Aborting.
    pause
    exit /b %ERRORLEVEL%
)

echo Adding changes...
git add .

echo Committing...
git commit -m "update"

echo Pushing...
git push

echo Done!
pause