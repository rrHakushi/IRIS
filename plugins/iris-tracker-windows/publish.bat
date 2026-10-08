@echo off
setlocal
echo ========================================================
echo   Publishing Iris extra (Self-Contained Single-File EXE)
echo ========================================================

cd /d "%~dp0"

dotnet publish IrisTracker.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o publish

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo   BUILD SUCCESSFUL!
    echo   Standalone executable created at:
    echo   %~dp0publish\IrisExtra.exe
    echo ========================================================
) else (
    echo.
    echo [ERROR] Build failed with exit code %ERRORLEVEL%.
)

endlocal
