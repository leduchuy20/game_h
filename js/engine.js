'use strict';
/* =========================================================
   Tròn Party — engine dùng chung
   (hằng số, tiện ích, input, âm thanh, hiệu ứng, hàm vẽ)
   ========================================================= */

const W = 1280, H = 720, TAU = Math.PI * 2;
const FONT = '"Baloo 2", "Segoe UI", system-ui, sans-serif';

const PLAYER_COLORS = [
  { name: 'Xanh',  main: '#3d9bff', dark: '#1f5fbf', light: '#d2e8ff' },
  { name: 'Hồng',  main: '#ff5c9d', dark: '#c02c69', light: '#ffd6e7' },
  { name: 'Lá',    main: '#34cc78', dark: '#1a8648', light: '#cbf6dd' },
  { name: 'Vàng',  main: '#ffbf2e', dark: '#c0840a', light: '#fff1c6' },
];
// màu người chơi tự chọn ở sảnh (4 màu đầu = màu mặc định P1–P4)
const COLOR_CHOICES = PLAYER_COLORS.concat([
  { name: 'Cam',   main: '#ff8a3d', dark: '#c0561a', light: '#ffe0c9' },
  { name: 'Tím',   main: '#a66bff', dark: '#6a37c0', light: '#e6d6ff' },
  { name: 'Ngọc',  main: '#22c7c0', dark: '#11807b', light: '#c6f5f2' },
  { name: 'Đỏ',    main: '#ff4f4f', dark: '#b81f1f', light: '#ffd2d2' },
  { name: 'Trắng', main: '#e8e4f2', dark: '#9a93b0', light: '#ffffff' },
  { name: 'Nâu',   main: '#b0784a', dark: '#6e4423', light: '#f0dcc8' },
]);
const NAME_MAX = 8; // tên người chơi tối đa 8 ký tự cho vừa ô điểm trên HUD

/* ---------------- Tiện ích ---------------- */
const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a = 0, b = 1) => a + Math.random() * (b - a),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
  approach: (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t)),
  angDiff(a, b) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  },
  outBack(t) { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  fmtTime(s) {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  },
  now: () => performance.now() / 1000,
};

