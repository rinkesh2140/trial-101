@echo off
echo.
echo  Copying latest files to deploy folder...
copy /Y "f:\RINKESH_CLAUDE\supervisor.html" "f:\RINKESH_CLAUDE\deploy\supervisor.html"
copy /Y "f:\RINKESH_CLAUDE\supervisor.css"  "f:\RINKESH_CLAUDE\deploy\supervisor.css"
copy /Y "f:\RINKESH_CLAUDE\supervisor.js"   "f:\RINKESH_CLAUDE\deploy\supervisor.js"
copy /Y "f:\RINKESH_CLAUDE\index.html" "f:\RINKESH_CLAUDE\deploy\labour.html"
echo  Done copying.
echo.
echo  Deploying to Firebase...
cd /d f:\RINKESH_CLAUDE\deploy
firebase deploy --only hosting
echo.
echo  Deploy complete!
pause
