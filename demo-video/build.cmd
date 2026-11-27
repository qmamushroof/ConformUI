@echo off
rem Rebuilds out\conformui-demo.mp4 + out\captions.srt from the current takes, cues and voice-over (about 3 minutes).
rem Re-rendered voice-over wavs in voiceover\ are picked up automatically.
setlocal
set PY=C:\Users\SN-LP-64\AppData\Local\Temp\claude\578072ca28f862b2\e23ea498-7ab9-447e-8d16-5b497e220614\scratchpad\tts\venv\Scripts\python.exe
if not exist "%PY%" set PY=python
"%PY%" "%~dp0scripts\build.py" %*
