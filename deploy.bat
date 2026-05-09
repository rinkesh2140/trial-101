@echo off
echo.
echo  Copying latest files to deploy folder...

if not exist "d:\trial-101\deploy" mkdir "d:\trial-101\deploy"

copy /Y "d:\trial-101\supervisor.html" "d:\trial-101\deploy\supervisor.html"
copy /Y "d:\trial-101\supervisor.css"  "d:\trial-101\deploy\supervisor.css"
copy /Y "d:\trial-101\supervisor.js"   "d:\trial-101\deploy\supervisor.js"
copy /Y "d:\trial-101\index.html"      "d:\trial-101\deploy\index.html"
copy /Y "d:\trial-101\worker.html"     "d:\trial-101\deploy\worker.html"
copy /Y "d:\trial-101\open-app.html"   "d:\trial-101\deploy\open-app.html"
copy /Y "d:\trial-101\manifest.json"   "d:\trial-101\deploy\manifest.json"

echo  Done copying.
echo.
echo  Deploying to Firebase...
cd /d "d:\trial-101\deploy"
firebase deploy --only hosting
echo.
echo  Deploy complete!
pause
