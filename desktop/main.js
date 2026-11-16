'use strict';
/* Tròn Party — bản chạy không cần trình duyệt (Electron).
   Game nằm trong thư mục "game" ngay cạnh TronParty.exe → muốn cập nhật game chỉ cần chép đè index.html, css, js vào đó.
   Phím: F11 = bật/tắt toàn màn hình · Ctrl+R = tải lại · Ctrl+Q = thoát.
   - Chỉ chạy MỘT bản: mở TronParty.exe lần nữa thì bản đang chạy được đưa lên trước, không mở thêm (đỡ tốn RAM).
   - Màn "Đang tải" hiện ngay khi bấm mở, tắt khi game đã nạp xong.
   - Có kèm Phòng tập não bộ (game/naobo/phong-tap-nao-bo.html — file gốc chép nguyên): mở từ nút ở màn đầu Tròn Party,
     hoặc mở thẳng bằng `TronParty.exe --naobo` (lối tắt / bấm chuột phải biểu tượng trên thanh tác vụ).
   - Font chữ lấy từ game/fonts (không cần mạng); mọi yêu cầu tới Google Fonts bị chặn để không phải chờ mạng. */
const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const NAOBO = 'naobo/phong-tap-nao-bo.html';
const wantNaobo = (argv) => argv.some((a) => String(a).toLowerCase() === '--naobo');

// ---------- chỉ một bản chạy ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();          // đã có bản đang chạy → bản kia nhận sự kiện 'second-instance' và tự hiện lên
} else {
  app.on('second-instance', (ev, argv) => {
    // mở lối tắt Phòng tập não bộ trong lúc game đang chạy → chuyển cửa sổ đang mở sang đó
    if (wantNaobo(argv) && main && !main.isDestroyed()) openPage(NAOBO);
    const w = (main && !main.isDestroyed() && main.isVisible()) ? main : (splash && !splash.isDestroyed() ? splash : main);
    if (!w || w.isDestroyed()) return;
    if (w.isMinimized()) w.restore();
    w.show();
    w.focus();
    if (w === main) w.flashFrame(true);   // nháy nút trên thanh tác vụ cho biết game đang mở sẵn
    if (w === splash) splashSay('Game đang mở rồi — chờ chút nhé…');
  });
  app.whenReady().then(start);
}

// âm thanh WebAudio chạy ngay không cần bấm trước
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let main = null, splash = null;
const SPLASH_MIN = 900;      // ms — màn tải hiện ít nhất chừng này để không loé lên rồi tắt
const LOAD_MAX = 30000;      // ms — quá lâu vẫn chưa xong thì cứ mở cửa sổ game

function gameDir() {
  // khi đã đóng gói: thư mục chứa TronParty.exe; khi chạy thử bằng `electron .`: thư mục dự án
  const exeDir = path.dirname(process.execPath);
  const cands = [path.join(exeDir, 'game'), path.join(__dirname, 'game'), path.join(__dirname, '..', '..', 'game')];
  return cands.find((d) => fs.existsSync(path.join(d, 'index.html'))) || cands[0];
}

