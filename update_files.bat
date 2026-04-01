@echo off
setlocal

echo Updating files submodule...
cd files
if %ERRORLEVEL% neq 0 (
	echo Could not enter files submodule.
	pause
	exit /b %ERRORLEVEL%
)

git add .
if %ERRORLEVEL% neq 0 (
	echo git add failed in files submodule.
	cd ..
	pause
	exit /b %ERRORLEVEL%
)

git diff --cached --quiet
if %ERRORLEVEL% equ 0 (
	echo No staged changes in files submodule.
	cd ..
	echo Done!
	pause
	exit /b 0
)

git commit -m "update"
if %ERRORLEVEL% neq 0 (
	echo git commit failed in files submodule.
	cd ..
	pause
	exit /b %ERRORLEVEL%
)

git push
if %ERRORLEVEL% neq 0 (
	echo git push failed in files submodule.
	cd ..
	pause
	exit /b %ERRORLEVEL%
)

cd ..
echo Done!
pause