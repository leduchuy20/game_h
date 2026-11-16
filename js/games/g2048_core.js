// Lõi 2048: bàn N×N số mũ (0 = trống, 1 = 2, 2 = 4, …; −1 = ô đá không trượt, không gộp), trượt + gộp theo luật bản gốc,
// ô mới 90% là 2 / 10% là 4, bộ sinh số có hạt giống (lưu được để chơi tiếp). Không vẽ gì — test: node tools/g2048-test.js.
// Hướng: 0 lên · 1 phải · 2 xuống · 3 trái. Ô thứ i = hàng floor(i / N), cột i % N.
(function (root, factory) {
  const C = factory();
  if (typeof module === 'object' && module.exports) module.exports = C;
  else root.G2048Core = C;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STONE = -1;
  // ô mục tiêu theo cỡ bàn (số mũ): 3×3 → 256, 4×4 → 2048, 5×5 → 4096, 6×6 → 8192
  const TARGET = { 3: 8, 4: 11, 5: 12, 6: 13 };
  const SIZES = [3, 4, 5, 6];

  /** bộ sinh số mulberry32; trạng thái `s` là một số nguyên (lưu / nạp được) */
  function makeRng(seed) {
    const r = { s: seed >>> 0 };
    r.next = () => {
      r.s = (r.s + 0x6D2B79F5) >>> 0;
      let t = r.s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return r;
  }

  /** các hàng theo hướng dir: mỗi hàng là danh sách chỉ số ô, phần tử đầu = sát mép mà ô trượt tới */
  const LINES = {};
  function lines(N, dir) {
    const key = N * 4 + dir;
    if (LINES[key]) return LINES[key];
    const out = [];
    for (let a = 0; a < N; a++) {
      const L = [];
      for (let b = 0; b < N; b++) {
        let r, c;
        if (dir === 0) { c = a; r = b; } else if (dir === 2) { c = a; r = N - 1 - b; }
        else if (dir === 3) { r = a; c = b; } else { r = a; c = N - 1 - b; }
        L.push(r * N + c);
      }
      out.push(L);
    }
    return (LINES[key] = out);
  }

  /**
   * Trượt cả bàn theo hướng dir. Không sửa `cells`.
   * Trả { cells, gained (điểm cộng), moved, moves: [{ from, to, merge }], merges: [ô vừa gộp], top (số mũ lớn nhất vừa tạo) }.
   * Luật: trượt hết cỡ; hai ô cùng số chạm nhau gộp một lần; 3 ô giống nhau → 2 ô phía trước gộp; 4 ô → 2 cặp; ô đá chia hàng thành đoạn.
   */
  function move(cells, N, dir) {
    const res = cells.slice(), moves = [], merges = [];
    let gained = 0, moved = false, top = 0;
    for (const L of lines(N, dir)) {
      let seg = 0;
      while (seg < L.length) {
        // đoạn [seg, end) giữa các ô đá
        let end = seg;
        while (end < L.length && cells[L[end]] !== STONE) end++;
        const out = [];
        for (let k = seg; k < end; k++) {
          const idx = L[k], v = cells[idx];
          if (!v) continue;
          const last = out[out.length - 1];
          if (last && !last.m && last.v === v) { last.v++; last.m = true; last.src.push(idx); gained += 2 ** last.v; top = Math.max(top, last.v); }
          else out.push({ v, m: false, src: [idx] });
        }
        for (let k = seg; k < end; k++) res[L[k]] = 0;
        out.forEach((o, j) => {
          const dest = L[seg + j];
          res[dest] = o.v;
          if (o.m) merges.push(dest);
          for (const s of o.src) { moves.push({ from: s, to: dest, merge: o.m }); if (s !== dest) moved = true; }
        });
        seg = end + 1;                       // bỏ qua ô đá
      }
    }
    return { cells: res, gained, moved, moves, merges, top };
  }

  /** đặt ô mới (2: 90%, 4: 10%) vào ô trống ngẫu nhiên; trả chỉ số ô hoặc −1 nếu đầy */
  function spawn(cells, rng) {
    const empty = [];
    for (let i = 0; i < cells.length; i++) if (cells[i] === 0) empty.push(i);
    if (!empty.length) return -1;
    const i = empty[Math.floor(rng.next() * empty.length)];
    cells[i] = rng.next() < 0.9 ? 1 : 2;
    return i;
  }

  /** còn nước đi không (còn ô trống hoặc hai ô kề nhau cùng số) */
  function canMove(cells, N) {
    for (let i = 0; i < cells.length; i++) {
      const v = cells[i];
      if (v === 0) return true;
      if (v < 0) continue;
      const c = i % N;
      if (c < N - 1 && cells[i + 1] === v) return true;
      if (i + N < cells.length && cells[i + N] === v) return true;
    }
    return false;
  }

  function maxTile(cells) { let m = 0; for (const v of cells) if (v > m) m = v; return m; }

  /** ván mới: bàn trống + 2 ô */
  function newGame(N, seed) {
    const rng = makeRng(seed), cells = new Array(N * N).fill(0);
    spawn(cells, rng); spawn(cells, rng);
    return { N, cells, rng, score: 0, moves: 0 };
  }

  /**
   * Chấm bàn cho máy tự chơi (chỉ dùng ở smoke test / ảnh thẻ): nhiều ô trống, hàng đơn điệu, ô to ở góc trên-trái.
   */
  function evalBoard(cells, N) {
    let empty = 0, mono = 0, smooth = 0;
    for (let i = 0; i < cells.length; i++) {
      const v = Math.max(0, cells[i]);
      if (!v) { empty++; continue; }
      const r = Math.floor(i / N), c = i % N;
      if (c < N - 1 && cells[i + 1] > 0) { mono += cells[i] >= cells[i + 1] ? v : -v; smooth -= Math.abs(v - cells[i + 1]); }
      if (r < N - 1 && cells[i + N] > 0) { mono += cells[i] >= cells[i + N] ? v : -v; smooth -= Math.abs(v - cells[i + N]); }
    }
    const m = maxTile(cells), corner = cells[0] === m ? m * 4 : 0;
    return empty * 12 + mono * 1.5 + smooth + corner;
  }
  /** nước tốt nhất 1 lớp theo evalBoard (−1 nếu hết nước); `noise` = tỉ lệ đi bừa (cần `rng`) để ván của máy không kéo quá dài */
  function bestMove(cells, N, rng, noise) {
    let best = -1, bs = -Infinity;
    const ok = [];
    for (const d of [0, 3, 1, 2]) {
      const r = move(cells, N, d);
      if (!r.moved) continue;
      ok.push(d);
      const s = evalBoard(r.cells, N) + r.gained * 0.05;
      if (s > bs) { bs = s; best = d; }
    }
    if (rng && noise && ok.length && rng.next() < noise) return ok[Math.floor(rng.next() * ok.length)];
    return best;
  }

  /* ---------- gợi ý: expectimax ---------- */
  /**
   * Chấm bàn cho gợi ý (theo cách các AI 2048 phổ biến): log số ô trống, độ mượt (ô kề chênh ít),
   * độ đơn điệu từng hàng/cột, ô lớn nhất. Ô đá bỏ qua (không tính trống, không tính kề).
   */
  function heur(cells, N) {
    let empty = 0, smooth = 0, mx = 0, mono = 0;
    for (let i = 0; i < cells.length; i++) {
      const v = cells[i];
      if (v === 0) { empty++; continue; }
      if (v < 0) continue;
      if (v > mx) mx = v;
      const c = i % N;
      if (c < N - 1 && cells[i + 1] > 0) smooth -= Math.abs(v - cells[i + 1]);
      if (i + N < cells.length && cells[i + N] > 0) smooth -= Math.abs(v - cells[i + N]);
    }
    for (let a = 0; a < N; a++) {
      // hàng a và cột a: tổng tăng / tổng giảm giữa các ô có số liền nhau
      for (const step of [1, N]) {
        let inc = 0, dec = 0, prev = -1;
        for (let b = 0; b < N; b++) {
          const v = cells[step === 1 ? a * N + b : b * N + a];
          if (v <= 0) continue;
          if (prev >= 0) { if (v > prev) inc += v - prev; else dec += prev - v; }
          prev = v;
        }
        mono -= Math.min(inc, dec);
      }
    }
    return smooth * 0.1 + mono * 1.0 + Math.log(empty + 1) * 2.7 + mx;
  }
  function empties(cells) { const e = []; for (let i = 0; i < cells.length; i++) if (cells[i] === 0) e.push(i); return e; }
  // nút máy chọn: lấy nước tốt nhất
  function maxNode(cells, N, depth) {
    let best = -Infinity;
    for (let d = 0; d < 4; d++) {
      const r = move(cells, N, d);
      if (!r.moved) continue;
      const v = chanceNode(r.cells, N, depth);
      if (v > best) best = v;
    }
    return best === -Infinity ? heur(cells, N) - 50 : best;   // hết nước: phạt nặng
  }
  // nút may rủi: trung bình mọi ô trống × (2: 90%, 4: 10%); nhiều ô trống thì lấy mẫu đều tối đa 8 ô cho nhanh
  function chanceNode(cells, N, depth) {
    if (depth <= 0) return heur(cells, N);
    let e = empties(cells);
    if (!e.length) return maxNode(cells, N, depth - 1);
    if (e.length > 8) { const step = e.length / 8; e = Array.from({ length: 8 }, (_, k) => e[Math.floor(k * step)]); }
    let sum = 0;
    for (const i of e) {
      cells[i] = 1; sum += 0.9 * maxNode(cells, N, depth - 1);
      cells[i] = 2; sum += 0.1 * maxNode(cells, N, depth - 1);
      cells[i] = 0;
    }
    return sum / e.length;
  }
  /**
   * Nước gợi ý: expectimax, độ sâu theo số ô trống (ít ô trống = nguy hiểm → nhìn xa hơn).
   * Trả { dir (−1 nếu hết nước), scores: [điểm 4 hướng hoặc null] }.
   */
  function think(cells, N, depth) {
    const nE = empties(cells).length;
    const D = depth || (nE <= 4 ? 3 : 2);
    const scores = [null, null, null, null];
    let dir = -1, best = -Infinity;
    for (let d = 0; d < 4; d++) {
      const r = move(cells, N, d);
      if (!r.moved) continue;
      const v = chanceNode(r.cells.slice(), N, D) + r.gained * 0.002;
      scores[d] = v;
      if (v > best) { best = v; dir = d; }
    }
    return { dir, scores };
  }

  /* ---------- màn Thử thách ---------- */
  // ô đá viết theo (hàng, cột); goal = số mũ ô cần đạt; limit = số nước tối đa (0 = không giới hạn); star = [≤ nước được 3 sao, ≤ nước được 2 sao]
  const S = (N, ...rc) => rc.map(([r, c]) => r * N + c);
  const LEVELS = [
    { id: 'l1', name: 'Khởi động', N: 4, goal: 7, limit: 0, stones: [], star: [75, 100], desc: 'Lên ô 128 thật gọn' },
    { id: 'l2', name: 'Hòn đá giữa đường', N: 4, goal: 8, limit: 0, stones: S(4, [1, 1]), star: [150, 190], desc: 'Một ô đá chắn lối — lên ô 256' },
    { id: 'l3', name: 'Bàn chật', N: 3, goal: 7, limit: 0, stones: [], star: [72, 92], desc: 'Bàn 3×3 — lên ô 128' },
    { id: 'l4', name: 'Chạy đua', N: 4, goal: 8, limit: 170, stones: [], star: [135, 150], desc: 'Lên ô 256 trong 170 nước' },
    { id: 'l5', name: 'Hai tảng đá', N: 4, goal: 8, limit: 0, stones: S(4, [0, 3], [3, 0]), star: [140, 175], desc: 'Hai góc bị đá chiếm — lên ô 256' },
    { id: 'l6', name: 'Bàn rộng có đá', N: 5, goal: 9, limit: 0, stones: S(5, [2, 2]), star: [275, 330], desc: 'Bàn 5×5, đá ở tâm — lên ô 512' },
    { id: 'l7', name: 'Đếm từng nước', N: 4, goal: 9, limit: 350, stones: [], star: [280, 315], desc: 'Lên ô 512 trong 350 nước' },
    { id: 'l8', name: 'Hành lang', N: 5, goal: 9, limit: 0, stones: S(5, [1, 1], [1, 3], [3, 1], [3, 3]), star: [350, 420], desc: 'Bốn ô đá chia bàn thành hành lang — lên ô 512' },
    { id: 'l9', name: 'Góc kẹt', N: 4, goal: 9, limit: 0, stones: S(4, [1, 2]), star: [275, 330], desc: 'Đá lệch tâm — lên ô 512' },
    { id: 'l10', name: 'Pháo đài', N: 6, goal: 10, limit: 0, stones: S(6, [2, 2], [2, 3], [3, 2], [3, 3]), star: [620, 760], desc: 'Bàn 6×6, khối đá 2×2 ở giữa — lên ô 1024' },
    { id: 'l11', name: 'Nghìn không hai bốn', N: 4, goal: 10, limit: 0, stones: [], star: [520, 600], desc: 'Lên ô 1024 trên bàn chuẩn' },
    { id: 'l12', name: 'Vua của đá', N: 5, goal: 11, limit: 0, stones: S(5, [0, 2], [2, 0], [2, 4], [4, 2]), star: [1100, 1350], desc: 'Đá giữa bốn cạnh — lên ô 2048' },
  ];
  /** ván mới cho màn: đặt đá rồi 2 ô */
  function newLevel(L, seed) {
    const rng = makeRng(seed), cells = new Array(L.N * L.N).fill(0);
    for (const i of L.stones) cells[i] = STONE;
    spawn(cells, rng); spawn(cells, rng);
    return { N: L.N, cells, rng, score: 0, moves: 0 };
  }
  function starsOf(L, moves) { return moves <= L.star[0] ? 3 : moves <= L.star[1] ? 2 : 1; }

  /* ---------- ván mỗi ngày ---------- */
  const DAILY_MOVES = 250;
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  /** ván ngày `key` (vd. '2026-11-16'): cùng hạt giống cho cả ngày, ngày lẻ (theo hạt giống) có 1 ô đá */
  function dailyGame(key) {
    const seed = hashStr('g2048-' + key), N = 4, cells = new Array(16).fill(0);
    const pr = makeRng(seed ^ 0x9e3779b9);
    const stone = pr.next() < 0.5 ? [5, 6, 9, 10][Math.floor(pr.next() * 4)] : -1;
    if (stone >= 0) cells[stone] = STONE;
    const rng = makeRng(seed);
    spawn(cells, rng); spawn(cells, rng);
    return { N, cells, rng, score: 0, moves: 0, stone };
  }

  return { STONE, TARGET, SIZES, makeRng, lines, move, spawn, canMove, maxTile, newGame, evalBoard, bestMove,
    heur, think, LEVELS, newLevel, starsOf, DAILY_MOVES, hashStr, dailyGame };
});
