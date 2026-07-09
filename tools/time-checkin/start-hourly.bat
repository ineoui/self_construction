@echo off
setlocal
set "APP_DIR=%~dp0"
where pythonw.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  start "" pythonw.exe "%APP_DIR%checkin.py" --interval 60
) else (
  start "" python.exe "%APP_DIR%checkin.py" --interval 60
)
endlocal
