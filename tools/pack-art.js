// Gói tranh Cờ Tỷ Phú (assets/monopoly/*.svg|png|jpg) thành assets/monopoly/art.js = data URI.
// Lý do: mở bằng file:// (và bản .exe) thì ảnh nạp từ file làm "bẩn" canvas → WebGL không cho dùng làm texture
// (lỗi "Tainted canvases may not be loaded"). Ảnh nạp từ data URI thì không bị.
// Chạy lại mỗi khi thay / thêm tranh:  node tools/pack-art.js
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DIR = 'assets/monopoly';
const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const out = {};
for (const f of fs.readdirSync(path.join(ROOT, DIR)).sort()) {
  const ext = path.extname(f).toLowerCase();
  if (!MIME[ext]) continue;
  const buf = fs.readFileSync(path.join(ROOT, DIR, f));
  out[`${DIR}/${f}`] = `data:${MIME[ext]};base64,${buf.toString('base64')}`;
}
const body = Object.entries(out).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
const js = `// TỰ SINH bởi tools/pack-art.js — đừng sửa tay. Tranh Cờ Tỷ Phú dạng data URI (dùng được làm texture 3D khi mở bằng file://).\nwindow.ASSET_URI = Object.assign(window.ASSET_URI || {}, {\n${body}\n});\n`;
fs.writeFileSync(path.join(ROOT, DIR, 'art.js'), js);
console.log(`${Object.keys(out).length} ảnh → ${DIR}/art.js (${Math.round(js.length / 1024)} KB)`);
