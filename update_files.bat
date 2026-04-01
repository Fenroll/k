@echo off
setlocal

echo Updating files submodule...
for /f "delims=" %%i in ('git config -f .gitmodules --get submodule.files.url 2^>nul') do set SUBMODULE_URL=%%i
if "%SUBMODULE_URL%"=="" (
	echo Could not read submodule URL from .gitmodules.
	pause
	exit /b 1
)

git submodule sync -- files
if %ERRORLEVEL% neq 0 (
	echo Could not sync submodule configuration.
	pause
	exit /b %ERRORLEVEL%
)

for /f "delims=" %%i in ('git -C files remote get-url origin 2^>nul') do set CURRENT_URL=%%i
if /I not "%CURRENT_URL%"=="%SUBMODULE_URL%" (
	echo Fixing files origin URL:
	echo   %CURRENT_URL%
	echo   -> %SUBMODULE_URL%
	git -C files remote set-url origin "%SUBMODULE_URL%"
	if %ERRORLEVEL% neq 0 (
		echo Could not set files origin URL.
		pause
		exit /b %ERRORLEVEL%
	)
)

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

git push origin HEAD:main
if %ERRORLEVEL% neq 0 (
	echo git push failed in files submodule.
	cd ..
	pause
	exit /b %ERRORLEVEL%
)

cd ..
echo Done!
pause