/* ---------- màn "Đang tải" ---------- */
const SPLASH_HTML = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Tròn Party</title><style>
  html,body{margin:0;height:100%;overflow:hidden;background:transparent;font-family:"Segoe UI",system-ui,sans-serif;user-select:none;cursor:default}
  .card{position:absolute;inset:8px;border-radius:22px;background:radial-gradient(circle at 50% 30%,#3b2585,#1d1240 70%);
    box-shadow:0 8px 24px rgba(0,0,0,.45);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;-webkit-app-region:drag}
  .blobs{display:flex;gap:16px;height:96px;align-items:flex-end;margin-bottom:6px}
  .b{width:46px;height:46px;border-radius:50%;position:relative;animation:hop 1.1s infinite cubic-bezier(.3,0,.4,1);box-shadow:inset -6px -8px 0 rgba(0,0,0,.18)}
  .b::before,.b::after{content:"";position:absolute;top:15px;width:7px;height:10px;border-radius:50%;background:#1d1240}
  .b::before{left:13px}.b::after{right:13px}
  .b:nth-child(1){background:#ff5a5f}.b:nth-child(2){background:#3fa7ff;animation-delay:.14s}
  .b:nth-child(3){background:#46d17c;animation-delay:.28s}.b:nth-child(4){background:#ffd23f;animation-delay:.42s}
  @keyframes hop{0%,100%{transform:translateY(0) scale(1.12,.86)}12%{transform:translateY(0) scale(.92,1.1)}45%{transform:translateY(-44px) scale(.96,1.04)}78%{transform:translateY(0) scale(1,1)}}
  h1{margin:4px 0 2px;font-size:34px;font-weight:800;letter-spacing:1px;text-shadow:0 3px 0 #120a2e}
  .msg{font-size:15px;opacity:.85;height:20px}
  .bar{width:280px;height:10px;border-radius:6px;background:rgba(255,255,255,.12);margin-top:14px;overflow:hidden}
  .fill{height:100%;width:0;border-radius:6px;background:linear-gradient(90deg,#ffd23f,#ff8a3d);transition:width .25s}
</style></head><body><div class="card">
  <div class="blobs"><div class="b"></div><div class="b"></div><div class="b"></div><div class="b"></div></div>
  <h1>Tròn Party</h1><div class="msg" id="msg">Đang khởi động…</div><div class="bar"><div class="fill" id="fill"></div></div>
</div><script>
  // thanh tiến độ: tiến dần tới ~90% trong lúc chờ, tới 100% khi game nạp xong (setP)
  let p = 0, done = false;
  const fill = document.getElementById('fill');
  setInterval(() => { if (!done) { p += (90 - p) * 0.045; fill.style.width = p + '%'; } }, 50);
  window.setP = (v) => { done = v >= 100; p = Math.max(p, v); fill.style.width = p + '%'; };
  window.say = (s) => { document.getElementById('msg').textContent = s; };
</script></body></html>`;

function splashSay(s) {
  if (splash && !splash.isDestroyed()) splash.webContents.executeJavaScript(`say(${JSON.stringify(s)})`).catch(() => {});
}
function splashP(v) {
  if (splash && !splash.isDestroyed()) splash.webContents.executeJavaScript(`setP(${v})`).catch(() => {});
}

function createSplash() {
  splash = new BrowserWindow({
    width: 460, height: 300, frame: false, transparent: true, resizable: false, maximizable: false,
    fullscreenable: false, show: false, center: true, title: 'Tròn Party', skipTaskbar: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  // hiện ngay khi vẽ xong, rồi mới bắt đầu nạp game (cửa sổ game tạo cùng lúc sẽ tranh CPU làm màn tải hiện chậm)
  splash.once('ready-to-show', () => { if (splash && !splash.isDestroyed()) splash.show(); setTimeout(createMain, 30); });
  splash.on('closed', () => { splash = null; if (main && !main.isDestroyed() && !main.isVisible()) quitAll(); });
  if (wantNaobo(process.argv)) splash.webContents.once('did-finish-load', () => splashSay('Đang mở Phòng tập não bộ…'));
  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(SPLASH_HTML));
}

/* ---------- cửa sổ game ---------- */
function createMain() {
  if (main || quitting) return;
  main = new BrowserWindow({
    width: 1280, height: 760, minWidth: 640, minHeight: 400,
    backgroundColor: '#1d1240', title: 'Tròn Party', show: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  main.on('closed', () => { main = null; quitAll(); });
  main.on('focus', () => main && main.flashFrame(false));

  // hiện cửa sổ game khi đã vẽ khung đầu VÀ nạp xong mọi script (three.js, tranh…), rồi tắt màn tải
  const t0 = Date.now();
  let painted = false, loaded = false, shown = false;
  const reveal = () => {
    if (shown || !main || main.isDestroyed()) return;
    shown = true;
    splashSay('Sẵn sàng!'); splashP(100);
    setTimeout(() => {
      if (!main || main.isDestroyed()) return;
      main.maximize(); main.show(); main.focus();
      setTimeout(() => { if (splash && !splash.isDestroyed()) splash.destroy(); }, 150);
    }, Math.max(250, SPLASH_MIN - (Date.now() - t0)));
  };
  main.once('ready-to-show', () => { painted = true; splashP(70); if (loaded) reveal(); });
  main.webContents.on('did-finish-load', () => { loaded = true; if (painted) reveal(); else splashP(85); });
  main.webContents.on('did-fail-load', () => { painted = loaded = true; reveal(); });
  setTimeout(reveal, LOAD_MAX);

  const index = path.join(gameDir(), 'index.html');
  if (!wantNaobo(process.argv)) splashSay('Đang nạp game…');
  if (fs.existsSync(index)) main.loadFile(wantNaobo(process.argv) && fs.existsSync(path.join(gameDir(), NAOBO)) ? path.join(gameDir(), NAOBO) : index);
  else main.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
    '<body style="font-family:sans-serif;background:#1d1240;color:#fff;padding:40px"><h2>Không tìm thấy game</h2>'
    + '<p>Cần thư mục <b>game</b> (có index.html, css, js) nằm cạnh TronParty.exe.</p></body>'));
  main.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { main.setFullScreen(!main.isFullScreen()); e.preventDefault(); }
    else if (input.control && input.key.toLowerCase() === 'q') { quitAll(); e.preventDefault(); }
    else if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') { main.webContents.reload(); e.preventDefault(); }
    else if (input.control && isNaobo(main.webContents)) {
      // Phòng tập não bộ: Ctrl + / Ctrl - / Ctrl 0 phóng to, thu nhỏ, về mặc định (như bản exe cũ)
      if (input.key === '=' || input.key === '+') naoboZoom = Math.min(4, naoboZoom + 0.5);
      else if (input.key === '-') naoboZoom = Math.max(-3, naoboZoom - 0.5);
      else if (input.key === '0') naoboZoom = 0;
      else return;
      main.webContents.setZoomLevel(naoboZoom); e.preventDefault();
    }
  });
  // liên kết ra ngoài (nếu có) mở bằng ứng dụng mặc định, không mở cửa sổ mới trong game
  main.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  main.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
  main.webContents.on('dom-ready', () => decorate(main.webContents));
}

function openPage(rel) {
  const f = path.join(gameDir(), rel);
  if (main && !main.isDestroyed() && fs.existsSync(f)) main.loadFile(f);
}

/* ---------- font cục bộ + nút quay về cho Phòng tập não bộ ---------- */
let fontCss = null;
function localFonts() {
  // fonts.css dùng đường dẫn tương đối → đổi thành đường dẫn file tuyệt đối để chèn vào trang nào cũng được
  if (fontCss === null) {
    try {
      const dir = path.join(gameDir(), 'fonts');
      const base = pathToFileURL(dir).href + '/';
      fontCss = fs.readFileSync(path.join(dir, 'fonts.css'), 'utf8').replace(/url\((?!data:|file:)([^)]+)\)/g, (m, u) => `url(${base}${u})`);
    } catch (e) { fontCss = ''; }
  }
  return fontCss;
}
const BACK_JS = `(() => {
  if (document.getElementById('tp-back')) return;
  const st = document.createElement('style');
  st.textContent = '#tp-back{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;'
    + 'border:1px solid var(--line,#ccc);background:var(--surface,#fff);color:var(--ink,#111);text-decoration:none;'
    + 'font:500 14px/1.4 var(--f-body,system-ui),system-ui,sans-serif;white-space:nowrap}'
    + '#tp-back:hover,#tp-back:focus-visible{border-color:var(--accent,#36c);color:var(--accent,#36c)}'
    + 'header.top .brand{margin-right:auto}'
    + '#tp-back.float{position:fixed;left:12px;bottom:12px;z-index:99;box-shadow:0 2px 8px rgba(0,0,0,.15)}';
  document.head.appendChild(st);
  const a = document.createElement('a');
  a.id = 'tp-back'; a.href = '../index.html'; a.textContent = '← Tròn Party'; a.title = 'Về Tròn Party';
  const top = document.querySelector('header.top');
  if (top) top.insertBefore(a, top.firstChild); else { a.className = 'float'; document.body.appendChild(a); }
})();`;
let naoboZoom = 0;
const isNaobo = (wc) => /\/naobo\//.test(wc.getURL());
function decorate(wc) {
  const css = localFonts();
  if (css) wc.insertCSS(css).catch(() => {});
  // mức phóng to chỉ áp cho Phòng tập não bộ, về Tròn Party thì trả về 100% (game tự co theo cửa sổ)
  wc.setZoomLevel(isNaobo(wc) ? naoboZoom : 0);
  if (isNaobo(wc)) wc.executeJavaScript(BACK_JS).catch(() => {});
}

function start() {
  // Google Fonts: chặn luôn (font đã có sẵn trong game/fonts) để trang không phải chờ mạng chậm / mất mạng
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['*://fonts.googleapis.com/*', '*://fonts.gstatic.com/*'] }, (d, cb) => cb({ cancel: true }));
  // bấm chuột phải biểu tượng trên thanh tác vụ → mở thẳng Phòng tập não bộ
  if (process.platform === 'win32') {
    try {
      app.setUserTasks([{ program: process.execPath, arguments: '--naobo', iconPath: process.execPath, iconIndex: 0,
        title: 'Phòng tập não bộ', description: 'Mở thẳng Phòng tập não bộ' }]);
    } catch (e) { /* bỏ qua */ }
  }
  createSplash();
  setTimeout(createMain, 1500);   // phòng khi màn tải không vẽ được thì vẫn mở game
}

/* ---------- tắt là tắt hẳn ----------
   Bấm X ở cửa sổ game (hoặc tắt màn tải) → thoát cả chương trình. Phòng khi có gì kẹt lại (game treo, tiến trình GPU
   không chịu đóng…), sau 3 giây vẫn chưa thoát xong thì ép thoát luôn để không còn tiến trình chạy ngầm ăn RAM. */
let quitting = false;
function quitAll() {
  if (quitting) return;
  quitting = true;
  setTimeout(() => app.exit(0), 3000).unref();
  app.quit();
}
app.on('before-quit', () => { if (!quitting) { quitting = true; setTimeout(() => app.exit(0), 3000).unref(); } });
app.on('window-all-closed', quitAll);
