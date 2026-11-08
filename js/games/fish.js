'use strict';
/* Cá Lớn Nuốt Cá Bé — nuốt cá nhỏ hơn để lớn, né cá to hơn (kể cả cá mập). Hết giờ ai nặng nhất thắng. */
(() => {
  const TOP = 76, GAME_TIME = 60, NPC_TARGET = 22, START_MASS = 12;
  const NPC_COLORS = [['#7fd8ff', '#3a8fc0'], ['#ffb36b', '#c26a1e'], ['#c7a6ff', '#7a52c7'], ['#9ff08a', '#4a9c3a'], ['#ff9fb8', '#c0506e']];
  const rOf = (m) => 4.6 * Math.sqrt(m);
  const SPAWN = [[200, 220], [W - 200, H - 140], [W - 200, 220], [200, H - 140]];

  class Fish {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.finished = false;
      this.ps = this.P.map((p, i) => ({
        x: SPAWN[i][0], y: SPAWN[i][1], vx: 0, vy: 0, mass: START_MASS, dir: i % 2 ? -1 : 1, tilt: 0,
        dashT: 0, dashCd: 0, dead: 0, inv: 1.5, wig: 0, eaten: 0,
      }));
      this.npcs = [];
      for (let k = 0; k < NPC_TARGET; k++) this.spawnNpc(true);
      this.bubbles = Array.from({ length: 40 }, () => this.newBubble(true));
      this.weeds = Array.from({ length: 14 }, (_, k) => [40 + k * 92 + U.rand(-20, 20), U.rand(50, 110), U.rand(0, TAU)]);
      this.spawnT = 0;
      this.bot = this.P.map(() => ({ wx: W / 2, wy: H / 2, t: 0 }));
    }

    newBubble(any) { return { x: U.rand(0, W), y: any ? U.rand(TOP, H) : H + 10, r: U.rand(2, 6), s: U.rand(30, 70) }; }

    spawnNpc(anywhere) {
      const roll = Math.random();
      const big = roll < 0.05 && !this.npcs.some((f) => f.big);
      const mass = big ? U.rand(120, 230) : roll < 0.7 ? U.rand(2, 9) : U.rand(14, 50);
      const r = rOf(mass), dir = Math.random() < 0.5 ? 1 : -1;
      const x = anywhere ? U.rand(60, W - 60) : dir > 0 ? -r - 30 : W + r + 30;
      this.npcs.push({
        x, y: U.rand(TOP + r + 10, H - r - 30), vx: dir * (big ? U.rand(60, 80) : U.rand(50, 120)), mass, r, big,
        col: big ? ['#8ea2b8', '#4b5a6e'] : U.pick(NPC_COLORS), wob: U.rand(0, TAU), alive: true,
      });
    }

    die(p, i) {
      p.dead = 2.2; p.eaten++;
      const lost = p.mass;
      p.mass = Math.max(START_MASS, p.mass * 0.5);
      Sfx.play('crash'); FX.shake(6);
      this.api.parts.burst(p.x, p.y, [this.P[i].color.main, '#fff'], 20, 260, 0.7, 6);
      this.api.parts.text(p.x, p.y - 30, `Bị nuốt! −${Math.round(lost - p.mass)}`, '#ff8fa8', 26);
    }

    update(dt, inp) {
      const parts = this.api.parts, t = U.now();
      if (!this.finished) {
        this.time -= dt;
        if (this.time <= 0) { this.time = 0; this.finished = true; }
      }
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.npcs.length < NPC_TARGET) { this.spawnNpc(false); this.spawnT = 0.35; }
      for (const b of this.bubbles) { b.y -= b.s * dt; b.x += Math.sin(t * 2 + b.r) * 10 * dt; if (b.y < TOP - 10) Object.assign(b, this.newBubble(false)); }

      this.ps.forEach((p, i) => {
        if (p.dead > 0) {
          p.dead -= dt;
          if (p.dead <= 0) {
            const [sx, sy] = SPAWN[U.randi(0, 3)];
            Object.assign(p, { x: sx, y: sy, vx: 0, vy: 0, inv: 2 });
          }
          return;
        }
        const q = inp[i];
        p.inv -= dt; p.dashT -= dt; p.dashCd -= dt;
        // FSH2: cá to tự hao hụt dần (càng to hao càng nhanh) để người dẫn đầu không đứng yên giữ điểm
        if (!this.finished && p.mass > 30) p.mass = Math.max(30, p.mass - dt * p.mass * 0.01 * (p.mass / 150));
        const r = rOf(p.mass);
        let sp = Math.max(120, 300 - r * 2.2);
        if (q.actP && p.dashCd <= 0 && !this.finished) { p.dashT = 0.35; p.dashCd = 1.5; Sfx.play('dash'); }
        if (p.dashT > 0) sp *= 2.1;
        const k = Math.min(1, dt * 5);
        p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.x = U.clamp(p.x, r, W - r); p.y = U.clamp(p.y, TOP + r, H - r * 0.8);
        if (Math.abs(p.vx) > 15) p.dir = p.vx > 0 ? 1 : -1;
        p.tilt = U.clamp(p.vy / 400, -0.5, 0.5);
        p.wig += dt * (4 + Math.hypot(p.vx, p.vy) / 30);
        if (p.dashT > 0 && Math.random() < 0.5) parts.burst(p.x - p.dir * r, p.y, 'rgba(255,255,255,0.7)', 1, 30, 0.5, 4);
      });

      for (const f of this.npcs) {
        f.wob += dt * 3;
        if (f.big) {
          // cá mập lượn về phía người chơi gần nhất
          let best = null, bd = 320;
          for (const p of this.ps) {
            if (p.dead > 0 || rOf(p.mass) > f.r * 0.9) continue;
            const d = Math.hypot(p.x - f.x, p.y - f.y);
            if (d < bd) { bd = d; best = p; }
          }
          if (best) f.y += U.clamp(best.y - f.y, -60, 60) * dt;
        }
        f.x += f.vx * dt; f.y += Math.sin(f.wob) * 18 * dt;
        f.y = U.clamp(f.y, TOP + f.r, H - f.r);
        if ((f.vx > 0 && f.x > W + f.r + 40) || (f.vx < 0 && f.x < -f.r - 40)) f.alive = false;
      }

      if (!this.finished) {
        this.ps.forEach((p, i) => {
          if (p.dead > 0) return;
          const r = rOf(p.mass);
          for (const f of this.npcs) {
            if (!f.alive) continue;
            const d = Math.hypot(f.x - p.x, f.y - p.y);
            if (r > f.r * 1.1 && d < r * 0.95) {
              f.alive = false; p.mass = Math.min(450, p.mass + f.mass * 0.7);
              Sfx.play('eat', 0.04);
              parts.burst(f.x, f.y, [f.col[0], '#fff'], 8, 140, 0.4, 4);
              if (f.mass >= 6) parts.text(f.x, f.y - 20, `+${Math.round(f.mass * 0.7)}`, '#fff', 20);
            } else if (f.r > r * 1.1 && d < f.r * 0.85 && p.inv <= 0) {
              f.mass += p.mass * 0.3; f.r = rOf(Math.min(f.mass, 300));
              this.die(p, i);
              return;
            }
          }
        });
        for (let a = 0; a < this.n; a++) {
          for (let b = 0; b < this.n; b++) {
            const A = this.ps[a], B = this.ps[b];
            if (a === b || A.dead > 0 || B.dead > 0 || B.inv > 0) continue;
            const ra = rOf(A.mass), rb = rOf(B.mass);
            if (ra > rb * 1.12 && Math.hypot(A.x - B.x, A.y - B.y) < ra * 0.95) {
              A.mass = Math.min(450, A.mass + B.mass * 0.5);
              parts.text(A.x, A.y - ra - 10, `Nuốt ${this.P[b].name}!`, this.P[a].color.light, 28);
              this.die(B, b);
            }
          }
        }
      }
      this.npcs = this.npcs.filter((f) => f.alive);
    }

    drawFish(ctx, x, y, r, dir, tilt, c1, c2, o = {}) {
      ctx.save();
      ctx.globalAlpha = o.alpha ?? 1;
      ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(tilt * dir);
      const wag = Math.sin(o.wig || 0) * 0.25;
      // đuôi
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, 0);
      ctx.lineTo(-r * 1.65, -r * (0.7 + wag));
      ctx.quadraticCurveTo(-r * 1.4, 0, -r * 1.65, r * (0.7 - wag));
      ctx.closePath(); ctx.fill();
      // vây lưng
      ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.7); ctx.quadraticCurveTo(0, -r * 1.3, r * 0.35, -r * 0.75); ctx.fill();
      // thân
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.35, r * 0.1, 0, 0, r * 1.2);
      g.addColorStop(0, o.light || '#fff'); g.addColorStop(0.4, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * 0.85, 0, 0, TAU); ctx.fill();
      ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.strokeStyle = 'rgba(20,10,40,0.4)'; ctx.stroke();
      // mắt
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.18, r * 0.24, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1d1230';
      ctx.beginPath(); ctx.arc(r * 0.57, -r * 0.16, r * 0.12, 0, TAU); ctx.fill();
      if (o.big) {
        ctx.fillStyle = '#fff';
        for (let k = 0; k < 4; k++) {
          ctx.beginPath(); ctx.moveTo(r * (0.55 + k * 0.12), r * 0.3); ctx.lineTo(r * (0.61 + k * 0.12), r * 0.45); ctx.lineTo(r * (0.67 + k * 0.12), r * 0.3); ctx.fill();
        }
        ctx.strokeStyle = '#2a1840'; ctx.lineWidth = r * 0.05;
        ctx.beginPath(); ctx.moveTo(r * 0.5, r * 0.3); ctx.lineTo(r * 1.05, r * 0.3); ctx.stroke();
      } else {
        ctx.strokeStyle = '#2a1840'; ctx.lineWidth = Math.max(1.5, r * 0.06); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(r * 0.82, r * 0.18, r * 0.14, 0.2, Math.PI - 0.6); ctx.stroke();
      }
      if (o.cheek) {
        ctx.fillStyle = 'rgba(255,120,150,0.5)';
        ctx.beginPath(); ctx.ellipse(r * 0.35, r * 0.25, r * 0.14, r * 0.08, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    draw(ctx) {
      const t = U.now();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#3aa3e6'); g.addColorStop(0.5, '#1767a8'); g.addColorStop(1, '#0a3466');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let k = 0; k < 5; k++) {
        const x = 150 + k * 260 + Math.sin(t * 0.3 + k) * 40;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x + 200, H); ctx.lineTo(x + 60, H); ctx.fill();
      }
      ctx.fillStyle = '#e6cf8f';
      ctx.beginPath(); ctx.moveTo(0, H - 22);
      for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H - 22 + Math.sin(x * 0.02) * 6);
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
      ctx.strokeStyle = '#2f9e5a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      for (const [x, h, ph] of this.weeds) {
        ctx.beginPath(); ctx.moveTo(x, H - 18);
        for (let k = 1; k <= 5; k++) ctx.lineTo(x + Math.sin(t * 1.5 + ph + k * 0.7) * k * 3, H - 18 - h * k / 5);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5;
      for (const b of this.bubbles) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke(); }

      for (const f of this.npcs) {
        this.drawFish(ctx, f.x, f.y, f.r, f.vx > 0 ? 1 : -1, 0, f.col[0], f.col[1], { big: f.big, wig: f.wob * 2 });
      }
      this.ps.forEach((p, i) => {
        if (p.dead > 0) return;
        const r = rOf(p.mass), c = this.P[i].color;
        const blink = p.inv > 0 && Math.sin(t * 30) > 0;
        this.drawFish(ctx, p.x, p.y, r, p.dir, p.tilt, c.main, c.dark, { light: c.light, wig: p.wig, cheek: true, alpha: blink ? 0.45 : 1 });
        Draw.text(ctx, this.P[i].name, p.x, p.y - r - 14, { size: 18, color: c.light, sw: 4 });
      });
      const lead = this.ps.reduce((bi, p, i, arr) => (p.mass > arr[bi].mass ? i : bi), 0);
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.dead > 0 ? '💀 ' : '') + Math.round(p.mass) + ' kg'), { crown: lead });
      Draw.timer(ctx, this.time, W - 72, 38);
    }

    results() {
      return this.ps.map((p) => ({ score: Math.round(p.mass * 10) / 10, text: `Nặng ${Math.round(p.mass)} kg · bị nuốt ${p.eaten} lần` }));
    }

    botInput(i) {
      const p = this.ps[i], st = this.bot[i];
      const o = { mx: 0, my: 0, actP: false };
      if (p.dead > 0) return o;
      const r = rOf(p.mass);
      let fx = 0, fy = 0, chase = Infinity, threat = Infinity;
      const consider = (x, y, or, mass, inv) => {
        const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1;
        if (r > or * 1.12 && d < 450 && !inv) {
          const w = (mass + 2) / (d + 40);
          fx += dx / d * w; fy += dy / d * w; chase = Math.min(chase, d);
        } else if (or > r * 1.08 && d < 260 + or) {
          const w = 4 * (1 - d / (260 + or));
          fx -= dx / d * w; fy -= dy / d * w; threat = Math.min(threat, d - or);
        }
      };
      for (const f of this.npcs) consider(f.x, f.y, f.r, f.mass, false);
      this.ps.forEach((q, j) => { if (j !== i && q.dead <= 0) consider(q.x, q.y, rOf(q.mass), q.mass, q.inv > 0); });
      const m = 90 + r;
      if (p.x < m) fx += 0.6; if (p.x > W - m) fx -= 0.6;
      if (p.y < TOP + m) fy += 0.6; if (p.y > H - m) fy -= 0.6;
      if (Math.hypot(fx, fy) < 0.02) {
        st.t -= 1 / 60;
        if (st.t <= 0) { st.wx = U.rand(150, W - 150); st.wy = U.rand(TOP + 100, H - 100); st.t = 2; }
        fx = st.wx - p.x; fy = st.wy - p.y;
      }
      const l = Math.hypot(fx, fy) || 1;
      o.mx = fx / l; o.my = fy / l;
      if (p.dashCd <= 0 && (threat < 90 || chase < 110) && Math.random() < 0.15) o.actP = true;
      return o;
    }
  }

  Party.register({
    id: 'fish', name: 'Cá Lớn Nuốt Cá Bé', emoji: '🐟',
    tagline: 'Nuốt cá nhỏ hơn để lớn, né cá to hơn · nặng nhất là thắng',
    how: 'Bơi tới nuốt cá nhỏ hơn mình (kể cả bạn bè!) để lớn lên. Né cá to hơn và cá mập — bị nuốt là mất phần lớn cân nặng. Cá càng to càng tự sụt cân dần, phải ăn liên tục. Hết giờ, ai nặng nhất thắng.',
    controls: { move: 'Bơi 8 hướng', act: 'Lao nhanh' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Fish(api),
  });
})();
