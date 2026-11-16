@echo off
chcp 65001 >nul
rem Tạo 2 lối tắt trên Desktop: "Tròn Party" và "Phòng tập não bộ" (mở thẳng app luyện não).
rem Chạy lại file này nếu chép thư mục TronParty sang chỗ khác.
set "EXE=%~dp0TronParty.exe"
if not exist "%EXE%" (
  echo Không thấy TronParty.exe cạnh file này.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$w = New-Object -ComObject WScript.Shell; $d = [Environment]::GetFolderPath('Desktop');" ^
  "$s = $w.CreateShortcut((Join-Path $d 'Tròn Party.lnk')); $s.TargetPath = $env:EXE; $s.WorkingDirectory = (Split-Path $env:EXE); $s.Save();" ^
  "$s = $w.CreateShortcut((Join-Path $d 'Phòng tập não bộ.lnk')); $s.TargetPath = $env:EXE; $s.Arguments = '--naobo'; $s.WorkingDirectory = (Split-Path $env:EXE); $s.Save()"
if errorlevel 1 (
  echo Không tạo được lối tắt.
) else (
  echo Đã tạo lối tắt "Tròn Party" và "Phòng tập não bộ" trên Desktop.
)
pause
