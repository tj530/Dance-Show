@echo off
:: Requires Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator.
    pause
    exit /b 1
)

set /p USERNAME="Enter the username for auto-logon: "
set /p DOMAIN="Enter the domain (leave blank for local account): "
set /p PASSWORD="Enter the password: "

set REG_PATH=HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon

reg add "%REG_PATH%" /v AutoAdminLogon    /t REG_SZ /d "1"         /f
reg add "%REG_PATH%" /v DefaultUserName   /t REG_SZ /d "%USERNAME%" /f
reg add "%REG_PATH%" /v DefaultPassword   /t REG_SZ /d "%PASSWORD%" /f

if "%DOMAIN%"=="" (
    reg delete "%REG_PATH%" /v DefaultDomainName /f >nul 2>&1
) else (
    reg add "%REG_PATH%" /v DefaultDomainName /t REG_SZ /d "%DOMAIN%" /f
)

echo.
echo Auto-logon enabled for user: %USERNAME%
echo Reboot the machine for changes to take effect.
echo WARNING: The password is stored in plaintext in the registry.
echo          Do not use this on shared or sensitive systems.
pause
