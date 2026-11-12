# Đóng gói Tròn Party thành ứng dụng Windows (không cần trình duyệt)

Dùng Electron (bản đã đóng gói sẵn, không cần cài Node trên máy chơi). Đã làm ngày 12/11/2026 với Electron **44.10.0**.

1. Tải `electron-v44.10.0-win32-x64.zip` và `SHASUMS256.txt` từ
   https://github.com/electron/electron/releases/tag/v44.10.0 — kiểm tra SHA-256 khớp.
2. Giải nén vào thư mục `TronParty/`, đổi tên `electron.exe` → `TronParty.exe`, xoá `resources/default_app.asar`.
   (Có thể xoá bớt `locales/*.pak`, chỉ giữ `en-US.pak` và `vi.pak`.)
3. Tạo `TronParty/resources/app/` và chép `main.js` + `package.json` trong thư mục này vào đó.
4. Chép `index.html`, `css/`, `js/`, `assets/` của game vào `TronParty/game/`
   (KHÔNG chép `arcade.html` — trang đó cần mạng và đã gỡ khỏi menu).
5. Chép `HUONG-DAN.txt` và `cap-nhat-game.bat` vào `TronParty/`.
6. Nén `TronParty/` thành `TronParty-Windows.zip` (đặt trong `dist/`, đã có trong .gitignore).

Ghi chú:
- `main.js` tìm game ở thư mục `game` cạnh TronParty.exe → cập nhật game chỉ cần chép đè `game/`, không phải đóng gói lại.
- File .exe chưa ký số nên lần đầu Windows SmartScreen hỏi → "More info" → "Run anyway".
- Biểu tượng .exe là biểu tượng mặc định của Electron (đổi biểu tượng cần `rcedit`, chạy trên Windows hoặc qua wine).
- Dữ liệu localStorage của bản ứng dụng lưu ở `%APPDATA%\tron-party`, tách riêng với trình duyệt.
