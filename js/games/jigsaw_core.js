// Lõi Jigsaw Puzzle: lưới mảnh, cạnh răng cưa Bézier theo hạt giống, nhóm mảnh, hút dính, khoá vào khung, xoay 90°.
// Không vẽ gì — chạy được bằng node để test (tools/jigsaw-test.js). Trình duyệt: window.JigsawCore.
// Toạ độ "lời giải": mảnh (c, r) có gốc (c·pw, r·ph). Mỗi nhóm có phép biến đổi { x, y, rot }:
//   điểm trên bàn = R(rot)·(điểm lời giải) + (x, y)   — R(k) = xoay k×90° theo chiều kim đồng hồ (y hướng xuống).
// Hai nhóm ghép đúng với nhau ⇔ cùng rot và (x, y) gần nhau; nhóm nằm đúng chỗ trong khung ⇔ rot 0 và (x, y) ≈ gốc khung.
(function (root, factory) {
  const C = factory();
  if (typeof module === 'object' && module.exports) module.exports = C;
  else root.JigsawCore = C;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // số mảnh → lưới cột × hàng (khung 16:9)
  const GRIDS = { 12: [4, 3], 24: [6, 4], 48: [8, 6], 96: [12, 8] };
  const SIZES = [12, 24, 48, 96];
  const TAB = 0.1;          // cỡ núm (tỉ lệ cạnh)
  const JITTER = 0.06;      // độ lệch ngẫu nhiên tối đa

  /** bộ sinh số ngẫu nhiên có hạt giống (mulberry32) */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** xoay vector (x, y) k lần 90° theo chiều kim đồng hồ */
  function rot(x, y, k) {
    switch (((k % 4) + 4) % 4) {
      case 1: return [-y, x];
      case 2: return [-x, -y];
      case 3: return [y, -x];
      default: return [x, y];
    }
  }

  /** tham số một cạnh trong: núm lồi về phía n (flip = 1) hoặc ngược lại, kèm độ lệch */
  function edgeParams(R, jitter) {
    const u = () => (R() * 2 - 1) * jitter;
    return { flip: R() < 0.5 ? 1 : -1, a: u(), b: u(), c: u(), d: u(), e: u() };
  }

  /**
   * 10 điểm (p0..p9) của một cạnh từ A tới B theo kiểu Draradech: 3 đoạn Bézier bậc ba (vào, núm, ra).
   * Pháp tuyến n = (−dy, dx)/L (vuông góc, bên trái chiều đi trên màn y-xuống… tuỳ hướng — chỉ cần nhất quán).
   */
  function edgePoints(ax, ay, bx, by, p, tab) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const t = tab, f = p.flip;
    const P = (l, w) => [ax + ux * l * L + nx * w * L * f, ay + uy * l * L + ny * w * L * f];
    return [
      P(0, 0), P(0.2, p.a), P(0.5 + p.b + p.d, -t + p.c), P(0.5 - t + p.b, t + p.c),
      P(0.5 - 2 * t + p.b - p.d, 3 * t + p.c), P(0.5 + 2 * t + p.b - p.d, 3 * t + p.c), P(0.5 + t + p.b, t + p.c),
      P(0.5 + p.b + p.d, -t + p.c), P(0.8, p.e), P(1, 0),
    ];
  }

  /**
   * Dựng bộ ghép: { cols, rows, pw, ph, w, h, pad, pieces: [{ i, c, r, cmds, edge: [top,right,bottom,left] }] }.
   * cmds = đường viền mảnh trong toạ độ gốc mảnh (gốc = góc trên-trái ô): ['M',x,y] / ['L',x,y] / ['C',x1,y1,x2,y2,x,y].
   * edge[k] = 0 thẳng (viền), 1 lồi ra ngoài, −1 lõm vào trong.
   */
  function makePuzzle(n, w, h, seed, opts = {}) {
    const g = GRIDS[n] || GRIDS[48];
    const cols = g[0], rows = g[1], pw = w / cols, ph = h / rows;
    const R = rng(seed), tab = opts.tab || TAB, jit = opts.jitter == null ? JITTER : opts.jitter;
    // cạnh ngang hz[r][c]: giữa hàng r−1 và r (r = 1..rows−1), đi trái → phải; cạnh dọc vt[r][c]: giữa cột c−1 và c, đi trên → dưới
    const hz = [], vt = [];
    for (let r = 0; r <= rows; r++) { hz.push([]); for (let c = 0; c < cols; c++) hz[r].push(r > 0 && r < rows ? edgeParams(R, jit) : null); }
    for (let r = 0; r < rows; r++) { vt.push([]); for (let c = 0; c <= cols; c++) vt[r].push(c > 0 && c < cols ? edgeParams(R, jit) : null); }
    const pieces = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x0 = c * pw, y0 = r * ph, x1 = x0 + pw, y1 = y0 + ph;
      const cmds = [['M', 0, 0]], edge = [0, 0, 0, 0];
      // đi theo chiều kim đồng hồ: trên (trái→phải), phải (trên→dưới), dưới (phải→trái), trái (dưới→lên)
      const add = (pts, rev) => {
        const q = rev ? pts.slice().reverse() : pts;
        for (let k = 1; k < 10; k += 3) cmds.push(['C', q[k][0] - x0, q[k][1] - y0, q[k + 1][0] - x0, q[k + 1][1] - y0, q[k + 2][0] - x0, q[k + 2][1] - y0]);
      };
      // pháp tuyến của cạnh ngang trái→phải là (0, 1) = xuống; của cạnh dọc trên→dưới là (−1, 0) = sang trái
      const top = hz[r][c], right = vt[r][c + 1], bottom = hz[r + 1][c], left = vt[r][c];
      if (top) { add(edgePoints(x0, y0, x1, y0, top, tab), false); edge[0] = top.flip > 0 ? -1 : 1; } else cmds.push(['L', pw, 0]);
      if (right) { add(edgePoints(x1, y0, x1, y1, right, tab), false); edge[1] = right.flip > 0 ? -1 : 1; } else cmds.push(['L', pw, ph]);
      if (bottom) { add(edgePoints(x0, y1, x1, y1, bottom, tab), true); edge[2] = bottom.flip > 0 ? 1 : -1; } else cmds.push(['L', 0, ph]);
      if (left) { add(edgePoints(x0, y0, x0, y1, left, tab), true); edge[3] = left.flip > 0 ? 1 : -1; } else cmds.push(['L', 0, 0]);
      pieces.push({ i: r * cols + c, c, r, cmds, edge });
    }
    return { n: cols * rows, cols, rows, pw, ph, w, h, seed, pad: Math.ceil(Math.max(pw, ph) * (3 * tab + jit + 0.06)), pieces, hz, vt };
  }

  /** các ô kề (trên, phải, dưới, trái) của mảnh i */
  function neighbors(P, i) {
    const c = i % P.cols, r = Math.floor(i / P.cols), out = [];
    if (r > 0) out.push(i - P.cols);
    if (c < P.cols - 1) out.push(i + 1);
    if (r < P.rows - 1) out.push(i + P.cols);
    if (c > 0) out.push(i - 1);
    return out;
  }
  const isEdge = (P, i) => { const c = i % P.cols, r = Math.floor(i / P.cols); return c === 0 || r === 0 || c === P.cols - 1 || r === P.rows - 1; };

  /**
   * Bàn chơi: nhóm mảnh + hút dính. fx, fy = gốc khung trên bàn.
   * groups: Map id → { id, x, y, rot, m: [chỉ số mảnh], locked, z }.
   */
  class Board {
    constructor(P, fx, fy) {
      this.P = P; this.fx = fx; this.fy = fy;
      this.gOf = new Array(P.n).fill(0);
      this.groups = new Map(); this.nextId = 1; this.zTop = 0;
    }
    /** mỗi mảnh một nhóm, đặt sao cho TÂM mảnh ở (cx, cy), xoay rot */
    place(i, cx, cy, rt = 0) {
      const P = this.P, p = P.pieces[i];
      const s = [(p.c + 0.5) * P.pw, (p.r + 0.5) * P.ph], v = rot(s[0], s[1], rt);
      const id = this.nextId++;
      this.groups.set(id, { id, x: cx - v[0], y: cy - v[1], rot: ((rt % 4) + 4) % 4, m: [i], locked: false, z: ++this.zTop });
      this.gOf[i] = id;
      return id;
    }
    group(id) { return this.groups.get(id); }
    groupOfPiece(i) { return this.groups.get(this.gOf[i]); }
    /** điểm lời giải (sx, sy) của nhóm g → toạ độ bàn */
    toBoard(g, sx, sy) { const v = rot(sx, sy, g.rot); return [v[0] + g.x, v[1] + g.y]; }
    /** toạ độ bàn → điểm lời giải theo nhóm g */
    toSol(g, bx, by) { return rot(bx - g.x, by - g.y, 4 - g.rot); }
    pieceCenter(i) { const P = this.P, p = P.pieces[i], g = this.groupOfPiece(i); return this.toBoard(g, (p.c + 0.5) * P.pw, (p.r + 0.5) * P.ph); }
    /** nhóm theo thứ tự vẽ (dưới → trên): nhóm đã khoá luôn ở dưới */
    order() { return [...this.groups.values()].sort((a, b) => (b.locked - a.locked) || a.z - b.z); }
    raise(g) { g.z = ++this.zTop; }
    move(g, dx, dy) { g.x += dx; g.y += dy; }
    /** xoay nhóm quanh điểm (px, py) trên bàn, dir = ±1 */
    rotate(g, px, py, dir) {
      if (g.locked) return;
      const s = this.toSol(g, px, py);
      g.rot = (((g.rot + dir) % 4) + 4) % 4;
      const v = rot(s[0], s[1], g.rot);
      g.x = px - v[0]; g.y = py - v[1];
    }
    /** gần đúng (theo ô chữ nhật, không theo núm): mảnh nằm dưới điểm (bx, by) trong nhóm g, hoặc −1 */
    pieceAtRect(g, bx, by) {
      const P = this.P, s = this.toSol(g, bx, by);
      const c = Math.floor(s[0] / P.pw), r = Math.floor(s[1] / P.ph);
      if (c < 0 || r < 0 || c >= P.cols || r >= P.rows) return -1;
      const i = r * P.cols + c;
      return this.gOf[i] === g.id ? i : -1;
    }
    /**
     * Thả nhóm g: gộp với các nhóm kề đúng vị trí (sai lệch < tol, cùng góc), rồi khoá vào khung nếu đúng chỗ.
     * Trả { joins: số lần gộp, locked: vừa khoá, gid: id nhóm sau cùng, moved: [dx, dy] độ dời của nhóm thả }.
     */
    drop(g, tol) {
      let joins = 0, justLocked = false;
      const x0 = g.x, y0 = g.y;
      let changed = true;
      while (changed) {
        changed = false;
        for (const i of g.m) {
          for (const j of neighbors(this.P, i)) {
            const h = this.groups.get(this.gOf[j]);
            if (!h || h === g || h.rot !== g.rot) continue;
            if (Math.hypot(h.x - g.x, h.y - g.y) >= tol) continue;
            // nhóm nhỏ dính vào nhóm lớn (nhóm đã khoá không bao giờ bị dời)
            let keep = h, gone = g;
            if (!h.locked && (g.locked || g.m.length > h.m.length)) { keep = g; gone = h; }
            for (const k of gone.m) { this.gOf[k] = keep.id; keep.m.push(k); }
            this.groups.delete(gone.id);
            keep.z = Math.max(keep.z, gone.z);
            g = keep; joins++; changed = true;
            break;
          }
          if (changed) break;
        }
      }
      if (!g.locked && g.rot === 0 && Math.hypot(g.x - this.fx, g.y - this.fy) < tol) {
        g.x = this.fx; g.y = this.fy; g.locked = true; justLocked = true;
        // nhóm đã khoá nằm sát nhau thì gộp luôn
        for (const i of [...g.m]) for (const j of neighbors(this.P, i)) {
          const h = this.groups.get(this.gOf[j]);
          if (h && h !== g && h.locked) { for (const k of h.m) { this.gOf[k] = g.id; g.m.push(k); } this.groups.delete(h.id); }
        }
      }
      return { joins, locked: justLocked, gid: g.id, moved: [g.x - x0, g.y - y0] };
    }
    lockedCount() { let n = 0; for (const g of this.groups.values()) if (g.locked) n += g.m.length; return n; }
    /** số chỗ nối đã khớp (mỗi lần gộp = số mảnh − số nhóm) */
    joinedCount() { return this.P.n - this.groups.size; }
    done() { return this.groups.size === 1 && [...this.groups.values()][0].locked; }
    /** chụp trạng thái để lưu ván */
    snapshot() {
      return [...this.groups.values()].map((g) => ({ x: Math.round(g.x * 10) / 10, y: Math.round(g.y * 10) / 10, rot: g.rot, l: g.locked ? 1 : 0, m: g.m.slice() }));
    }
    /** dựng lại từ snapshot; trả false nếu dữ liệu không khớp bộ ghép */
    restore(snap) {
      if (!Array.isArray(snap)) return false;
      const seen = new Array(this.P.n).fill(false);
      for (const s of snap) for (const i of s.m || []) { if (!(i >= 0 && i < this.P.n) || seen[i]) return false; seen[i] = true; }
      if (seen.some((v) => !v)) return false;
      this.groups.clear(); this.nextId = 1; this.zTop = 0;
      for (const s of snap) {
        const id = this.nextId++;
        this.groups.set(id, { id, x: +s.x || 0, y: +s.y || 0, rot: (s.rot | 0) & 3, m: s.m.slice(), locked: !!s.l, z: ++this.zTop });
        for (const i of s.m) this.gOf[i] = id;
      }
      return true;
    }
  }

  /**
   * Rải n mảnh quanh khung: trả mảng tâm [x, y] (trộn thứ tự). area = { w, h, top }; frame = { x, y, w, h }.
   * Tránh khung (thu vào `inset`), chừa mép `margin`; mảnh được phép chồng nhẹ lên nhau.
   */
  function scatter(R, n, area, frame, piece, inset = 0.35, edge = 0.55) {
    const pts = [], mx = piece.w * edge, my = piece.h * edge;
    const fx0 = frame.x + piece.w * inset, fx1 = frame.x + frame.w - piece.w * inset;
    const fy0 = frame.y + piece.h * inset, fy1 = frame.y + frame.h - piece.h * inset;
    const okPos = (x, y) => !(x > fx0 - piece.w * 0.5 && x < fx1 + piece.w * 0.5 && y > fy0 - piece.h * 0.5 && y < fy1 + piece.h * 0.5);
    let minD = Math.max(piece.w, piece.h) * 0.95;
    for (let k = 0; k < n; k++) {
      let best = null, bd = -1;
      for (let t = 0; t < 60; t++) {
        const x = mx + R() * (area.w - 2 * mx), y = area.top + my + R() * (area.h - area.top - 2 * my);
        if (!okPos(x, y)) continue;
        let d = Infinity;
        for (const p of pts) d = Math.min(d, Math.hypot(p[0] - x, p[1] - y));
        if (d >= minD) { best = [x, y]; bd = d; break; }
        if (d > bd) { bd = d; best = [x, y]; }
      }
      if (!best) best = [mx + R() * (area.w - 2 * mx), area.top + my];
      pts.push(best);
      if (k % 8 === 7) minD *= 0.96;
    }
    return pts;
  }

  /**
   * Chỗ xếp gọn: lưới ô quanh khung (ngoài khung), sắp theo khoảng cách tới khung (gần trước).
   * Trả mảng tâm [x, y] dài ≥ n nếu xếp được (thu nhỏ khoảng cách dần, tối thiểu `minGap` × cỡ mảnh).
   * block(x, y) → true = chỗ đó đã có nhóm lớn, bỏ qua.
   */
  function tidySlots(n, area, frame, piece, block = () => false, gap = 1.5, minGap = 0.95) {
    let last = [];
    // mảnh to (ít mảnh) không đủ chỗ ngoài khung → cho chỗ lấn dần vào mép khung (ef âm)
    for (const ef of [0.6, 0.3, 0, -0.25, -0.45]) {
      for (let k = gap; k >= minGap - 1e-9; k -= 0.05) {
        const sx = piece.w * k, sy = piece.h * k, out = [];
        const x0 = piece.w * 0.75, y0 = area.top + piece.h * 0.75, x1 = area.w - piece.w * 0.75, y1 = area.h - piece.h * 0.7;
        const ex = piece.w * ef, ey = piece.h * ef;   // cách mép khung (âm = lấn vào trong)
        for (let y = y0; y <= y1 + 1e-6; y += sy) {
          for (let x = x0; x <= x1 + 1e-6; x += sx) {
            if (x > frame.x - ex && x < frame.x + frame.w + ex && y > frame.y - ey && y < frame.y + frame.h + ey) continue;
            if (block(x, y)) continue;
            const dx = Math.max(frame.x - x, 0, x - frame.x - frame.w), dy = Math.max(frame.y - y, 0, y - frame.y - frame.h);
            out.push([x, y, Math.hypot(dx, dy) + y * 1e-4 + x * 1e-7]);
          }
        }
        if (out.length > last.length) last = out;
        if (out.length >= n) { out.sort((a, b) => a[2] - b[2]); return out.map((p) => [p[0], p[1]]); }
      }
    }
    last.sort((a, b) => a[2] - b[2]);
    return last.map((p) => [p[0], p[1]]);
  }

  return { GRIDS, SIZES, TAB, JITTER, rng, rot, edgePoints, makePuzzle, neighbors, isEdge, Board, scatter, tidySlots };
});
