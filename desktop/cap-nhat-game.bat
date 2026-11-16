@echo off
chcp 65001 >nul
rem Chép bản game mới nhất từ thư mục game_party (2 cấp trên) vào thư mục game cạnh TronParty.exe
set "SRC=%~dp0..\.."
if not exist "%SRC%\index.html" (
  echo Không tìm thấy game_party\index.html ở "%SRC%".
  echo Hãy chép tay index.html, css, js, assets, fonts, naobo vào thư mục game.
  pause
  exit /b 1
)
xcopy "%SRC%\index.html" "%~dp0game\" /Y /Q >nul
xcopy "%SRC%\css" "%~dp0game\css\" /E /I /Y /Q >nul
xcopy "%SRC%\js" "%~dp0game\js\" /E /I /Y /Q >nul
if exist "%SRC%\assets" xcopy "%SRC%\assets" "%~dp0game\assets\" /E /I /Y /Q >nul
if exist "%SRC%\fonts" xcopy "%SRC%\fonts" "%~dp0game\fonts\" /E /I /Y /Q >nul
if exist "%SRC%\naobo" xcopy "%SRC%\naobo" "%~dp0game\naobo\" /E /I /Y /Q >nul
rem Phòng tập não bộ: nếu có bản mới ở thư mục gốc (Google Drive) thì lấy luôn — đổi đường dẫn dưới đây nếu chuyển chỗ
set "NAOBO=H:\My Drive\tro giang\ALL\muscle\phong-tap-nao-bo.html"
if exist "%NAOBO%" copy /Y "%NAOBO%" "%~dp0game\naobo\phong-tap-nao-bo.html" >nul
echo Đã cập nhật game. Mở TronParty.exe để chơi.
pause
