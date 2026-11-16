// Tạo fonts/: woff2 (latin, latin-ext, vietnamese) + fonts.css đường dẫn tương đối, cho Tròn Party (Baloo 2) và Phòng tập não bộ (Lexend, Be Vietnam Pro).
// Chạy trong thư mục gốc: npm i --no-save @fontsource/baloo-2@5 @fontsource/lexend@5 @fontsource/be-vietnam-pro@5 && node tools/pack-fonts.js
const fs = require('fs'), path = require('path');
const OUT = require('path').join(__dirname, '..', 'fonts');
const W = { 'baloo-2': [400, 500, 600, 700, 800], lexend: [300, 400, 500, 700, 800], 'be-vietnam-pro': [400, 500, 600, 700] };
fs.rmSync(OUT, { recursive: true, force: true });
let css = '/* Font cục bộ (Fontsource, SIL OFL 1.1) — chỉ subset latin, latin-ext, vietnamese. Tự sinh, xem assets/CREDITS.md */\n';
for (const [f, ws] of Object.entries(W)) {
  const src = `node_modules/@fontsource/${f}`;
  fs.mkdirSync(`${OUT}/${f}`, { recursive: true });
  fs.copyFileSync(`${src}/LICENSE`, `${OUT}/${f}/LICENSE`);
  for (const w of ws) {
    const c = fs.readFileSync(`${src}/${w}.css`, 'utf8');
    const blocks = c.split(/(?=\/\*)/).filter((b) => /\/\* [a-z0-9-]+?-(latin|latin-ext|vietnamese)-\d+-normal \*\//.test(b));
    if (blocks.length !== 3) throw new Error(f + w + ' blocks ' + blocks.length);
    for (const b of blocks) for (const m of b.matchAll(/url\(\.\/files\/([^)]+\.woff2)\)/g)) fs.copyFileSync(`${src}/files/${m[1]}`, `${OUT}/${f}/${m[1]}`);
    css += blocks.join('').replace(/url\(\.\/files\/([^)]+\.woff2)\) format\('woff2'\), url\(\.\/files\/[^)]+\.woff\) format\('woff'\)/g, `url(${f}/$1) format('woff2')`);
  }
}
if (/\.woff\)/.test(css) || /files\//.test(css)) throw new Error('còn url lạ');
fs.writeFileSync(`${OUT}/fonts.css`, css);
console.log('ok', css.length);
