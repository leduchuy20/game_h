'use strict';
/* Bắt Gà — ôm gà về chuồng mình, trộm gà chuồng khác, húc để làm rơi gà. */
(() => {
  const AX = 40, AY = 84, AW = W - 80, AH = H - 84 - 20;
  const GAME_TIME = 60, CR = 78;
  const COOPS = [[AX + 95, AY + 95], [AX + AW - 95, AY + AH - 95], [AX + AW - 95, AY + 95], [AX + 95, AY + AH - 95]];

  class Chicken {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.finished = false; this.lastTick = 99;
      this.ps = this.P.map((p, i) => {
        const [cx, cy] = COOPS[i];
        return {
          x: cx + (cx < W / 2 ? 110 : -110), y: cy + (cy < H / 2 ? 60 : -60), vx: 0, vy: 0, r: 24,
          face: 0, walk: 0, dashT: 0, dashCd: 0, stun: 0, carry: -1, grabCd: 0, squash: 0, skip: false,
        };
      });
      this.ch = [];
      for (let k = 0; k < this.n * 3 + 2; k++) {
        this.ch.push({ x: W / 2 + U.rand(-220, 220), y: AY + AH / 2 + U.rand(-160, 160), vx: 0, vy: 0,
          state: 'free', owner: -1, carrier: -1, t: U.rand(0, 2), dir: U.rand(0, TAU), flap: 0, z: 0, vz: 0, face: 1 });
      }
      this.counts = new Array(this.n).fill(0);
    }

    drop(p, i, dirx, diry) {
      const c = this.ch[p.carry];
      p.carry = -1; p.grabCd = 0.8;
      Object.assign(c, { state: 'free', carrier: -1, x: p.x, y: p.y, vx: dirx * 260 + U.rand(-60, 60), vy: diry * 260 + U.rand(-60, 60), z: 30, vz: 300, t: 0.8 });
      Sfx.play('crash', 0.1);
      this.api.parts.burst(p.x, p.y - 20, ['#fff', '#f2e6d0'], 12, 200, 0.6, 5, { g: 300 });
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) {
        this.time -= dt;
        const s = Math.ceil(this.time);
        if (s <= 5 && s > 0 && s !== this.lastTick) { this.lastTick = s; Sfx.play('tick'); }
        if (this.time <= 0) { this.time = 0; this.finished = true; }
      }
      this.ps.forEach((p, i) => {
        const q = inp[i];
        p.dashT -= dt; p.dashCd -= dt; p.stun -= dt; p.grabCd -= dt;
        p.squash *= Math.pow(0.01, dt);
        const can = p.stun <= 0 && !this.finished;
        if (can && (q.mx || q.my)) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        if (can && q.actP && p.dashCd <= 0) {
          p.dashT = 0.25; p.dashCd = 1.0; p.squash = -0.2; Sfx.play('dash');
          p.vx = Math.cos(p.face) * 680; p.vy = Math.sin(p.face) * 680;
        }
        if (p.dashT <= 0) {
          const sp = can ? (p.carry >= 0 ? 240 : 280) : 0, k = Math.min(1, dt * (can ? 10 : 3));
          p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        }
        p.x = U.clamp(p.x + p.vx * dt, AX + p.r, AX + AW - p.r);
        p.y = U.clamp(p.y + p.vy * dt, AY + p.r, AY + AH - p.r);
      });
      Phys.separate(this.ps, 0.5, (a, b, nx, ny, imp, ia, ib) => {
        const hit = (atk, vic, iv, sx, sy) => {
          if (atk.dashT <= 0) return;
          atk.dashT = 0; vic.stun = 0.5; vic.vx += sx * 380; vic.vy += sy * 380;
          Sfx.play('hit'); FX.shake(6);
          parts.burst(vic.x, vic.y - 10, ['#fff', '#ffe14d'], 10, 220, 0.4, 5, { shape: 's' });
          if (vic.carry >= 0) this.drop(vic, iv, sx, sy);
        };
        hit(a, b, ib, nx, ny); hit(b, a, ia, -nx, -ny);
      });

      if (!this.finished) {
        this.ps.forEach((p, i) => {
          if (p.stun > 0) return;
          if (p.carry >= 0) {
            const [cx, cy] = COOPS[i];
            if (Math.hypot(p.x - cx, p.y - cy) < CR - 15) {
              const c = this.ch[p.carry];
              const a = U.rand(0, TAU), rr = U.rand(0, CR - 35);
              Object.assign(c, { state: 'coop', owner: i, carrier: -1, x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, z: 0 });
              p.carry = -1; p.grabCd = 0.3;
              Sfx.play('crown');
              parts.text(cx, cy - 50, '+1 🐔', this.P[i].color.light, 28);
            }
            return;
          }
          if (p.grabCd > 0) return;
          // gà thả rông
          for (let k = 0; k < this.ch.length; k++) {
            const c = this.ch[k];
            if (c.state === 'free' && c.z < 12 && Math.hypot(c.x - p.x, c.y - p.y) < p.r + 16) {
              c.state = 'carried'; c.carrier = i; p.carry = k;
              Sfx.play('pickup');
              return;
            }
          }
          // trộm gà chuồng khác
          for (let j = 0; j < this.n; j++) {
            if (j === i) continue;
            const [cx, cy] = COOPS[j];
            if (Math.hypot(p.x - cx, p.y - cy) < CR - 8) {
              const k = this.ch.findIndex((c) => c.state === 'coop' && c.owner === j);
              if (k >= 0) {
                Object.assign(this.ch[k], { state: 'carried', carrier: i, owner: -1 });
                p.carry = k; p.grabCd = 0.5;
                Sfx.play('pickup');
                parts.text(p.x, p.y - 50, 'Trộm!', '#ffe14d', 26);
                return;
              }
            }
          }
        });
      }

      // gà
      for (const c of this.ch) {
        c.flap += dt * 10;
        if (c.state === 'carried') {
          const p = this.ps[c.carrier];
          c.x = p.x; c.y = p.y; c.face = Math.cos(p.face) >= 0 ? 1 : -1;
          continue;
        }
        if (c.z > 0 || c.vz > 0) { c.vz -= 900 * dt; c.z = Math.max(0, c.z + c.vz * dt); if (c.z === 0) c.vz = 0; }
        c.t -= dt;
        if (c.state === 'free') {
          let near = null, nd = 150;
          for (const p of this.ps) {
            const d = Math.hypot(p.x - c.x, p.y - c.y);
            if (d < nd) { nd = d; near = p; }
          }
          let tvx, tvy;
          if (near && c.t <= 0) {
            const a = Math.atan2(c.y - near.y, c.x - near.x) + U.rand(-0.5, 0.5);
            tvx = Math.cos(a) * 175; tvy = Math.sin(a) * 175;
          } else {
            if (c.t <= -U.rand(1, 2)) { c.dir = U.rand(0, TAU); c.t = 0; }
            tvx = Math.cos(c.dir) * 55; tvy = Math.sin(c.dir) * 55;
          }
          const k = Math.min(1, dt * 4);
          c.vx += (tvx - c.vx) * k; c.vy += (tvy - c.vy) * k;
          c.x += c.vx * dt; c.y += c.vy * dt;
          if (c.x < AX + 20 || c.x > AX + AW - 20) { c.vx *= -1; c.dir = Math.PI - c.dir; }
          if (c.y < AY + 20 || c.y > AY + AH - 20) { c.vy *= -1; c.dir = -c.dir; }
          c.x = U.clamp(c.x, AX + 20, AX + AW - 20); c.y = U.clamp(c.y, AY + 20, AY + AH - 20);
          // gà thả rông không tự chui vào chuồng
          for (const [cx, cy] of COOPS.slice(0, this.n)) {
            const d = Math.hypot(c.x - cx, c.y - cy);
            if (d < CR + 6) { c.x = cx + (c.x - cx) / d * (CR + 6); c.y = cy + (c.y - cy) / d * (CR + 6); }
          }
          if (Math.abs(c.vx) > 5) c.face = c.vx > 0 ? 1 : -1;
        } else if (c.state === 'coop') {
          const [cx, cy] = COOPS[c.owner];
          if (c.t <= -U.rand(1, 3)) { c.dir = U.rand(0, TAU); c.t = 0; }
          c.x += Math.cos(c.dir) * 25 * dt; c.y += Math.sin(c.dir) * 25 * dt;
          const d = Math.hypot(c.x - cx, c.y - cy);
          if (d > CR - 30) { c.x = cx + (c.x - cx) / d * (CR - 30); c.y = cy + (c.y - cy) / d * (CR - 30); c.dir += Math.PI; }
          c.face = Math.cos(c.dir) >= 0 ? 1 : -1;
        }
      }
      this.counts.fill(0);
      for (const c of this.ch) if (c.state === 'coop') this.counts[c.owner]++;
    }

    drawChicken(ctx, x, y, face, flap, z = 0, s = 1) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(x, y + 12 * s, 13 * s, 4 * s, 0, 0, TAU); ctx.fill();
      ctx.translate(x, y - z); ctx.scale(face * s, s);
      ctx.strokeStyle = '#e09a2a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-3, 6); ctx.lineTo(-4, 12); ctx.moveTo(3, 6); ctx.lineTo(4, 12); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(60,40,20,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 10, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(9, -8, 7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f0e6d6';
      ctx.beginPath(); ctx.ellipse(-2, -1 + Math.sin(flap) * 2, 7, 4, -0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8384f';
      ctx.beginPath(); ctx.arc(8, -15, 3, 0, TAU); ctx.arc(11, -15, 3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(13, -4, 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffb12e';
      ctx.beginPath(); ctx.moveTo(15, -9); ctx.lineTo(20, -7); ctx.lineTo(15, -5); ctx.fill();
      ctx.fillStyle = '#1d1230';
      ctx.beginPath(); ctx.arc(11, -9, 1.6, 0, TAU); ctx.fill();
      ctx.restore();
    }

    draw(ctx) {
      ctx.fillStyle = '#3f7d36'; ctx.fillRect(0, 0, W, H);
      Draw.rr(ctx, AX, AY, AW, AH, 26); ctx.fillStyle = '#86c96a'; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let k = 0; k < 40; k++) {
        const x = AX + ((k * 137) % AW), y = AY + ((k * 251) % AH);
        ctx.beginPath(); ctx.ellipse(x, y, 18, 6, 0, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 8;
      Draw.rr(ctx, AX, AY, AW, AH, 26); ctx.stroke();
      // chuồng
      for (let i = 0; i < this.n; i++) {
        const [cx, cy] = COOPS[i], col = this.P[i].color;
        ctx.fillStyle = '#c99a5b';
        ctx.beginPath(); ctx.arc(cx, cy, CR, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.arc(cx, cy, CR - 12, 0, TAU); ctx.fill();
        ctx.strokeStyle = col.main; ctx.lineWidth = 6; ctx.setLineDash([14, 10]);
        ctx.beginPath(); ctx.arc(cx, cy, CR, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        for (let k = 0; k < 12; k++) {
          const a = k * TAU / 12;
          ctx.fillStyle = '#6b4320';
          ctx.fillRect(cx + Math.cos(a) * CR - 4, cy + Math.sin(a) * CR - 10, 8, 14);
        }
        const bx = cx + (cx < W / 2 ? -CR + 14 : CR - 14), by = cy + (cy < H / 2 ? -CR + 14 : CR - 14);
        Draw.rr(ctx, bx - 30, by - 18, 60, 36, 18); ctx.fillStyle = col.dark; ctx.fill();
        Draw.text(ctx, `🐔${this.counts[i]}`, bx, by + 1, { size: 20, sw: 3 });
      }
      // gà trong chuồng & thả rông (vẽ dưới), gà đang được ôm vẽ trên người
      for (const c of this.ch) if (c.state !== 'carried') this.drawChicken(ctx, c.x, c.y, c.face, c.flap, c.z);
      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i];
        Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: this.P[i].color, face: p.face, walk: p.walk, squash: p.squash, stun: p.stun > 0 });
        if (p.carry >= 0) {
          const c = this.ch[p.carry];
          this.drawChicken(ctx, p.x, p.y - 34, c.face, c.flap * 2, 0, 1.1);
        }
      }
      const lead = this.counts.indexOf(Math.max(...this.counts));
      Draw.chips(ctx, this.P, this.counts.map((c) => `🐔 ${c}`), { crown: this.counts[lead] > 0 ? lead : -1 });
      Draw.timer(ctx, this.time, W - 72, 38);
    }

    results() { return this.counts.map((c) => ({ score: c, text: `${c} con gà` })); }

    botInput(i) {
      const p = this.ps[i];
      const o = { mx: 0, my: 0, actP: false };
      let tx, ty;
      if (p.carry >= 0) { [tx, ty] = COOPS[i]; }
      else {
        let bd = Infinity;
        for (const c of this.ch) {
          if (c.state !== 'free') continue;
          const d = Math.hypot(c.x - p.x, c.y - p.y);
          if (d < bd) { bd = d; tx = c.x + c.vx * 0.3; ty = c.y + c.vy * 0.3; }
        }
        for (let j = 0; j < this.n; j++) {
          if (j === i || this.counts[j] === 0) continue;
          const [cx, cy] = COOPS[j];
          const d = Math.hypot(cx - p.x, cy - p.y) + 160 - this.counts[j] * 15;
          if (d < bd) { bd = d; tx = cx; ty = cy; }
        }
        // húc người đang ôm gà ở gần
        this.ps.forEach((q, j) => {
          if (j === i || q.carry < 0) return;
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d < 220 && d < bd) { bd = d; tx = q.x; ty = q.y; }
          if (d < 120 && p.dashCd <= 0 && Math.random() < 0.15) o.actP = true;
        });
      }
      if (tx === undefined) return o;
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
      o.mx = dx / d; o.my = dy / d;
      return o;
    }
  }

  Party.register({
    id: 'chicken', name: 'Bắt Gà', emoji: '🐔',
    tagline: 'Ôm gà về chuồng, trộm gà chuồng khác · nhiều gà nhất là thắng',
    how: 'Lại gần gà là tự ôm, mang về chuồng có viền màu của mình. Vào chuồng người khác để trộm gà! Húc trúng người đang ôm gà để làm rơi gà.',
    controls: { move: 'Chạy (lại gần gà là ôm)', act: 'Húc — làm rơi gà' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Chicken(api),
  });
})();