/* ---------------- Input ----------------
   4 bộ phím trên 1 bàn phím + tối đa 4 tay cầm (Gamepad API).
   Mỗi người chơi có: hướng đi (mx,my), nút Đánh (act) và nút Nhảy (jump).
*/
const KB_SCHEMES = [
  { name: 'Phím trái',  keys: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', act: 'KeyQ', jump: 'KeyE' },
    labels: { move: 'W A S D', act: 'Q', jump: 'E' } },
  { name: 'Phím giữa',  keys: { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', act: 'KeyU', jump: 'KeyO' },
    labels: { move: 'I J K L', act: 'U', jump: 'O' } },
  { name: 'Mũi tên',    keys: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', act: 'Period', jump: 'Slash' },
    labels: { move: '↑ ← ↓ →', act: '.', jump: '/' } },
  { name: 'Phím số',    keys: { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', act: 'Numpad7', jump: 'Numpad9' },
    labels: { move: '8 4 5 6 (numpad)', act: '7', jump: '9' } },
];
const PAD_LABELS = { move: 'Cần trái / D-pad', act: 'A', jump: 'B' };

const GAME_KEYS = new Set(KB_SCHEMES.flatMap((s) => Object.values(s.keys))
  .concat(['Space', 'Enter', 'Escape', 'KeyP', 'Tab', 'Backspace']));

/* ---------------- Đổi phím (ALL14) ----------------
   Bộ phím gốc giữ trong KB_DEFAULT; bộ phím đã đổi lưu localStorage 'tronparty.keys'. */
const KB_DEFAULT = KB_SCHEMES.map((s) => Object.assign({}, s.keys));
const KEY_ACTIONS = [['up', 'Lên'], ['down', 'Xuống'], ['left', 'Trái'], ['right', 'Phải'], ['act', 'Đánh'], ['jump', 'Nhảy']];
const RESERVED_KEYS = ['Enter', 'Escape', 'Space', 'Tab', 'KeyP', 'Backspace'];
function keyName(code) {
  if (!code) return '?';
  const map = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Period: '.', Slash: '/', Comma: ',', Semicolon: ';',
    Quote: "'", BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`', Backslash: '\\', ShiftLeft: 'Shift trái',
    ShiftRight: 'Shift phải', ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải', AltLeft: 'Alt trái', AltRight: 'Alt phải',
    NumpadAdd: 'Num +', NumpadSubtract: 'Num −', NumpadMultiply: 'Num *', NumpadDivide: 'Num /', NumpadEnter: 'Num Enter', NumpadDecimal: 'Num .' };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
/** cập nhật nhãn hiển thị của từng bộ phím theo phím đang gán */
function refreshKeyLabels() {
  KB_SCHEMES.forEach((s, i) => {
    const k = s.keys, dflt = Object.keys(k).every((a) => k[a] === KB_DEFAULT[i][a]);
    s.dLabels = s.dLabels || Object.assign({}, s.labels); // nhãn gốc (vd "8 4 5 6 (numpad)")
    if (dflt) s.labels = Object.assign({}, s.dLabels);
    else {
      s.labels = { move: `${keyName(k.up)} ${keyName(k.left)} ${keyName(k.down)} ${keyName(k.right)}`, act: keyName(k.act), jump: keyName(k.jump) };
    }
    Object.values(k).forEach((c) => GAME_KEYS.add(c));
  });
}
function loadKeys() {
  try {
    const arr = JSON.parse(localStorage.getItem('tronparty.keys') || 'null');
    if (Array.isArray(arr) && arr.length === KB_SCHEMES.length) arr.forEach((k, i) => {
      if (k && KEY_ACTIONS.every(([a]) => typeof k[a] === 'string')) KB_SCHEMES[i].keys = Object.assign({}, k);
    });
  } catch (e) { /* bỏ qua */ }
  refreshKeyLabels();
}
function saveKeys() {
  try { localStorage.setItem('tronparty.keys', JSON.stringify(KB_SCHEMES.map((s) => s.keys))); } catch (e) { /* bỏ qua */ }
  refreshKeyLabels();
}
/** gán phím code cho (bộ i, hành động a); phím đang dùng ở chỗ khác thì đổi chỗ cho nhau */
function bindKey(i, a, code) {
  const old = KB_SCHEMES[i].keys[a];
  KB_SCHEMES.forEach((s) => KEY_ACTIONS.forEach(([b]) => { if (s.keys[b] === code) s.keys[b] = old; }));
  KB_SCHEMES[i].keys[a] = code;
  saveKeys();
}
function resetKeys() {
  KB_SCHEMES.forEach((s, i) => { s.keys = Object.assign({}, KB_DEFAULT[i]); });
  saveKeys();
}

const Input = {
  down: new Set(),
  queue: new Set(),
  just: new Set(),
  pads: [],

  init() {
    addEventListener('keydown', (e) => {
      // đang gõ chữ (đổi tên) thì không coi là phím game
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.queue.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
  },

  poll() {
    this.just = this.queue;
    this.queue = new Set();
    let gps = [];
    try { gps = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { gps = []; }
    for (let i = 0; i < 4; i++) {
      const gp = gps[i];
      const st = this.pads[i] || (this.pads[i] = { connected: false, b: [], pb: [], x: 0, y: 0, px: 0, py: 0 });
      st.pb = st.b; st.px = st.x; st.py = st.y;
      if (!gp || !gp.connected) { st.connected = false; st.b = []; st.x = st.y = 0; continue; }
      st.connected = true;
      st.b = gp.buttons.map((b) => b.pressed || b.value > 0.5);
      let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
      if (Math.hypot(x, y) < 0.35) x = y = 0;
      if (st.b[14]) x = -1; if (st.b[15]) x = 1;
      if (st.b[12]) y = -1; if (st.b[13]) y = 1;
      st.x = x; st.y = y;
    }
  },

  key(c) { return this.down.has(c); },
  hit(c) { return this.just.has(c); },
  padHit(i, btn) { const p = this.pads[i]; return !!(p && p.connected && p.b[btn] && !p.pb[btn]); },
  padCount() { return this.pads.filter((p) => p && p.connected).length; },
  /** Rung tay cầm (ALL11). strength 0..1. Trình duyệt không hỗ trợ (Firefox) thì bỏ qua. */
  rumble(index, strength = 0.5, ms = 160) {
    if (!this.rumbleOn) return;
    try {
      const gp = navigator.getGamepads && navigator.getGamepads()[index];
      const act = gp && gp.vibrationActuator;
      if (!act || !act.playEffect) return;
      const s = Math.max(0, Math.min(1, strength));
      act.playEffect('dual-rumble', { duration: ms, strongMagnitude: s, weakMagnitude: Math.min(1, s * 1.2) }).catch(() => {});
    } catch (e) { /* bỏ qua */ }
  },
  rumbleOn: true,

  /** Đọc trạng thái điều khiển của 1 nguồn (bàn phím hoặc tay cầm). */
  read(src) {
    const o = { mx: 0, my: 0, act: false, jump: false, actP: false, jumpP: false };
    if (!src) return o;
    if (src.type === 'kb') {
      const k = KB_SCHEMES[src.scheme].keys;
      o.mx = (this.key(k.right) ? 1 : 0) - (this.key(k.left) ? 1 : 0);
      o.my = (this.key(k.down) ? 1 : 0) - (this.key(k.up) ? 1 : 0);
      o.act = this.key(k.act); o.jump = this.key(k.jump);
      o.actP = this.hit(k.act); o.jumpP = this.hit(k.jump);
    } else if (src.type === 'pad') {
      const p = this.pads[src.index];
      if (!p || !p.connected) return o;
      o.mx = p.x; o.my = p.y;
      o.act = !!(p.b[0] || p.b[2]); o.jump = !!(p.b[1] || p.b[3]);
      o.actP = this.padHit(src.index, 0) || this.padHit(src.index, 2);
      o.jumpP = this.padHit(src.index, 1) || this.padHit(src.index, 3);
    }
    const l = Math.hypot(o.mx, o.my);
    if (l > 1) { o.mx /= l; o.my /= l; }
    return o;
  },

  /** Điều hướng menu: gộp tất cả bộ phím + tay cầm. */
  menu() {
    const m = { up: false, down: false, left: false, right: false, enter: false, act: false, back: false, start: false };
    for (const s of KB_SCHEMES) {
      const k = s.keys;
      if (this.hit(k.up)) m.up = true;
      if (this.hit(k.down)) m.down = true;
      if (this.hit(k.left)) m.left = true;
      if (this.hit(k.right)) m.right = true;
      if (this.hit(k.act)) m.act = true;
    }
    if (this.hit('Enter') || this.hit('Space')) m.enter = true;
    if (this.hit('Escape')) m.back = true;
    this.pads.forEach((p, i) => {
      if (!p || !p.connected) return;
      if (p.y < -0.5 && p.py >= -0.5) m.up = true;
      if (p.y > 0.5 && p.py <= 0.5) m.down = true;
      if (p.x < -0.5 && p.px >= -0.5) m.left = true;
      if (p.x > 0.5 && p.px <= 0.5) m.right = true;
      if (this.padHit(i, 0)) m.act = true;
      if (this.padHit(i, 1)) m.back = true;
      if (this.padHit(i, 9)) m.start = true;
    });
    return m;
  },
};

function srcLabels(src) {
  if (!src) return null;
  return src.type === 'kb' ? KB_SCHEMES[src.scheme].labels : PAD_LABELS;
}
function srcName(src) {
  if (!src) return 'Máy';
  return src.type === 'kb' ? KB_SCHEMES[src.scheme].name : `Tay cầm ${src.index + 1}`;
}

/* ---------------- Âm thanh (tự tổng hợp bằng WebAudio, không cần file) ---------------- */
const Sfx = {
  ctx: null, master: null, noiseBuf: null, muted: false, last: {},

  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.32;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(f, d = 0.12, type = 'square', v = 0.3, f2 = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + d + 0.03);
  },

  noise(d = 0.3, v = 0.4, freq = 800, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + d + 0.03);
  },

  play(name, minGap = 0.03) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < minGap) return;
    this.last[name] = now;
    const T = this.tone.bind(this), N = this.noise.bind(this);
    switch (name) {
      case 'move':   T(520, 0.05, 'square', 0.1); break;
      case 'select': T(660, 0.07, 'square', 0.18); T(990, 0.1, 'square', 0.18, null, 0.06); break;
      case 'join':   T(440, 0.08, 'triangle', 0.3); T(660, 0.08, 'triangle', 0.3, null, 0.08); T(880, 0.12, 'triangle', 0.3, null, 0.16); break;
      case 'leave':  T(500, 0.18, 'triangle', 0.3, 220); break;
      case 'dash':   N(0.15, 0.22, 2200); T(280, 0.12, 'sawtooth', 0.1, 620); break;
      case 'hit':    T(190, 0.12, 'square', 0.28, 80); N(0.08, 0.3, 1600); break;
      case 'boom':   N(0.6, 0.55, 700); T(130, 0.4, 'sine', 0.5, 40); break;
      case 'fall':   T(720, 0.55, 'sine', 0.22, 110); break;
      case 'pickup': T(880, 0.06, 'square', 0.18); T(1320, 0.1, 'square', 0.18, null, 0.06); break;
      case 'paint':  T(U.rand(480, 720), 0.035, 'triangle', 0.06); break;
      case 'count':  T(440, 0.16, 'square', 0.22); break;
      case 'go':     T(880, 0.35, 'square', 0.22); T(1320, 0.35, 'square', 0.12); break;
      case 'win':    [523, 659, 784, 1047].forEach((f, i) => T(f, 0.2, 'square', 0.2, null, i * 0.12)); break;
      case 'hurt':   T(320, 0.25, 'sawtooth', 0.22, 90); break;
      case 'jump':   T(300, 0.15, 'sine', 0.22, 760); break;
      case 'punch':  N(0.07, 0.35, 3000); T(230, 0.08, 'square', 0.2, 110); break;
      case 'crash':  N(0.4, 0.45, 1300); T(220, 0.3, 'sawtooth', 0.25, 45); break;
      case 'crown':  T(784, 0.08, 'triangle', 0.3); T(1175, 0.16, 'triangle', 0.3, null, 0.08); break;
      case 'tick':   T(1250, 0.04, 'square', 0.1); break;
      case 'warn':   T(920, 0.07, 'square', 0.08); T(920, 0.07, 'square', 0.08, null, 0.12); break;
      case 'place':  T(210, 0.07, 'square', 0.2); break;
      case 'crumble':N(0.35, 0.25, 500); break;
      case 'kick':   T(170, 0.09, 'sine', 0.45, 60); N(0.05, 0.3, 2600); break;
      case 'goal':   N(0.8, 0.25, 4000); [523, 659, 784, 1047, 1319].forEach((f, i) => T(f, 0.16, 'square', 0.2, null, i * 0.08)); break;
      case 'eat':    T(U.rand(500, 700), 0.07, 'sine', 0.25, 1100); break;
      case 'shoot':  T(700, 0.12, 'square', 0.15, 180); N(0.08, 0.25, 3000); break;
      case 'pull':   T(U.rand(140, 180), 0.05, 'square', 0.12); break;
    }
  },
};

/* ---------------- Hiệu ứng ---------------- */
const FX = {
  amt: 0,
  onShake: null,   // app gắn vào để rung tay cầm theo rung màn hình (ALL11)
  shake(a) { this.amt = Math.max(this.amt, a); if (this.onShake) this.onShake(a); },
  update(dt) { this.amt = Math.max(0, this.amt - dt * 40); },
  offset() { const a = this.amt; return a ? { x: U.rand(-a, a), y: U.rand(-a, a) } : { x: 0, y: 0 }; },
};

class Particles {
  constructor() { this.list = []; }
  burst(x, y, color, n = 12, speed = 220, life = 0.6, size = 6, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = speed * (0.35 + Math.random() * 0.65);
      this.list.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0),
        life: life * (0.6 + Math.random() * 0.4), max: life,
        size: size * (0.6 + Math.random() * 0.7),
        color: Array.isArray(color) ? U.pick(color) : color,
        g: o.g || 0, drag: o.drag ?? 3, shape: o.shape || 'c',
      });
    }
  }
  text(x, y, s, color = '#fff', size = 28) {
    this.list.push({ type: 't', x, y, vx: 0, vy: -70, life: 1.1, max: 1.1, s, color, size, g: 0, drag: 0.5 });
  }
  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += p.g * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }
  draw(ctx) {
    for (const p of this.list) {
      const a = U.clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = Math.min(1, a * 1.5);
      if (p.type === 't') {
        Draw.text(ctx, p.s, p.x, p.y, { size: p.size, color: p.color });
      } else if (p.shape === 's') {
        Draw.sparkle(ctx, p.x, p.y, p.size * (0.5 + a), p.color);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

/* ---------------- Vật lý đơn giản ---------------- */
const Phys = {
  /** Đẩy các hình tròn ra khỏi nhau. onHit(a,b,nx,ny,impact) */
  separate(list, rest = 0.7, onHit) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.skip || b.skip) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
        if (d < m && d > 0.0001) {
          const nx = dx / d, ny = dy / d, ov = (m - d) / 2;
          a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) {
            const jj = -(1 + rest) * rv / 2;
            a.vx -= jj * nx; a.vy -= jj * ny; b.vx += jj * nx; b.vy += jj * ny;
          }
          if (onHit) onHit(a, b, nx, ny, -rv, i, j);
        }
      }
    }
  },
  /** Đẩy hình tròn c ra khỏi hình chữ nhật r. */
  circleRect(c, r) {
    const px = U.clamp(c.x, r.x, r.x + r.w), py = U.clamp(c.y, r.y, r.y + r.h);
    const dx = c.x - px, dy = c.y - py, d = Math.hypot(dx, dy);
    if (d >= c.r) return false;
    if (d < 0.0001) {
      const l = c.x - r.x, rr = r.x + r.w - c.x, t = c.y - r.y, b = r.y + r.h - c.y;
      const m = Math.min(l, rr, t, b);
      if (m === l) { c.x = r.x - c.r; c.vx = Math.min(0, c.vx); }
      else if (m === rr) { c.x = r.x + r.w + c.r; c.vx = Math.max(0, c.vx); }
      else if (m === t) { c.y = r.y - c.r; c.vy = Math.min(0, c.vy); }
      else { c.y = r.y + r.h + c.r; c.vy = Math.max(0, c.vy); }
      return true;
    }
    const nx = dx / d, ny = dy / d;
    c.x = px + nx * c.r; c.y = py + ny * c.r;
    const vn = c.vx * nx + c.vy * ny;
    if (vn < 0) { c.vx -= vn * nx; c.vy -= vn * ny; }
    return true;
  },
};

/* ---------------- Hàm vẽ ---------------- */
const Draw = {
  rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  text(ctx, s, x, y, o = {}) {
    const size = o.size || 32;
    ctx.font = `${o.weight || 800} ${size}px ${FONT}`;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.base || 'middle';
    if (o.stroke !== null) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.sw || Math.max(3, size * 0.16);
      ctx.strokeStyle = o.stroke || 'rgba(25,12,45,.65)';
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(s, x, y);
  },

  sparkle(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.fill();
  },

  /** Nhân vật "Tròn": thân tròn, 2 mắt nhìn theo hướng, 2 chân. */
  blob(ctx, o) {
    const r = o.r || 26, c = o.color, face = o.face || 0, z = o.z || 0;
    const sq = o.squash || 0, scale = o.scale ?? 1;
    if (scale <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = o.alpha ?? 1;
    if (o.shadow !== false) {
      const k = 1 - Math.min(z, 90) / 180;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(o.x, o.y + r * 0.8 * scale, r * 0.95 * scale * k, r * 0.32 * scale * k, 0, 0, TAU);
      ctx.fill();
    }
    ctx.translate(o.x, o.y - z);
    ctx.scale(scale, scale);
    const fx = Math.cos(face), fy = Math.sin(face);
    const ph = Math.sin(o.walk || 0);
    // chân
    ctx.fillStyle = c.dark;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.42 + fx * r * 0.1, r * 0.8 + s * ph * r * 0.1, r * 0.3, r * 0.19, 0, 0, TAU);
      ctx.fill();
    }
    // thân
    ctx.save();
    ctx.scale(1 + sq, 1 - sq);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.42, r * 0.08, 0, 0, r * 1.05);
    g.addColorStop(0, c.light); g.addColorStop(0.38, c.main); g.addColorStop(1, c.dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.1); ctx.strokeStyle = 'rgba(20,10,40,0.45)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.5, r * 0.22, r * 0.12, -0.6, 0, TAU); ctx.fill();
    ctx.restore();
    // mắt
    const ex = fx * r * 0.3, ey = fy * r * 0.18 - r * 0.12;
    for (const s of [-1, 1]) {
      const cx = ex + s * r * 0.3, cy = ey;
      if (o.stun || o.dead) {
        ctx.strokeStyle = '#2a1840'; ctx.lineWidth = r * 0.09; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.13, cy - r * 0.13); ctx.lineTo(cx + r * 0.13, cy + r * 0.13);
        ctx.moveTo(cx + r * 0.13, cy - r * 0.13); ctx.lineTo(cx - r * 0.13, cy + r * 0.13);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.21, r * 0.27, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1d1230';
        ctx.beginPath(); ctx.arc(cx + fx * r * 0.08, cy + fy * r * 0.1, r * 0.11, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx + fx * r * 0.08 - r * 0.04, cy + fy * r * 0.1 - r * 0.05, r * 0.035, 0, TAU); ctx.fill();
      }
    }
    // má hồng
    ctx.fillStyle = 'rgba(255,120,150,0.45)';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(ex + s * r * 0.55, ey + r * 0.3, r * 0.12, r * 0.07, 0, 0, TAU); ctx.fill();
    }
    // sao choáng
    if (o.stun) {
      const t = U.now() * 5;
      for (let k = 0; k < 3; k++) {
        const a = t + k * TAU / 3;
        Draw.sparkle(ctx, Math.cos(a) * r * 0.75, -r * 1.15 + Math.sin(a) * r * 0.22, r * 0.2, '#ffe14d');
      }
    }
    if (o.crown) Draw.crown(ctx, 0, -r * 1.05, r * 0.9);
    ctx.restore();
  },

  crown(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a86b00'; ctx.lineWidth = s * 0.08; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, s * 0.25); ctx.lineTo(-s * 0.55, -s * 0.3); ctx.lineTo(-s * 0.25, -s * 0.05);
    ctx.lineTo(0, -s * 0.45); ctx.lineTo(s * 0.25, -s * 0.05); ctx.lineTo(s * 0.55, -s * 0.3);
    ctx.lineTo(s * 0.5, s * 0.25); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff4f6d';
    ctx.beginPath(); ctx.arc(0, s * 0.08, s * 0.09, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4fd1ff';
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.arc(k * s * 0.28, s * 0.1, s * 0.065, 0, TAU); ctx.fill(); }
    ctx.restore();
  },

  /** Chữ lớn giữa màn hình, nảy lên khi xuất hiện. */
  banner(ctx, s, age, o = {}) {
    const k = age < 0.35 ? U.outBack(Math.max(0, age) / 0.35) : 1;
    ctx.save();
    ctx.translate(W / 2, o.y ?? H / 2);
    ctx.scale(k, k);
    Draw.text(ctx, s, 0, 0, { size: o.size || 76, color: o.color || '#fff', sw: 14 });
    if (o.sub) Draw.text(ctx, o.sub, 0, (o.size || 76) * 0.78, { size: (o.size || 76) * 0.38 });
    ctx.restore();
  },

  /** Dải thẻ người chơi phía trên màn hình. */
  chips(ctx, players, texts, o = {}) {
    const n = players.length, w = o.w || 190, gap = 12, y = o.y || 38;
    let x = W / 2 - (n * w + (n - 1) * gap) / 2;
    players.forEach((p, i) => {
      ctx.save();
      if (o.dim && o.dim[i]) ctx.globalAlpha = 0.45;
      Draw.rr(ctx, x, y - 24, w, 48, 24);
      ctx.fillStyle = 'rgba(20,12,40,0.6)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = p.color.main; ctx.stroke();
      Draw.blob(ctx, { x: x + 25, y: y - 2, r: 15, color: p.color, shadow: false, crown: o.crown === i });
      // tên dài thì thu nhỏ chữ / cắt bớt cho khỏi đè lên số điểm
      ctx.font = `800 22px ${FONT}`;
      const tw = ctx.measureText(String(texts[i])).width, room = w - 48 - 16 - tw - 8;
      let nm = p.name, sz = 20;
      ctx.font = `800 ${sz}px ${FONT}`;
      while (sz > 13 && ctx.measureText(nm).width > room) { sz--; ctx.font = `800 ${sz}px ${FONT}`; }
      while (nm.length > 1 && ctx.measureText(nm).width > room) nm = nm.slice(0, -1);
      if (nm !== p.name) nm = nm.slice(0, -1) + '…';
      Draw.text(ctx, nm, x + 48, y, { size: sz, align: 'left', color: p.color.light, sw: 4 });
      Draw.text(ctx, String(texts[i]), x + w - 16, y, { size: 22, align: 'right', sw: 4 });
      ctx.restore();
      x += w + gap;
    });
  },

  timer(ctx, sec, x = W - 72, y = 38) {
    const urgent = sec <= 10;
    const pulse = urgent ? 1 + 0.08 * Math.max(0, Math.sin(U.now() * 12)) : 1;
    ctx.save();
    ctx.translate(x, y); ctx.scale(pulse, pulse);
    Draw.rr(ctx, -52, -24, 104, 48, 24);
    ctx.fillStyle = urgent ? '#e83a5c' : 'rgba(20,12,40,0.6)'; ctx.fill();
    Draw.text(ctx, '⏱ ' + U.fmtTime(sec), 0, 1, { size: 24, sw: 4 });
    ctx.restore();
  },

  label(ctx, s, x = 70, y = 38) {
    ctx.font = `800 22px ${FONT}`;
    const w = ctx.measureText(s).width + 32;
    Draw.rr(ctx, x - w / 2, y - 22, w, 44, 22);
    ctx.fillStyle = 'rgba(20,12,40,0.6)'; ctx.fill();
    Draw.text(ctx, s, x, y + 1, { size: 22, sw: 4 });
  },
};

/* ---------------- Độ khó của máy (bot) ----------------
   react   : bao lâu máy mới "nghĩ lại" hướng đi (giây) — càng lớn càng chậm phản xạ
   speed   : hệ số tốc độ chạy của máy
   actCd   : thời gian hồi chiêu THÊM cho máy sau mỗi lần dùng chiêu (húc, lao, đặt bom, sút...)
   actDrop : xác suất máy bỏ lỡ không dùng chiêu
   wander  : số lần đi lạc trung bình mỗi giây
   look    : độ xa máy "nhìn trước" (Vệt Sáng)
   tug     : tốc độ bấm (lần/giây) trong Kéo Co
*/
const BOT_LEVELS = {
  easy:   { name: 'Dễ',         react: 0.38, speed: 0.70, actCd: 1.6, actDrop: 0.55, wander: 0.30, look: 30,  tug: [3.8, 5.2] },
  normal: { name: 'Trung bình', react: 0.20, speed: 0.85, actCd: 0.8, actDrop: 0.30, wander: 0.10, look: 110, tug: [5.2, 6.8] },
  hard:   { name: 'Khó',        react: 0,    speed: 1.00, actCd: 0,   actDrop: 0,    wander: 0,    look: 260, tug: [6.5, 8.6] },
};
const BOT_ORDER = ['easy', 'normal', 'hard'];

/* ---------------- Độ dài ván ----------------
   time  : hệ số nhân thời gian cho game tính giờ (60 giây → 30 / 60 / 90)
   wins  : số hiệp phải thắng cho game theo hiệp (tối đa wins*2-1 hiệp)
   count : hệ số cho game đếm số lượng (số câu hỏi, số vòng đua, số hộp, số điểm kiếm...)
*/
const GAME_LENGTHS = {
  short:  { name: 'Ngắn', icon: '⚡', time: 0.5, wins: 1, count: 0.6 },
  normal: { name: 'Vừa',  icon: '⏱', time: 1,   wins: 2, count: 1 },
  long:   { name: 'Dài',  icon: '🐢', time: 1.5, wins: 3, count: 1.5 },
};
const LEN_ORDER = ['short', 'normal', 'long'];

/* ---------------- Chia đội (game đồng đội) ----------------
   2 người: 1–1 · 3 người: 2–1 · 4 người: 2–2 (P1,P3 bên trái; P2,P4 bên phải)
*/
const TEAMS = {
  names: ['Đội Trái', 'Đội Phải'],
  colors: ['#ff9f43', '#4dd0ff'],
  split: (n) => Array.from({ length: n }, (_, i) => i % 2),
};

/* ---------------- Danh sách game ----------------
   Mỗi file trong js/games/ gọi Party.register({...}) để tự thêm vào menu.
*/
const GAME_CATS = [
  { id: 'all', name: 'Tất cả', icon: '🎮' },
  { id: 'fight', name: 'Đối kháng', icon: '⚔️' },
  { id: 'dodge', name: 'Né tránh', icon: '🏃' },
  { id: 'collect', name: 'Thu thập & Đua', icon: '🏁' },
  { id: 'team', name: 'Đồng đội', icon: '🤝' },
  { id: 'brain', name: 'Trí tuệ & Phản xạ', icon: '🧠' },
  { id: 'board', name: 'Cờ', icon: '♟️' },
];
// Nhóm mặc định của từng game (game mới có thể tự khai báo cat: '...' khi register)
const GAME_CAT_OF = {
  sumo: 'fight', bomb: 'fight', boxing: 'fight', fencing: 'fight', tank: 'fight', crown: 'fight', potato: 'fight', tron: 'fight',
  tiles: 'dodge', laser: 'dodge', flappy: 'dodge', redlight: 'dodge',
  paint: 'collect', chicken: 'collect', race: 'collect', fish: 'collect',
  soccer: 'team', tug: 'team',
  math: 'brain', color: 'brain', glass: 'brain', impostor: 'brain',
};

const Party = {
  games: [],
  /** Game gọi khi người chơi i bị trúng đòn / mất mạng: rung tay cầm của riêng người đó (ALL11). */
  rumble(i, strength = 0.8, ms = 220) { if (this.onRumble) this.onRumble(i, strength, ms); },
  onRumble: null,
  register(def) {
    def.cat = def.cat || GAME_CAT_OF[def.id] || 'fight';
    this.games.push(def);
  },
};
