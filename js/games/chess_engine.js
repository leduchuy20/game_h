'use strict';
/* =========================================================
   Lõi Cờ Vua: luật, sinh nước đi, đánh giá thế cờ, tìm kiếm (AI).
   Viết trong MỘT hàm factory để chạy được cả ở luồng chính lẫn trong Web Worker
   (worker được tạo từ ChessEngineFactory.toString() — xem board_base.js).
   Bàn 0x88: ô = hàng*16 + cột (hàng 0 = hàng 1 của Trắng). Quân: 1 Tốt, 2 Mã, 3 Tượng, 4 Xe, 5 Hậu, 6 Vua; +8 = quân Đen.
   Nước đi là số nguyên: from | to<<7 | phong cấp<<14 | cờ<<17.
   ========================================================= */
function ChessEngineFactory() {
  'use strict';
  const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const ND = [33, 31, 18, 14, -33, -31, -18, -14], BD = [15, 17, -15, -17], RD = [1, -1, 16, -16];
  const KD = [15, 17, -15, -17, 1, -1, 16, -16];
  const F_CAP = 1, F_EP = 2, F_CASTLE = 4, F_DOUBLE = 8;
  const mv = (f, t, promo, fl) => f | (t << 7) | (promo << 14) | (fl << 17);
  const mFrom = (m) => m & 127, mTo = (m) => (m >> 7) & 127, mPromo = (m) => (m >> 14) & 7, mFlag = (m) => m >> 17;
  const FILES = 'abcdefgh';
  const sqName = (q) => FILES[q & 7] + ((q >> 4) + 1);
  const sqOf = (s) => (s.charCodeAt(1) - 49) * 16 + (s.charCodeAt(0) - 97);
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  /* ---------- Zobrist ---------- */
  let seed = 0x2545f491;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };
  const ZL = new Int32Array(16 * 128), ZH = new Int32Array(16 * 128);
  for (let i = 0; i < ZL.length; i++) { ZL[i] = rnd(); ZH[i] = rnd(); }
  const ZCL = new Int32Array(16), ZCH = new Int32Array(16), ZEL = new Int32Array(128), ZEH = new Int32Array(128);
  for (let i = 0; i < 16; i++) { ZCL[i] = rnd(); ZCH[i] = rnd(); }
  for (let i = 0; i < 128; i++) { ZEL[i] = rnd(); ZEH[i] = rnd(); }
  const ZSL = rnd(), ZSH = rnd();
  // quyền nhập thành: bit 1 Trắng cánh Vua, 2 Trắng cánh Hậu, 4 Đen cánh Vua, 8 Đen cánh Hậu
  const CRM = new Int8Array(128).fill(15);
  CRM[0] = 13; CRM[7] = 14; CRM[4] = 12; CRM[112] = 7; CRM[119] = 11; CRM[116] = 3;

  class Pos {
    constructor(fen) { this.b = new Int8Array(128); this.undo = []; this.nst = []; this.reps = []; this.load(fen || START); }
    load(fen) {
      const b = this.b;
      b.fill(0);
      const [pl, sd, cs = '-', ep = '-', hm = '0', fm = '1'] = fen.trim().split(/\s+/);
      let r = 7, f = 0;
      for (const ch of pl) {
        if (ch === '/') { r--; f = 0; continue; }
        if (ch >= '1' && ch <= '8') { f += +ch; continue; }
        const lo = ch.toLowerCase();
        b[r * 16 + f] = ('pnbrqk'.indexOf(lo) + 1) | (ch === lo ? 8 : 0);
        f++;
      }
      this.side = sd === 'b' ? 1 : 0;
      this.castle = (cs.includes('K') ? 1 : 0) | (cs.includes('Q') ? 2 : 0) | (cs.includes('k') ? 4 : 0) | (cs.includes('q') ? 8 : 0);
      this.ep = ep !== '-' ? sqOf(ep) : -1;
      this.half = +hm || 0; this.full = +fm || 1;
      this.kings = [-1, -1];
      for (let q = 0; q < 128; q++) { if (b[q] === 6) this.kings[0] = q; if (b[q] === 14) this.kings[1] = q; }
      this.rehash();
      this.undo.length = 0; this.nst.length = 0; this.reps = [this.hl];
    }
    rehash() {
      let hl = 0, hh = 0;
      for (let q = 0; q < 128; q++) if (!(q & 0x88) && this.b[q]) { hl ^= ZL[this.b[q] * 128 + q]; hh ^= ZH[this.b[q] * 128 + q]; }
      if (this.side) { hl ^= ZSL; hh ^= ZSH; }
      hl ^= ZCL[this.castle]; hh ^= ZCH[this.castle];
      if (this.ep >= 0) { hl ^= ZEL[this.ep]; hh ^= ZEH[this.ep]; }
      this.hl = hl; this.hh = hh;
    }
    fen() {
      let s = '';
      for (let r = 7; r >= 0; r--) {
        let e = 0;
        for (let f = 0; f < 8; f++) {
          const p = this.b[r * 16 + f];
          if (!p) { e++; continue; }
          if (e) { s += e; e = 0; }
          const ch = ' pnbrqk'[p & 7];
          s += p & 8 ? ch : ch.toUpperCase();
        }
        if (e) s += e;
        if (r) s += '/';
      }
      const c = this.castle;
      const cs = (c & 1 ? 'K' : '') + (c & 2 ? 'Q' : '') + (c & 4 ? 'k' : '') + (c & 8 ? 'q' : '') || '-';
      return `${s} ${this.side ? 'b' : 'w'} ${cs} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.half} ${this.full}`;
    }
    /** ô sq có bị bên `by` (0 Trắng, 1 Đen) tấn công không */
    attacked(sq, by) {
      const b = this.b, c = by ? 8 : 0;
      let s;
      if (by === 0) {
        s = sq - 15; if (!(s & 0x88) && b[s] === 1) return true;
        s = sq - 17; if (!(s & 0x88) && b[s] === 1) return true;
      } else {
        s = sq + 15; if (!(s & 0x88) && b[s] === 9) return true;
        s = sq + 17; if (!(s & 0x88) && b[s] === 9) return true;
      }
      for (let i = 0; i < 8; i++) { s = sq + ND[i]; if (!(s & 0x88) && b[s] === (KNIGHT | c)) return true; }
      for (let i = 0; i < 8; i++) { s = sq + KD[i]; if (!(s & 0x88) && b[s] === (KING | c)) return true; }
      for (let i = 0; i < 4; i++) {
        const d = BD[i];
        for (s = sq + d; !(s & 0x88); s += d) { const p = b[s]; if (p) { if (p === (BISHOP | c) || p === (QUEEN | c)) return true; break; } }
      }
      for (let i = 0; i < 4; i++) {
        const d = RD[i];
        for (s = sq + d; !(s & 0x88); s += d) { const p = b[s]; if (p) { if (p === (ROOK | c) || p === (QUEEN | c)) return true; break; } }
      }
      return false;
    }
    inCheck() { return this.attacked(this.kings[this.side], this.side ^ 1); }
    /** sinh nước giả hợp lệ (chưa kiểm vua bị chiếu); caps = chỉ nước ăn + phong Hậu */
    gen(out, caps) {
      const b = this.b, us = this.side, c = us ? 8 : 0;
      for (let sq = 0; sq < 120; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const p = b[sq];
        if (!p || (p & 8) !== c) continue;
        const t = p & 7;
        if (t === PAWN) {
          const dir = us ? -16 : 16, one = sq + dir, promoR = us ? 0 : 7;
          const isPromo = (one >> 4) === promoR;
          if (!b[one]) {
            if (isPromo) { out.push(mv(sq, one, QUEEN, 0)); if (!caps) { out.push(mv(sq, one, KNIGHT, 0), mv(sq, one, ROOK, 0), mv(sq, one, BISHOP, 0)); } }
            else if (!caps) {
              out.push(mv(sq, one, 0, 0));
              if ((sq >> 4) === (us ? 6 : 1) && !b[one + dir]) out.push(mv(sq, one + dir, 0, F_DOUBLE));
            }
          }
          for (let k = 0; k < 2; k++) {
            const s = sq + (us ? (k ? -15 : -17) : (k ? 15 : 17));
            if (s & 0x88) continue;
            const q = b[s];
            if (q && (q & 8) !== c) {
              if (isPromo) { out.push(mv(sq, s, QUEEN, F_CAP)); if (!caps) out.push(mv(sq, s, KNIGHT, F_CAP), mv(sq, s, ROOK, F_CAP), mv(sq, s, BISHOP, F_CAP)); }
              else out.push(mv(sq, s, 0, F_CAP));
            } else if (s === this.ep) out.push(mv(sq, s, 0, F_CAP | F_EP));
          }
        } else if (t === KNIGHT || t === KING) {
          const D = t === KNIGHT ? ND : KD;
          for (let i = 0; i < 8; i++) {
            const s = sq + D[i];
            if (s & 0x88) continue;
            const q = b[s];
            if (!q) { if (!caps) out.push(mv(sq, s, 0, 0)); } else if ((q & 8) !== c) out.push(mv(sq, s, 0, F_CAP));
          }
        } else {
          const D = t === BISHOP ? BD : t === ROOK ? RD : KD;
          for (let i = 0; i < D.length; i++) {
            const d = D[i];
            for (let s = sq + d; !(s & 0x88); s += d) {
              const q = b[s];
              if (!q) { if (!caps) out.push(mv(sq, s, 0, 0)); continue; }
              if ((q & 8) !== c) out.push(mv(sq, s, 0, F_CAP));
              break;
            }
          }
        }
      }
      if (caps) return out;
      // nhập thành: ô vua đi qua không bị chiếu, ô giữa trống
      const cr = this.castle, them = us ^ 1;
      if (us === 0) {
        if ((cr & 1) && !b[5] && !b[6] && b[7] === ROOK && !this.attacked(4, them) && !this.attacked(5, them) && !this.attacked(6, them)) out.push(mv(4, 6, 0, F_CASTLE));
        if ((cr & 2) && !b[1] && !b[2] && !b[3] && b[0] === ROOK && !this.attacked(4, them) && !this.attacked(3, them) && !this.attacked(2, them)) out.push(mv(4, 2, 0, F_CASTLE));
      } else {
        if ((cr & 4) && !b[117] && !b[118] && b[119] === (ROOK | 8) && !this.attacked(116, them) && !this.attacked(117, them) && !this.attacked(118, them)) out.push(mv(116, 118, 0, F_CASTLE));
        if ((cr & 8) && !b[113] && !b[114] && !b[115] && b[112] === (ROOK | 8) && !this.attacked(116, them) && !this.attacked(115, them) && !this.attacked(114, them)) out.push(mv(116, 114, 0, F_CASTLE));
      }
      return out;
    }
    /** đi nước m; trả false (và tự hoàn tác) nếu nước đó để vua bị chiếu */
    make(m) {
      const b = this.b, f = mFrom(m), t = mTo(m), fl = mFlag(m), pc = b[f], us = this.side;
      let cap = b[t], capSq = t;
      if (fl & F_EP) { capSq = us ? t + 16 : t - 16; cap = b[capSq]; }
      this.undo.push(m, cap, this.castle, this.ep, this.half, this.hl, this.hh);
      let hl = this.hl, hh = this.hh;
      if (this.ep >= 0) { hl ^= ZEL[this.ep]; hh ^= ZEH[this.ep]; }
      hl ^= ZCL[this.castle]; hh ^= ZCH[this.castle];
      if (cap) { b[capSq] = 0; hl ^= ZL[cap * 128 + capSq]; hh ^= ZH[cap * 128 + capSq]; }
      b[f] = 0; hl ^= ZL[pc * 128 + f]; hh ^= ZH[pc * 128 + f];
      const pr = mPromo(m), np = pr ? (pr | (us ? 8 : 0)) : pc;
      b[t] = np; hl ^= ZL[np * 128 + t]; hh ^= ZH[np * 128 + t];
      if (fl & F_CASTLE) {
        const rf = t > f ? f + 3 : f - 4, rt = t > f ? f + 1 : f - 1, rk = b[rf];
        b[rf] = 0; b[rt] = rk;
        hl ^= ZL[rk * 128 + rf] ^ ZL[rk * 128 + rt]; hh ^= ZH[rk * 128 + rf] ^ ZH[rk * 128 + rt];
      }
      if ((pc & 7) === KING) this.kings[us] = t;
      this.castle &= CRM[f] & CRM[t];
      hl ^= ZCL[this.castle]; hh ^= ZCH[this.castle];
      this.ep = fl & F_DOUBLE ? (f + t) >> 1 : -1;
      if (this.ep >= 0) { hl ^= ZEL[this.ep]; hh ^= ZEH[this.ep]; }
      this.half = (pc & 7) === PAWN || cap ? 0 : this.half + 1;
      if (us) this.full++;
      this.side ^= 1; hl ^= ZSL; hh ^= ZSH;
      this.hl = hl; this.hh = hh;
      this.reps.push(hl);
      if (this.attacked(this.kings[us], this.side)) { this.unmake(); return false; }
      return true;
    }
    unmake() {
      const u = this.undo, n = u.length, b = this.b;
      const m = u[n - 7], cap = u[n - 6];
      this.castle = u[n - 5]; this.ep = u[n - 4]; this.half = u[n - 3]; this.hl = u[n - 2]; this.hh = u[n - 1];
      u.length = n - 7;
      this.reps.pop();
      this.side ^= 1;
      const us = this.side, f = mFrom(m), t = mTo(m), fl = mFlag(m);
      if (us) this.full--;
      const pc = mPromo(m) ? (PAWN | (us ? 8 : 0)) : b[t];
      b[f] = pc; b[t] = 0;
      if (fl & F_EP) b[us ? t + 16 : t - 16] = cap; else b[t] = cap;
      if (fl & F_CASTLE) {
        const rf = t > f ? f + 3 : f - 4, rt = t > f ? f + 1 : f - 1;
        b[rf] = b[rt]; b[rt] = 0;
      }
      if ((pc & 7) === KING) this.kings[us] = f;
    }
    makeNull() {
      this.nst.push(this.ep, this.half, this.hl, this.hh);
      if (this.ep >= 0) { this.hl ^= ZEL[this.ep]; this.hh ^= ZEH[this.ep]; }
      this.ep = -1; this.half = 0;
      this.side ^= 1; this.hl ^= ZSL; this.hh ^= ZSH;
      this.reps.push(this.hl);
    }
    unmakeNull() {
      const s = this.nst, n = s.length;
      this.ep = s[n - 4]; this.half = s[n - 3]; this.hl = s[n - 2]; this.hh = s[n - 1];
      s.length = n - 4;
      this.side ^= 1;
      this.reps.pop();
    }
    legal() {
      const out = [], ms = this.gen([], false);
      for (const m of ms) if (this.make(m)) { this.unmake(); out.push(m); }
      return out;
    }
    /** thế hiện tại đã xuất hiện trước đó (trong phạm vi luật 50 nước) */
    isRep() {
      const r = this.reps, n = r.length - 1, h = r[n];
      for (let i = n - 2, lim = Math.max(0, n - this.half); i >= lim; i -= 2) if (r[i] === h) return true;
      return false;
    }
    /** số lần thế hiện tại đã lặp lại trước đó */
    repCount() {
      const r = this.reps, n = r.length - 1, h = r[n];
      let c = 0;
      for (let i = n - 2, lim = Math.max(0, n - this.half); i >= lim; i -= 2) if (r[i] === h) c++;
      return c;
    }
    /** bên side còn quân ngoài Tốt/Vua (dùng cho nước rỗng) */
    hasPieces(side) {
      const c = side ? 8 : 0, b = this.b;
      for (let q = 0; q < 120; q++) { const p = b[q]; if (p && (p & 8) === c && (p & 7) > PAWN && (p & 7) < KING && !(q & 0x88)) return true; }
      return false;
    }
    /** đếm quân: {P,N,B,R,Q} theo từng bên + màu ô của các Tượng */
    material() {
      const m = [{ P: 0, N: 0, B: 0, R: 0, Q: 0, bsq: [] }, { P: 0, N: 0, B: 0, R: 0, Q: 0, bsq: [] }];
      for (let q = 0; q < 120; q++) {
        if (q & 0x88) { q += 7; continue; }
        const p = this.b[q];
        if (!p || (p & 7) === KING) continue;
        const o = m[p & 8 ? 1 : 0], k = ' PNBRQ'[p & 7];
        o[k]++;
        if (k === 'B') o.bsq.push(((q >> 4) + (q & 7)) & 1);
      }
      return m;
    }
  }

  /** không bên nào còn đủ quân để chiếu hết */
  function deadPosition(pos) {
    const [w, k] = pos.material();
    if (w.P || k.P || w.R || k.R || w.Q || k.Q) return false;
    const mw = w.N + w.B, mb = k.N + k.B;
    if (mw + mb <= 1) return true;
    if (!w.N && !k.N && w.B + k.B >= 1) {
      const all = w.bsq.concat(k.bsq);
      if (all.every((x) => x === all[0])) return true; // mọi Tượng cùng màu ô
    }
    return false;
  }
  /** bên side có cách nào chiếu hết không (dùng khi bên kia hết giờ) */
  function canMate(pos, side) {
    const m = pos.material(), a = m[side], o = m[side ^ 1];
    if (a.P || a.R || a.Q) return true;
    if (a.N + a.B >= 2) return true;
    if (a.N + a.B === 1) return o.P + o.N + o.B + o.R + o.Q > 0;
    return false;
  }
  /** trạng thái ván: null (đang chơi) hoặc { over, winner: 0|1|-1, why } */
  function status(pos) {
    const legal = pos.legal();
    if (!legal.length) return pos.inCheck() ? { winner: pos.side ^ 1, why: 'mate' } : { winner: -1, why: 'stalemate' };
    if (pos.half >= 100) return { winner: -1, why: 'fifty' };
    if (pos.repCount() >= 2) return { winner: -1, why: 'repetition' };
    if (deadPosition(pos)) return { winner: -1, why: 'material' };
    return null;
  }

  /** ký hiệu đại số chuẩn (SAN) của nước m trong thế pos (chưa đi) */
  function san(pos, m, legal) {
    const b = pos.b, f = mFrom(m), t = mTo(m), fl = mFlag(m), p = b[f] & 7;
    let s;
    if (fl & F_CASTLE) s = t > f ? 'O-O' : 'O-O-O';
    else if (p === PAWN) {
      s = fl & F_CAP ? FILES[f & 7] + 'x' + sqName(t) : sqName(t);
      if (mPromo(m)) s += '=' + 'NBRQ'[mPromo(m) - 2];
    } else {
      let dis = '';
      const others = (legal || pos.legal()).filter((o) => mTo(o) === t && mFrom(o) !== f && (b[mFrom(o)] & 7) === p);
      if (others.length) {
        const sameFile = others.some((o) => (mFrom(o) & 7) === (f & 7)), sameRank = others.some((o) => (mFrom(o) >> 4) === (f >> 4));
        dis = !sameFile ? FILES[f & 7] : !sameRank ? String((f >> 4) + 1) : sqName(f);
      }
      s = 'NBRQK'[p - 2] + dis + (fl & F_CAP ? 'x' : '') + sqName(t);
    }
    if (pos.make(m)) {
      if (pos.inCheck()) s += pos.legal().length ? '+' : '#';
      pos.unmake();
    }
    return s;
  }

  function perft(pos, d) {
    if (!d) return 1;
    const ms = pos.gen([], false);
    let n = 0;
    for (const m of ms) { if (!pos.make(m)) continue; n += perft(pos, d - 1); pos.unmake(); }
    return n;
  }

  /* ---------- Đánh giá thế cờ ---------- */
  // bảng vị trí kiểu "Simplified Evaluation Function" (T. Michniewski), viết theo hướng nhìn của Trắng: dòng đầu = hàng 8
  const T = (v) => { const o = new Int16Array(64); for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) o[r * 8 + f] = v[(7 - r) * 8 + f]; return o; };
  const PST_P = T([0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0]);
  const PST_PE = T([0, 0, 0, 0, 0, 0, 0, 0, 90, 90, 90, 90, 90, 90, 90, 90, 55, 55, 55, 55, 55, 55, 55, 55, 30, 30, 30, 30, 30, 30, 30, 30,
    15, 15, 15, 15, 15, 15, 15, 15, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const PST_N = T([-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50]);
  const PST_B = T([-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20]);
  const PST_R = T([0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0]);
  const PST_Q = T([-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20]);
  const PST_K = T([-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]);
  const PST_KE = T([-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50]);
  const MGT = [null, PST_P, PST_N, PST_B, PST_R, PST_Q, PST_K], EGT = [null, PST_PE, PST_N, PST_B, PST_R, PST_Q, PST_KE];
  const VMG = [0, 100, 320, 330, 500, 900, 0], VEG = [0, 120, 300, 320, 530, 940, 0], PH = [0, 0, 1, 1, 2, 4, 0];
  const pf = [new Int8Array(8), new Int8Array(8)];

  /** điểm thế cờ (centipawn) theo góc nhìn bên đang đi */
  function evaluate(pos) {
    const b = pos.b;
    let mg = 0, eg = 0, phase = 0, bw = 0, bb = 0, matW = 0, matB = 0, minW = 0, minB = 0, heavy = 0, pawns = 0;
    pf[0].fill(0); pf[1].fill(0);
    for (let q = 0; q < 120; q++) {
      if (q & 0x88) { q += 7; continue; }
      const p = b[q];
      if (!p) continue;
      const t = p & 7, r = q >> 4, f = q & 7;
      phase += PH[t];
      if (p & 8) {
        const i = (7 - r) * 8 + f;
        mg -= VMG[t] + MGT[t][i]; eg -= VEG[t] + EGT[t][i];
        if (t === BISHOP) bb++;
        if (t === PAWN) { pf[1][f]++; pawns++; }
        if (t !== KING) matB += VMG[t];
        if (t === KNIGHT || t === BISHOP) minB++;
        if (t === ROOK || t === QUEEN) heavy++;
      } else {
        const i = r * 8 + f;
        mg += VMG[t] + MGT[t][i]; eg += VEG[t] + EGT[t][i];
        if (t === BISHOP) bw++;
        if (t === PAWN) { pf[0][f]++; pawns++; }
        if (t !== KING) matW += VMG[t];
        if (t === KNIGHT || t === BISHOP) minW++;
        if (t === ROOK || t === QUEEN) heavy++;
      }
    }
    // không đủ quân chiếu hết → coi như hòa
    if (!pawns && !heavy && minW <= 1 && minB <= 1) return 0;
    if (bw >= 2) { mg += 30; eg += 45; }
    if (bb >= 2) { mg -= 30; eg -= 45; }
    // Tốt chồng / Tốt cô lập
    for (let s = 0; s < 2; s++) {
      const a = pf[s], sg = s ? -1 : 1;
      for (let f = 0; f < 8; f++) {
        if (!a[f]) continue;
        if (a[f] > 1) { mg -= sg * 12 * (a[f] - 1); eg -= sg * 18 * (a[f] - 1); }
        if ((f === 0 || !a[f - 1]) && (f === 7 || !a[f + 1])) { mg -= sg * 10 * a[f]; eg -= sg * 12 * a[f]; }
      }
    }
    const ph = Math.min(24, phase);
    let sc = (mg * ph + eg * (24 - ph)) / 24;
    // tàn cuộc hơn quân nhiều: dồn vua thua vào góc, vua thắng áp sát (để máy biết chiếu hết)
    if (ph <= 8 && Math.abs(matW - matB) >= 300) {
      const win = matW > matB ? 0 : 1, lk = pos.kings[win ^ 1], wk = pos.kings[win];
      const lr = lk >> 4, lf = lk & 7;
      const cd = Math.max(3 - lf, lf - 4) + Math.max(3 - lr, lr - 4);
      const kd = Math.abs((wk >> 4) - lr) + Math.abs((wk & 7) - lf);
      const bonus = 12 * cd + 5 * (14 - kd);
      sc += win === 0 ? bonus : -bonus;
    }
    sc = Math.round(sc) + 10 * (pos.side ? -1 : 1);
    return pos.side ? -sc : sc;
  }

  /* ---------- Tìm kiếm ---------- */
  const INF = 32000, MATE = 31000;
  const TT_SIZE = 1 << 20, TT_MASK = TT_SIZE - 1;
  let ttK = null, ttM, ttS, ttD, ttF;
  function ttInit() {
    if (ttK) return;
    ttK = new Int32Array(TT_SIZE); ttM = new Int32Array(TT_SIZE); ttS = new Int16Array(TT_SIZE); ttD = new Int8Array(TT_SIZE); ttF = new Int8Array(TT_SIZE);
  }
  const VICT = [0, 100, 320, 330, 500, 900, 2000];

  function scoreMoves(S, ms, ttMove, ply) {
    const b = S.pos.b, sc = new Int32Array(ms.length), k1 = S.killers[ply * 2], k2 = S.killers[ply * 2 + 1];
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i], fl = mFlag(m);
      if (m === ttMove) sc[i] = 3000000;
      else if (fl & F_CAP) sc[i] = 2000000 + (fl & F_EP ? 100 : VICT[b[mTo(m)] & 7]) * 16 - (b[mFrom(m)] & 7);
      else if (mPromo(m)) sc[i] = 1900000 + mPromo(m);
      else if (m === k1) sc[i] = 1800000;
      else if (m === k2) sc[i] = 1799999;
      else sc[i] = S.hist[(b[mFrom(m)] & 15) * 128 + mTo(m)];
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
      if (!mPromo(m) && stand + VICT[mFlag(m) & F_EP ? 1 : pos.b[mTo(m)] & 7] + 200 < alpha) continue; // không thể gỡ lại
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
    if (ply && (pos.half >= 100 || pos.isRep())) return 0;
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
    // nước rỗng: cho đối phương đi 2 lần mà vẫn hơn → cắt
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
      if (!pos.make(m)) continue;
      legal++;
      const quiet = !(mFlag(m) & F_CAP) && !mPromo(m);
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
            const hi = (pos.b[mFrom(m)] & 15) * 128 + mTo(m);
            S.hist[hi] = Math.min(1000000, S.hist[hi] + depth * depth);
          }
          break;
        }
      }
    }
    if (!legal) return inCheck ? -MATE + ply : 0;
    if (ttK[ti] !== pos.hh || ttD[ti] <= depth) {
      let s = bestS;
      if (s > MATE - 300) s += ply; else if (s < -MATE + 300) s -= ply;
      ttK[ti] = pos.hh; ttM[ti] = bestM; ttS[ti] = s; ttD[ti] = depth; ttF[ti] = bestS >= beta ? 2 : bestS > a0 ? 1 : 3;
    }
    return bestS;
  }

  /**
   * Máy nghĩ nước đi. o = { time (ms), depth, multi (chấm đủ điểm từng nước gốc), noise (cp), blunder (xác suất), margin (cp) }
   * Trả { move, score, depth, nodes }.
   */
  function think(pos, o) {
    ttInit();
    o = o || {};
    const S = { pos, nodes: 0, stop: false, t0: now(), limit: o.time || 2000, killers: new Int32Array(260), hist: new Int32Array(16 * 128) };
    let root = pos.legal();
    if (!root.length) return { move: 0, score: 0, depth: 0, nodes: 0 };
    if (root.length === 1) return { move: root[0], score: 0, depth: 0, nodes: 0 };
    // nước trong bảng chuyển vị lên đầu
    const ti = pos.hl & TT_MASK;
    if (ttF[ti] && ttK[ti] === pos.hh) { const k = root.indexOf(ttM[ti]); if (k > 0) { root.splice(k, 1); root.unshift(ttM[ti]); } }
    let best = root[0], bestScore = -INF, depthDone = 0, scores = null;
    const maxD = o.depth || 64;
    for (let d = 1; d <= maxD; d++) {
      let alpha = -INF, iterBest = 0, iterScore = -INF;
      const sc = new Array(root.length).fill(-INF);
      let done = 0;
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
      if (S.stop) {
        if (done && !o.multi) { best = iterBest; bestScore = iterScore; }
        break;
      }
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
    START, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, F_CAP, F_EP, F_CASTLE, F_DOUBLE, MATE,
    Pos, mv, mFrom, mTo, mPromo, mFlag, sqName, sqOf, san, perft, evaluate, think, status, deadPosition, canMate,
  };
}
if (typeof window !== 'undefined') window.ChessEngine = ChessEngineFactory();
