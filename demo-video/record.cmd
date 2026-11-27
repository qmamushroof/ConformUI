@echo off
rem Re-records beats 2-7 from the live app with your real Chrome + the on-device model, then cuts takes and rebuilds the video.
rem Needs: Node + Playwright (NODE_PATH points at the app repo's node_modules), the copied model profile (node scripts\setup-profile.cjs once).
setlocal
set NODE_PATH=C:\Users\SN-LP-64\source\repos\qmamushroof\ConformUI\node_modules
set PY=C:\Users\SN-LP-64\AppData\Local\Temp\claude\578072ca28f862b2\e23ea498-7ab9-447e-8d16-5b497e220614\scratchpad\tts\venv\Scripts\python.exe
if not exist "%PY%" set PY=python
powershell -NoProfile -File "%~dp0scripts\kill-chrome.ps1"
node "%~dp0scripts\rec.cjs" --cloud || exit /b 1
"%PY%" "%~dp0scripts\cut.py" || exit /b 1
"%PY%" "%~dp0scripts\build.py" --frames
