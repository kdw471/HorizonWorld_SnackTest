@echo off
REM Build HzScriptMigratorGui.exe with the C# compiler bundled in Windows (.NET Framework 4.x). No SDK install needed.
setlocal
cd /d "%~dp0"
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" set CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
if not exist dist mkdir dist
"%CSC%" /nologo /target:winexe /optimize+ /platform:anycpu /out:dist\HzScriptMigratorGui.exe ^
  /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Web.Extensions.dll ^
  HzScriptMigratorGui.cs
if errorlevel 1 (
  echo.
  echo BUILD FAILED
  exit /b 1
)
echo.
echo BUILD OK: %~dp0dist\HzScriptMigratorGui.exe
if not exist "%USERPROFILE%\Documents\HorizonTools" mkdir "%USERPROFILE%\Documents\HorizonTools"
copy /y dist\HzScriptMigratorGui.exe "%USERPROFILE%\Documents\HorizonTools\" >nul && echo COPIED TO: %USERPROFILE%\Documents\HorizonTools\HzScriptMigratorGui.exe
endlocal