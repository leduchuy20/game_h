// Caro — luật + máy chơi (thuần, không đụng DOM). Viết dạng hàm factory để nhúng được vào Web Worker
// (BoardKit.ai dùng factory.toString()) và chạy được bằng node để test (tools/caro-test.js).
//   window.CaroEngineFactory / window.CaroEngine (trình duyệt) · module.exports = CaroEngineFactory (node)
// Ô = r * N + c. Giá trị ô: 0 trống, 1 = X, 2 = O.
// Luật: 'block2' (chặn hai đầu, kiểu Việt Nam: dãy ≥ 5 thắng trừ khi CẢ HAI đầu là quân đối thủ),
//       'free' (≥ 5 là thắng), 'exact' (đúng 5, dãy 6+ không tính).
function CaroEngineFactory() {
  'use strict';
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const BIG = 1e9;

  class Board {
    constructor(n = 50, rule = 'block2') {
      this.n = n; this.rule = rule;
      this.c = new Int8Array(n * n);
      this.moves = [];
    }
    get(r, c) { return r < 0 || c < 0 || r >= this.n || c >= this.n ? -1 : this.c[r * this.n + c]; }
    play(i, col) { this.c[i] = col; this.moves.push(i); }
    undo() { this.c[this.moves.pop()] = 0; }
    get full() { return this.moves.length >= this.n * this.n; }
    /** dãy thắng qua ô i (đã có quân) theo luật → mảng ô, hoặc null */
    winLine(i) {
      const col = this.c[i];
      if (!col) return null;
      const n = this.n, r0 = (i / n) | 0, c0 = i % n, opp = 3 - col;
      for (const [dr, dc] of DIRS) {
        let a = 0, b = 0;
        while (this.get(r0 - (a + 1) * dr, c0 - (a + 1) * dc) === col) a++;
        while (this.get(r0 + (b + 1) * dr, c0 + (b + 1) * dc) === col) b++;
        const len = a + b + 1;
        if (len < 5) continue;
        if (this.rule === 'exact' && len !== 5) continue;
        if (this.rule === 'block2') {
          const e1 = this.get(r0 - (a + 1) * dr, c0 - (a + 1) * dc), e2 = this.get(r0 + (b + 1) * dr, c0 + (b + 1) * dc);
          if (e1 === opp && e2 === opp) continue;
        }
        const out = [];
        for (let k = -a; k <= b; k++) out.push((r0 + k * dr) * n + c0 + k * dc);
        return out;
      }
      return null;
    }
    /** đặt col vào ô trống i có thắng ngay không */
    wouldWin(i, col) {
      if (this.c[i]) return false;
      this.c[i] = col;
      const w = !!this.winLine(i);
      this.c[i] = 0;
      return w;
    }
    /** các ô trống trong khoảng d quanh mọi quân (ô ứng viên) */
    near(d = 2) {
      const n = this.n, seen = new Uint8Array(n * n), out = [];
      for (const i of this.moves) {
        const r0 = (i / n) | 0, c0 = i % n;
        for (let r = Math.max(0, r0 - d); r <= Math.min(n - 1, r0 + d); r++) {
          for (let c = Math.max(0, c0 - d); c <= Math.min(n - 1, c0 + d); c++) {
            const j = r * n + c;
            if (!this.c[j] && !seen[j]) { seen[j] = 1; out.push(j); }
          }
        }
      }
      return out;
    }
    /** các ô (trống) dọc 4 hướng qua i, cách tối đa k ô — chỗ có thể tạo/hoàn thành dãy */
    lineCells(i, k = 4) {
      const n = this.n, r0 = (i / n) | 0, c0 = i % n, out = [];
      for (const [dr, dc] of DIRS) {
        for (let s = -k; s <= k; s++) {
          if (!s) continue;
          const r = r0 + s * dr, c = c0 + s * dc;
          if (r < 0 || c < 0 || r >= n || c >= n) continue;
          const j = r * n + c;
          if (!this.c[j]) out.push(j);
        }
      }
      return out;
    }
    /** các ô col đặt vào là thắng ngay, quanh ô i (sau khi i đã có quân) */
    winsAround(i, col) {
      const out = [];
      for (const j of this.lineCells(i, 4)) if (out.indexOf(j) < 0 && this.wouldWin(j, col)) out.push(j);
      return out;
    }
    /** mọi ô col thắng ngay (quét ô ứng viên) */
    allWins(col) {
      const out = [];
      for (const j of this.near(1)) if (this.wouldWin(j, col)) out.push(j);
      return out;
    }
  }

  /* ---------- chấm điểm một nước ---------- */
  const WIN_W = [0, 1, 6, 40, 160, 0];
  /** điểm "cửa sổ 5 ô" dọc các hướng qua i cho col (dãy hai, dãy một — để chọn nước êm) */
  function windowScore(b, i, col) {
    const n = b.n, r0 = (i / n) | 0, c0 = i % n, opp = 3 - col;
    let s = 0;
    for (const [dr, dc] of DIRS) {
      for (let st = -4; st <= 0; st++) {
        let k = 0, ok = true;
        for (let t = 0; t < 5; t++) {
          const v = b.get(r0 + (st + t) * dr, c0 + (st + t) * dc);
          if (v === -1 || v === opp) { ok = false; break; }
          if (v === col) k++;
        }
        if (ok) s += WIN_W[Math.min(4, k)];
      }
    }
    return s;
  }
  /**
   * phân tích nước col đặt ở i: { win, four (số hướng có 1 ô thắng), open4 (hướng có ≥2 ô thắng), three (hướng tạo được bốn mở), c3 }
   * Đếm theo luật thật (wouldWin) nên đúng cả với luật chặn hai đầu / đúng 5.
   */
  function shape(b, i, col) {
    const n = b.n, r0 = (i / n) | 0, c0 = i % n;
    b.c[i] = col;
    const o = { win: !!b.winLine(i), four: 0, open4: 0, three: 0, c3: 0 };
    if (!o.win) {
      for (const [dr, dc] of DIRS) {
        // ô trống trên hướng này trong tầm 4
        const cells = [];
        for (let s = -4; s <= 4; s++) {
          if (!s) continue;
          const r = r0 + s * dr, c = c0 + s * dc;
          if (r < 0 || c < 0 || r >= n || c >= n) continue;
          const j = r * n + c;
          if (!b.c[j]) cells.push(j);
        }
        let w = 0;
        for (const j of cells) if (b.wouldWin(j, col)) w++;
        if (w >= 2) { o.open4++; continue; }
        if (w === 1) { o.four++; continue; }
        // dãy ba: thêm 1 quân trên hướng này thành bốn mở (≥2 ô thắng) hay bốn thường
        let best = 0;
        for (const j of cells) {
          b.c[j] = col;
          let w2 = 0;
          for (const k of cells) if (k !== j && b.wouldWin(k, col)) { w2++; if (w2 >= 2) break; }
          b.c[j] = 0;
          if (w2 > best) best = w2;
          if (best >= 2) break;
        }
        if (best >= 2) o.three++; else if (best === 1) o.c3++;
      }
    }
    b.c[i] = 0;
    return o;
  }
  function shapeValue(o) {
    if (o.win) return 1e8;
    if (o.open4 || o.four >= 2) return 5e6;          // không chặn nổi
    if (o.four && o.three) return 2e6;               // bốn – ba
    if (o.three >= 2) return 8e5;                    // ba – ba
    return o.four * 6e4 + o.three * 3e4 + o.c3 * 2500;
  }
  /** điểm ô i cho người đi col: tấn công + phòng thủ (chặn đối thủ) */
  function moveScore(b, i, col, defW = 0.9) {
    const opp = 3 - col;
    const a = shapeValue(shape(b, i, col)) + windowScore(b, i, col);
    const d = shapeValue(shape(b, i, opp)) + windowScore(b, i, opp);
    return a + d * defW;
  }

  /* ---------- VCF: thắng bằng chuỗi nước bốn liên tục ---------- */
  function vcf(b, col, depth, budget) {
    if (depth <= 0 || budget.n <= 0) return null;
    const opp = 3 - col;
    const cand = b.near(2);
    for (const m of cand) if (b.wouldWin(m, col)) return [m];
    for (const m of cand) {
      if (--budget.n <= 0) return null;
      b.c[m] = col;
      const w = b.winsAround(m, col);
      if (!w.length) { b.c[m] = 0; continue; }
      if (w.length >= 2) { b.c[m] = 0; return [m]; }
      // đối thủ buộc phải chặn w[0]; chặn mà thành năm hoặc tạo bốn ngược thì bỏ nhánh này
      const blk = w[0];
      b.c[blk] = opp;
      let bad = !!b.winLine(blk) || b.winsAround(blk, opp).length > 0;
      let r = null;
      if (!bad) {
        b.moves.push(m); b.moves.push(blk);
        r = vcf(b, col, depth - 1, budget);
        b.moves.pop(); b.moves.pop();
      }
      b.c[blk] = 0; b.c[m] = 0;
      if (r) return [m, blk].concat(r);
    }
    return null;
  }

  /* ---------- máy chọn nước ---------- */
  const LV = {
    easy: { noise: 0.9, defW: 0.55, missWin: 0.12, missBlock: 0.18, vcf: 0, guard: 0, top: 6 },
    normal: { noise: 0.25, defW: 0.85, missWin: 0, missBlock: 0, vcf: 4, guard: 0, top: 3 },
    hard: { noise: 0.04, defW: 0.95, missWin: 0, missBlock: 0, vcf: 12, guard: 8, top: 1 },
  };
  /**
   * think(b, col, level, rnd) → ô sẽ đi. rnd: hàm ngẫu nhiên [0,1) (để test lặp lại được).
   */
  function think(b, col, level = 'normal', rnd = Math.random) {
    const L = LV[level] || LV.normal, n = b.n, opp = 3 - col;
    if (!b.moves.length) {
      const m = (n >> 1) * n + (n >> 1);
      return level === 'hard' ? m : m + (Math.floor(rnd() * 3) - 1) * n + Math.floor(rnd() * 3) - 1;
    }
    const cand = b.near(2);
    // 1. thắng ngay
    if (rnd() >= L.missWin) for (const m of cand) if (b.wouldWin(m, col)) return m;
    // 2. chặn đối thủ sắp thắng
    const threats = cand.filter((m) => b.wouldWin(m, opp));
    if (threats.length && rnd() >= L.missBlock) return threats[0];
    // 3. chuỗi bốn liên tục
    if (L.vcf && !threats.length) {
      const seq = vcf(b, col, L.vcf, { n: level === 'hard' ? 6000 : 800 });
      if (seq) return seq[0];
    }
    // 4. chấm điểm
    let list = cand.map((m) => ({ m, s: moveScore(b, m, col, L.defW) * (1 + (rnd() * 2 - 1) * L.noise) }));
    list.sort((x, y) => y.s - x.s);
    // Khó: bỏ nước để đối thủ có chuỗi bốn thắng
    if (L.guard) {
      for (const it of list.slice(0, L.guard)) {
        b.play(it.m, col);
        const bad = vcf(b, opp, 8, { n: 1500 });
        b.undo();
        if (!bad) return it.m;
      }
      return list[0].m;
    }
    const k = Math.min(L.top, list.length);
    // chọn trong top-k, nghiêng về nước tốt nhất
    const pick = Math.floor(Math.pow(rnd(), 2.2) * k);
    return list[pick].m;
  }

  /** ô nguy hiểm của col (để gợi ý cho người mới): {win:[...], open:[...]} */
  function dangers(b, col) {
    const win = [], open = [];
    for (const m of b.near(2)) {
      if (b.wouldWin(m, col)) { win.push(m); continue; }
      const o = shape(b, m, col);
      if (o.open4 || o.four >= 2) open.push(m);
    }
    return { win, open };
  }

  return { Board, think, shape, moveScore, vcf, dangers, LV, BIG };
}
if (typeof module !== 'undefined' && module.exports) module.exports = CaroEngineFactory;
if (typeof window !== 'undefined') { window.CaroEngineFactory = CaroEngineFactory; window.CaroEngine = CaroEngineFactory(); }
