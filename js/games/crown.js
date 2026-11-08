'use strict';
/* Giữ Vương Miện — đội vương miện càng lâu càng nhiều điểm. Húc người đang đội để cướp. */
(() => {
  const AX = 50, AY = 84, AW = W - 100, AH = H - 84 - 24;
  const CX = AX + AW / 2, CY = AY + AH / 2;
  const GAME_TIME = 70, DOUBLE_AT = 15;
  const OBS = [
    { x: CX - 330, y: CY - 170, w: 140, h: 64 }, { x: CX + 190, y: CY - 170, w: 140, h: 64 },
    { x: CX - 330, y: CY + 106, w: 140, h: 64 }, { x: CX + 190, y: CY + 106, w: 140, h: 64 },
    { x: CX - 26, y: AY + 40, w: 52, h: 52 }, { x: CX - 26, y: AY + AH - 92, w: 52, h: 52 },
  ];
  const SPAWN = [[AX + 90, AY + 90], [AX + AW - 90, AY + AH - 90], [AX + AW - 90, AY + 90], [AX + 90, AY + AH - 90]];

  class Crown {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.scores = new Array(this.n).fill(0);
      this.time = this.total = api.T(GAME_TIME); this.doubleAt = api.T(DOUBLE_AT); this.finished = false;
      this.ps = this.P.map((p, i) => ({
        x: SPAWN[i][0], y: SPAWN[i][1], vx: 0, vy: 0, r: 26, face: 0, walk: 0,
        dashT: 0, dashCd: 0, squash: 0, noPick: 0, stun: 0, skip: false,
      }));
      this.crown = { x: CX, y: CY, vx: 0, vy: 0, z: 260, vz: 0, holder: -1, holdT: 0 };
      this.announcedDouble = false;
    }

    dropCrown(from, dirx, diry) {
      const c = this.crown, p = this.ps[from];
      c.holder = -1; c.x = p.x; c.y = p.y; c.z = 40;
      c.vx = dirx * 360 + U.rand(-80, 80); c.vy = diry * 360 + U.rand(-80, 80); c.vz = 380;
      p.noPick = 1.2;
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) {
        this.time -= dt;
        if (this.time <= 0) { this.time = 0; this.finished = true; }
        if (this.time <= this.doubleAt && !this.announcedDouble) {
          this.announcedDouble = true; Sfx.play('warn');
          parts.text(W / 2, H / 2 - 120, 'Điểm ×2!', '#ffe14d', 64);
        }
      }
      const c = this.crown;
      this.ps.forEach((p, i) => {
        const q = inp[i];
        p.dashT -= dt; p.dashCd -= dt; p.noPick -= dt; p.stun -= dt;
        p.squash *= Math.pow(0.01, dt);
        const holder = c.holder === i;
        if (p.stun <= 0) {
          if (q.mx || q.my) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
          if (q.actP && p.dashCd <= 0) {
            p.dashT = 0.25; p.dashCd = 1.0; p.squash = -0.2; Sfx.play('dash');
            p.vx = Math.cos(p.face) * 720; p.vy = Math.sin(p.face) * 720;
          }
        }
        if (p.dashT <= 0) {
          // CRW1: vương miện càng đội lâu càng nặng (chậm dần), người đuổi nhanh hơn chút khi có người đang đội
          const sp = p.stun > 0 ? 0 : holder ? 250 * Math.max(0.68, 1 - c.holdT * 0.025) : c.holder >= 0 ? 305 : 290;
          const k = Math.min(1, dt * (p.stun > 0 ? 3 : 10));
          p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        for (const o of OBS) Phys.circleRect(p, o);
        p.x = U.clamp(p.x, AX + p.r, AX + AW - p.r);
        p.y = U.clamp(p.y, AY + p.r, AY + AH - p.r);
      });
      Phys.separate(this.ps, 0.6, (a, b, nx, ny, imp, ia, ib) => {
        const tryHit = (atk, vic, iv, sx, sy) => {
          if (atk.dashT <= 0) return;
          atk.dashT = 0;
          vic.vx += sx * 420; vic.vy += sy * 420; vic.stun = 0.5;
          Sfx.play('hit'); FX.shake(7);
          parts.burst(vic.x, vic.y, ['#fff', '#ffe680'], 12, 240, 0.4, 5, { shape: 's' });
          if (c.holder === iv) {
            this.dropCrown(iv, sx, sy);
            Sfx.play('crown');
          }
        };
        tryHit(a, b, ib, nx, ny);
        tryHit(b, a, ia, -nx, -ny);
      });

      // vương miện
      if (c.holder < 0) {
        c.vz -= 1100 * dt; c.z += c.vz * dt;
        if (c.z <= 0) { c.z = 0; if (c.vz < -150) { c.vz *= -0.35; } else c.vz = 0; }
        const f = Math.pow(c.z > 0 ? 0.6 : 0.02, dt);
        c.vx *= f; c.vy *= f;
        c.x += c.vx * dt; c.y += c.vy * dt;
        const cc = { x: c.x, y: c.y, vx: c.vx, vy: c.vy, r: 16 };
        for (const o of OBS) Phys.circleRect(cc, o);
        c.x = U.clamp(cc.x, AX + 20, AX + AW - 20); c.y = U.clamp(cc.y, AY + 20, AY + AH - 20);
        c.vx = cc.vx; c.vy = cc.vy;
        if (c.z < 30) {
          for (let i = 0; i < this.n; i++) {
            const p = this.ps[i];
            if (p.noPick <= 0 && p.stun <= 0 && Math.hypot(p.x - c.x, p.y - c.y) < p.r + 20) {
              c.holder = i; c.holdT = 0; Sfx.play('crown');
              parts.text(p.x, p.y - 60, '👑', '#fff', 40);
              break;
            }
          }
        }
      } else if (!this.finished) {
        const p = this.ps[c.holder];
        c.x = p.x; c.y = p.y; c.holdT += dt;
        if (c.holdT > 6 && Math.random() < dt * 3) parts.burst(p.x + U.rand(-14, 14), p.y - 30, '#9fd8ff', 1, 30, 0.5, 4);
        this.scores[c.holder] += dt * (this.time <= this.doubleAt ? 2 : 1);
        if (Math.random() < dt * 8) parts.burst(p.x + U.rand(-20, 20), p.y - 40, '#ffe14d', 1, 40, 0.6, 5, { shape: 's' });
      }
    }

    draw(ctx) {
      ctx.fillStyle = '#245a2c'; ctx.fillRect(0, 0, W, H);
      Draw.rr(ctx, AX - 10, AY - 10, AW + 20, AH + 20, 28);
      ctx.fillStyle = '#8b5a2b'; ctx.fill();
      Draw.rr(ctx, AX, AY, AW, AH, 22);
      ctx.save(); ctx.clip();
      for (let x = AX; x < AX + AW; x += 70) {
        ctx.fillStyle = ((x - AX) / 70) % 2 ? '#79c95f' : '#70bf57';
        ctx.fillRect(x, AY, 70, AH);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(CX, CY, 90, 0, TAU); ctx.stroke();
      ctx.restore();
      // chướng ngại (bụi cây)
      for (const o of OBS) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        Draw.rr(ctx, o.x + 4, o.y + 10, o.w, o.h, 18); ctx.fill();
        ctx.fillStyle = '#2f8a3a';
        Draw.rr(ctx, o.x, o.y, o.w, o.h, 18); ctx.fill();
        ctx.fillStyle = '#48b04f';
        Draw.rr(ctx, o.x + 5, o.y + 4, o.w - 10, o.h - 16, 14); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        for (let k = 0; k < o.w / 30; k++) { ctx.beginPath(); ctx.arc(o.x + 18 + k * 30, o.y + 14, 5, 0, TAU); ctx.fill(); }
      }
      const c = this.crown;
      // vòng sáng dưới người giữ vương miện
      if (c.holder >= 0) {
        const p = this.ps[c.holder];
        ctx.strokeStyle = 'rgba(255,225,77,0.8)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.8, p.r * 1.4, p.r * 0.5, 0, 0, TAU); ctx.stroke();
      }
      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      let crownDrawn = false;
      for (const i of order) {
        const p = this.ps[i];
        if (c.holder < 0 && !crownDrawn && c.y < p.y) { this.drawCrown(ctx); crownDrawn = true; }
        const blink = p.noPick > 0 && Math.sin(U.now() * 30) > 0;
        Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: this.P[i].color, face: p.face, walk: p.walk,
          squash: p.squash, stun: p.stun > 0, crown: c.holder === i, alpha: blink ? 0.5 : 1 });
      }
      if (c.holder < 0 && !crownDrawn) this.drawCrown(ctx);

      const lead = this.scores.indexOf(Math.max(...this.scores));
      Draw.chips(ctx, this.P, this.scores.map((s) => Math.floor(s)), { y: 38, crown: this.scores[lead] > 0 ? lead : -1 });
      Draw.timer(ctx, this.time, W - 72, 38);
      if (this.time <= this.doubleAt && !this.finished) Draw.label(ctx, '×2 điểm!', 80, 38);
    }

    drawCrown(ctx) {
      const c = this.crown;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(c.x, c.y + 14, 18, 6, 0, 0, TAU); ctx.fill();
      Draw.crown(ctx, c.x, c.y - c.z - 4 + Math.sin(U.now() * 4) * 2, 34);
    }

    results() {
      return this.scores.map((s) => ({ score: Math.round(s * 10) / 10, text: `${Math.floor(s)} điểm` }));
    }

    botInput(i) {
      const p = this.ps[i], c = this.crown;
      const o = { mx: 0, my: 0, actP: false };
      let tx, ty;
      if (c.holder === i) {
        // chạy trốn: tránh xa những người khác, tránh góc tường
        let fx = 0, fy = 0;
        this.ps.forEach((q, j) => {
          if (j === i) return;
          const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1;
          const w = 1 / Math.max(60, d);
          fx += dx / d * w; fy += dy / d * w;
        });
        const wx = (CX - p.x) / AW, wy = (CY - p.y) / AH;
        fx += wx * 0.012; fy += wy * 0.012;
        const l = Math.hypot(fx, fy) || 1;
        o.mx = fx / l; o.my = fy / l;
        return o;
      }
      if (c.holder < 0) { tx = c.x; ty = c.y; }
      else { const h = this.ps[c.holder]; tx = h.x + h.vx * 0.2; ty = h.y + h.vy * 0.2; }
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
      o.mx = dx / d; o.my = dy / d;
      if (c.holder >= 0 && d < 150 && p.dashCd <= 0 && Math.random() < 0.12) o.actP = true;
      return o;
    }
  }

  Party.register({
    id: 'crown', name: 'Giữ Vương Miện', emoji: '👑',
    tagline: 'Đội vương miện càng lâu càng nhiều điểm · húc để cướp',
    how: 'Chạm vương miện để đội lên đầu — mỗi giây đội được 1 điểm (những giây cuối ×2). Đội càng lâu vương miện càng nặng, đi chậm dần. Húc trúng người đang đội để làm rơi vương miện!',
    controls: { move: 'Di chuyển', act: 'Húc (lao tới)' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Crown(api),
  });
})();
