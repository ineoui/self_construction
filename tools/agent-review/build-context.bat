@echo off
setlocal
set "APP_DIR=%~dp0"
pushd "%APP_DIR%..\.."
python ".\tools\agent-review\build_context.py" --days 7 --clipboard --open
popd
endlocal
