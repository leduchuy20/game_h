'use strict';
/* Tròn Party — bản chạy không cần trình duyệt (Electron).
   Game nằm trong thư mục "game" ngay cạnh TronParty.exe → muốn cập nhật game chỉ cần chép đè index.html, css, js vào đó.
   Phím: F11 = bật/tắt toàn màn hình · Ctrl+R = tải lại · Ctrl+Q = thoát. */
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// âm thanh WebAudio chạy ngay không cần bấm trước
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function gameDir() {
  // khi đã đóng gói: thư mục chứa TronParty.exe; khi chạy thử bằng `electron .`: thư mục dự án
  const exeDir = path.dirname(process.execPath);
  const cands = [path.join(exeDir, 'game'), path.join(__dirname, 'game'), path.join(__dirname, '..', '..', 'game')];
  return cands.find((d) => fs.existsSync(path.join(d, 'index.html'))) || cands[0];
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 760, minWidth: 640, minHeight: 400,
    backgroundColor: '#1d1240', title: 'Tròn Party', show: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  const index = path.join(gameDir(), 'index.html');
  if (fs.existsSync(index)) win.loadFile(index);
  else win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
    '<body style="font-family:sans-serif;background:#1d1240;color:#fff;padding:40px"><h2>Không tìm thấy game</h2>'
    + '<p>Cần thư mục <b>game</b> (có index.html, css, js) nằm cạnh TronParty.exe.</p></body>'));
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    else if (input.control && input.key.toLowerCase() === 'q') { app.quit(); e.preventDefault(); }
    else if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') { win.webContents.reload(); e.preventDefault(); }
  });
  // liên kết ra ngoài (nếu có) mở bằng ứng dụng mặc định, không mở cửa sổ mới trong game
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
