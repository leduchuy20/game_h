// Cờ Cá Ngựa — lõi luật thuần (không vẽ, không DOM) → window.LudoRules (node: module.exports)
// Bàn 15×15 kiểu chữ thập: vòng 56 ô chạy theo chiều kim đồng hồ, mỗi màu 14 ô,
// ô xuất quân có mũi tên, ngay trước nó là ô cửa dẫn vào chuồng đích 6 bậc ở giữa.
(() => {
  'use strict';

  const RING = 56, SEG = 14, GATE = 55, STEPS = 6;
  // màu theo chiều kim đồng hồ: 0 đỏ (cánh trái) · 1 xanh dương (trên) · 2 xanh lá (phải) · 3 vàng (dưới)
  const COLORS = ['red', 'blue', 'green', 'yellow'];

  /* ---------- hình học bàn (hàng r, cột c trên lưới 15×15) ---------- */
  const RING_RC = [];
  (() => {
    const seg = (cells) => cells.forEach((rc) => RING_RC.push(rc));
    const run = (r0, c0, dr, dc, n) => Array.from({ length: n }, (_, k) => [r0 + dr * k, c0 + dc * k]);
    // đỏ: (6,0)…(6,5) · góc (6,6) · (5,6)…(0,6) · mũi (0,7) = cửa của xanh dương
    seg(run(6, 0, 0, 1, 6)); seg([[6, 6]]); seg(run(5, 6, -1, 0, 6)); seg([[0, 7]]);
    // xanh dương: (0,8)…(5,8) · (6,8) · (6,9)…(6,14) · (7,14)
    seg(run(0, 8, 1, 0, 6)); seg([[6, 8]]); seg(run(6, 9, 0, 1, 6)); seg([[7, 14]]);
    // xanh lá: (8,14)…(8,9) · (8,8) · (9,8)…(14,8) · (14,7)
    seg(run(8, 14, 0, -1, 6)); seg([[8, 8]]); seg(run(9, 8, 1, 0, 6)); seg([[14, 7]]);
    // vàng: (14,6)…(9,6) · (8,6) · (8,5)…(8,0) · (7,0) = cửa của đỏ
    seg(run(14, 6, -1, 0, 6)); seg([[8, 6]]); seg(run(8, 5, 0, -1, 6)); seg([[7, 0]]);
  })();
  const START = [0, 14, 28, 42];                    // ô xuất quân (chỉ số trên vòng) của từng màu
  const GATE_IDX = START.map((s) => (s + GATE) % RING);
  // chuồng đích: bậc 1 sát cửa → bậc 6 sát giữa bàn
  const HOME_RC = [
    Array.from({ length: 6 }, (_, k) => [7, 1 + k]),
    Array.from({ length: 6 }, (_, k) => [1 + k, 7]),
    Array.from({ length: 6 }, (_, k) => [7, 13 - k]),
    Array.from({ length: 6 }, (_, k) => [13 - k, 7]),
  ];
  // chuồng ngựa (sân 6×6 ở góc): tâm theo lưới
  const YARD_RC = [[2.5, 2.5], [2.5, 11.5], [11.5, 11.5], [11.5, 2.5]];

  /* ---------- tuỳ chọn luật (mặc định = kiểu phổ biến, giống boardgamevui) ---------- */
  const DEFAULTS = {
    dice: 2,            // 2 | 1
    split: false,       // true = tách 2 con (mỗi xúc xắc một nước)
    exit: 'pair16',     // 2 xúc xắc: 'pair16' (đôi / 1+6) | 'six' (đôi / có con 6) · 1 xúc xắc: 'six' | 'one6'
    half: true,         // đổ đôi được chọn đi nửa
    jump: false,        // được nhảy qua đầu ngựa
    entry: 'straight',  // 'straight' đếm thẳng vào · 'gate' dừng ở cửa, ra n lên bậc n · 'count' đếm bước cả trong chuồng
    gateDouble: false,  // kiểu 'gate': đổ đôi thì lên 1 bậc
    win: 'top4',        // 'top4' 4 ngựa ở bậc 3–6 · 'all' cả 4 ngựa lên đích
    triple: false,      // đôi / 1+6 lần thứ 3 liên tiếp thì mất lượt
    rank: true,         // có người về nhất thì chơi tiếp tranh hạng
  };

  /* ---------- trạng thái ---------- */
  /** colors: màu của từng người chơi (2 người ngồi đối diện: [0, 2]) */
  function newState(colors) {
    return { colors: colors.slice(), horses: colors.map(() => [-1, -1, -1, -1]) };
  }
  const colorsFor = (n) => (n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
  const clone = (st) => ({ colors: st.colors.slice(), horses: st.horses.map((h) => h.slice()) });

  /** ô trên vòng của ngựa có tiến độ p (null khi trong chuồng hoặc đã vào chuồng đích) */
  const cellOf = (color, p) => (p >= 0 && p <= GATE ? (START[color] + p) % RING : null);

  /** ai đang đứng ở mỗi ô vòng: Map(ô → {pl, h}) */
  function occupancy(st) {
    const m = new Map();
    st.horses.forEach((hs, pl) => hs.forEach((p, h) => { const c = cellOf(st.colors[pl], p); if (c !== null) m.set(c, { pl, h }); }));
    return m;
  }

  /* ---------- xúc xắc ---------- */
  const isDouble = (d) => d.length === 2 && d[0] === d[1];
  const is16 = (d) => d.length === 2 && ((d[0] === 1 && d[1] === 6) || (d[0] === 6 && d[1] === 1));
  function canExit(d, o) {
    if (d.length === 1) return o.exit === 'one6' ? d[0] === 1 || d[0] === 6 : d[0] === 6;
    if (isDouble(d)) return true;
    return o.exit === 'six' ? d[0] === 6 || d[1] === 6 : is16(d);
  }
  /** được đổ tiếp sau khi đi */
  function isBonus(d, o) {
    if (d.length === 1) return o.exit === 'one6' ? d[0] === 1 || d[0] === 6 : d[0] === 6;
    return isDouble(d) || is16(d);
  }

  /* ---------- sinh nước đi ---------- */
  // nước: { pl, h, from, to, steps, use: 'all' | 0 | 1 (chỉ số xúc xắc), kind: 'exit'|'run'|'home'|'climb', kick: {pl,h}|null, tag }
  /** ngựa h của người pl đi n bước theo luật (không tính xuất chuồng / leo bằng đôi). Trả {to, kick} hoặc null */
  function walk(st, o, occ, pl, h, n, opt = {}) {
    const color = st.colors[pl], hs = st.horses[pl], p = hs[h];
    if (p < 0 || n <= 0) return null;
    const own = (q) => hs.some((x, k) => k !== h && x === q);
    if (p > GATE) {
      // đang trong chuồng đích
      if (o.entry !== 'count') return null;            // các kiểu khác leo riêng (climbMoves)
      const q = p + n;
      if (q > GATE + STEPS || own(q)) return null;   // trong chuồng được vượt ngựa nhà (không thì dễ kẹt cứng), chỉ không đứng đè
      return { to: q, kick: null };
    }
    let q = p + n;
    const maxQ = o.entry === 'gate' ? GATE : GATE + STEPS;
    if (q > maxQ) return null;
    // ô vòng đi qua (trước ô dừng) không được có ngựa khi cấm nhảy qua đầu
    const ringEnd = Math.min(q, GATE);
    for (let x = p + 1; x <= ringEnd; x++) {
      const c = (START[color] + x) % RING, who = occ.get(c);
      if (!who) continue;
      if (x < q && !o.jump) return null;               // chắn đường
      if (x === q) {
        if (who.pl === pl) return null;                 // không đứng lên ngựa nhà
        return { to: q, kick: who };
      }
    }
    if (q > GATE) {
      // vào chuồng đích: không vượt / đè ngựa nhà (kiểu 'count' chỉ cấm đứng đè)
      if (o.entry === 'count') { if (own(q)) return null; }
      else for (let x = GATE + 1; x <= q; x++) if (own(x)) return null;
    }
    return { to: q, kick: null };
  }

  /** mọi nước hợp lệ của người pl với lần đổ d; pool = các xúc xắc còn dùng được (tách 2 con) */
  function legalMoves(st, o, pl, d, pool) {
    o = Object.assign({}, DEFAULTS, o);
    const occ = occupancy(st), hs = st.horses[pl], color = st.colors[pl];
    const out = [], seen = new Set();
    const push = (m) => {
      const key = `${m.h}:${m.to}`;                     // cùng ngựa cùng điểm đến → chỉ giữ 1 (ưu tiên dùng ít xúc xắc)
      if (seen.has(key)) return;
      seen.add(key); out.push(Object.assign({ pl }, m));
    };
    const whole = !pool || pool.length === d.length;    // chưa dùng xúc xắc nào
    // 1) xuất chuồng (dùng cả lần đổ)
    if (whole && canExit(d, o)) {
      const hIn = hs.findIndex((p) => p < 0);
      if (hIn >= 0) {
        const c = START[color], who = occ.get(c);
        if (!who || who.pl !== pl) push({ h: hIn, from: -1, to: 0, steps: 0, use: 'all', kind: 'exit', kick: who || null });
      }
    }
    // các lượng bước có thể dùng
    const amounts = [];
    if (o.split && d.length === 2) {
      (pool || [0, 1]).forEach((k) => amounts.push({ n: d[k], use: k }));
    } else if (d.length === 1) {
      amounts.push({ n: d[0], use: 'all' });
    } else {
      amounts.push({ n: d[0] + d[1], use: 'all' });
      if (isDouble(d) && o.half) amounts.push({ n: d[0], use: 'all', half: true });
    }
    // 2) đi trên vòng / vào chuồng
    hs.forEach((p, h) => {
      if (p < 0) return;
      for (const a of amounts) {
        if (p > GATE && o.entry !== 'count') break;
        const r = walk(st, o, occ, pl, h, a.n);
        if (r) push({ h, from: p, to: r.to, steps: a.n, use: a.use, half: !!a.half, kind: r.to > GATE ? 'home' : 'run', kick: r.kick });
      }
      // kiểu 'gate': được dùng 1 con lẻ để dừng đúng ô cửa
      if (o.entry === 'gate' && p <= GATE && d.length === 2 && !o.split && whole) {
        for (const k of [0, 1]) {
          if (p + d[k] !== GATE) continue;
          const r = walk(st, o, occ, pl, h, d[k]);
          if (r) push({ h, from: p, to: r.to, steps: d[k], use: 'all', kind: 'run', kick: r.kick, single: true });
        }
      }
    });
    // 3) leo bậc trong chuồng đích
    const own = (q, h) => hs.some((x, k) => k !== h && x === q);
    hs.forEach((p, h) => {
      if (o.entry === 'straight' && p > GATE && p < GATE + STEPS && whole) {
        // đã vào chuồng: mỗi lần đổ đôi (1 xúc xắc: ra 6) lên 1 bậc, dùng cả lần đổ
        const ok = d.length === 1 ? d[0] === 6 : isDouble(d);
        if (ok && !own(p + 1, h)) push({ h, from: p, to: p + 1, steps: 1, use: 'all', kind: 'climb', kick: null });
      }
      if (o.entry === 'gate' && p >= GATE && p < GATE + STEPS) {
        const cur = p - GATE;                           // 0 = đang ở cửa, k = bậc k
        const vals = [];
        if (o.split && d.length === 2) (pool || [0, 1]).forEach((k) => vals.push({ n: d[k], use: k }));
        else if (d.length === 1) vals.push({ n: d[0], use: 'all' });
        else if (whole) { vals.push({ n: d[0], use: 'all' }, { n: d[1], use: 'all' }, { n: d[0] + d[1], use: 'all' }); }
        for (const v of vals) {
          const target = cur === 0 ? v.n : (v.n === cur + 1 ? cur + 1 : 0);
          if (target < 1 || target > STEPS || target <= cur) continue;
          const q = GATE + target;
          let free = true;
          for (let x = p + 1; x <= q; x++) if (own(x, h)) free = false;
          if (free) push({ h, from: p, to: q, steps: v.n, use: v.use, kind: 'climb', kick: null });
        }
        if (o.gateDouble && whole && isDouble(d) && cur >= 1 && !own(p + 1, h)) push({ h, from: p, to: p + 1, steps: 1, use: 'all', kind: 'climb', kick: null });
      }
    });
    // nhãn hiển thị
    out.forEach((m) => { m.tag = moveTag(m); });
    return out;
  }

  function moveTag(m) {
    if (m.kind === 'exit') return m.kick ? 'Xuất · ĐÁ!' : 'Xuất chuồng';
    if (m.kick) return `${m.steps} → ĐÁ!`;
    if (m.to > GATE) return `${m.kind === 'climb' ? '⬆' : m.steps} → bậc ${m.to - GATE}`;
    if (m.to === GATE) return `${m.steps} → cửa`;
    return `${m.steps} ô`;
  }

  /** thực hiện nước đi (trả trạng thái mới, không sửa st) */
  function apply(st, m) {
    const s = clone(st);
    s.horses[m.pl][m.h] = m.to;
    if (m.kick) s.horses[m.kick.pl][m.kick.h] = -1;
    return s;
  }

  function hasWon(st, o, pl) {
    o = Object.assign({}, DEFAULTS, o);
    const hs = st.horses[pl];
    return o.win === 'all' ? hs.every((p) => p > GATE) : hs.every((p) => p >= GATE + 3);
  }

  /* ---------- máy: chấm điểm nước đi ---------- */
  // xác suất 2 xúc xắc ra tổng s (1..12), cộng cả trường hợp đi nửa khi đôi
  const P2 = (() => {
    const t = new Array(13).fill(0);
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) { t[a + b] += 1 / 36; if (a === b) t[a] += 1 / 36; }
    return t;
  })();
  /** khả năng ngựa ở ô vòng c bị đối thủ đá ở lượt sau (xấp xỉ, bỏ qua chắn đường) */
  function dangerAt(st, o, pl, c, ignore) {
    if (c === null) return 0;
    let risk = 0;
    st.horses.forEach((hs, e) => {
      if (e === pl) return;
      const col = st.colors[e];
      hs.forEach((p, h) => {
        if (ignore && ignore.pl === e && ignore.h === h) return;
        if (p < 0) {
          // ngựa trong chuồng xuất ra đá ở ô xuất quân
          if (c === START[col]) risk += o.dice === 1 ? 1 / 6 : 8 / 36;
          return;
        }
        if (p > GATE) return;
        const dist = (c - (START[col] + p) + RING) % RING;
        if (dist === 0 || dist + p > GATE) return;          // đã qua cửa của nó thì không với tới
        risk += o.dice === 1 ? (dist <= 6 ? 1 / 6 : 0) : (P2[dist] || 0);
      });
    });
    return Math.min(1, risk);
  }

  /** điểm của nước m cho người pl theo mức lv ('easy' | 'normal' | 'hard') */
  function scoreMove(st, o, m, lv) {
    o = Object.assign({}, DEFAULTS, o);
    const pl = m.pl, color = st.colors[pl];
    let s = 0;
    if (m.kick) {
      const vp = st.horses[m.kick.pl][m.kick.h];
      s += 70 + Math.max(0, vp) * 1.2;
    }
    if (m.kind === 'exit') s += 38 - st.horses[pl].filter((p) => p >= 0 && p <= GATE).length * 6;
    if (m.to > GATE) {
      s += m.from <= GATE ? 55 : 22;                      // vào chuồng đích / leo bậc
      s += (m.to - GATE) * 6;
      if (m.to === GATE + STEPS) s += 12;
      // kiểu thắng 4 bậc cao: ngựa đầu nên lên thẳng bậc 6, đừng chiếm bậc thấp
      if (o.win === 'top4' && m.to - GATE < 3) s -= 30;
    } else if (m.kind === 'run') s += m.steps * 0.9;
    if (m.to === GATE && o.entry === 'gate') s += 18;
    if (lv === 'easy') return s;
    // an toàn: trước và sau nước đi
    const after = apply(st, m);
    const val = (p) => 25 + Math.max(0, p) * 1.1;
    const cFrom = cellOf(color, m.from), cTo = cellOf(color, m.to);
    const dFrom = m.from >= 0 && m.from <= GATE ? dangerAt(st, o, pl, cFrom) : 0;
    const dTo = cTo !== null ? dangerAt(after, o, pl, cTo, m.kick) : 0;
    s += dFrom * val(m.from) * (lv === 'hard' ? 1 : 0.6);
    s -= dTo * val(m.to) * (lv === 'hard' ? 1.1 : 0.6);
    // rời ô xuất quân để còn chỗ xuất con khác
    if (m.from === 0 && st.horses[pl].some((p) => p < 0)) s += 6;
    if (lv === 'hard') {
      // đứng ngay trước ngựa đối thủ (trong 2–12 ô) = mồi để nó đá; đứng sau nó = rình đá
      if (cTo !== null) {
        st.horses.forEach((hs, e) => {
          if (e === pl) return;
          hs.forEach((p) => {
            if (p < 0 || p > GATE) return;
            const ec = (START[st.colors[e]] + p) % RING, ahead = (ec - cTo + RING) % RING;
            if (ahead >= 2 && ahead <= 12) s += 4 * (P2[ahead] || 0) * 10;
          });
        });
      }
      // kẹt ở cửa với kiểu đếm thẳng: ưu tiên đi con khác
      if (m.to === GATE && o.entry === 'straight') s -= 4;
    }
    return s;
  }

  /** Khó: đánh giá cả thế cờ sau nước đi (của mình − của đối thủ, trừ rủi ro bị đá ở lượt sau) */
  function horseValue(p, o) {
    if (p < 0) return 0;
    if (p <= GATE) return 30 + p * 1.6;
    const b = p - GATE;
    let v = 30 + GATE * 1.6 + 25 + b * 10;
    // bậc thấp chặn cửa chuồng (không vượt ngựa nhà) và chưa tính thắng
    if (o.win === 'top4' && b < 3 && o.entry !== 'count') v -= 45;
    return v;
  }
  function evalState(st, o, pl) {
    let me = 0, them = 0;
    st.horses.forEach((hs, k) => hs.forEach((p) => {
      let v = horseValue(p, o);
      if (p >= 0 && p <= GATE) v -= dangerAt(st, o, k, cellOf(st.colors[k], p)) * (30 + p * 1.6) * (k === pl ? 1 : 0.5);
      if (k === pl) me += v; else them += v;
    }));
    const n = st.horses.length - 1;
    return me - them / Math.max(1, n) * 0.9;
  }
  function scoreHard(st, o, m) {
    const after = apply(st, m);
    let s = evalState(after, o, m.pl);
    if (hasWon(after, o, m.pl)) s += 1e4;
    return s;
  }

  /** chọn nước cho máy */
  function botPick(st, o, moves, lv, rnd = Math.random) {
    if (!moves.length) return null;
    if (lv === 'easy') {
      // Dễ: hay đi bừa, 30% bỏ qua cơ hội đá
      if (rnd() < 0.8) {
        const pool = moves.filter((m) => !m.kick || rnd() > 0.3);
        return (pool.length ? pool : moves)[Math.floor(rnd() * (pool.length || moves.length))];
      }
    }
    let best = null, bs = -1e9;
    for (const m of moves) {
      const sc = (lv === 'hard' ? scoreHard(st, Object.assign({}, DEFAULTS, o), m) : scoreMove(st, o, m, lv)) + (lv === 'normal' ? (rnd() - 0.5) * 12 : lv === 'easy' ? (rnd() - 0.5) * 30 : 0);
      if (sc > bs) { bs = sc; best = m; }
    }
    return best;
  }

  /** tổng tiến độ (xếp hạng người chưa về) */
  const progress = (st, pl) => st.horses[pl].reduce((a, p) => a + (p < 0 ? 0 : p + 1), 0);

  const LudoRules = {
    RING, SEG, GATE, STEPS, COLORS, RING_RC, START, GATE_IDX, HOME_RC, YARD_RC, DEFAULTS,
    newState, colorsFor, clone, cellOf, occupancy, isDouble, is16, canExit, isBonus,
    legalMoves, apply, hasWon, scoreMove, botPick, dangerAt, progress, moveTag,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LudoRules;
  else window.LudoRules = LudoRules;
})();
