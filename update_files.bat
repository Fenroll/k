@echo off
echo Updating files submodule...
cd files
git add .
git commit -m "update"
git push
cd ..
echo Done!
pause