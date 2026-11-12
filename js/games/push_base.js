'use strict';
/* =========================================================
   PushKit — khung chung cho game "đẩy nhau rơi khỏi sàn" (Đấu Sumo, Lăn Tuyết)
   S1  Húc tích lực: giữ nút Đánh để tích, thả để lao (càng tích càng mạnh nhưng dễ trôi theo đà)
   S2  Thanh %: bị húc càng nhiều càng văng xa, không bị húc một lúc thì tự giảm
   S3  Đứng tấn: GIỮ nút Nhảy — không di chuyển, bị đẩy ít hơn, tốn sức
   S4  Dậm đất: CHẠM nút Nhảy — sóng đẩy người xung quanh (hồi 5 giây)
   S5  Chới với mép sàn: bị đẩy ra mép có ~0,5 giây, bấm Nhảy để bật về
   S6  Chọn võ sĩ: Nhẹ / Cân bằng / Nặng
   S7  Nhiều sàn đấu, S8 sàn vỡ từng mảng, S9 chướng ngại (cột nảy, thanh quét, mạch nham, gió)
   S10 Vật phẩm, S11 Đồng đội, S12 Vua võ đài, S13 Mạng, S14 Ma quấy rối
   Game con kế thừa PushArena và cung cấp cfg + drawBody().
   ========================================================= */
