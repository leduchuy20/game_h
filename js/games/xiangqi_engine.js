'use strict';
/* =========================================================
   Lõi Cờ Tướng: luật, sinh nước đi, đánh giá, tìm kiếm (AI), ký hiệu kiểu Việt.
   Một hàm factory để chạy được cả ở luồng chính lẫn trong Web Worker (BoardKit.ai).
   Ô: sq = (hàng + 2) * 16 + (cột + 3); hàng 0 = hàng cuối bên Đỏ, cột 0 = cột trái nhìn từ phía Đỏ.
   Quân: 1 Tướng, 2 Sĩ, 3 Tượng, 4 Mã, 5 Xe, 6 Pháo, 7 Tốt; +8 = quân Đen. Đỏ (0) đi trước, ở dưới.
   Nước đi: from | to << 8.
   ========================================================= */
function XiangqiEngineFactory() {
  'use strict';
  const K = 1, A = 2, B = 3, N = 4, R = 5, C = 6, P = 7;
  const START = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
  const ROW = (q) => (q >> 4) - 2, COL = (q) => (q & 15) - 3;
  const SQ = (r, f) => (r + 2) * 16 + f + 3;
  const IN = new Uint8Array(256), PAL = [new Uint8Array(256), new Uint8Array(256)], HALF = [new Uint8Array(256), new Uint8Array(256)];
  const SQS = [];
  for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
    const q = SQ(r, f);
    IN[q] = 1; SQS.push(q);
    if (f >= 3 && f <= 5 && r <= 2) PAL[0][q] = 1;
    if (f >= 3 && f <= 5 && r >= 7) PAL[1][q] = 1;
    HALF[r <= 4 ? 0 : 1][q] = 1;
  }
  const ORTH = [16, -16, 1, -1], DIAG1 = [17, 15, -17, -15], ELE = [34, 30, -34, -30];
  // Mã: bước + chân (ô cản ngay cạnh mã)
  const HD = [33, 31, -33, -31, 18, 14, -18, -14], HL = [16, 16, -16, -16, 1, -1, -1, 1];
  const mv = (f, t) => f | (t << 8);
  const mFrom = (m) => m & 255, mTo = (m) => (m >> 8) & 255;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  /* ---------- Zobrist ---------- */
  let seed = 0x5bd1e995;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };
  const ZL = new Int32Array(16 * 256), ZH = new Int32Array(16 * 256);
  for (let i = 0; i < ZL.length; i++) { ZL[i] = rnd(); ZH[i] = rnd(); }
  const ZSL = rnd(), ZSH = rnd();

  class Pos {
    constructor(fen) { this.b = new Int8Array(256); this.undo = []; this.nst = []; this.reps = []; this.load(fen || START); }
    load(fen) {
      const b = this.b;
      b.fill(0);
      const [pl, sd, , , hm = '0', fm = '1'] = fen.trim().split(/\s+/);
      let r = 9, f = 0;
      for (const ch of pl) {
        if (ch === '/') { r--; f = 0; continue; }
        if (ch >= '1' && ch <= '9') { f += +ch; continue; }
        const lo = ch.toLowerCase(), t = 'kabnrcp'.indexOf(lo === 'h' ? 'n' : lo === 'e' ? 'b' : lo) + 1;
        b[SQ(r, f)] = t | (ch === lo ? 8 : 0);
        f++;
      }
      this.side = sd === 'b' ? 1 : 0;
      this.half = +hm || 0; this.full = +fm || 1;
      this.kings = [0, 0];
      for (const q of SQS) { if (b[q] === K) this.kings[0] = q; if (b[q] === (K | 8)) this.kings[1] = q; }
      let hl = 0, hh = 0;
      for (const q of SQS) if (b[q]) { hl ^= ZL[b[q] * 256 + q]; hh ^= ZH[b[q] * 256 + q]; }
      if (this.side) { hl ^= ZSL; hh ^= ZSH; }
      this.hl = hl; this.hh = hh;
      this.undo.length = 0; this.nst.length = 0; this.reps = [this.hl];
    }
    fen() {
      let s = '';
      for (let r = 9; r >= 0; r--) {
        let e = 0;
        for (let f = 0; f < 9; f++) {
          const p = this.b[SQ(r, f)];
          if (!p) { e++; continue; }
          if (e) { s += e; e = 0; }
          const ch = ' kabnrcp'[p & 7];
          s += p & 8 ? ch : ch.toUpperCase();
        }
        if (e) s += e;
        if (r) s += '/';
      }
      return `${s} ${this.side ? 'b' : 'w'} - - ${this.half} ${this.full}`;
    }
    /** ô t có bị bên `by` khống chế không (kể cả luật lộ mặt tướng) */
    attacked(t, by) {
      const b = this.b, c = by ? 8 : 0;
      for (let i = 0; i < 4; i++) {
        const d = ORTH[i];
        let s = t + d;
        while (IN[s] && !b[s]) s += d;
        if (!IN[s]) continue;
        const p = b[s];
        if (p === (R | c)) return true;
        if (p === (K | c) && (d === 16 || d === -16)) return true; // hai tướng đối mặt
        if (p === (K | c) && s === t + d) return true;
        if (p === (P | c)) {
          // Tốt đứng sát: tiến thẳng vào t, hoặc đã qua sông thì đi ngang
          if (s === t + d && ((by === 0 && d === -16) || (by === 1 && d === 16) || ((d === 1 || d === -1) && HALF[by ^ 1][s]))) return true;
        }
        s += d;
        while (IN[s] && !b[s]) s += d;
        if (IN[s] && b[s] === (C | c)) return true;
      }
      for (let i = 0; i < 8; i++) {
        const s = t - HD[i];
        if (IN[s] && b[s] === (N | c) && !b[s + HL[i]]) return true;
      }
      return false;
    }
    inCheck() { return this.attacked(this.kings[this.side], this.side ^ 1); }
    gen(out, caps) {
      const b = this.b, us = this.side, c = us ? 8 : 0;
      const add = (f, s) => {
        const q = b[s];
        if (!q) { if (!caps) out.push(mv(f, s)); } else if ((q & 8) !== c) out.push(mv(f, s));
      };
      for (let k = 0; k < 90; k++) {
        const sq = SQS[k], p = b[sq];
        if (!p || (p & 8) !== c) continue;
        switch (p & 7) {
          case K: for (let i = 0; i < 4; i++) { const s = sq + ORTH[i]; if (PAL[us][s]) add(sq, s); } break;
          case A: for (let i = 0; i < 4; i++) { const s = sq + DIAG1[i]; if (PAL[us][s]) add(sq, s); } break;
          case B: for (let i = 0; i < 4; i++) { const s = sq + ELE[i]; if (IN[s] && HALF[us][s] && !b[sq + ELE[i] / 2]) add(sq, s); } break;
          case N: for (let i = 0; i < 8; i++) { const s = sq + HD[i]; if (IN[s] && !b[sq + HL[i]]) add(sq, s); } break;
          case R:
            for (let i = 0; i < 4; i++) {
              const d = ORTH[i];
              for (let s = sq + d; IN[s]; s += d) { if (!b[s]) { if (!caps) out.push(mv(sq, s)); continue; } if ((b[s] & 8) !== c) out.push(mv(sq, s)); break; }
            }
            break;
          case C:
            for (let i = 0; i < 4; i++) {
              const d = ORTH[i];
              let s = sq + d;
              for (; IN[s] && !b[s]; s += d) if (!caps) out.push(mv(sq, s));
              if (!IN[s]) continue;
              for (s += d; IN[s] && !b[s]; s += d);
              if (IN[s] && (b[s] & 8) !== c) out.push(mv(sq, s));
            }
            break;
          case P: {
            const s = sq + (us ? -16 : 16);
            if (IN[s]) add(sq, s);
            if (HALF[us ^ 1][sq]) { if (IN[sq + 1]) add(sq, sq + 1); if (IN[sq - 1]) add(sq, sq - 1); }
            break;
          }
        }
      }
      return out;
    }
    make(m) {
      const b = this.b, f = mFrom(m), t = mTo(m), pc = b[f], cap = b[t], us = this.side;
      this.undo.push(m, cap, this.half, this.hl, this.hh);
      let hl = this.hl ^ ZL[pc * 256 + f] ^ ZL[pc * 256 + t] ^ ZSL, hh = this.hh ^ ZH[pc * 256 + f] ^ ZH[pc * 256 + t] ^ ZSH;
      if (cap) { hl ^= ZL[cap * 256 + t]; hh ^= ZH[cap * 256 + t]; }
      b[t] = pc; b[f] = 0;
      if ((pc & 7) === K) this.kings[us] = t;
      this.half = cap ? 0 : this.half + 1;
      if (us) this.full++;
      this.side ^= 1; this.hl = hl; this.hh = hh;
      this.reps.push(hl);
      if (this.attacked(this.kings[us], this.side)) { this.unmake(); return false; }
      return true;
    }
    unmake() {
      const u = this.undo, n = u.length, b = this.b;
      const m = u[n - 5], cap = u[n - 4];
      this.half = u[n - 3]; this.hl = u[n - 2]; this.hh = u[n - 1];
      u.length = n - 5;
      this.reps.pop();
      this.side ^= 1;
      const f = mFrom(m), t = mTo(m), pc = b[t];
      if (this.side) this.full--;
      b[f] = pc; b[t] = cap;
      if ((pc & 7) === K) this.kings[this.side] = f;
    }
    makeNull() {
      this.nst.push(this.half, this.hl, this.hh);
      this.half = 0; this.side ^= 1; this.hl ^= ZSL; this.hh ^= ZSH;
      this.reps.push(this.hl);
    }
    unmakeNull() {
      const s = this.nst, n = s.length;
      this.half = s[n - 3]; this.hl = s[n - 2]; this.hh = s[n - 1];
      s.length = n - 3; this.side ^= 1; this.reps.pop();
    }
    legal() {
      const out = [];
      for (const m of this.gen([], false)) if (this.make(m)) { this.unmake(); out.push(m); }
      return out;
    }
    isRep() {
      const r = this.reps, n = r.length - 1, h = r[n];
      for (let i = n - 2, lim = Math.max(0, n - this.half); i >= lim; i -= 2) if (r[i] === h) return true;
      return false;
    }
    repCount() {
      const r = this.reps, n = r.length - 1, h = r[n];
      let c = 0;
      for (let i = n - 2, lim = Math.max(0, n - this.half); i >= lim; i -= 2) if (r[i] === h) c++;
      return c;
    }
    /** chỉ số (trong reps) của lần xuất hiện sớm nhất của thế hiện tại, trong phạm vi chưa ăn quân */
    firstRep() {
      const r = this.reps, n = r.length - 1, h = r[n];
      let k = n;
      for (let i = n - 2, lim = Math.max(0, n - this.half); i >= lim; i -= 2) if (r[i] === h) k = i;
      return k;
    }
    /** bên side còn quân tấn công (Xe, Mã, Pháo, Tốt) */
    hasAttackers(side) {
      const c = side ? 8 : 0;
      for (const q of SQS) { const p = this.b[q]; if (p && (p & 8) === c && (p & 7) >= N) return true; }
      return false;
    }
    hasPieces(side) {
      const c = side ? 8 : 0;
      for (const q of SQS) { const p = this.b[q]; if (p && (p & 8) === c && (p & 7) >= N && (p & 7) <= C) return true; }
      return false;
    }
  }

  function perft(pos, d) {
    if (!d) return 1;
    let n = 0;
    for (const m of pos.gen([], false)) { if (!pos.make(m)) continue; n += perft(pos, d - 1); pos.unmake(); }
    return n;
  }

  /* ---------- Ký hiệu kiểu Việt: quân + cột (đếm từ phải sang của bên đi) + . tiến / / thoái / - bình + đích ---------- */
  const PL = ['', 'Tg', 'S', 'T', 'M', 'X', 'P', 'B'];
  function note(pos, m) {
    const b = pos.b, f = mFrom(m), t = mTo(m), p = b[f], ty = p & 7, side = p & 8 ? 1 : 0;
    const fileNum = (q) => (side === 0 ? 9 - COL(q) : COL(q) + 1);
    const fwd = side === 0 ? ROW(t) - ROW(f) : ROW(f) - ROW(t);
    let tag = String(fileNum(f));
    // hai (ba) quân cùng loại cùng cột: t = trước, g = giữa, s = sau (theo hướng tiến của bên đi)
    const same = SQS.filter((q) => b[q] === p && COL(q) === COL(f));
    if (same.length > 1 && ty !== A && ty !== B) {
      same.sort((x, y) => (side === 0 ? ROW(y) - ROW(x) : ROW(x) - ROW(y)));
      const k = same.indexOf(f);
      tag = same.length === 2 ? (k === 0 ? 't' : 's') : (k === 0 ? 't' : k === same.length - 1 ? 's' : 'g');
    }
    let act, tgt;
    if (fwd === 0) { act = '-'; tgt = fileNum(t); } else { act = fwd > 0 ? '.' : '/'; tgt = ty === A || ty === B || ty === N ? fileNum(t) : Math.abs(fwd); }
    return PL[ty] + tag + act + tgt;
  }

  /* ---------- Sách khai cuộc nhỏ (để máy đi đa dạng + hiện tên) ---------- */
  const BOOK0 = [
    { name: 'Pháo đầu', line: ['P2-5'] },
    { name: 'Pháo đầu – Bình phong mã', line: ['P2-5', 'M8.7', 'M2.3', 'M2.3', 'X1-2', 'X9-8'] },
    { name: 'Pháo đầu – Bình phong mã', line: ['P2-5', 'M2.3', 'M2.3', 'M8.7'] },
    { name: 'Thuận pháo', line: ['P2-5', 'P8-5', 'M2.3', 'M8.7'] },
    { name: 'Nghịch pháo', line: ['P2-5', 'P2-5', 'M2.3', 'M8.7'] },
    { name: 'Pháo đầu – Phản cung mã', line: ['P2-5', 'M2.3', 'M2.3', 'P8-6'] },
    { name: 'Tiên nhân chỉ lộ', line: ['B7.1', 'B7.1', 'M8.7', 'M2.3'] },
    { name: 'Tiên nhân chỉ lộ – Tốt để Pháo', line: ['B7.1', 'P2-3'] },
    { name: 'Phi tượng cục', line: ['T3.5', 'B7.1', 'M2.3', 'M8.7'] },
    { name: 'Phi tượng – Quá cung pháo', line: ['T3.5', 'P8-4'] },
    { name: 'Khởi mã cục', line: ['M2.3', 'B7.1', 'B7.1', 'M8.7'] },
    { name: 'Sĩ giác pháo', line: ['P2-4', 'M8.7', 'M2.3'] },
    { name: 'Quá cung pháo', line: ['P2-6', 'M8.7'] },
  ];
  // thêm bản đối xứng trái–phải của mỗi đường (vd. P8-5 cũng là Pháo đầu)
  const mirrorNote = (n) => n.replace(/^(Tg|S|T|M|X|P|B)([1-9tsg])([.\/-])(\d)$/, (_, pc, fl, act, tg) =>
    pc + (/\d/.test(fl) ? 10 - fl : fl) + act + (act === '-' || pc === 'M' || pc === 'T' || pc === 'S' ? 10 - tg : tg));
  const BOOK = BOOK0.concat(BOOK0.map((e) => ({ name: e.name, line: e.line.map(mirrorNote) })));
  /** tên khai cuộc của dãy ký hiệu đã đi (khớp tiền tố dài nhất ≥ 1 nước) */
  function openingName(notes) {
    let best = null, bl = 0;
    for (const e of BOOK) {
      let k = 0;
      while (k < e.line.length && k < notes.length && e.line[k] === notes[k]) k++;
      if (k > bl && (k === notes.length || k === e.line.length)) { best = e.name; bl = k; }
    }
    return best;
  }
  /** nước sách cho thế hiện tại (đã đi `notes`), hoặc 0 */
  function bookMove(pos, notes) {
    const nexts = [];
    for (const e of BOOK) {
      if (e.line.length <= notes.length) continue;
      if (notes.every((x, i) => e.line[i] === x)) nexts.push(e.line[notes.length]);
    }
    if (!nexts.length) return 0;
    const want = nexts[Math.floor(Math.random() * nexts.length)];
    const legal = pos.legal();
    return legal.find((m) => note(pos, m) === want) || 0;
  }

  /* ---------- Đánh giá ---------- */
  const PST = Array.from({ length: 8 }, () => new Int16Array(90));
  for (let r = 0; r < 10; r++) for (let f = 0; f < 9; f++) {
    const i = r * 9 + f, cf = 4 - Math.abs(f - 4);
    // Tốt: chưa qua sông gần như 0; qua sông có giá, càng gần cung càng tốt, hàng đáy kém đi
    PST[P][i] = r <= 2 ? -10 : r <= 4 ? (f === 4 && r === 4 ? 10 : 0) : r === 9 ? 30 + cf * 3 : 70 + (r - 5) * 12 + cf * 8;
    PST[N][i] = cf * 7 + (r >= 2 && r <= 7 ? 12 : 0) + (r >= 5 ? 10 : 0) - (r === 0 ? 15 : 0) - (f === 0 || f === 8 ? 12 : 0);
    PST[R][i] = (r >= 5 && r <= 7 ? 15 : 0) + (f === 3 || f === 5 ? 6 : f === 4 ? 4 : 0) + (r === 1 ? 8 : 0);
    PST[C][i] = (f === 4 && r <= 3 ? 25 : 0) + (r === 2 ? 4 : 0) + (r >= 7 ? 6 : 0) + cf * 2;
    PST[K][i] = r === 0 ? 10 : r === 1 ? -10 : -30;
    PST[A][i] = (r === 1 && f === 4) ? 6 : 0;
    PST[B][i] = (r === 2 && f === 4) ? 6 : (r === 0 && (f === 2 || f === 6)) ? 3 : 0;
  }
  const VMG = [0, 0, 200, 200, 390, 900, 470, 100], VEG = [0, 0, 200, 200, 440, 900, 410, 120];
  const PH = [0, 0, 0, 0, 1, 2, 1, 0];
  function evaluate(pos) {
    const b = pos.b;
    let mg = 0, eg = 0, phase = 0;
    const cnt = [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]];
    for (let k = 0; k < 90; k++) {
      const q = SQS[k], p = b[q];
      if (!p) continue;
      const t = p & 7, s = p & 8 ? 1 : 0, r = ROW(q), f = COL(q);
      const i = s ? (9 - r) * 9 + (8 - f) : r * 9 + f;
      const v1 = VMG[t] + PST[t][i], v2 = VEG[t] + PST[t][i];
      if (s) { mg -= v1; eg -= v2; } else { mg += v1; eg += v2; }
      phase += PH[t]; cnt[s][t]++;
    }
    // an toàn tướng: thiếu Sĩ khi đối phương còn Xe, thiếu Tượng khi đối phương còn Pháo
    for (let s = 0; s < 2; s++) {
      const o = cnt[s ^ 1], me = cnt[s];
      let pen = 0;
      if (o[R]) pen += (2 - me[A]) * 25;
      if (o[C]) pen += (2 - me[B]) * 20;
      if (o[N] + o[R] + o[C] === 0) pen = 0;
      mg += s ? pen : -pen; eg += s ? pen * 0.5 : -pen * 0.5;
    }
    const ph = Math.min(16, phase);
    let sc = Math.round((mg * ph + eg * (16 - ph)) / 16) + (pos.side ? -12 : 12);
    // không còn quân tấn công thì không thể thắng: kéo điểm về 0
    const atk = (s) => cnt[s][N] + cnt[s][R] + cnt[s][C] + cnt[s][P];
    if (!atk(0) && sc > 0) sc = Math.round(sc / 8);
    if (!atk(1) && sc < 0) sc = Math.round(sc / 8);
    return pos.side ? -sc : sc;
  }

  /* ---------- Tìm kiếm (giống Cờ Vua) ---------- */
  const INF = 32000, MATE = 31000;
  const TT_SIZE = 1 << 20, TT_MASK = TT_SIZE - 1;
  let ttK = null, ttM, ttS, ttD, ttF;
  function ttInit() {
    if (ttK) return;
    ttK = new Int32Array(TT_SIZE); ttM = new Int32Array(TT_SIZE); ttS = new Int16Array(TT_SIZE); ttD = new Int8Array(TT_SIZE); ttF = new Int8Array(TT_SIZE);
  }
  const VICT = [0, 3000, 200, 200, 400, 900, 450, 100];
  function scoreMoves(S, ms, ttMove, ply) {
    const b = S.pos.b, sc = new Int32Array(ms.length), k1 = S.killers[ply * 2], k2 = S.killers[ply * 2 + 1];
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i], cap = b[mTo(m)];
      if (m === ttMove) sc[i] = 3000000;
      else if (cap) sc[i] = 2000000 + VICT[cap & 7] * 16 - (b[mFrom(m)] & 7);
      else if (m === k1) sc[i] = 1800000;
      else if (m === k2) sc[i] = 1799999;
      else sc[i] = S.hist[(b[mFrom(m)] & 15) * 256 + mTo(m)];
    }
    return sc;
  }
  function pickNext(ms, sc, i) {
    let bi = i;
    for (let j = i + 1; j < ms.length; j++) if (sc[j] > sc[bi]) bi = j;
    if (bi !== i) { const t = ms[i]; ms[i] = ms[bi]; ms[bi] = t; const u = sc[i]; sc[i] = sc[bi]; sc[bi] = u; }
  }
  function tick(S) {
    if ((++S.nodes & 1023) === 0 && now() - S.t0 > S.limit) S.stop = true;
    return S.stop;
  }
  function qsearch(S, alpha, beta, ply) {
    if (tick(S)) return 0;
    const pos = S.pos, stand = evaluate(pos);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply > 90) return stand;
    const ms = pos.gen([], true), sc = scoreMoves(S, ms, 0, Math.min(ply, 120));
    let best = stand;
    for (let i = 0; i < ms.length; i++) {
      pickNext(ms, sc, i);
      const m = ms[i];
      if (stand + VICT[pos.b[mTo(m)] & 7] + 200 < alpha) continue;
      if (!pos.make(m)) continue;
      const s = -qsearch(S, -beta, -alpha, ply + 1);
      pos.unmake();
      if (S.stop) return 0;
      if (s > best) best = s;
      if (s > alpha) { alpha = s; if (s >= beta) break; }
    }
    return best;
  }
  function negamax(S, depth, alpha, beta, ply) {
    if (tick(S)) return 0;
    const pos = S.pos;
    if (ply && (pos.half >= 120 || pos.isRep())) return 0;
    if (ply >= 100) return evaluate(pos);
    const inCheck = pos.inCheck();
    if (inCheck) depth++;
    if (depth <= 0) return qsearch(S, alpha, beta, ply);
    alpha = Math.max(alpha, -MATE + ply); beta = Math.min(beta, MATE - ply - 1);
    if (alpha >= beta) return alpha;
    const ti = pos.hl & TT_MASK;
    let ttMove = 0;
    if (ttF[ti] && ttK[ti] === pos.hh) {
      ttMove = ttM[ti];
      if (ttD[ti] >= depth) {
        let s = ttS[ti];
        if (s > MATE - 300) s -= ply; else if (s < -MATE + 300) s += ply;
        const fl = ttF[ti];
        if (fl === 1 || (fl === 2 && s >= beta) || (fl === 3 && s <= alpha)) return s;
      }
    }
    const pv = beta - alpha > 1;
    if (!pv && !inCheck && depth >= 3 && beta < MATE - 300 && pos.hasPieces(pos.side) && evaluate(pos) >= beta) {
      pos.makeNull();
      const s = -negamax(S, depth - 3, -beta, -beta + 1, ply + 1);
      pos.unmakeNull();
      if (S.stop) return 0;
      if (s >= beta) return beta;
    }
    const ms = pos.gen([], false), sc = scoreMoves(S, ms, ttMove, ply);
    const a0 = alpha;
    let legal = 0, bestS = -INF, bestM = 0;
    for (let i = 0; i < ms.length; i++) {
      pickNext(ms, sc, i);
      const m = ms[i];
      const quiet = !pos.b[mTo(m)];
      if (!pos.make(m)) continue;
      legal++;
      let s;
      if (legal === 1) s = -negamax(S, depth - 1, -beta, -alpha, ply + 1);
      else {
        let r = 0;
        if (depth >= 3 && legal > 3 && quiet && !inCheck && !pos.inCheck()) r = legal > 10 && depth >= 5 ? 2 : 1;
        s = -negamax(S, depth - 1 - r, -alpha - 1, -alpha, ply + 1);
        if (s > alpha && r && !S.stop) s = -negamax(S, depth - 1, -alpha - 1, -alpha, ply + 1);
        if (s > alpha && s < beta && !S.stop) s = -negamax(S, depth - 1, -beta, -alpha, ply + 1);
      }
      pos.unmake();
      if (S.stop) return 0;
      if (s > bestS) { bestS = s; bestM = m; }
      if (s > alpha) {
        alpha = s;
        if (s >= beta) {
          if (quiet) {
            if (S.killers[ply * 2] !== m) { S.killers[ply * 2 + 1] = S.killers[ply * 2]; S.killers[ply * 2] = m; }
            const hi = (pos.b[mFrom(m)] & 15) * 256 + mTo(m);
            S.hist[hi] = Math.min(1000000, S.hist[hi] + depth * depth);
          }
          break;
        }
      }
    }
    // Cờ Tướng: hết nước đi (kể cả không bị chiếu) là THUA
    if (!legal) return -MATE + ply;
    if (ttK[ti] !== pos.hh || ttD[ti] <= depth) {
      let s = bestS;
      if (s > MATE - 300) s += ply; else if (s < -MATE + 300) s -= ply;
      ttK[ti] = pos.hh; ttM[ti] = bestM; ttS[ti] = s; ttD[ti] = depth; ttF[ti] = bestS >= beta ? 2 : bestS > a0 ? 1 : 3;
    }
    return bestS;
  }
  /**
   * o = { time (ms), depth, multi, noise, blunder, margin, ban: [nước cấm — vd. chiếu dài sẽ bị xử thua] }
   */
  function think(pos, o) {
    ttInit();
    o = o || {};
    const S = { pos, nodes: 0, stop: false, t0: now(), limit: o.time || 2000, killers: new Int32Array(260), hist: new Int32Array(16 * 256) };
    let root = pos.legal();
    if (o.ban && o.ban.length) { const r2 = root.filter((m) => !o.ban.includes(m)); if (r2.length) root = r2; }
    if (!root.length) return { move: 0, score: 0, depth: 0, nodes: 0 };
    if (root.length === 1) return { move: root[0], score: 0, depth: 0, nodes: 0 };
    const ti = pos.hl & TT_MASK;
    if (ttF[ti] && ttK[ti] === pos.hh) { const k = root.indexOf(ttM[ti]); if (k > 0) { root.splice(k, 1); root.unshift(ttM[ti]); } }
    let best = root[0], bestScore = -INF, depthDone = 0, scores = null;
    const maxD = o.depth || 64;
    for (let d = 1; d <= maxD; d++) {
      let alpha = -INF, iterBest = 0, iterScore = -INF, done = 0;
      const sc = new Array(root.length).fill(-INF);
      for (let i = 0; i < root.length; i++) {
        const m = root[i];
        pos.make(m);
        let s;
        if (o.multi || i === 0) s = -negamax(S, d - 1, -INF, o.multi ? INF : -alpha, 1);
        else {
          s = -negamax(S, d - 1, -alpha - 1, -alpha, 1);
          if (s > alpha && !S.stop) s = -negamax(S, d - 1, -INF, -alpha, 1);
        }
        pos.unmake();
        if (S.stop) break;
        sc[i] = s; done++;
        if (s > iterScore) { iterScore = s; iterBest = m; }
        if (s > alpha) alpha = s;
      }
      if (S.stop) { if (done && !o.multi) { best = iterBest; bestScore = iterScore; } break; }
      best = iterBest; bestScore = iterScore; depthDone = d;
      const idx = root.map((_, i) => i).sort((a, b) => sc[b] - sc[a]);
      root = idx.map((i) => root[i]); scores = idx.map((i) => sc[i]);
      if (Math.abs(bestScore) > MATE - 200) break;
      if (now() - S.t0 > S.limit * 0.5) break;
    }
    let pick = best;
    if (o.multi && scores) {
      const noise = o.noise || 0;
      let bi = 0, bv = -Infinity;
      scores.forEach((s, i) => { const v = s + (Math.random() * 2 - 1) * noise; if (v > bv) { bv = v; bi = i; } });
      pick = root[bi];
      if (o.blunder && Math.random() < o.blunder) {
        const ok = root.filter((_, i) => scores[i] >= scores[0] - (o.margin || 200) && scores[i] > -MATE + 300);
        if (ok.length) pick = ok[Math.floor(Math.random() * ok.length)];
      }
    }
    return { move: pick, score: bestScore, depth: depthDone, nodes: S.nodes };
  }

  return {
    START, K, A, B, N, R, C, P, MATE, ROW, COL, SQ, SQS, IN,
    Pos, mv, mFrom, mTo, perft, note, evaluate, think, openingName, bookMove, BOOK,
  };
}
if (typeof window !== 'undefined') window.XiangqiEngine = XiangqiEngineFactory();
