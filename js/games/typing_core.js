// Lõi game Gõ Chữ Tiếng Anh: kho từ, phiên gõ (WPM, độ chính xác, thống kê từng phím), hộp Leitner, lưu tiến độ.
// Không vẽ gì — chạy được bằng node để test (tools/typing-test.js). Trình duyệt: window.TypingCore.
(function (root, factory) {
  const C = factory();
  if (typeof module === 'object' && module.exports) module.exports = C;
  else root.TypingCore = C;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const POS_VI = { n: 'danh từ', v: 'động từ', a: 'tính từ', r: 'trạng từ', p: 'đại từ', pr: 'giới từ', d: 'hạn định từ',
    c: 'liên từ', num: 'số từ', m: 'động từ khuyết thiếu', i: 'thán từ' };
  // hộp Leitner: số ngày tới lần ôn sau (hộp 1..5); hộp ≥ 4 = đã thuộc
  const BOX_DAYS = [0, 1, 2, 4, 8, 16];
  const KNOWN_BOX = 4;

  /* ---------------- kho từ ---------------- */
  function makeBank(raw) {
    const all = (raw || []).map((r) => ({ w: r[0], lv: r[1], pos: r[2] ? r[2].split(',') : [], vi: r[3] || '' }));
    // từ dùng để gõ nhanh: chỉ chữ thường a–z, 2–12 ký tự (bỏ tên riêng, viết tắt, cụm từ)
    const plain = all.filter((e) => /^[a-z]{2,12}$/.test(e.w));
    return { all, plain, byWord: new Map(all.map((e) => [e.w, e])) };
  }
  /** lọc theo mức: 'rand' = mọi mức, 'A1'..'C2' */
  function byLevel(list, level) {
    if (!level || level === 'rand') return list;
    const lv = LEVELS.indexOf(level);
    return lv < 0 ? list : list.filter((e) => e.lv === lv);
  }
  function shuffle(a, rnd = Math.random) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function pickWords(list, n, rnd = Math.random) {
    if (!list.length) return [];
    const out = [];
    let last = '';
    for (let i = 0; i < n; i++) {
      let e = list[Math.floor(rnd() * list.length)];
      if (e.w === last && list.length > 1) e = list[Math.floor(rnd() * list.length)];
      out.push(e); last = e.w;
    }
    return out;
  }
  function posVi(pos) { return pos.map((p) => POS_VI[p] || p).join(', '); }

  /* ---------------- phiên gõ ----------------
     Văn bản = dãy từ; gõ từng ký tự vào từ hiện tại, Space sang từ sau (từ chưa gõ đủ: chữ thiếu tính lỗi),
     Backspace xoá ký tự vừa gõ (chỉ trong từ hiện tại). Mỗi phím chữ gõ ra được chấm đúng/sai ngay lúc gõ. */
  class Session {
    constructor(words, opts = {}) {
      this.words = words.slice();              // chuỗi
      this.typed = this.words.map(() => '');
      this.done = this.words.map(() => false);
      this.cur = 0;
      this.keys = 0; this.good = 0; this.bad = 0;      // phím chữ đã gõ (không tính Backspace/Space)
      this.corrections = 0;
      this.t0 = null; this.tEnd = null; this.tLast = null;
      this.perKey = {};                        // ký tự → { n, err, ms }
      this.wrongWords = new Set();
      this.finishOnLast = opts.finishOnLast !== false;   // gõ đúng hết từ cuối là xong, không cần Space
    }
    get word() { return this.words[this.cur] || ''; }
    get input() { return this.typed[this.cur] || ''; }
    get finished() { return this.cur >= this.words.length; }
    /** ký tự mong đợi tiếp theo (Space khi đã gõ đủ từ) */
    expected() {
      if (this.finished) return '';
      const w = this.word, t = this.input;
      return t.length < w.length ? w[t.length] : ' ';
    }
    stamp(t) { if (this.t0 === null) this.t0 = t; }
    type(ch, t) {
      if (this.finished) return null;
      if (ch === ' ') return this.space(t);
      this.stamp(t);
      const w = this.word, t0 = this.input;
      const want = t0.length < w.length ? w[t0.length] : null;
      const ok = want === ch && t0 === w.slice(0, t0.length);   // phải đúng cả phần trước
      this.typed[this.cur] = t0 + ch;
      this.keys++;
      if (ok) this.good++; else { this.bad++; this.wrongWords.add(this.cur); }
      if (want) {
        const k = this.perKey[want] || (this.perKey[want] = { n: 0, err: 0, ms: 0 });
        k.n++; if (!ok) k.err++;
        if (this.tLast !== null && ok) k.ms += Math.min(2000, t - this.tLast);
      }
      this.tLast = t;
      // từ cuối gõ đúng đủ → xong luôn
      if (this.finishOnLast && this.cur === this.words.length - 1 && this.typed[this.cur] === w) this.commit(t);
      return ok;
    }
    back() {
      if (this.finished) return false;
      const t = this.input;
      if (!t.length) return false;
      this.typed[this.cur] = t.slice(0, -1);
      this.corrections++;
      return true;
    }
    /** Nitro (Đua Xe): bỏ qua từ đang gõ, coi như gõ đúng */
    skipWord(t) {
      if (this.finished) return false;
      this.stamp(t);
      this.typed[this.cur] = this.words[this.cur];
      this.wrongWords.delete(this.cur);
      this.commit(t);
      return true;
    }
    /** tỉ lệ đã đi được (ký tự của các từ đã xong + phần đúng của từ đang gõ) / tổng ký tự */
    progress() {
      if (!this._tot) this._tot = this.words.reduce((a, w) => a + w.length + 1, -1) || 1;
      let n = 0;
      for (let i = 0; i < this.cur && i < this.words.length; i++) n += this.words[i].length + 1;
      if (!this.finished) { const w = this.word, t = this.input; let k = 0; while (k < t.length && t[k] === w[k]) k++; n += k; }
      return Math.min(1, n / this._tot);
    }
    /** xoá cả từ đang gõ (Ctrl+Backspace) */
    backWord() { if (this.finished || !this.input) return false; this.typed[this.cur] = ''; this.corrections++; return true; }
    space(t) {
      if (this.finished) return null;
      if (!this.input.length) return null;        // Space khi chưa gõ gì: bỏ qua
      this.stamp(t);
      const ok = this.input === this.word;
      if (!ok) { this.wrongWords.add(this.cur); }
      this.commit(t);
      return ok;
    }
    commit(t) {
      this.done[this.cur] = true;
      this.cur++;
      this.tLast = t;
      if (this.finished) this.tEnd = t;
    }
    /** số ký tự đúng (gồm khoảng trắng giữa các từ đúng) — dùng cho WPM kiểu Monkeytype */
    correctChars() {
      let n = 0;
      for (let i = 0; i < this.words.length; i++) {
        if (!this.done[i] && i !== this.cur) continue;
        const w = this.words[i], t = this.typed[i];
        if (this.done[i]) { if (t === w) n += w.length + (i < this.words.length - 1 ? 1 : 0); }
        else { let k = 0; while (k < t.length && t[k] === w[k]) k++; n += k; }
      }
      return n;
    }
    elapsed(now) { return this.t0 === null ? 0 : ((this.tEnd !== null ? this.tEnd : now) - this.t0) / 1000; }
    wpm(now) { const s = this.elapsed(now); return s < 1 ? 0 : (this.correctChars() / 5) / (s / 60); }
    raw(now) { const s = this.elapsed(now); return s < 1 ? 0 : ((this.keys + this.cur) / 5) / (s / 60); }
    acc() { return this.keys ? this.good / this.keys : 1; }
    wrongList() { return [...this.wrongWords].sort((a, b) => a - b).map((i) => this.words[i]); }
  }

  /** ký tự lạ do bộ gõ tiếng Việt (Unikey/EVKey) bật: chữ có dấu, đ, hoặc phím "Process" của IME */
  function isImeKey(e) {
    if (!e) return false;
    if (e.key === 'Process' || e.key === 'Unidentified' || e.isComposing) return true;
    return typeof e.key === 'string' && e.key.length === 1 && e.key.charCodeAt(0) > 126;
  }

  /* ---------------- Leitner ---------------- */
  function today(d = new Date()) { return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5); }
  /** rec = [hộp, ngày đến hạn, số lần đúng, số lần sai] */
  function review(rec, ok, day) {
    const r = rec ? rec.slice() : [0, day, 0, 0];
    if (ok) { r[0] = Math.min(5, (r[0] || 0) + 1); r[2]++; } else { r[0] = 1; r[3]++; }
    r[1] = day + BOX_DAYS[r[0]];
    return r;
  }
  /** chọn thẻ cho một buổi: từ đến hạn trước (hộp thấp trước), rồi từ mới cùng mức */
  function pickCards(bank, srs, level, n, day, rnd = Math.random) {
    const pool = byLevel(bank.all, level).filter((e) => e.vi);
    const due = pool.filter((e) => srs[e.w] && srs[e.w][1] <= day)
      .sort((a, b) => srs[a.w][0] - srs[b.w][0] || srs[a.w][1] - srs[b.w][1]);
    const fresh = shuffle(pool.filter((e) => !srs[e.w]), rnd);
    const out = due.slice(0, n);
    for (const e of fresh) { if (out.length >= n) break; out.push(e); }
    // hết từ mới & từ đến hạn: lấy thêm từ ôn sớm (hộp thấp nhất)
    if (out.length < n) {
      const rest = shuffle(pool.filter((e) => srs[e.w] && !out.includes(e)), rnd).sort((a, b) => srs[a.w][0] - srs[b.w][0]);
      for (const e of rest) { if (out.length >= n) break; out.push(e); }
    }
    return shuffle(out, rnd);
  }
  function srsStats(srs, day) {
    let known = 0, learning = 0, due = 0;
    for (const w in srs) { const r = srs[w]; if (r[0] >= KNOWN_BOX) known++; else learning++; if (r[1] <= day) due++; }
    return { known, learning, due };
  }

  /* ---------------- Luyện Ngón ---------------- */
  // thứ tự mở chữ: hàng phím cơ sở trước rồi lan dần ra
  const FINGER_ORDER = 'asdfjkl' + 'eirughtonywcmpbvxqz';
  const FINGER_START = 8;   // asdfjkl + e
  /** ngón tay cho từng phím (0..3 = út/áp út/giữa/trỏ trái, 4..7 = trỏ/giữa/áp út/út phải), 8 = ngón cái */
  const FINGER = {};
  [['qaz', 0], ['wsx', 1], ['edc', 2], ['rfvtgb', 3], ['yhnujm', 4], ['ik,', 5], ['ol.', 6], ["p;/'[]", 7]]
    .forEach(([ks, f]) => { for (const k of ks) FINGER[k] = f; });
  FINGER[' '] = 8;
  function fingerWords(list, letters, weak, n, rnd = Math.random) {
    const set = new Set(letters);
    let pool = list.filter((e) => e.w.length >= 2 && e.w.length <= 8 && [...e.w].every((c) => set.has(c)));
    if (pool.length < 12) {
      // quá ít từ thật → ghép thêm "từ giả" từ các chữ đã mở (giống keybr)
      const L = [...letters];
      for (let i = 0; i < 40; i++) {
        let w = ''; const len = 2 + Math.floor(rnd() * 4);
        for (let k = 0; k < len; k++) w += L[Math.floor(rnd() * L.length)];
        pool.push({ w, lv: -1, pos: [], vi: '' });
      }
    }
    // từ chứa phím yếu được chọn nhiều hơn
    const wt = pool.map((e) => 1 + [...e.w].reduce((s, c) => s + (weak[c] || 0), 0) * 3);
    const tot = wt.reduce((a, b) => a + b, 0);
    const out = [];
    for (let i = 0; i < n; i++) {
      let r = rnd() * tot, k = 0;
      while (k < pool.length - 1 && (r -= wt[k]) > 0) k++;
      if (out.length && out[out.length - 1] === pool[k].w && pool.length > 1) k = (k + 1) % pool.length;
      out.push(pool[k].w);
    }
    return out;
  }
  /** độ "yếu" của từng phím từ thống kê tích luỹ: tỉ lệ sai + chậm hơn trung bình */
  function weakness(keyStats) {
    const ks = Object.keys(keyStats).filter((k) => keyStats[k].n >= 5);
    if (!ks.length) return {};
    const spd = (k) => keyStats[k].ms / Math.max(1, keyStats[k].n - keyStats[k].err);
    const avg = ks.reduce((s, k) => s + spd(k), 0) / ks.length || 1;
    const out = {};
    for (const k of ks) out[k] = Math.max(0, keyStats[k].err / keyStats[k].n * 4 + (spd(k) / avg - 1));
    return out;
  }

  /* ---------------- Bộ từ của tôi ----------------
     Mỗi dòng một từ: "word - nghĩa", "word = nghĩa", "word: nghĩa", "word<Tab>nghĩa" hoặc chỉ "word"
     (thiếu nghĩa thì lấy nghĩa trong kho nếu có). Trả [{w, vi}], bỏ trùng, tối đa 1000 từ. */
  const MINE_MAX = 1000;
  function parseMine(text, lookup) {
    const out = [], seen = new Set();
    for (let line of String(text || '').split(/\r?\n/)) {
      line = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim();     // bỏ gạch đầu dòng / số thứ tự
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^([A-Za-z][A-Za-z' .-]*?)\s*(?:\s[-–—]\s|=|:|\t|\s{2,}|\s[-–—]|[-–—]\s)\s*(.*)$/);
      let w, vi;
      if (m) { w = m[1].trim(); vi = m[2].trim(); }
      else if (/^[A-Za-z][A-Za-z' .-]*$/.test(line)) { w = line; vi = ''; }
      else continue;
      w = w.replace(/\s+/g, ' ').replace(/[ .-]+$/, '');
      if (!w || w.length > 30 || seen.has(w.toLowerCase())) continue;
      seen.add(w.toLowerCase());
      if (!vi && lookup) vi = lookup(w) || '';
      out.push({ w, vi });
      if (out.length >= MINE_MAX) break;
    }
    return out;
  }
  /** kho từ dạng giống makeBank cho Bộ từ của tôi (mức -1) */
  function mineBank(list) {
    const all = (list || []).map((e) => ({ w: e.w, lv: -1, pos: [], vi: e.vi || '', mine: true }));
    return { all, plain: all, byWord: new Map(all.map((e) => [e.w, e])) };
  }

  /* ---------------- câu ví dụ ---------------- */
  function makeSents(raw) { return (raw || []).map((r) => ({ s: r[0], lv: r[1], vi: r[2] || '' })); }
  /** chọn n câu theo mức (mức chưa có câu → lấy câu mức gần nhất bên dưới, rồi mọi mức) */
  function pickSents(list, level, n, rnd = Math.random) {
    let pool = list;
    const lv = LEVELS.indexOf(level);
    if (lv >= 0) {
      for (let k = lv; k >= 0; k--) { const p = list.filter((e) => e.lv === k); if (p.length >= n) { pool = p; break; } }
    }
    return shuffle(pool.slice(), rnd).slice(0, n);
  }
  /** chữ gõ được (bỏ dấu câu, chữ thường) để tra từ trong kho */
  function bare(w) { return String(w).toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, ''); }

  /* ---------------- Đua Xe: nhịp xe máy ----------------
     Xe máy gõ quanh `wpm`, đổi nhịp mỗi 1–3 giây (0,75–1,25×), thỉnh thoảng khựng (như gõ sai rồi sửa).
     Trả mảng số ký tự đã gõ sau mỗi STEP giây cho tới khi đủ `chars`. */
  const PACE_STEP = 0.1;
  function paceSchedule(chars, wpm, rnd = Math.random) {
    const cps = Math.max(0.5, wpm * 5 / 60), out = [0];
    let n = 0, mul = 1, seg = 0, stall = 0;
    for (let i = 0; n < chars && i < 30000; i++) {
      if ((seg -= PACE_STEP) <= 0) { seg = 1 + rnd() * 2; mul = 0.75 + rnd() * 0.5; if (rnd() < 0.18) stall = 0.3 + rnd() * 0.6; }
      if (stall > 0) stall -= PACE_STEP; else n += cps * mul * PACE_STEP;
      out.push(Math.min(chars, n));
    }
    return out;
  }
  function paceAt(sched, t) {
    const k = t / PACE_STEP, i = Math.floor(k);
    if (i >= sched.length - 1) return sched[sched.length - 1];
    return sched[i] + (sched[i + 1] - sched[i]) * (k - i);
  }
  function paceFinish(sched) { return (sched.length - 1) * PACE_STEP; }

  /* ---------------- thống kê ---------------- */
  /** gộp lịch sử theo ngày: [{d, best, avg, acc, n}] (chỉ các lần có WPM) */
  function byDay(hist, days = 30, today_ = today()) {
    const m = new Map();
    for (const h of hist || []) {
      if (typeof h.wpm !== 'number' || h.d < today_ - days + 1) continue;
      const a = m.get(h.d) || { d: h.d, best: 0, sum: 0, acc: 0, n: 0 };
      a.best = Math.max(a.best, h.wpm); a.sum += h.wpm; a.acc += h.acc || 0; a.n++;
      m.set(h.d, a);
    }
    return [...m.values()].sort((a, b) => a.d - b.d).map((a) => ({ d: a.d, best: a.best, avg: a.sum / a.n, acc: a.acc / a.n, n: a.n }));
  }
  /** WPM gần đây (trung bình 5 lần gần nhất có WPM, bỏ Luyện Ngón) — dùng chỉnh độ khó */
  function recentWpm(hist, def = 30) {
    const xs = (hist || []).filter((h) => typeof h.wpm === 'number' && h.m !== 'finger' && h.wpm > 0).slice(-5).map((h) => h.wpm);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : def;
  }
  /** đưa từ gõ sai về hộp 1 (từ có trong kho / Bộ từ của tôi) */
  function markWrong(prof, words, day, known) {
    const done = [];
    for (const w0 of words) {
      const w = known(w0);
      if (!w || done.includes(w)) continue;
      prof.srs[w] = review(prof.srs[w], false, day);
      done.push(w);
    }
    return done;
  }
  function boxCounts(srs) {
    const c = [0, 0, 0, 0, 0, 0];
    for (const w in srs) c[Math.max(0, Math.min(5, srs[w][0] || 0))]++;
    return c;
  }

  /* ---------------- lưu tiến độ (localStorage, theo tên người chơi) ---------------- */
  const STORE_KEY = 'tronparty.typing';
  // mine = Bộ từ của tôi [{w, vi}], ghost = bản ghi Đua Xe kỷ lục { wpm, prog: [tỉ lệ sau mỗi 0,5 giây] }
  function blank() { return { srs: {}, keys: {}, best: {}, hist: [], unlocked: FINGER_START, days: [], last: 0, mine: [], ghost: null }; }
  function loadAll(storage) {
    try { const s = storage && storage.getItem(STORE_KEY); return s ? JSON.parse(s) : {}; } catch (e) { return {}; }
  }
  function loadProfile(storage, name) {
    const all = loadAll(storage);
    return Object.assign(blank(), all[name] || {});
  }
  function saveProfile(storage, name, prof) {
    try {
      const all = loadAll(storage);
      prof.hist = prof.hist.slice(-400);
      all[name] = prof;
      storage && storage.setItem(STORE_KEY, JSON.stringify(all));
      return true;
    } catch (e) { return false; }
  }
  /** cộng thống kê phím của một phiên vào hồ sơ */
  function mergeKeys(prof, perKey) {
    for (const k in perKey) {
      const a = prof.keys[k] || (prof.keys[k] = { n: 0, err: 0, ms: 0 }), b = perKey[k];
      a.n += b.n; a.err += b.err; a.ms += b.ms;
      // giữ khoảng 300 lần gần nhất để phản ánh hiện tại
      if (a.n > 300) { const f = 300 / a.n; a.n = 300; a.err = Math.round(a.err * f); a.ms = Math.round(a.ms * f); }
    }
  }
  function markDay(prof, day) {
    if (!prof.days.includes(day)) prof.days.push(day);
    prof.days = prof.days.slice(-400);
  }
  function streak(prof, day) {
    const set = new Set(prof.days);
    let n = 0, d = set.has(day) ? day : day - 1;
    while (set.has(d)) { n++; d--; }
    return n;
  }

  return { LEVELS, POS_VI, BOX_DAYS, KNOWN_BOX, makeBank, byLevel, shuffle, pickWords, posVi, Session, isImeKey,
    today, review, pickCards, srsStats, FINGER_ORDER, FINGER_START, FINGER, fingerWords, weakness,
    MINE_MAX, parseMine, mineBank, makeSents, pickSents, bare, PACE_STEP, paceSchedule, paceAt, paceFinish,
    byDay, recentWpm, markWrong, boxCounts,
    STORE_KEY, loadProfile, saveProfile, mergeKeys, markDay, streak };
});
