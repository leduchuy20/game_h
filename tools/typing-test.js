// Test lõi Gõ Chữ: node tools/typing-test.js
'use strict';
global.window = {};
require('../js/games/typing_words.js');
const C = require('../js/games/typing_core.js');
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log('✗', msg); } else console.log('✓', msg); };

const bank = C.makeBank(window.TYPING_WORDS);
ok(bank.all.length > 8000, `kho từ ${bank.all.length} từ, gõ nhanh ${bank.plain.length}`);
ok(bank.plain.every((e) => /^[a-z]+$/.test(e.w)), 'từ gõ nhanh chỉ có a–z');
ok(C.byLevel(bank.all, 'A1').every((e) => e.lv === 0), 'lọc mức A1');

// phiên gõ: "cat dog", gõ đúng hết trong 6 giây
let s = new C.Session(['cat', 'dog']);
let t = 0;
for (const ch of 'cat dog') s.type(ch, (t += 1000 / 1.1));
ok(s.finished, 'gõ đúng hết → xong (không cần Space cuối)');
ok(s.acc() === 1 && s.correctChars() === 7, 'độ chính xác 100%, 7 ký tự đúng');
ok(Math.abs(s.wpm(t) - (7 / 5) / (s.elapsed(t) / 60)) < 1e-9, 'WPM = ký tự đúng / 5 / phút');

// gõ sai rồi Backspace sửa: vẫn tính lỗi, từ vẫn đúng
s = new C.Session(['cat', 'dog']);
'cx'.split('').forEach((ch) => s.type(ch, 0)); s.back(); 'at'.split('').forEach((ch) => s.type(ch, 0)); s.type(' ', 0);
ok(s.bad === 1 && s.good === 3 && s.corrections === 1, 'phím sai vẫn tính lỗi dù đã sửa');
ok(s.typed[0] === 'cat' && s.cur === 1, 'Backspace sửa được, Space sang từ sau');
// Space sớm: từ thiếu chữ = sai
s.type('d', 0); s.type(' ', 0);
ok(s.wrongList().includes('dog') && s.finished, 'Space khi chưa gõ đủ → từ sai');

// Unikey
ok(C.isImeKey({ key: 'â' }) && C.isImeKey({ key: 'Process' }) && !C.isImeKey({ key: 'a' }), 'nhận ra phím của bộ gõ tiếng Việt');

// Leitner
let r = C.review(null, true, 100);
ok(r[0] === 1 && r[1] === 101, 'đúng lần đầu → hộp 1, ôn sau 1 ngày');
r = C.review(r, true, 101); r = C.review(r, true, 103);
ok(r[0] === 3 && r[1] === 107, 'đúng tiếp → hộp 3, ôn sau 4 ngày');
r = C.review(r, false, 107);
ok(r[0] === 1 && r[1] === 108 && r[3] === 1, 'sai → về hộp 1');
const srs = { apple: [1, 50, 1, 0], banana: [3, 60, 3, 0] };
const cards = C.pickCards(bank, srs, 'A1', 10, 55);
ok(cards.length === 10 && cards.some((e) => e.w === 'apple') && !cards.some((e) => e.w === 'banana'), 'chọn thẻ: có từ đến hạn, chưa lấy từ chưa đến hạn');
ok(cards.every((e) => e.vi), 'thẻ đều có nghĩa tiếng Việt');

// Luyện Ngón
const letters = C.FINGER_ORDER.slice(0, C.FINGER_START);
const fw = C.fingerWords(bank.plain, letters, {}, 30);
ok(fw.length === 30 && fw.every((w) => [...w].every((c) => letters.includes(c))), 'Luyện Ngón chỉ dùng chữ đã mở: ' + fw.slice(0, 8).join(' '));

// hồ sơ
const mem = { d: {}, getItem(k) { return this.d[k] || null; }, setItem(k, v) { this.d[k] = v; } };
const p = C.loadProfile(mem, 'Huy');
p.srs.cat = [2, 10, 2, 0]; C.markDay(p, 10); C.markDay(p, 11);
C.saveProfile(mem, 'Huy', p);
const p2 = C.loadProfile(mem, 'Huy');
ok(p2.srs.cat[0] === 2 && C.streak(p2, 11) === 2 && C.loadProfile(mem, 'Khác').unlocked === C.FINGER_START, 'lưu/đọc hồ sơ theo tên, chuỗi ngày');

// Bộ từ của tôi
const mine = C.parseMine('abandon - từ bỏ\n2. look after = chăm sóc\n- apple\nhello: xin chào\nkick\tđá\nAbandon - trùng\n# ghi chú\n???\nwell-known — nổi tiếng',
  (w) => (bank.byWord.get(w) || {}).vi);
ok(mine.length === 6 && mine[0].vi === 'từ bỏ' && mine[1].w === 'look after' && mine[2].vi && mine[4].vi === 'đá' && mine[5].w === 'well-known',
  'đọc Bộ từ của tôi: ' + mine.map((e) => e.w + '=' + e.vi).join(' | '));

// câu ví dụ
const sents = C.makeSents(window.TYPING_SENTS);
ok(sents.length >= 150 && sents.every((e) => /^[\x20-\x7e]+$/.test(e.s) && e.vi), `${sents.length} câu ví dụ, đều gõ được và có bản dịch`);
ok(C.pickSents(sents, 'C2', 3).every((e) => e.lv === 2), 'mức chưa có câu → lấy câu mức thấp hơn gần nhất');

// Nitro + tiến độ
s = new C.Session(['Hello,', 'world.']);
'Hel'.split('').forEach((ch) => s.type(ch, 0));
ok(Math.abs(s.progress() - 3 / 13) < 1e-9, 'tiến độ theo ký tự đúng');
s.skipWord(0);
ok(s.cur === 1 && s.typed[0] === 'Hello,' && !s.wrongList().length, 'Nitro bỏ qua từ, tính như gõ đúng');

// nhịp xe máy
const sch = C.paceSchedule(300, 40, () => 0.5);
const fin = C.paceFinish(sch);
ok(sch[sch.length - 1] === 300 && fin > 300 / (40 * 5 / 60) * 0.8 && fin < 300 / (40 * 5 / 60) * 1.5, `xe máy 40 WPM gõ 300 ký tự hết ${fin.toFixed(1)} giây`);
ok(C.paceAt(sch, fin + 5) === 300 && C.paceAt(sch, 0) === 0, 'paceAt kẹp đầu/cuối');

// thống kê ngày
const hist = [{ d: 100, m: 'speed', wpm: 30, acc: 90 }, { d: 100, m: 'speed', wpm: 40, acc: 100 }, { d: 101, m: 'race', wpm: 50, acc: 96 }, { d: 101, m: 'cards', ok: 3, n: 5 }];
const bd = C.byDay(hist, 30, 101);
ok(bd.length === 2 && bd[0].best === 40 && bd[0].avg === 35 && bd[1].best === 50, 'gộp WPM theo ngày');
ok(C.recentWpm(hist) === 40 && C.recentWpm([], 30) === 30, 'WPM gần đây');
const prof2 = { srs: {} };
C.markWrong(prof2, ['Apple.', 'zzzq', 'apple'], 50, (w) => (bank.byWord.has(C.bare(w)) ? C.bare(w) : null));
ok(Object.keys(prof2.srs).join() === 'apple' && prof2.srs.apple[0] === 1, 'từ gõ sai về hộp 1 (bỏ dấu câu, bỏ từ lạ)');

console.log(fail ? `${fail} lỗi` : 'Không lỗi');
process.exit(fail ? 1 : 0);
