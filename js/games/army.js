'use strict';
/* Đội Quân — chạm vào người xám để họ theo mình. Chạm vào quân đi sau người khác để cướp quân.
   Hết giờ, đội đông quân nhất thắng. */
(() => {
  const AX = 40, AY = 84, AW = W - 80, AH = H - 84 - 20;
  const GAME_TIME = 60, FREE_TARGET = 34, SPACING = 24;
  const GRAY = { main: '#b9b3cc', dark: '#7c7695', light: '#f1eff7' };
  const BLOCKS = [
    { x: 250, y: 200, w: 150, h: 90 }, { x: W - 400, y: 200, w: 150, h: 90 },
    { x: 250, y: H - 210, w: 150, h: 90 }, { x: W - 400, y: H - 210, w: 150, h: 90 },
    { x: W / 2 - 60, y: AY + AH / 2 - 45, w: 120, h: 90 },
  ];
  const SPAWN = [[AX + 80, AY + 80], [AX + AW - 80, AY + AH - 80], [AX + AW - 80, AY + 80], [AX + 80, AY + AH - 80]];

  class Army {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.finished = false;
      this.ps = this.P.map((p, i) => ({ x: SPAWN[i][0], y: SPAWN[i][1], vx: 0, vy: 0, r: 24, face: 0, walk: 0,
        dashT: 0, dashCd: 0, squash: 0, skip: false, trail: [], troops: [], stealCd: 0 }));
      this.free = [];
      for (let k = 0; k < FREE_TARGET; k++) this.spawnFree();
      this.bot = this.P.map(() => ({}));
    }

    freeSpot() {
      for (let k = 0; k < 30; k++) {
        const x = U.rand(AX + 30, AX + AW - 30), y = U.rand(AY + 30, AY + AH - 30);
        if (!BLOCKS.some((b) => x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20)) return [x, y];
      }
      return [W / 2, AY + 40];
    }
    spawnFree() {
      const [x, y] = this.freeSpot();
      this.free.push({ x, y, dir: U.rand(0, TAU), t: U.rand(0, 2), walk: 0, pop: 1 });
    }

    // vị trí quân thứ k trong hàng theo sau người chơi p
    slot(p, k) {
      const tr = p.trail, want = (k + 1) * SPACING;
      let acc = 0, prev = [p.x, p.y];
      for (let j = tr.length - 1; j >= 0; j--) {
        const pt = tr[j], d = Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
        if (acc + d >= want) { const f = (want - acc) / (d || 1); return [U.lerp(prev[0], pt[0], f), U.lerp(prev[1], pt[1], f)]; }
        acc += d; prev = pt;
      }
      return prev;
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) { this.time -= dt; if (this.time <= 0) { this.time = 0; this.finished = true; } }
      this.ps.forEach((p, i) => {
        const q = inp[i];
        p.dashT -= dt; p.dashCd -= dt; p.stealCd -= dt;
        p.squash *= Math.pow(0.01, dt);
        if (q.mx || q.my) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        if (q.actP && p.dashCd <= 0 && !this.finished) {
          p.dashT = 0.25; p.dashCd = 1.3; p.squash = -0.2; Sfx.play('dash');
          p.vx = Math.cos(p.face) * 620; p.vy = Math.sin(p.face) * 620;
        }
        if (p.dashT <= 0) {
          const sp = Math.max(200, 270 - p.troops.length * 2), k = Math.min(1, dt * 10);
          p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        for (const b of BLOCKS) Phys.circleRect(p, b);
        p.x = U.clamp(p.x, AX + p.r, AX + AW - p.r); p.y = U.clamp(p.y, AY + p.r, AY + AH - p.r);
        const last = p.trail[p.trail.length - 1];
        if (!last || Math.hypot(last[0] - p.x, last[1] - p.y) > 6) {
          p.trail.push([p.x, p.y]);
          const maxLen = (p.troops.length + 3) * SPACING / 6 + 20;
          if (p.trail.length > maxLen) p.trail.splice(0, p.trail.length - maxLen);
        }
        // quân đi theo
        p.troops.forEach((t, k) => {
          const [sx, sy] = this.slot(p, k);
          t.x += (sx - t.x) * Math.min(1, dt * 10); t.y += (sy - t.y) * Math.min(1, dt * 10);
          t.walk += dt * 12; t.pop = Math.max(0, t.pop - dt * 3);
        });
      });
      Phys.separate(this.ps, 0.6);
      if (this.finished) return;

      // chiêu mộ người xám
      this.ps.forEach((p, i) => {
        for (let k = this.free.length - 1; k >= 0; k--) {
          const f = this.free[k];
          if (Math.hypot(f.x - p.x, f.y - p.y) < p.r + 18) {
            this.free.splice(k, 1);
            p.troops.push({ x: f.x, y: f.y, walk: 0, pop: 1 });
            Sfx.play('pickup', 0.05);
          }
        }
      });
      // cướp quân của người khác (chạm vào quân của họ)
      this.ps.forEach((p, i) => {
        if (p.stealCd > 0) return;
        for (let j = 0; j < this.n; j++) {
          if (j === i) continue;
          const o = this.ps[j];
          const k = o.troops.findIndex((t) => Math.hypot(t.x - p.x, t.y - p.y) < p.r + 16);
          if (k < 0) continue;
          // lao vào thì cướp cả đoạn phía sau, đi bộ thì cướp 1 người
          const take = p.dashT > 0 ? o.troops.length - k : 1;
          const got = o.troops.splice(k, take);
          got.forEach((t) => { t.pop = 1; p.troops.push(t); });
          p.stealCd = 0.9;
          Sfx.play('hit'); FX.shake(got.length > 2 ? 6 : 3);
          parts.text(p.x, p.y - 40, `Cướp ${got.length}!`, this.P[i].color.light, 26);
          break;
        }
      });
      // người xám đi lang thang
      for (const f of this.free) {
        f.t -= dt; f.walk += dt * 8; f.pop = Math.max(0, f.pop - dt * 3);
        if (f.t <= 0) { f.dir = U.rand(0, TAU); f.t = U.rand(1, 3); }
        const nx = f.x + Math.cos(f.dir) * 40 * dt, ny = f.y + Math.sin(f.dir) * 40 * dt;
        if (nx < AX + 20 || nx > AX + AW - 20 || ny < AY + 20 || ny > AY + AH - 20
          || BLOCKS.some((b) => nx > b.x - 14 && nx < b.x + b.w + 14 && ny > b.y - 14 && ny < b.y + b.h + 14)) { f.dir += Math.PI; continue; }
        f.x = nx; f.y = ny;
      }
      this.spawnT = (this.spawnT || 0) - dt;
      if (this.free.length < FREE_TARGET * 0.6 && this.spawnT <= 0) { this.spawnFree(); this.spawnT = 0.5; }
    }

    draw(ctx) {
      ctx.fillStyle = '#4b4560'; ctx.fillRect(0, 0, W, H);
      Draw.rr(ctx, AX, AY, AW, AH, 20); ctx.fillStyle = '#c9c3d6'; ctx.fill();
      ctx.save(); Draw.rr(ctx, AX, AY, AW, AH, 20); ctx.clip();
      ctx.fillStyle = '#bdb6cc';
      for (let x = AX; x < AX + AW; x += 48) for (let y = AY; y < AY + AH; y += 48) if (((x - AX) / 48 + (y - AY) / 48) % 2 === 0) ctx.fillRect(x, y, 48, 48);
      ctx.restore();
      for (const b of BLOCKS) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; Draw.rr(ctx, b.x + 6, b.y + 10, b.w, b.h, 10); ctx.fill();
        ctx.fillStyle = '#7d6fa8'; Draw.rr(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill();
        ctx.fillStyle = '#9a8cc6'; Draw.rr(ctx, b.x + 6, b.y + 6, b.w - 12, b.h - 22, 8); ctx.fill();
        ctx.fillStyle = '#ffe9a8';
        for (let x = b.x + 18; x < b.x + b.w - 16; x += 28) ctx.fillRect(x, b.y + 16, 14, 14);
      }
      for (const f of this.free) Draw.blob(ctx, { x: f.x, y: f.y, r: 14, color: GRAY, face: f.dir, walk: f.walk, scale: 1 - f.pop * 0.5 });
      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i], c = this.P[i].color;
        for (let k = p.troops.length - 1; k >= 0; k--) {
          const t = p.troops[k];
          Draw.blob(ctx, { x: t.x, y: t.y, r: 14, color: { main: c.light, dark: c.main, light: '#fff' }, face: p.face, walk: t.walk, scale: 1 + t.pop * 0.3 });
        }
        Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: c, face: p.face, walk: p.walk, squash: p.squash });
        Draw.text(ctx, String(p.troops.length), p.x, p.y - p.r - 16, { size: 20, color: c.light, sw: 4 });
      }
      const counts = this.ps.map((p) => p.troops.length);
      const lead = counts.indexOf(Math.max(...counts));
      Draw.chips(ctx, this.P, counts.map((c) => `👥 ${c}`), { crown: counts[lead] > 0 ? lead : -1 });
      Draw.timer(ctx, this.time, W - 72, 38);
    }

    results() { return this.ps.map((p) => ({ score: p.troops.length, text: `${p.troops.length} quân` })); }

    botInput(i) {
      const p = this.ps[i];
      const o = { mx: 0, my: 0, actP: false };
      let tx = null, ty = null, bd = Infinity, isFoe = false;
      for (const f of this.free) {
        const d = Math.hypot(f.x - p.x, f.y - p.y);
        if (d < bd) { bd = d; tx = f.x; ty = f.y; isFoe = false; }
      }
      this.ps.forEach((o2, j) => {
        if (j === i || o2.troops.length < 3) return;
        const t = o2.troops[Math.floor(o2.troops.length / 2)];
        const d = Math.hypot(t.x - p.x, t.y - p.y) - o2.troops.length * 6;
        if (d < bd) { bd = d; tx = t.x; ty = t.y; isFoe = true; }
      });
      if (tx === null) return o;
      let dx = tx - p.x, dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      // tránh nhà
      for (const b of BLOCKS) {
        const ax = p.x + dx * 40, ay = p.y + dy * 40;
        if (ax > b.x - 20 && ax < b.x + b.w + 20 && ay > b.y - 20 && ay < b.y + b.h + 20) { const t = dx; dx = -dy; dy = t; break; }
      }
      o.mx = dx; o.my = dy;
      if (isFoe && d < 140 && p.dashCd <= 0 && Math.random() < 0.08) o.actP = true;
      return o;
    }
  }

  Party.register({
    id: 'army', name: 'Đội Quân', emoji: '👥', cat: 'collect',
    tagline: 'Gom người xám vào đội, cướp quân của nhau · đông quân nhất là thắng',
    how: 'Chạm vào người xám để họ đi theo bạn. Chạm vào quân đang theo người khác để cướp 1 người — lao tới (nút Đánh) thì cướp cả đoạn phía sau! Đội càng dài chạy càng chậm.',
    controls: { move: 'Dẫn đội', act: 'Lao tới cướp quân' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Army(api),
  });
})();
