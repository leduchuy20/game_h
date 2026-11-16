// Gói kho từ cho game Gõ Chữ Tiếng Anh → js/games/typing_words.js (window.TYPING_WORDS)
// Nguồn: tools/words-src/ (CEFR-J Vocabulary Profile 1.5 + Octanove C1/C2 1.0, xem README.md ở đó)
//        tools/words-vi/*.txt  nghĩa tiếng Việt tự viết: mỗi dòng "từ=nghĩa"
//        tools/words-vi/sentences.txt  câu ví dụ tự viết: "MỨC | câu | bản dịch" → window.TYPING_SENTS
// Chạy: node tools/pack-words.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(__dirname, 'words-src');
const VI = path.join(__dirname, 'words-vi');
const OUT = path.join(ROOT, 'js', 'games', 'typing_words.js');
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
// loại từ → mã ngắn (game hiện chữ Việt)
const POS = { noun: 'n', verb: 'v', adjective: 'a', adverb: 'r', pronoun: 'p', preposition: 'pr', determiner: 'd',
  conjunction: 'c', number: 'num', 'modal auxiliary': 'm', interjection: 'i', 'be-verb': 'v', 'do-verb': 'v', 'have-verb': 'v', vern: 'v' };

function csv(file) {
  const lines = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split(',');
  return lines.map((l) => {
    const cells = []; let cur = '', q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur);
    const o = {}; head.forEach((h, i) => { o[h] = (cells[i] || '').trim(); });
    return o;
  });
}

const rows = csv(path.join(SRC, 'cefrj-vocabulary-profile-1.5.csv')).concat(csv(path.join(SRC, 'octanove-vocabulary-profile-c1c2-1.0.csv')));
const map = new Map();
for (const r of rows) {
  const w = r.headword.split('/')[0].trim();           // "colour/color" → lấy cách viết đầu
  const lv = LEVELS.indexOf(r.CEFR);
  if (lv < 0 || !/^[A-Za-z]([A-Za-z' -]*[A-Za-z])?$/.test(w)) continue;   // bỏ "a.m.", số...
  const e = map.get(w) || { w, lv, pos: [] };
  e.lv = Math.min(e.lv, lv);
  const p = POS[r.pos];
  if (p && !e.pos.includes(p)) e.pos.push(p);
  map.set(w, e);
}

// nghĩa tiếng Việt
const vi = new Map();
if (fs.existsSync(VI)) {
  for (const f of fs.readdirSync(VI).filter((x) => x.endsWith('.txt') && x !== 'sentences.txt').sort()) {
    for (const line of fs.readFileSync(path.join(VI, f), 'utf8').split(/\r?\n/)) {
      const mm = line.match(/^([^=\t#]+)[=\t](.+)$/);   // "từ=nghĩa" (hoặc tab); dòng # là ghi chú
      if (!mm) continue;
      const w = mm[1].trim(), m = mm[2].trim();
      if (w && m) vi.set(w, m);
    }
  }
}
const list = [...map.values()].sort((a, b) => a.lv - b.lv || a.w.localeCompare(b.w));
let withVi = 0;
const miss = [];
const data = list.map((e) => {
  const m = vi.get(e.w) || '';
  if (m) withVi++; else miss.push(e.w);
  return [e.w, e.lv, e.pos.join(','), m];
});
const unknown = [...vi.keys()].filter((w) => !map.has(w));

// câu ví dụ: [câu, mức, bản dịch]
const sents = [];
const SF = path.join(VI, 'sentences.txt');
if (fs.existsSync(SF)) {
  for (const line of fs.readFileSync(SF, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [lv, en, tr] = line.split('|').map((x) => (x || '').trim());
    if (LEVELS.indexOf(lv) < 0 || !en) { console.log('Bỏ dòng câu lỗi:', line); continue; }
    if (/[^\x20-\x7e]/.test(en)) { console.log('Câu có ký tự không gõ được:', en); continue; }
    sents.push([en, LEVELS.indexOf(lv), tr]);
  }
}

const out = `// TỰ SINH bằng tools/pack-words.js — đừng sửa tay.
// Từ + mức CEFR: CEFR-J Vocabulary Profile 1.5 (Tono Laboratory, TUFS — dùng miễn phí, ghi nguồn) và
// Octanove Vocabulary Profile C1/C2 1.0 (Octanove Labs, CC BY-SA 4.0). Nghĩa tiếng Việt tự viết. Cả file: CC BY-SA 4.0.
// Mỗi phần tử: [từ, mức (0=A1 … 5=C2), loại từ (n,v,a,r,p,pr,d,c,num,m,i), nghĩa tiếng Việt ('' = chưa có)]
window.TYPING_WORDS = ${JSON.stringify(data).replace(/\],\[/g, '],\n[')};
// Câu ví dụ tự viết (Đua Xe Gõ Chữ, trùm Bắn Thiên Thạch): [câu, mức, bản dịch]
window.TYPING_SENTS = ${JSON.stringify(sents).replace(/\],\[/g, '],\n[')};
`;
fs.writeFileSync(OUT, out);
console.log(`${data.length} từ (${LEVELS.map((l, i) => l + ' ' + data.filter((d) => d[1] === i).length).join(', ')}), có nghĩa ${withVi}; ${sents.length} câu ví dụ (${LEVELS.map((l, i) => l + ' ' + sents.filter((d) => d[1] === i).length).filter((x) => !x.endsWith(' 0')).join(', ')})`);
if (unknown.length) console.log('Nghĩa của từ không có trong danh sách:', unknown.slice(0, 30).join(', '), unknown.length > 30 ? '…' : '');
if (process.argv.includes('--miss')) {
  const lv = Number(process.argv[process.argv.indexOf('--miss') + 1] || 0);
  console.log(list.filter((e) => e.lv === lv && !vi.has(e.w)).map((e) => e.w + '\t' + e.pos.join(',')).join('\n'));
}