const PushKit = (() => {
  const CX = W / 2, CY = H / 2 + 40;
  const R = 300, RC = 110, RINGS = 3, SECT = 16;   // sàn tròn: lõi + 3 vòng × 16 mảnh
  const HS = 265, GRID = 8;                        // sàn vuông: 8×8 ô
  const TAP = 0.16;                                // nhả nút Nhảy trước mốc này = dậm đất

  const CLASSES = [
    { id: 'light', name: 'Nhẹ', icon: '🪶', desc: 'nhanh, húc yếu, dễ bị đẩy', speed: 1.2, mass: 0.8, power: 0.9, size: 0.88 },
    { id: 'mid', name: 'Cân bằng', icon: '⚖️', desc: 'mọi thứ vừa phải', speed: 1, mass: 1, power: 1, size: 1 },
    { id: 'heavy', name: 'Nặng', icon: '🪨', desc: 'chậm, húc mạnh, khó bị đẩy', speed: 0.85, mass: 1.35, power: 1.12, size: 1.14 },
  ];
  const CHOICES = { label: 'Võ sĩ', def: 1, items: CLASSES };
  const MODES = [
    { id: 'rounds', name: 'Đấu hiệp', desc: 'Người cuối cùng còn trên sàn thắng hiệp. Ai rơi sẽ thành 👻 ma quấy rối (nút Đánh: thổi gió).' },
    { id: 'team', name: 'Đồng đội', desc: 'P1+P3 đấu P2+P4. Đội còn người trên sàn thắng hiệp. Húc đồng đội không tăng %.' },
    { id: 'stocks', name: 'Mạng', desc: 'Mỗi người có vài mạng, rơi thì hồi sinh từ trên trời. Hết mạng thành 👻 ma.' },
    { id: 'koth', name: 'Vua võ đài', desc: 'Đứng MỘT MÌNH trong vòng sáng để ghi điểm. Vòng sáng đổi chỗ liên tục. Rơi thì hồi sinh.' },
    { id: 'train', name: 'Tập luyện', desc: 'Máy đứng yên làm bình nộm. Làm theo từng bước hướng dẫn để học hết các nút.' },
  ];
  // S16: phụ kiện trang trí (chọn ở màn giới thiệu bằng nút Lên), không ảnh hưởng sức mạnh
  const LOOKS = [
    { id: 'none', icon: '—', name: 'Không' }, { id: 'hat', icon: '🎩', name: 'Mũ chóp' }, { id: 'cap', icon: '🧢', name: 'Mũ lưỡi trai' },
    { id: 'crown', icon: '👑', name: 'Vương miện' }, { id: 'bow', icon: '🎀', name: 'Nơ' }, { id: 'shades', icon: '🕶️', name: 'Kính râm' },
    { id: 'flower', icon: '🌸', name: 'Hoa' },
  ];
  // S17: các bước tập luyện
  const TRAIN = [
    { id: 'move', text: 'Dùng phím hướng để đi một vòng' },
    { id: 'dash', text: 'GIỮ nút Đánh cho tới khi vòng vàng đầy rồi THẢ ra để húc' },
    { id: 'stomp', text: 'CHẠM nút Nhảy để dậm đất' },
    { id: 'stance', text: 'GIỮ nút Nhảy để đứng tấn (vòng xanh dưới chân)' },
    { id: 'ko', text: 'Húc một bình nộm 🎯 rơi khỏi sàn' },
    { id: 'item', text: 'Nhặt một vật phẩm trên sàn' },
  ];
  const ITEMS = {
    heavy: { icon: '🍙', name: 'Siêu nặng!' }, chili: { icon: '🌶️', name: 'Tăng tốc!' }, shield: { icon: '🛡️', name: 'Khiên!' },
    freeze: { icon: '🧊', name: 'Đóng băng!' }, fan: { icon: '💨', name: 'Quạt gió!' },
  };
  const ARENAS = {
    sand:     { name: 'Sàn cát', icon: '🏖️', shape: 'circle', fric: 0.03, acc: 1, top: ['#f6dfae', '#ecd096'], side: '#8a5a2b', bg: ['#2f5fae', '#0f1a3c'] },
    ice:      { name: 'Sàn băng trơn', icon: '❄️', shape: 'circle', fric: 0.5, acc: 0.6, top: ['#eef9ff', '#d3ecfb'], side: '#6aa6d6', bg: ['#1d4f86', '#0a1d3a'] },
    lava:     { name: 'Núi lửa', icon: '🌋', shape: 'circle', fric: 0.03, acc: 1, top: ['#857470', '#766561'], side: '#3a2a28', bg: ['#ff8a2a', '#5a1205'], hazard: 'geyser' },
    square:   { name: 'Võ đài vuông', icon: '🟫', shape: 'square', fric: 0.03, acc: 1, top: ['#e7bd82', '#d9ab6c'], side: '#7a4a22', bg: ['#4a2f6e', '#1b1030'] },
    spin:     { name: 'Sàn xoay', icon: '🌀', shape: 'circle', fric: 0.04, acc: 1, top: ['#ddcdff', '#c9b4f7'], side: '#5b3fa0', bg: ['#2b1a55', '#0b0620'], spin: 0.45 },
    snow:     { name: 'Đồi tuyết', icon: '⛄', shape: 'circle', fric: 0.05, acc: 1, top: ['#ffffff', '#eaf2fb'], side: '#7fb0d8', bg: ['#2b6aa8', '#0d2546'] },
    snowice:  { name: 'Hồ băng', icon: '❄️', shape: 'circle', fric: 0.5, acc: 0.6, top: ['#eef9ff', '#d3ecfb'], side: '#6aa6d6', bg: ['#1d4f86', '#0a1d3a'], grow: 0.5 },
    snowsq:   { name: 'Sân tuyết vuông', icon: '🧊', shape: 'square', fric: 0.05, acc: 1, top: ['#ffffff', '#e8f1fb'], side: '#7fb0d8', bg: ['#3a5f9a', '#101c38'] },
    snowspin: { name: 'Đảo tuyết xoay', icon: '🌀', shape: 'circle', fric: 0.05, acc: 1, top: ['#f6f2ff', '#e4dcfa'], side: '#7a6ab8', bg: ['#2b1a55', '#0b0620'], spin: 0.45 },
    blizzard: { name: 'Bão tuyết', icon: '🌨️', shape: 'circle', fric: 0.05, acc: 1, top: ['#f4f8ff', '#dce8f6'], side: '#7fb0d8', bg: ['#4a6a8a', '#152434'], hazard: 'wind' },
    // S18: sàn bập bênh — mọi người dồn về phía nào thì sàn nghiêng, ai cũng trượt về phía đó
    seesaw:   { name: 'Sàn bập bênh', icon: '⚖️', shape: 'circle', fric: 0.03, acc: 1, top: ['#cfe8b0', '#bfdc9c'], side: '#5a7a34', bg: ['#3a6a4a', '#0f2418'], seesaw: true },
    snowsaw:  { name: 'Bập bênh băng tuyết', icon: '⚖️', shape: 'circle', fric: 0.05, acc: 1, top: ['#f0f8ff', '#dbeaf7'], side: '#6a8ab8', bg: ['#2e4f7a', '#0d1d36'], seesaw: true },
  };

  class PushArena {
    constructor(api, cfg) {
      this.api = api; this.P = api.players; this.n = this.P.length; this.cfg = cfg;
      this.mode = api.mode || 'rounds';
      this.team = this.mode === 'team' ? TEAMS.split(this.n) : this.P.map((_, i) => i);
      if (this.mode !== 'team') this.teamOf = null;
      this.cls = this.P.map((_, i) => CLASSES[(api.choices && api.choices[i]) ?? 1] || CLASSES[1]);
      this.finished = false; this.round = 0; this.elapsed = 0;
      this.kos = new Array(this.n).fill(0); this.outCount = 0;
      if (this.mode === 'rounds' || this.mode === 'team') {
        this.need = api.wins; this.maxRounds = api.wins * 2 - 1;
        this.wins = new Array(this.mode === 'team' ? 2 : this.n).fill(0);
      } else if (this.mode === 'stocks') { this.stocksMax = api.count(3); this.total = this.time = api.T(90); }
      else if (this.mode === 'train') {
        this.total = this.time = api.T(120);
        this.steps = this.P.map(() => ({ k: 0, moved: 0, stance: 0, doneT: -1 }));
        this.dummy = this.P.map((p) => !!p.bot && this.P.some((q) => !q.bot));
      } else { this.total = this.time = api.T(60); this.points = new Array(this.n).fill(0); }
      this.looks = api.looks || this.P.map(() => 0);
      this.arenaOrder = U.shuffle(cfg.arenas.slice());
      if (this.mode === 'train') this.arenaOrder = [cfg.arenas[0]];
      // ALL13: hiệp phụ quyết tử — 1 hiệp thắng là xong, sàn chỉ còn vòng lõi giữa
      this.sudden = !!api.sudden && this.mode === 'rounds';
      if (this.sudden) { this.need = 1; this.maxRounds = 5; this.arenaOrder = [cfg.arenas[0]]; }
      this.tilt = { x: 0, y: 0 }; this.hitStop = 0; this.slow = null;
      this.bot = this.P.map(() => ({ hold: 0, charging: false, stanceT: 0, tap: 0, teeterT: -1, atkCd: 0, tgt: -1 }));
      this.rings = [];
      this.startRound();
    }
    teamOf(i) { return this.team[i]; }
    foes(a, b) { return this.team[a] !== this.team[b]; }

    /* ---------------- hiệp / sàn ---------------- */
    startRound() {
      this.round++;
      this.aid = this.arenaOrder[(this.round - 1) % this.arenaOrder.length];
      this.A = ARENAS[this.aid];
      this.rot = 0; this.rt = 0;
      this.buildTiles();
      this.items = []; this.itemT = U.rand(3, 5);
      this.hazard = this.A.hazard || U.pick(['none', 'bumpers', 'arm', 'bumpers', 'arm']);
      if (this.mode === 'koth' && this.hazard === 'arm') this.hazard = 'bumpers';
      this.setupHazard();
      this.crumbleT = this.mode === 'koth' || this.mode === 'train' ? Infinity : this.mode === 'stocks' ? 8 : 9;
      if (this.mode === 'train') this.hazard = 'none';
      this.tilt = { x: 0, y: 0 }; this.slow = null;
      this.roundCap = this.api.T(50) + 15;
      if (this.sudden) {
        for (const t of this.tiles) if (t.k > 0 || (t.layer !== undefined && t.k === undefined && !t.core)) { t.alive = false; t.fallT = 0; }
        this.crumbleT = 5; this.roundCap = 30; this.hazard = 'none'; this.setupHazard();
      }
      this.over = false; this.overT = 0;
      const head = this.mode === 'rounds' || this.mode === 'team' ? `Hiệp ${this.round} · ` : '';
      this.bannerText = this.sudden ? '⚔️ Hiệp phụ quyết tử!' : `${head}${this.A.icon} ${this.A.name}`; this.bannerColor = '#fff'; this.bannerT = 0;
      this.freeze = this.round === 1 ? 0 : 1.3;
      this.gusts = [];
      const keep = this.bodies;
      this.bodies = this.P.map((_, i) => {
        const a = Math.PI + i * TAU / this.n;
        const sr = this.sudden ? 0.68 : 1, b = this.newBody(i, CX + Math.cos(a) * 175 * sr, CY + Math.sin(a) * 160 * sr);
        if (keep) { b.stocks = keep[i].stocks; }
        return b;
      });
      this.zone = this.mode === 'koth' ? { x: CX, y: CY, r: 74, t: 12, next: null } : null;
    }

    newBody(i, x, y) {
      const c = this.cls[i];
      const b = {
        i, x, y, vx: 0, vy: 0, z: 0, vz: 0, face: Math.atan2(CY - y, CX - x), walk: 0, squash: 0, roll: 0,
        r: this.cfg.baseR * c.size, alive: true, ghost: false, fall: -1, respawn: 0, inv: 0,
        dashT: 0, dashCd: 0.3, dashPow: 0, dashCh: 0, charge: 0, charging: false,
        pct: 0, calmT: 0, jumpHeld: 0, stance: false, stamina: 1, stompCd: 0, dizzy: 0,
        teeter: 0, teeterCd: 0, knocked: false, lastHit: -1, lastHitT: 0, flash: 0,
        fx: { heavy: 0, chili: 0, shield: 0, frozen: 0 },
        stocks: this.stocksMax || 0, gA: Math.atan2(y - CY, x - CX), gx: x, gy: y, gCd: 1.5, outTime: 0,
      };
      if (this.cfg.onSpawn) this.cfg.onSpawn(b, c);
      return b;
    }

    buildTiles() {
      this.tiles = [];
      if (this.A.shape === 'circle') {
        for (let k = 0; k < RINGS; k++) for (let s = 0; s < SECT; s++) this.tiles.push({ k, s, layer: RINGS - 1 - k, alive: true, warn: 0, fallT: 0, regen: 0, pop: 0 });
      } else {
        for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
          const layer = Math.min(gx, gy, GRID - 1 - gx, GRID - 1 - gy);
          this.tiles.push({ gx, gy, layer, core: layer >= 3, alive: true, warn: 0, fallT: 0, regen: 0, pop: 0 });
        }
      }
    }
    /** -2 = lõi (luôn còn) · -1 = ngoài sàn · ≥0 = chỉ số mảnh */
    tileAt(x, y) {
      const dx = x - CX, dy = y - CY;
      if (this.A.shape === 'circle') {
        const d = Math.hypot(dx, dy);
        if (d <= RC) return -2;
        if (d > R) return -1;
        const k = Math.min(RINGS - 1, Math.floor((d - RC) / ((R - RC) / RINGS)));
        let a = Math.atan2(dy, dx) - this.rot; a = ((a % TAU) + TAU) % TAU;
        return k * SECT + (Math.floor(a / (TAU / SECT)) % SECT);
      }
      if (Math.abs(dx) > HS || Math.abs(dy) > HS) return -1;
      const cs = HS * 2 / GRID;
      return U.clamp(Math.floor((dy + HS) / cs), 0, GRID - 1) * GRID + U.clamp(Math.floor((dx + HS) / cs), 0, GRID - 1);
    }
    solid(x, y) { const t = this.tileAt(x, y); return t === -2 || (t >= 0 && this.tiles[t].alive); }
    /** khoảng cách tới mép (dò theo hướng từ tâm ra) */
    edgeDist(x, y) {
      const dx = x - CX, dy = y - CY, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      for (let k = 0; k <= 32; k++) if (!this.solid(x + ux * k * 10, y + uy * k * 10)) return k * 10;
      return 330;
    }
    randomSpot(f = 0.7) {
      for (let k = 0; k < 40; k++) {
        const a = U.rand(0, TAU), d = Math.sqrt(Math.random()) * (this.A.shape === 'circle' ? R : HS) * f;
        const x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d;
        if (this.solid(x, y) && this.edgeDist(x, y) > 50) return [x, y];
      }
      return [CX, CY];
    }

    updateCrumble(dt) {
      for (const t of this.tiles) {
        if (t.warn > 0) {
          t.warn -= dt;
          if (t.warn <= 0) { t.alive = false; t.fallT = 0.6; t.regen = this.mode === 'stocks' ? 9 : 0; Sfx.play('crumble', 0.15); FX.shake(2); }
        }
        if (!t.alive) {
          t.fallT = Math.max(0, t.fallT - dt);
          if (t.regen > 0) { t.regen -= dt; if (t.regen <= 0) { t.alive = true; t.pop = 1; } }
        }
        t.pop = Math.max(0, t.pop - dt * 3);
      }
      this.crumbleT -= dt;
      if (this.crumbleT <= 0) {
        this.crumbleT = this.mode === 'stocks' ? 1.7 : 1.3;
        const cand = this.tiles.filter((t) => t.alive && t.warn <= 0 && !t.core);
        if (!cand.length) return;
        const minL = Math.min(...cand.map((t) => t.layer));
        U.pick(cand.filter((t) => t.layer === minL)).warn = 1.2;
      }
    }

    /* ---------------- chướng ngại ---------------- */
    setupHazard() {
      this.bumpers = []; this.arm = null; this.geysers = []; this.wind = null; this.geyserT = 2; this.windT = 3;
      const ext = this.A.shape === 'circle' ? R : HS;
      if (this.hazard === 'bumpers') {
        const a0 = U.rand(0, TAU);
        for (let k = 0; k < 3; k++) {
          const a = a0 + k * TAU / 3;
          this.bumpers.push({ x: CX + Math.cos(a) * ext * 0.56, y: CY + Math.sin(a) * ext * 0.56, r: 24, hit: 0 });
        }
      }
      if (this.hazard === 'arm') this.arm = { a: U.rand(0, TAU), w: (Math.random() < 0.5 ? 1 : -1) * 0.7, len: ext * 0.86 };
    }
    updateHazard(dt) {
      const parts = this.api.parts, F = this.onField();
      for (const bp of this.bumpers) {
        bp.hit -= dt;
        if (this.A.spin) {
          const a = Math.atan2(bp.y - CY, bp.x - CX) + this.A.spin * dt, d = Math.hypot(bp.x - CX, bp.y - CY);
          bp.x = CX + Math.cos(a) * d; bp.y = CY + Math.sin(a) * d;
        }
        if (!this.solid(bp.x, bp.y)) bp.dead = true;
        for (const b of F) {
          const r = this.radOf(b), dx = b.x - bp.x, dy = b.y - bp.y, d = Math.hypot(dx, dy);
          if (d < r + bp.r && d > 0.01) {
            const nx = dx / d, ny = dy / d;
            b.x = bp.x + nx * (r + bp.r); b.y = bp.y + ny * (r + bp.r);
            const vn = b.vx * nx + b.vy * ny, want = Math.max(400, Math.abs(vn) * 1.25);
            b.vx += nx * (want - vn); b.vy += ny * (want - vn);
            this.addPct(b, 3, -1);
            if (bp.hit <= 0) { Sfx.play('hit', 0.08); parts.burst(bp.x + nx * bp.r, bp.y + ny * bp.r, ['#fff', '#ff5a6e'], 8, 200, 0.35, 4, { shape: 's' }); }
            bp.hit = 0.25;
          }
        }
      }
      this.bumpers = this.bumpers.filter((bp) => !bp.dead);
      if (this.arm) {
        const a = this.arm; a.a += a.w * dt;
        const ux = Math.cos(a.a), uy = Math.sin(a.a), dir = Math.sign(a.w), px = -uy * dir, py = ux * dir;
        for (const b of F) {
          if (b.z > 18) continue;
          const r = this.radOf(b), rx = b.x - CX, ry = b.y - CY, along = rx * ux + ry * uy;
          if (along < 0 || along > a.len) continue;
          const perp = (-rx * uy + ry * ux) * dir;   // > 0: phía trước thanh (theo chiều quay)
          if (Math.abs(perp) < r + 9) {
            const side = perp >= 0 ? 1 : -1;
            b.x = CX + ux * along + px * side * (r + 10); b.y = CY + uy * along + py * side * (r + 10);
            if (side > 0) {
              const sp = Math.abs(a.w) * along * 1.5 + 140, vn = b.vx * px + b.vy * py;
              if (vn < sp) { b.vx += px * (sp - vn); b.vy += py * (sp - vn); }
              Sfx.play('hit', 0.2);
            }
          }
        }
      }
      if (this.hazard === 'geyser') {
        this.geyserT -= dt;
        if (this.geyserT <= 0 && !this.over) {
          this.geyserT = U.rand(1.5, 2.5);
          const [x, y] = this.randomSpot(0.85);
          this.geysers.push({ x, y, t: 1.1, r: 62, done: false });
        }
        for (const g of this.geysers) {
          g.t -= dt;
          if (g.t <= 0 && !g.done) {
            g.done = true; Sfx.play('boom', 0.1); FX.shake(5);
            parts.burst(g.x, g.y, ['#ff7a1a', '#ffd23f', '#ff3b1a'], 26, 340, 0.8, 7, { g: 300 });
            for (const b of F) {
              const dx = b.x - g.x, dy = b.y - g.y, d = Math.hypot(dx, dy) || 1;
              if (d < g.r + this.radOf(b) * 0.6) {
                const f = 520 * this.knockMul(b);
                b.vx += dx / d * f; b.vy += dy / d * f; this.addPct(b, 8, -1); b.knocked = true;
              }
            }
          }
        }
        this.geysers = this.geysers.filter((g) => g.t > -0.5);
      }
      if (this.hazard === 'wind') {
        this.windT -= dt;
        if (!this.wind && this.windT <= 0 && !this.over) { this.wind = { a: U.rand(0, TAU), warn: 1.3, t: 3 }; Sfx.play('warn'); }
        if (this.wind) {
          if (this.wind.warn > 0) this.wind.warn -= dt;
          else {
            this.wind.t -= dt;
            for (const b of F) { b.vx += Math.cos(this.wind.a) * 330 * dt / this.massOf(b); b.vy += Math.sin(this.wind.a) * 330 * dt / this.massOf(b); }
            if (Math.random() < 0.6) parts.burst(CX - Math.cos(this.wind.a) * 420 + U.rand(-300, 300) * Math.sin(this.wind.a), CY - Math.sin(this.wind.a) * 420 + U.rand(-300, 300) * Math.cos(this.wind.a), '#ffffff', 1, 10, 1.2, 3);
            for (const p of parts.list) if (p.color === '#ffffff' && !p.type) { p.vx += Math.cos(this.wind.a) * 900 * dt; p.vy += Math.sin(this.wind.a) * 900 * dt; }
            if (this.wind.t <= 0) { this.wind = null; this.windT = U.rand(2.5, 4); }
          }
        }
      }
    }

    /* ---------------- vật phẩm ---------------- */
    updateItems(dt) {
      if (this.over) return;
      this.itemT -= dt;
      if (this.itemT <= 0 && this.items.length < 2) {
        this.itemT = U.rand(5, 8);
        const [x, y] = this.randomSpot(0.6);
        this.items.push({ x, y, type: U.pick(Object.keys(ITEMS)), age: 0 });
      }
      for (const it of this.items) {
        it.age += dt;
        if (this.A.spin) { const a = Math.atan2(it.y - CY, it.x - CX) + this.A.spin * dt, d = Math.hypot(it.x - CX, it.y - CY); it.x = CX + Math.cos(a) * d; it.y = CY + Math.sin(a) * d; }
        if (!this.solid(it.x, it.y)) it.dead = true;
        for (const b of this.onField()) {
          if (!it.dead && b.z < 12 && Math.hypot(b.x - it.x, b.y - it.y) < this.radOf(b) + 18) { it.dead = true; this.applyItem(b, it.type); }
        }
      }
      this.items = this.items.filter((it) => !it.dead);
    }
    applyItem(b, type) {
      const parts = this.api.parts;
      if (this.mode === 'train') this.trainDone(b.i, 'item');
      Sfx.play('pickup');
      parts.text(b.x, b.y - 60, `${ITEMS[type].icon} ${ITEMS[type].name}`, '#ffe14d', 26);
      if (type === 'heavy') b.fx.heavy = 6;
      if (type === 'chili') b.fx.chili = 5;
      if (type === 'shield') b.fx.shield = 10;
      if (type === 'freeze') {
        let best = null, bd = Infinity;
        for (const o of this.onField()) { if (o === b || !this.foes(b.i, o.i)) continue; const d = Math.hypot(o.x - b.x, o.y - b.y); if (d < bd) { bd = d; best = o; } }
        if (best) { best.fx.frozen = 1.6; best.charging = false; best.stance = false; parts.burst(best.x, best.y, ['#bfe6ff', '#fff'], 16, 160, 0.6, 5); }
      }
      if (type === 'fan') {
        this.rings.push({ x: b.x, y: b.y, t: 0, c: '#bfe6ff' });
        for (const o of this.onField()) {
          if (o === b || !this.foes(b.i, o.i)) continue;
          const dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy) || 1;
          if (d < 300) { const f = 560 * (1 - d / 340) * this.knockMul(o); o.vx += dx / d * f; o.vy += dy / d * f; this.addPct(o, 4, b.i); o.knocked = o.teeter > 0; }
        }
      }
    }

    /* ---------------- thân & lực ---------------- */
    onField() { return this.bodies.filter((b) => b.alive && !b.ghost && b.fall < 0 && b.respawn <= 0); }
    massOf(b) { return this.cls[b.i].mass * (b.fx.heavy > 0 ? 2 : 1) * (this.cfg.massMul ? this.cfg.massMul(b) : 1); }
    radOf(b) { return b.r * (b.fx.heavy > 0 ? 1.25 : 1); }
    knockMul(b) { return Math.min(3.2, 1 + b.pct / 100) * (b.stance ? 0.3 : 1) / this.massOf(b); }
    addPct(b, v, by) {
      if (by >= 0 && !this.foes(by, b.i)) return;
      b.pct = Math.min(250, b.pct + v); b.calmT = 0;
      if (by >= 0) { b.lastHit = by; b.lastHitT = 3.5; }
    }

    dash(b) {
      const ch = b.charge, c = this.cls[b.i];
      const pow = 560 * (1 + 1.3 * ch) * c.power * (this.cfg.dashMul ? this.cfg.dashMul(b) : 1);
      b.vx += Math.cos(b.face) * pow; b.vy += Math.sin(b.face) * pow;
      b.dashT = 0.24 + 0.24 * ch; b.dashPow = pow; b.dashCh = ch;
      if (this.mode === 'train' && ch > 0.8) this.trainDone(b.i, 'dash');
      b.dashCd = (b.fx.chili > 0 ? 0.4 : 0.8) + ch * 0.4;
      b.squash = -0.2 - ch * 0.12;
      Sfx.play('dash'); if (ch > 0.5) FX.shake(3);
      this.api.parts.burst(b.x - Math.cos(b.face) * b.r, b.y - Math.sin(b.face) * b.r, this.P[b.i].color.light, 6 + ch * 10, 140, 0.35, 5);
    }
    stomp(b) {
      b.stompCd = this.mode === 'train' ? 1 : 5; b.squash = 0.3;
      if (this.mode === 'train') this.trainDone(b.i, 'stomp');
      Sfx.play('boom', 0.1); FX.shake(5);
      this.rings.push({ x: b.x, y: b.y, t: 0, c: '#ffe9a8' });
      for (const o of this.onField()) {
        if (o === b) continue;
        const dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy) || 1;
        if (d < 150 && o.z < 15) {
          const f = 440 * (1 - d / 170) * this.knockMul(o);
          o.vx += dx / d * f; o.vy += dy / d * f; this.addPct(o, 3, b.i);
          if (o.teeter > 0) o.knocked = true;
        }
      }
    }
    hit(att, vic, nx, ny) {
      const parts = this.api.parts;
      att.dashT = 0;
      if (vic.inv > 0) return;
      const foe = this.foes(att.i, vic.i);
      if (vic.fx.shield > 0 && foe) {
        vic.fx.shield = 0;
        const m = this.massOf(att);
        att.vx = -nx * 380 / m; att.vy = -ny * 380 / m;
        Sfx.play('crown'); parts.text(vic.x, vic.y - 50, '🛡️ Chặn!', '#9fd8ff', 26);
        return;
      }
      const f = att.dashPow * 0.95 * this.knockMul(vic) * (foe ? 1 : 0.5) * (this.cfg.hitMul ? this.cfg.hitMul(att) : 1);
      vic.vx = vic.vx * 0.3 + nx * f; vic.vy = vic.vy * 0.3 + ny * f;
      att.vx *= 0.25; att.vy *= 0.25;
      if (foe) this.addPct(vic, 6 + 12 * att.dashCh, att.i);
      if (vic.teeter > 0) vic.knocked = true;
      vic.flash = 0.15; vic.squash = 0.25; vic.charging = false;
      Party.rumble(vic.i, 0.4 + 0.5 * att.dashCh, 160);
      Sfx.play('hit'); FX.shake(5 + att.dashCh * 8);
      parts.burst((att.x + vic.x) / 2, (att.y + vic.y) / 2, ['#fff', '#ffe680'], 8 + att.dashCh * 14, 260, 0.4, 5, { shape: 's' });
      if (att.dashCh > 0.6) parts.text(vic.x, vic.y - 60, 'RẦM!', '#ffe14d', 34);
      if (att.dashCh >= 0.95) this.hitStop = 0.08;   // S18: cú húc đầy lực khựng hình một nhịp
    }
    collide() {
      const B = this.onField();
      for (let a = 0; a < B.length; a++) {
        for (let c = a + 1; c < B.length; c++) {
          const A = B[a], C = B[c];
          if (A.z > 15 || C.z > 15) continue;
          const dx = C.x - A.x, dy = C.y - A.y, d = Math.hypot(dx, dy), m = this.radOf(A) + this.radOf(C);
          if (d >= m || d < 0.001) continue;
          const nx = dx / d, ny = dy / d, ma = this.massOf(A), mc = this.massOf(C), ov = m - d;
          A.x -= nx * ov * mc / (ma + mc); A.y -= ny * ov * mc / (ma + mc);
          C.x += nx * ov * ma / (ma + mc); C.y += ny * ov * ma / (ma + mc);
          const aD = A.dashT > 0 && A.vx * nx + A.vy * ny > 60, cD = C.dashT > 0 && -(C.vx * nx + C.vy * ny) > 60;
          if (aD && cD) {   // đối đầu: cả hai bật ngược
            A.vx = -nx * 330 / ma; A.vy = -ny * 330 / ma; C.vx = nx * 330 / mc; C.vy = ny * 330 / mc;
            A.dashT = C.dashT = 0;
            this.addPct(A, 4, C.i); this.addPct(C, 4, A.i);
            Sfx.play('crash'); FX.shake(8);
            this.api.parts.text((A.x + C.x) / 2, (A.y + C.y) / 2 - 40, 'Đối đầu!', '#fff', 28);
            continue;
          }
          if (aD) { this.hit(A, C, nx, ny); continue; }
          if (cD) { this.hit(C, A, -nx, -ny); continue; }
          const rv = (C.vx - A.vx) * nx + (C.vy - A.vy) * ny;
          if (rv < 0) {
            const j = -(1 + 0.5) * rv / (1 / (ma * (A.stance ? 4 : 1)) + 1 / (mc * (C.stance ? 4 : 1)));
            const ia = A.stance ? 0.25 : 1, ic = C.stance ? 0.25 : 1;
            A.vx -= j / ma * nx * ia; A.vy -= j / ma * ny * ia; C.vx += j / mc * nx * ic; C.vy += j / mc * ny * ic;
          }
        }
      }
    }

    startFall(b) {
      const parts = this.api.parts;
      b.fall = 0; b.teeter = 0; b.charging = false; b.stance = false;
      Sfx.play('fall'); FX.shake(5); Party.rumble(b.i, 1, 300);
      parts.burst(b.x, b.y, this.P[b.i].color.main, 16, 220, 0.6, 7);
      // S15: cú rơi quyết định hiệp (chỉ còn một phe trên sàn) → quay chậm + phóng to
      if ((this.mode === 'rounds' || this.mode === 'team') && !this.over) {
        const left = new Set(this.bodies.filter((o) => o !== b && o.alive && !o.ghost && o.fall < 0).map((o) => this.team[o.i]));
        if (left.size === 1) this.slow = { t: 1.3, x: b.x, y: b.y };
      }
      if (this.mode === 'stocks' && b.stocks === 1 && this.bodies.filter((o) => !o.ghost).length === 2) this.slow = { t: 1.3, x: b.x, y: b.y };
      if (this.mode === 'train' && b.lastHit >= 0 && this.steps && this.dummy[b.i]) this.trainDone(b.lastHit, 'ko');
      if (b.lastHitT > 0 && b.lastHit >= 0 && b.lastHit !== b.i) {
        this.kos[b.lastHit]++;
        parts.text(b.x, b.y - 50, `${this.P[b.lastHit].name} đẩy rơi ${this.P[b.i].name}!`, this.P[b.lastHit].color.light, 24);
      }
    }
    afterFall(b) {
      if (this.mode === 'koth' || this.mode === 'train') { b.respawn = 1.5; return; }
      if (this.mode === 'stocks') {
        b.stocks--;
        if (b.stocks > 0) { b.respawn = 1.3; return; }
      }
      b.alive = false; b.ghost = true; b.outTime = this.elapsed; b.outOrder = ++this.outCount;
      b.gA = Math.atan2(b.y - CY, b.x - CX); b.gCd = 2;
    }
    doRespawn(b) {
      const [x, y] = this.randomSpot(0.5);
      const nb = this.newBody(b.i, x, y);
      nb.stocks = b.stocks; nb.z = 320; nb.inv = 1.8;
      Object.assign(b, nb);
    }

    /* ---------------- ma quấy rối ---------------- */
    updateGhost(b, q, dt) {
      const Rg = this.A.shape === 'circle' ? R + 58 : HS + 80;
      const tx = -Math.sin(b.gA), ty = Math.cos(b.gA);
      b.gA += (q.mx * tx + q.my * ty) * 1.6 * dt;
      b.gx = CX + Math.cos(b.gA) * Rg; b.gy = CY + Math.sin(b.gA) * Math.min(Rg, H / 2 - 20);
      b.gCd -= dt;
      if (q.actP && b.gCd <= 0 && !this.over) {
        b.gCd = 4;
        const dx = CX - b.gx, dy = CY - b.gy, d = Math.hypot(dx, dy);
        this.gusts.push({ x: b.gx, y: b.gy, vx: dx / d * 440, vy: dy / d * 440, t: 1.7, hit: new Set(), owner: b.i });
        Sfx.play('dash');
      }
    }
    updateGusts(dt) {
      for (const g of this.gusts) {
        g.t -= dt; g.x += g.vx * dt; g.y += g.vy * dt;
        for (const b of this.onField()) {
          if (g.hit.has(b.i) || !this.foes(g.owner, b.i)) continue;
          if (Math.hypot(b.x - g.x, b.y - g.y) < 44 + this.radOf(b)) {
            g.hit.add(b.i);
            const sp = Math.hypot(g.vx, g.vy), f = 360 * this.knockMul(b);
            b.vx += g.vx / sp * f; b.vy += g.vy / sp * f; this.addPct(b, 3, g.owner);
            if (b.teeter > 0) b.knocked = true;
            this.api.parts.burst(b.x, b.y, ['#ffffff', '#cfe8ff'], 10, 160, 0.5, 5);
          }
        }
      }
      this.gusts = this.gusts.filter((g) => g.t > 0);
    }

    /* ---------------- vòng lặp ---------------- */
    update(dt, inp) {
      const parts = this.api.parts;
      if (this.hitStop > 0) { this.hitStop -= dt; return; }
      if (this.slow) { this.slow.t -= dt; this.slow.age = (this.slow.age || 0) + dt; if (this.slow.t <= 0) this.slow = null; else dt *= 0.3; }
      this.bannerT += dt;
      for (const r of this.rings) r.t += dt;
      this.rings = this.rings.filter((r) => r.t < 0.5);
      if (this.freeze > 0) { this.freeze -= dt; return; }
      if (!this.finished) this.elapsed += dt;
      this.rt += dt;
      if (this.A.spin) this.rot += this.A.spin * dt;
      if (!this.over) {
        if (this.total) { this.time -= dt; if (this.time < 0) this.time = 0; }
        this.updateCrumble(dt);
      }
      this.updateHazard(dt);
      this.updateItems(dt);
      this.updateGusts(dt);
      if (this.A.seesaw) {
        // độ nghiêng = trọng tâm (theo khối lượng) của mọi người trên sàn
        let sx = 0, sy = 0, sm = 0;
        for (const b of this.onField()) { const m = this.massOf(b); sx += (b.x - CX) * m; sy += (b.y - CY) * m; sm += m; }
        const tx = sm ? sx / sm / R : 0, ty = sm ? sy / sm / R : 0;
        this.tilt.x += (U.clamp(tx * 1.6, -1, 1) - this.tilt.x) * Math.min(1, dt * 2);
        this.tilt.y += (U.clamp(ty * 1.6, -1, 1) - this.tilt.y) * Math.min(1, dt * 2);
      }
      if (this.mode === 'train') this.updateTrain(dt, inp);

      this.bodies.forEach((b, i) => {
        const q = inp[i];
        b.flash -= dt; b.squash *= Math.pow(0.01, dt);
        if (b.ghost) { this.updateGhost(b, q, dt); return; }
        if (b.respawn > 0) { b.respawn -= dt; if (b.respawn <= 0) this.doRespawn(b); return; }
        if (b.fall >= 0) {
          b.fall += dt; b.x += b.vx * dt * 0.35; b.y += b.vy * dt * 0.35 + 140 * dt;
          if (b.fall > 0.8 && b.alive) { b.fall = 0.8; this.afterFall(b); }
          return;
        }
        this.updateBody(b, q, dt);
      });
      this.collide();
      for (const b of this.onField()) this.edgeCheck(b, inp[b.i], dt);

      // vua võ đài
      if (this.zone && !this.finished) {
        const z = this.zone;
        z.t -= dt;
        if (z.t < 2.5 && !z.next) z.next = this.randomSpot(0.6);
        if (z.t <= 0) { [z.x, z.y] = z.next; z.next = null; z.t = 12; Sfx.play('warn'); }
        const inside = this.onField().filter((b) => b.z < 20 && Math.hypot(b.x - z.x, b.y - z.y) < z.r);
        z.contest = inside.length > 1;
        if (inside.length === 1) { this.points[inside[0].i] += dt; if (Math.random() < dt * 6) parts.burst(inside[0].x, inside[0].y - 30, '#ffe14d', 1, 40, 0.6, 5, { shape: 's' }); }
      }
      this.checkEnd(dt);
    }

    updateBody(b, q, dt) {
      const c = this.cls[b.i], A = this.A;
      b.dashT -= dt; b.dashCd -= dt; b.stompCd -= dt; b.inv -= dt; b.dizzy -= dt; b.teeterCd -= dt; b.lastHitT -= dt;
      for (const k in b.fx) b.fx[k] = Math.max(0, b.fx[k] - dt);
      if (this.A.seesaw && b.z <= 0 && b.teeter <= 0) { b.vx += this.tilt.x * 260 * dt; b.vy += this.tilt.y * 260 * dt; }
      b.calmT += dt; if (b.calmT > 3) b.pct = Math.max(0, b.pct - 6 * dt);
      b.knocked = false;
      // đang rơi từ trên trời xuống (hồi sinh)
      if (b.z > 0 || b.vz) { b.vz -= 1300 * dt; b.z = Math.max(0, b.z + b.vz * dt); if (b.z === 0) { if (b.vz < -500) { FX.shake(4); b.squash = 0.3; } b.vz = 0; } }
      if (b.teeter > 0) {
        b.teeter -= dt;
        if (q.jumpP) {
          // bật về sàn
          const dx = CX - b.x, dy = CY - b.y, d = Math.hypot(dx, dy) || 1;
          b.vx = dx / d * 340; b.vy = dy / d * 340; b.teeter = 0; b.teeterCd = 1.3; b.vz = 260; b.z = 1;
          Sfx.play('jump'); this.api.parts.text(b.x, b.y - 50, 'Thoát hiểm!', '#5dff9b', 24);
        } else if (b.teeter <= 0) {
          const dx = b.x - CX, dy = b.y - CY, d = Math.hypot(dx, dy) || 1;
          b.vx = dx / d * 120; b.vy = dy / d * 120; this.startFall(b);
        }
        return;
      }
      const frozen = b.fx.frozen > 0, can = !frozen && b.dizzy <= 0 && b.z < 20;
      // nút Nhảy: chạm = dậm đất, giữ = đứng tấn
      if (can && q.jump) {
        b.jumpHeld += dt;
        if (b.jumpHeld >= TAP && b.stamina > 0.05 && !b.stance) { b.stance = true; b.charging = false; Sfx.play('place', 0.2); }
      } else {
        if (can && ((b.jumpHeld > 0 && b.jumpHeld < TAP) || q.jumpP) && b.stompCd <= 0) this.stomp(b);
        b.jumpHeld = 0; b.stance = false;
      }
      if (b.stance) {
        b.stamina -= dt / 1.6;
        if (b.stamina <= 0) { b.stamina = 0; b.stance = false; b.dizzy = 0.5; this.api.parts.text(b.x, b.y - 50, 'Hết sức!', '#ffb0b8', 22); }
      } else b.stamina = Math.min(1, b.stamina + dt / 3);
      // nút Đánh: giữ = tích lực, nhả = lao
      if (can && !b.stance && q.act && b.dashCd <= 0) {
        if (!b.charging) { b.charging = true; b.charge = 0; }
        b.charge = Math.min(1, b.charge + dt / 0.9);
      }
      if (b.charging && (!q.act || !can || b.stance)) {
        if (can && !b.stance) this.dash(b);
        b.charging = false; b.charge = 0;
      }
      // di chuyển
      let acc = 1000 * c.speed * A.acc * (b.fx.chili > 0 ? 1.35 : 1) * (this.cfg.accMul ? this.cfg.accMul(b) : 1);
      if (b.charging) acc *= 0.4;
      if (!can || b.stance || b.dashT > 0) acc = 0;
      b.vx += q.mx * acc * dt; b.vy += q.my * acc * dt;
      if (can && (q.mx || q.my) && b.dashT <= 0) { b.face = Math.atan2(q.my, q.mx); b.walk += dt * 14; }
      const fr = b.stance ? 0.0005 : frozen ? Math.max(A.fric, 0.6) : A.fric;
      const damp = Math.pow(fr, dt);
      b.vx *= damp; b.vy *= damp;
      if (A.spin) {   // sàn xoay kéo người theo, hơi văng ra ngoài
        const rx = b.x - CX, ry = b.y - CY, d = Math.hypot(rx, ry) || 1;
        b.x += -ry * A.spin * dt * 0.9 + rx / d * 14 * dt * (d / R);
        b.y += rx * A.spin * dt * 0.9 + ry / d * 14 * dt * (d / R);
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (this.cfg.onMove) this.cfg.onMove(b, dt, this);
    }

    edgeCheck(b) {
      if (b.teeter > 0) { if (b.knocked || !this.solid(b.x, b.y)) { b.teeter = 0; this.startFall(b); } return; }
      if (b.z > 0 || this.solid(b.x, b.y)) return;
      const sp = Math.hypot(b.vx, b.vy);
      if (b.teeterCd <= 0 && sp < 640 && !b.knocked) {
        const dx = CX - b.x, dy = CY - b.y, d = Math.hypot(dx, dy) || 1;
        for (let k = 0; k < 12 && !this.solid(b.x, b.y); k++) { b.x += dx / d * 4; b.y += dy / d * 4; }
        if (this.solid(b.x, b.y)) {
          b.teeter = 0.5; b.vx = b.vy = 0; b.charging = false; b.stance = false;
          Sfx.play('warn', 0.2);
          return;
        }
      }
      this.startFall(b);
    }

    checkEnd() {
      const parts = this.api.parts;
      if (this.mode === 'rounds' || this.mode === 'team') {
        if (!this.over) {
          const alive = this.bodies.filter((b) => b.alive && !b.ghost && b.fall < 0);
          const groups = new Set(alive.map((b) => this.team[b.i]));
          let ended = groups.size <= 1, w = groups.size === 1 ? [...groups][0] : -1;
          if (!ended && this.rt >= this.roundCap) {
            // hết giờ: ít % nhất thắng (đội: còn nhiều người hơn, rồi ít % hơn)
            ended = true;
            const score = (g) => alive.filter((b) => this.team[b.i] === g).reduce((s, b) => s + 1000 - b.pct, 0);
            const arr = [...groups].sort((a, b) => score(b) - score(a));
            w = score(arr[0]) === score(arr[1]) ? -1 : arr[0];
          }
          if (ended) {
            this.over = true; this.overT = 2.4; this.bannerT = 0;
            if (w >= 0) {
              this.wins[w]++;
              const nm = this.mode === 'team' ? TEAMS.names[w] : this.P[w].name;
              this.bannerText = `${nm} thắng hiệp!`;
              this.bannerColor = this.mode === 'team' ? TEAMS.colors[w] : this.P[w].color.light;
            } else { this.bannerText = 'Hòa!'; this.bannerColor = '#fff'; }
            Sfx.play('crown');
          }
        } else {
          this.overT -= 1 / 60;
          if (this.overT <= 0 && !this.finished) {
            if (this.round >= this.maxRounds || Math.max(...this.wins) >= this.need) this.finished = true;
            else this.startRound();
          }
        }
      } else if (this.mode === 'stocks') {
        const left = this.bodies.filter((b) => !b.ghost).length;
        if (!this.finished && (left <= 1 || this.time <= 0)) { this.finished = true; this.over = true; }
      } else if (this.mode === 'train') {
        const humans = this.steps.filter((_, i) => !this.dummy[i] && !this.P[i].bot);
        const allDone = humans.length && humans.every((st) => st.k >= TRAIN.length && st.doneT > 2.5);
        if (!this.finished && (this.time <= 0 || allDone)) { this.finished = true; this.over = true; }
      } else if (!this.finished && this.time <= 0) { this.finished = true; this.over = true; }
      void parts;
    }

    /* ---------------- tập luyện (S17) ---------------- */
    trainDone(i, id) {
      const st = this.steps && this.steps[i];
      if (!st || this.dummy[i] || st.k >= TRAIN.length || TRAIN[st.k].id !== id) return;
      st.k++; st.moved = 0; st.stance = 0;
      Sfx.play('crown');
      const b = this.bodies[i];
      this.api.parts.text(b.x, b.y - 70, st.k >= TRAIN.length ? 'Hoàn thành! 🎉' : 'Giỏi lắm! ✓', '#5dff9b', 28);
      if (st.k >= TRAIN.length) st.doneT = 0;
    }
    updateTrain(dt, inp) {
      this.bodies.forEach((b, i) => {
        const st = this.steps[i];
        if (this.dummy[i] || !st) return;
        if (st.doneT >= 0) st.doneT += dt;
        const step = TRAIN[st.k];
        if (!step) return;
        const q = inp[i];
        if (step.id === 'move') { st.moved += Math.hypot(b.vx, b.vy) * dt; if (st.moved > 450) this.trainDone(i, 'move'); }
        if (step.id === 'stance') { st.stance = b.stance ? st.stance + dt : 0; if (st.stance > 0.6) this.trainDone(i, 'stance'); }
        void q;
      });
      // luôn có vật phẩm để tập nhặt
      if (this.items.length === 0 && this.steps.some((st, i) => !this.dummy[i] && TRAIN[st.k] && TRAIN[st.k].id === 'item')) this.itemT = Math.min(this.itemT, 0.5);
    }

    /* ---------------- kết quả ---------------- */
    results() {
      return this.P.map((_, i) => {
        const b = this.bodies[i], ko = this.kos[i];
        if (this.mode === 'rounds') return { score: this.wins[i] + ko * 0.001, text: `${this.wins[i]} hiệp thắng · đẩy rơi ${ko}` };
        if (this.mode === 'team') { const t = this.team[i]; return { score: this.wins[t] - this.wins[1 - t], text: `${TEAMS.names[t]} · thắng ${this.wins[t]} hiệp · đẩy rơi ${ko}` }; }
        if (this.mode === 'stocks') {
          return b.ghost ? { score: b.outTime + ko * 0.01, text: `Hết mạng · đẩy rơi ${ko}` }
            : { score: 1000 + b.stocks * 50 + ko - b.pct * 0.001, text: `Còn ${b.stocks} mạng · đẩy rơi ${ko}` };
        }
        if (this.mode === 'train') {
          if (this.dummy[i]) return { score: -1, text: '🎯 Bình nộm' };
          return { score: this.steps[i].k, text: `Xong ${this.steps[i].k}/${TRAIN.length} bước tập` };
        }
        return { score: Math.round(this.points[i] * 10) / 10, text: `${Math.floor(this.points[i])} điểm · đẩy rơi ${ko}` };
      });
    }

    /* ---------------- vẽ ---------------- */
    sector(ctx, r0, r1, a0, a1) { ctx.beginPath(); ctx.arc(CX, CY, r1, a0, a1); ctx.arc(CX, CY, r0, a1, a0, true); ctx.closePath(); }
    tilePath(ctx, t) {
      if (this.A.shape === 'circle') {
        const w = (R - RC) / RINGS, a0 = this.rot + t.s * TAU / SECT, a1 = a0 + TAU / SECT;
        this.sector(ctx, RC + t.k * w, RC + (t.k + 1) * w, a0, a1);
      } else {
        const cs = HS * 2 / GRID;
        ctx.beginPath(); ctx.rect(CX - HS + t.gx * cs, CY - HS + t.gy * cs, cs, cs);
      }
    }
    drawArena(ctx) {
      const A = this.A, t = U.now();
      const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 820);
      g.addColorStop(0, A.bg[0]); g.addColorStop(1, A.bg[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (this.aid === 'lava') {
        for (let k = 0; k < 14; k++) {
          const x = (k * 211 + t * 20) % W, y = (k * 97) % H, r = 6 + (k % 4) * 4 + Math.sin(t * 3 + k) * 3;
          ctx.fillStyle = 'rgba(255,220,120,0.35)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        }
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 3;
        for (let k = 0; k < 6; k++) { const rr = R + 40 + ((t * 30 + k * 70) % 420); ctx.beginPath(); ctx.arc(CX, CY, rr, 0, TAU); ctx.stroke(); }
      }
      // đáy sàn (3D) rồi mặt sàn
      for (const pass of [0, 1]) {
        ctx.save();
        if (pass === 0) ctx.translate(0, 16);
        if (A.shape === 'circle') {
          ctx.fillStyle = pass ? A.top[0] : A.side;
          ctx.beginPath(); ctx.arc(CX, CY, RC, 0, TAU); ctx.fill();
        }
        this.tiles.forEach((tl, k) => {
          if (!tl.alive && tl.fallT <= 0) return;
          ctx.save();
          if (!tl.alive) { const f = 1 - tl.fallT / 0.6; ctx.globalAlpha = 1 - f; ctx.translate(0, f * f * 160); }
          this.tilePath(ctx, tl);
          let col = pass ? A.top[(k + (tl.k || 0) + (tl.gy || 0)) % 2] : A.side;
          ctx.fillStyle = col; ctx.fill();
          if (pass) {
            if (tl.warn > 0 && Math.sin(t * 24) > -0.2) { ctx.fillStyle = 'rgba(255,60,80,0.55)'; ctx.fill(); }
            if (tl.pop > 0) { ctx.fillStyle = `rgba(255,255,255,${tl.pop * 0.5})`; ctx.fill(); }
            ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5; ctx.stroke();
          }
          ctx.restore();
        });
        ctx.restore();
      }
      if (A.shape === 'circle' && this.aid !== 'lava') {
        ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(CX, CY, RC, 0, TAU); ctx.stroke();
      }
      if (this.aid === 'sand' || this.aid === 'square') {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(CX - 60, CY - 4, 22, 8); ctx.fillRect(CX + 38, CY - 4, 22, 8);
      }
      if (A.seesaw) {
        // bập bênh: phía đang chúi xuống tối lại + mũi tên
        const tl = Math.hypot(this.tilt.x, this.tilt.y);
        if (tl > 0.05) {
          const a = Math.atan2(this.tilt.y, this.tilt.x);
          const g2 = ctx.createLinearGradient(CX - Math.cos(a) * R, CY - Math.sin(a) * R, CX + Math.cos(a) * R, CY + Math.sin(a) * R);
          g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(1, `rgba(0,0,0,${Math.min(0.35, tl * 0.45)})`);
          ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(CX, CY, R, 0, TAU); ctx.fill();
          ctx.save(); ctx.translate(CX, CY); ctx.rotate(a); ctx.globalAlpha = Math.min(0.8, tl);
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(60, 0); ctx.lineTo(20, -18); ctx.lineTo(20, -7); ctx.lineTo(-30, -7); ctx.lineTo(-30, 7); ctx.lineTo(20, 7); ctx.lineTo(20, 18); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = '#5a7a34'; ctx.beginPath(); ctx.arc(CX, CY, 14, 0, TAU); ctx.fill();
      }
      // vòng vua võ đài
      if (this.zone) {
        const z = this.zone;
        ctx.fillStyle = z.contest ? 'rgba(255,90,110,0.25)' : 'rgba(255,225,77,0.25)';
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = z.contest ? '#ff5a6e' : '#ffe14d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke();
        Draw.text(ctx, z.contest ? 'Tranh chấp!' : '👑', z.x, z.y, { size: z.contest ? 20 : 30, stroke: z.contest ? undefined : null });
        if (z.next) { ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,225,77,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(z.next[0], z.next[1], z.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      }
      // chướng ngại
      for (const gz of this.geysers) {
        if (!gz.done) {
          ctx.fillStyle = `rgba(255,90,30,${0.25 + 0.25 * Math.sin(t * 20)})`;
          ctx.beginPath(); ctx.arc(gz.x, gz.y, gz.r, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(gz.x, gz.y, gz.r * (gz.t / 1.1), 0, TAU); ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(255,170,40,${Math.max(0, 0.6 + gz.t)})`;
          ctx.beginPath(); ctx.ellipse(gz.x, gz.y - 40, 26, 60, 0, 0, TAU); ctx.fill();
        }
      }
      for (const bp of this.bumpers) {
        const s = bp.hit > 0 ? 1.15 : 1;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(bp.x, bp.y + 16, bp.r, bp.r * 0.4, 0, 0, TAU); ctx.fill();
        for (const [rr, c] of [[1, '#e8384f'], [0.68, '#fff'], [0.36, '#e8384f']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(bp.x, bp.y, bp.r * rr * s, 0, TAU); ctx.fill(); }
      }
      if (this.arm) {
        const a = this.arm;
        ctx.save(); ctx.translate(CX, CY); ctx.rotate(a.a);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; Draw.rr(ctx, 0, -4, a.len, 20, 9); ctx.fill();
        ctx.fillStyle = '#8a5a2b'; Draw.rr(ctx, 0, -10, a.len, 20, 9); ctx.fill();
        ctx.fillStyle = '#c98b4a'; Draw.rr(ctx, 4, -8, a.len - 8, 8, 4); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#5b5e78'; ctx.beginPath(); ctx.arc(CX, CY, 20, 0, TAU); ctx.fill();
        ctx.fillStyle = '#9aa1bb'; ctx.beginPath(); ctx.arc(CX, CY, 10, 0, TAU); ctx.fill();
      }
      if (this.wind) {
        const w = this.wind, alpha = w.warn > 0 ? 0.4 + 0.4 * Math.sin(t * 20) : 0.85;
        ctx.save(); ctx.translate(W / 2, 110); ctx.rotate(w.a); ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(-10, -20); ctx.lineTo(-10, -8); ctx.lineTo(-40, -8); ctx.lineTo(-40, 8); ctx.lineTo(-10, 8); ctx.lineTo(-10, 20); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // vật phẩm
      for (const it of this.items) {
        const s = Math.min(1, it.age * 3), y = it.y - 8 + Math.sin(t * 5 + it.x) * 4;
        ctx.save(); ctx.translate(it.x, y); ctx.scale(s, s);
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(0, 24, 16, 5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.stroke();
        Draw.text(ctx, ITEMS[it.type].icon, 0, 2, { size: 22, stroke: null });
        ctx.restore();
      }
    }

    drawOverlay(ctx, b) {
      const t = U.now(), r = this.radOf(b), x = b.x, y = b.y - b.z;
      if (this.mode === 'train' && this.dummy[b.i]) { Draw.text(ctx, '🎯', x, y - r - 40, { size: 22, stroke: null }); }
      if (b.charging) {
        ctx.strokeStyle = b.charge >= 1 ? '#ff5a3a' : '#ffe14d'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(x, y, r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * b.charge); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(b.face) * (r + 4), y + Math.sin(b.face) * (r + 4));
        ctx.lineTo(x + Math.cos(b.face) * (r + 30 + b.charge * 40), y + Math.sin(b.face) * (r + 30 + b.charge * 40)); ctx.stroke();
      }
      if (b.stance) {
        ctx.strokeStyle = 'rgba(160,220,255,0.9)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(x, b.y + r * 0.8, r * 1.3, r * 0.45, 0, 0, TAU); ctx.stroke();
      }
      if (b.stamina < 0.99) {
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x - r - 12, y, 9, 0, TAU); ctx.stroke();
        ctx.strokeStyle = b.stamina > 0.3 ? '#5dff9b' : '#ff5a6e'; ctx.beginPath(); ctx.arc(x - r - 12, y, 9, -Math.PI / 2, -Math.PI / 2 + TAU * b.stamina); ctx.stroke();
      }
      if (b.fx.shield > 0) { ctx.strokeStyle = `rgba(150,220,255,${0.6 + 0.3 * Math.sin(t * 6)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 14, 0, TAU); ctx.stroke(); }
      if (b.fx.frozen > 0) { ctx.fillStyle = 'rgba(180,230,255,0.55)'; Draw.rr(ctx, x - r - 6, y - r - 6, r * 2 + 12, r * 2 + 12, 10); ctx.fill(); }
      if (b.fx.chili > 0 && Math.random() < 0.4) this.api.parts.burst(x, b.y + r * 0.6, ['#ff5a2e', '#ffb12e'], 1, 40, 0.3, 4);
      if (b.teeter > 0) {
        Draw.text(ctx, '!', x, y - r - 30, { size: 36, color: '#ff5a5a' });
        Draw.text(ctx, 'NHẢY!', x, y + r + 22, { size: 18, color: '#ffe14d', sw: 4 });
      }
      // phần trăm
      const p = Math.round(b.pct);
      const col = p < 50 ? '#ffffff' : p < 100 ? '#ffe14d' : p < 160 ? '#ff9a3c' : '#ff4a5a';
      Draw.text(ctx, `${p}%`, x, y - r - 14 - (b.teeter > 0 ? 24 : 0), { size: 18 + Math.min(10, p / 20), color: col, sw: 4 });
      const icons = (b.fx.heavy > 0 ? '🍙' : '') + (b.fx.chili > 0 ? '🌶️' : '');
      if (icons) Draw.text(ctx, icons, x + r + 10, y - r, { size: 18, stroke: null });
    }

    drawGhost(ctx, b) {
      const t = U.now(), c = this.P[b.i].color;
      ctx.save(); ctx.globalAlpha = 0.55;
      ctx.translate(b.gx, b.gy + Math.sin(t * 3 + b.i) * 6);
      ctx.fillStyle = c.light;
      ctx.beginPath(); ctx.arc(0, -4, 20, Math.PI, 0);
      ctx.lineTo(20, 16);
      for (let k = 0; k < 4; k++) ctx.quadraticCurveTo(15 - k * 10, 24 + (k % 2) * -8, 10 - k * 10, 16);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1d1230';
      ctx.beginPath(); ctx.arc(-7, -6, 3.5, 0, TAU); ctx.arc(7, -6, 3.5, 0, TAU); ctx.fill();
      ctx.restore();
      if (b.gCd <= 0) Draw.text(ctx, '💨', b.gx, b.gy - 34, { size: 18, stroke: null });
    }

    draw(ctx) {
      // S15: camera quay chậm phóng to vào cú rơi quyết định
      ctx.save();
      if (this.slow) {
        const k = Math.min(1, (this.slow.age || 0) * 4) * Math.min(1, this.slow.t * 3), z = 1 + 0.55 * k;
        ctx.translate(W / 2, H / 2); ctx.scale(z, z);
        ctx.translate(-U.lerp(W / 2, this.slow.x, k), -U.lerp(H / 2, this.slow.y, k));
      }
      this.drawArena(ctx);
      // người đang rơi (vẽ dưới)
      for (const b of this.bodies) {
        if (b.fall < 0 || b.ghost) continue;
        const s = Math.max(0, 1 - b.fall / 0.8);
        if (s > 0) this.drawBody(ctx, b, { scale: s, alpha: s, stun: true });
      }
      const live = this.bodies.filter((b) => !b.ghost && b.fall < 0 && b.respawn <= 0).sort((a, c) => a.y - c.y);
      for (const b of live) {
        const blink = b.inv > 0 && Math.sin(U.now() * 30) > 0;
        let wob = 0;
        if (b.teeter > 0) wob = Math.sin(U.now() * 30) * 5;
        this.drawBody(ctx, b, { alpha: blink ? 0.45 : 1, stun: b.dizzy > 0 || b.fx.frozen > 0, wob });
        this.drawOverlay(ctx, b);
      }
      for (const r of this.rings) {
        ctx.strokeStyle = r.c; ctx.globalAlpha = 1 - r.t / 0.5; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(r.x, r.y, 30 + r.t * 260, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      }
      for (const g of this.gusts) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.arc(g.x, g.y, 40, 0, TAU); ctx.fill();
        Draw.text(ctx, '💨', g.x, g.y, { size: 34, stroke: null });
      }
      for (const b of this.bodies) if (b.ghost) this.drawGhost(ctx, b);
      ctx.restore();
      if (this.slow) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 0, W, 34); ctx.fillRect(0, H - 34, W, 34); }
      this.drawHud(ctx);
      if (this.mode === 'train') this.drawTrain(ctx);
    }
    drawTrain(ctx) {
      const humans = this.P.map((_, i) => i).filter((i) => !this.dummy[i] && !this.P[i].bot);
      humans.forEach((i, k) => {
        const st = this.steps[i], step = TRAIN[st.k], y = H - 64 - k * 40, c = this.P[i].color;
        Draw.rr(ctx, W / 2 - 420, y - 18, 840, 36, 14); ctx.fillStyle = 'rgba(15,10,35,0.75)'; ctx.fill();
        ctx.strokeStyle = c.main; ctx.lineWidth = 3; ctx.stroke();
        Draw.text(ctx, `${this.P[i].name} · Bước ${Math.min(st.k + 1, TRAIN.length)}/${TRAIN.length}: ${step ? step.text : 'Hoàn thành tất cả! 🎉'}`, W / 2, y + 1, { size: 18, color: step ? '#fff' : '#5dff9b', sw: 3 });
      });
    }
    /** S16: vẽ phụ kiện trên đầu (game con gọi trong drawBody) */
    drawLook(ctx, b, x, topY, s = 1) {
      const lk = LOOKS[this.looks[b.i] || 0];
      if (!lk || lk.id === 'none' || s < 0.3) return;
      const yy = lk.id === 'shades' ? topY + this.radOf(b) * 0.55 : topY - 6;
      Draw.text(ctx, lk.icon, x, yy, { size: Math.round(26 * s * (this.radOf(b) / 30) ** 0.5), stroke: null });
    }

    drawHud(ctx) {
      const M = MODES.find((m) => m.id === this.mode);
      let texts, dim = this.bodies.map((b) => b.ghost);
      if (this.mode === 'rounds') texts = this.wins.map((w) => '★'.repeat(w) + '☆'.repeat(Math.max(0, this.need - w)));
      else if (this.mode === 'team') texts = this.P.map((_, i) => { const t = this.team[i]; return `${t ? 'Phải' : 'Trái'} ${this.wins[t]}★`; });
      else if (this.mode === 'stocks') texts = this.bodies.map((b) => (b.ghost ? '👻' : '❤'.repeat(Math.max(0, b.stocks))));
      else if (this.mode === 'train') { texts = this.P.map((_, i) => (this.dummy[i] ? '🎯' : `${this.steps[i].k}/${TRAIN.length}`)); dim = null; }
      else { texts = this.points.map((p) => `👑 ${Math.floor(p)}`); dim = null; }
      Draw.chips(ctx, this.P, texts, { dim, w: 180 });
      const lbl = this.sudden ? `⚔️ Hiệp phụ · lần ${this.round}` : this.mode === 'rounds' || this.mode === 'team' ? `${M.name} · Hiệp ${this.round}/${this.maxRounds}` : M.name;
      Draw.label(ctx, lbl, 120, 38);
      if (this.total) Draw.timer(ctx, this.time, W - 72, 38);
      else if (!this.over && this.roundCap - this.rt < 10) Draw.timer(ctx, this.roundCap - this.rt, W - 72, 38);
      Draw.text(ctx, `${this.A.icon} ${this.A.name}`, 20, H - 22, { size: 18, align: 'left', sw: 4 });
      if (this.bannerT < 1.6 || this.over) Draw.banner(ctx, this.bannerText, this.bannerT, { color: this.bannerColor, size: 56, y: 120 });
      if (this.elapsed < 4 && this.round === 1 && this.mode !== 'train') Draw.text(ctx, 'Giữ Đánh: tích lực · Chạm Nhảy: dậm đất · Giữ Nhảy: đứng tấn', W / 2, H - 22, { size: 18, color: '#ffe14d', sw: 4 });
    }

    /* ---------------- máy (bot) ---------------- */
    /** vị trí nhân vật trên màn hình (cho biểu cảm, rung tay cầm...) — null nếu đang không hiện */
    posOf(i) {
      const b = this.bodies[i];
      if (b.ghost) return { x: b.gx, y: b.gy };
      if (b.fall >= 0 || b.respawn > 0) return null;
      return { x: b.x, y: b.y - b.z };
    }

    botInput(i) {
      const b = this.bodies[i], st = this.bot[i], lv = this.api.botOf(i);
      const o = { mx: 0, my: 0, act: false, jump: false, actP: false, jumpP: false };
      if (this.freeze > 0) return o;
      if (this.mode === 'train' && this.dummy[i]) return o;
      if (b.ghost) return this.ghostBot(b, st, lv);
      if (b.fall >= 0 || b.respawn > 0 || b.z > 20) return o;
      st.atkCd -= 1 / 60;
      if (b.teeter > 0) {
        if (st.teeterT < 0) st.teeterT = U.rand(0.05, 0.25) + lv.react * 0.5;
        st.teeterT -= 1 / 60;
        if (st.teeterT <= 0) o.jumpP = true;
        return o;
      }
      st.teeterT = -1;
      const foesOn = this.onField().filter((f) => f !== b && this.foes(i, f.i));
      // đang tích lực: giữ nút, quay về phía mục tiêu
      if (st.charging) {
        const tg = this.bodies[st.tgt];
        st.hold -= 1 / 60;
        if (tg && tg.fall < 0) { const a = Math.atan2(tg.y - b.y, tg.x - b.x); o.mx = Math.cos(a) * 0.3; o.my = Math.sin(a) * 0.3; }
        if (st.hold > 0 && b.charging !== false) { o.act = true; return o; }
        st.charging = false;
        return o;
      }
      if (st.stanceT > 0) { st.stanceT -= 1 / 60; o.jump = true; return o; }
      if (st.tap > 0) { st.tap--; o.jump = true; return o; }
      // đỡ đòn: đối thủ đang lao tới
      for (const f of foesOn) {
        const d = Math.hypot(f.x - b.x, f.y - b.y);
        if ((f.dashT > 0 || f.charging) && d < 160 && Math.abs(U.angDiff(f.face, Math.atan2(b.y - f.y, b.x - f.x))) < 0.5
          && b.stamina > 0.4 && st.atkCd <= 0 && Math.random() < 0.06 * (1 - lv.actDrop)) {
          st.stanceT = 0.45; st.atkCd = 0.6; o.jump = true; return o;
        }
      }
      // dậm đất khi bị vây hoặc đối thủ đứng sát mép
      const near = foesOn.filter((f) => Math.hypot(f.x - b.x, f.y - b.y) < 120);
      if (b.stompCd <= 0 && near.length && (near.length >= 2 || this.edgeDist(near[0].x, near[0].y) < 80) && Math.random() < 0.04 * (1 - lv.actDrop)) {
        st.tap = 2; o.jump = true; return o;
      }
      // chọn điểm đến
      let tx = CX, ty = CY, foe = null;
      if (this.zone) {
        const z = this.zone;
        const inZone = foesOn.filter((f) => Math.hypot(f.x - z.x, f.y - z.y) < z.r + 20);
        if (inZone.length) foe = inZone[0]; else { tx = z.x; ty = z.y; }
      } else {
        let bd = Infinity;
        for (const f of foesOn) { const d = Math.hypot(f.x - b.x, f.y - b.y) - f.pct * 0.6; if (d < bd) { bd = d; foe = f; } }
      }
      if (foe) {
        // đứng phía trong để húc đối thủ ra ngoài
        const ox = foe.x - CX, oy = foe.y - CY, ol = Math.hypot(ox, oy) || 1;
        tx = foe.x - ox / ol * (this.radOf(foe) + this.radOf(b)) * 0.7; ty = foe.y - oy / ol * (this.radOf(foe) + this.radOf(b)) * 0.7;
      }
      const it = this.items.find((x) => Math.hypot(x.x - b.x, x.y - b.y) < 200);
      if (it && (!foe || Math.hypot(foe.x - b.x, foe.y - b.y) > 120)) { tx = it.x; ty = it.y; }
      let mx = tx - b.x, my = ty - b.y; const l = Math.hypot(mx, my) || 1; mx /= l; my /= l;
      // né mạch nham sắp phun
      for (const g of this.geysers) if (!g.done && Math.hypot(g.x - b.x, g.y - b.y) < g.r + 40) { const dx = b.x - g.x, dy = b.y - g.y, d = Math.hypot(dx, dy) || 1; mx += dx / d * 2; my += dy / d * 2; }
      // giữ an toàn ở mép
      const ed = this.edgeDist(b.x, b.y), ahead = this.solid(b.x + mx * 60 + b.vx * 0.25, b.y + my * 60 + b.vy * 0.25);
      if (ed < 70 || !ahead) {
        const dc = Math.hypot(CX - b.x, CY - b.y) || 1, w = !ahead ? 2.5 : (70 - ed) / 40;
        mx += (CX - b.x) / dc * w; my += (CY - b.y) / dc * w;
      }
      const l2 = Math.hypot(mx, my) || 1;
      o.mx = mx / l2; o.my = my / l2;
      // tấn công
      if (foe && b.dashCd <= 0 && st.atkCd <= 0) {
        const d = Math.hypot(foe.x - b.x, foe.y - b.y), a = Math.atan2(foe.y - b.y, foe.x - b.x);
        if (d < this.radOf(b) + this.radOf(foe) + 90 && Math.abs(U.angDiff(b.face, a)) < 0.45) {
          if (Math.random() < lv.actDrop * 0.6) st.atkCd = 0.3 + lv.actCd;
          else {
            const foeEdge = this.edgeDist(foe.x, foe.y) < 100;
            st.charging = true; st.tgt = foe.i; st.hold = foeEdge || d > 110 ? U.rand(0.25, 0.75) : U.rand(0.02, 0.2);
            st.atkCd = 0.3 + lv.actCd * 0.5;
            o.act = true;
          }
        }
      }
      return o;
    }
    ghostBot(b, st, lv) {
      const o = { mx: 0, my: 0, actP: false };
      let best = null, bs = -Infinity;
      for (const f of this.onField()) {
        if (!this.foes(b.i, f.i)) continue;
        const sc = f.pct - this.edgeDist(f.x, f.y) * 0.5 + (this.mode === 'rounds' ? this.wins[f.i] * 30 : 0);
        if (sc > bs) { bs = sc; best = f; }
      }
      if (!best) return o;
      const want = Math.atan2(best.y - CY, best.x - CX) + Math.PI;   // đứng phía đối diện, thổi gió qua tâm
      const diff = U.angDiff(b.gA, want), tx = -Math.sin(b.gA), ty = Math.cos(b.gA);
      if (Math.abs(diff) > 0.05) { o.mx = tx * Math.sign(diff); o.my = ty * Math.sign(diff); }
      if (Math.abs(diff) < 0.2 && b.gCd <= 0 && Math.random() < 0.08) o.actP = true;
      void st; void lv;
      return o;
    }
  }

  return { PushArena, CLASSES, CHOICES, MODES, ARENAS, LOOKS, CX, CY };
})();
