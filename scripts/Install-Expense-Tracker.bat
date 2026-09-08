@echo off
setlocal EnableDelayedExpansion

:: =========================================================================
:: Expense Tracker - 1-Click Desktop Installer for Windows
:: =========================================================================

:: EDIT THIS URL to match your deployed web app address (e.g. Vercel / Netlify URL)
set "APP_URL=https://your-expense-tracker.vercel.app"

set "SHORTCUT_NAME=Expense Tracker"
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "SHORTCUT_PATH=%DESKTOP_DIR%\%SHORTCUT_NAME%.lnk"

echo.
echo ==========================================================
echo          Installing %SHORTCUT_NAME% on Windows
echo ==========================================================
echo.

:: Detect browser executable (prefer Microsoft Edge, then Chrome)
set "TARGET_EXE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set "TARGET_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set "TARGET_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "TARGET_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "TARGET_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
)

if not defined TARGET_EXE (
    echo [!] Defaulting to system msedge command...
    set "TARGET_EXE=msedge.exe"
)

echo [*] Target URL: %APP_URL%
echo [*] Creating Desktop Shortcut...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$s = $ws.CreateShortcut('%SHORTCUT_PATH%'); " ^
    "$s.TargetPath = '%TARGET_EXE%'; " ^
    "$s.Arguments = '--app=%APP_URL%'; " ^
    "$s.Description = 'Expense Tracker App'; " ^
    "$s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo.
    echo ==========================================================
    echo  SUCCESS: %SHORTCUT_NAME% shortcut created on your Desktop!
    echo ==========================================================
    echo.
    echo You can now double-click "%SHORTCUT_NAME%" on your desktop
    echo to open the app directly.
) else (
    echo.
    echo [ERROR] Could not automatically create shortcut.
    echo Please open Microsoft Edge and visit: %APP_URL%
)

echo.
pause
