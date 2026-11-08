'use strict';
/* Truyền Bom — chạm người khác để chuyền bom. Ai đang ôm bom lúc nổ thì bị loại. Nhảy lên thì không ai chuyền bom sang được. */
(() => {
  const AX = 90, AY = 100, AW = W - 180, AH = H - 100 - 30;
  const BUMPERS = [{ x: W / 2, y: AY + AH / 2, r: 46 }, { x: AX + 260, y: AY + 170, r: 34 }, { x: AX + AW - 260, y: AY + AH - 170, r: 34 },
    { x: AX + AW - 260, y: AY + 170, r: 30 }, { x: AX + 260, y: AY + AH - 170, r: 30 }];
  const SPAWN = [[AX + 120, AY + AH / 2], [AX + AW - 120, AY + AH / 2], [W / 2, AY + 80], [W / 2, AY + AH - 80]];

  class Potato {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.finished = false; this.outCount = 0; this.round = 0;
      this.ps = this.P.map((p, i) => ({
        x: SPAWN[i][0], y: SPAWN[i][1], vx: 0, vy: 0, r: 26, face: 0, walk: 0, z: 0, vz: 0,
        dashT: 0, dashCd: 0, jumpCd: 0, alive: true, outOrder: 0, squash: 0, skip: false, stun: 0, deadT: 0,
      }));
      this.holder = -1; this.pendT = 1.2; this.fuse = 0; this.fuseMax = 1;
      this.passCd = 0; this.lastFrom = -1; this.noReturn = 0; this.tickT = 0;
    }

    giveBomb() {
      const alive = this.ps.map((p, i) => (p.alive ? i : -1)).filter((i) => i >= 0);
      this.holder = U.pick(alive);
      this.round++;
      this.fuseMax = this.fuse = U.rand(9, 14) * Math.max(0.6, 1 - this.round * 0.08);
      this.lastFrom = -1; this.noReturn = 0;
      Sfx.play('warn');
      this.api.parts.text(this.ps[this.holder].x, this.ps[this.holder].y - 60, 'Có bom!', '#ff7a7a', 30);
    }

    update(dt, inp) {
      const parts = this.api.parts;
      this.ps.forEach((p, i) => {
        p.squash *= Math.pow(0.01, dt);
        if (!p.alive) { p.deadT += dt; p.skip = true; return; }
        const q = inp[i];
        p.dashT -= dt; p.dashCd -= dt; p.jumpCd -= dt; p.stun -= dt;
        const can = p.stun <= 0;
        if (can && (q.mx || q.my)) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        if (can && q.actP && p.dashCd <= 0) {
          p.dashT = 0.22; p.dashCd = 1.1; p.squash = -0.2; Sfx.play('dash');
          p.vx = Math.cos(p.face) * 700; p.vy = Math.sin(p.face) * 700;
        }
        if (can && q.jumpP && p.z <= 0 && p.jumpCd <= 0) { p.vz = 420; p.jumpCd = 1.0; Sfx.play('jump'); }
        p.vz -= 1500 * dt; p.z = Math.max(0, p.z + p.vz * dt);
        if (p.z <= 0 && p.vz < 0) p.vz = 0;
        if (p.dashT <= 0) {
          const sp = can ? (i === this.holder ? 295 : 270) : 0, k = Math.min(1, dt * (can ? 10 : 3));
          p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        for (const b of BUMPERS) {
          const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
          if (d < b.r + p.r) { p.x = b.x + dx / d * (b.r + p.r); p.y = b.y + dy / d * (b.r + p.r); }
        }
        p.x = U.clamp(p.x, AX + p.r, AX + AW - p.r); p.y = U.clamp(p.y, AY + p.r, AY + AH - p.r);
        p.skip = p.z > 15;
      });
      Phys.separate(this.ps, 0.6);

      if (this.finished) return;
      if (this.holder < 0) {
        this.pendT -= dt;
        if (this.pendT <= 0) this.giveBomb();
        return;
      }
      // chuyền bom
      this.passCd -= dt; this.noReturn -= dt;
      const h = this.ps[this.holder];
      if (this.passCd <= 0 && h.z < 15) {
        for (let j = 0; j < this.n; j++) {
          const o = this.ps[j];
          if (j === this.holder || !o.alive || o.z > 15) continue;
          if (j === this.lastFrom && this.noReturn > 0) continue;
          if (Math.hypot(o.x - h.x, o.y - h.y) < h.r + o.r + 6) {
            this.lastFrom = this.holder; this.holder = j;
            this.noReturn = 0.8; this.passCd = 0.25;
            o.stun = 0.25;
            Sfx.play('hit'); FX.shake(4);
            parts.text(o.x, o.y - 60, 'Bom nè!', '#ffe14d', 28);
            parts.burst(o.x, o.y - 40, ['#ffe14d', '#ff7a1a'], 10, 200, 0.4, 5);
            break;
          }
        }
      }
      // ngòi nổ
      this.fuse -= dt;
      this.tickT -= dt;
      const frac = this.fuse / this.fuseMax;
      if (this.tickT <= 0) { Sfx.play('tick'); this.tickT = 0.09 + frac * frac * 0.75; }
      if (this.fuse <= 0) {
        const p = this.ps[this.holder];
        p.alive = false; p.outOrder = ++this.outCount;
        Sfx.play('boom'); FX.shake(14); Party.rumble(this.holder, 1, 400);
        parts.burst(p.x, p.y, ['#ff7a1a', '#ffe14d', '#444', this.P[this.holder].color.main], 50, 450, 0.9, 9);
        parts.text(p.x, p.y - 60, `${this.P[this.holder].name} nổ tung!`, '#fff', 34);
        this.holder = -1; this.pendT = 1.8;
        if (this.ps.filter((q) => q.alive).length <= 1) this.finished = true;
      }
    }

    draw(ctx) {
      const t = U.now();
      ctx.fillStyle = '#3b2259'; ctx.fillRect(0, 0, W, H);
      Draw.rr(ctx, AX - 12, AY - 12, AW + 24, AH + 24, 34); ctx.fillStyle = '#ffb347'; ctx.fill();
      Draw.rr(ctx, AX, AY, AW, AH, 26); ctx.fillStyle = '#f7e1b5'; ctx.fill();
      ctx.save(); Draw.rr(ctx, AX, AY, AW, AH, 26); ctx.clip();
      ctx.fillStyle = '#efd29b';
      for (let x = AX - AH; x < AX + AW; x += 80) {
        ctx.beginPath(); ctx.moveTo(x, AY); ctx.lineTo(x + 40, AY); ctx.lineTo(x + 40 + AH, AY + AH); ctx.lineTo(x + AH, AY + AH); ctx.fill();
      }
      ctx.restore();
      for (const b of BUMPERS) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + b.r * 0.6, b.r, b.r * 0.45, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e8384f'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.68, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e8384f'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.36, 0, TAU); ctx.fill();
      }
      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i];
        if (!p.alive) {
          if (p.deadT < 1.5) Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: this.P[i].color, dead: true, alpha: 1 - p.deadT / 1.5, scale: 1 + p.deadT * 0.3 });
          continue;
        }
        if (i === this.holder) {
          const glow = 0.4 + 0.3 * Math.sin(t * 6); // không lộ thời gian còn lại (POT1)
          ctx.fillStyle = `rgba(255,60,60,${glow})`;
          ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.8, p.r * 1.5, p.r * 0.55, 0, 0, TAU); ctx.fill();
        }
        Draw.blob(ctx, { x: p.x, y: p.y, z: p.z, r: p.r, color: this.P[i].color, face: p.face, walk: p.walk, squash: p.squash, stun: p.stun > 0 });
        if (i === this.holder) this.drawBomb(ctx, p.x, p.y - p.z - p.r - 22);
      }
      Draw.chips(ctx, this.P, this.ps.map((p, i) => (!p.alive ? '💥 Loại' : i === this.holder ? '💣 BOM' : 'An toàn')),
        { dim: this.ps.map((p) => !p.alive) });
      if (this.holder < 0 && !this.finished && this.pendT > 0) {
        Draw.text(ctx, 'Chuẩn bị bom mới…', W / 2, AY + 40, { size: 28, color: '#5a2a7a', stroke: 'rgba(255,255,255,0.7)' });
      }
    }

    drawBomb(ctx, x, y) {
      // POT1: đồng hồ bom ẩn — chỉ nghe tiếng tích tắc nhanh dần; 1 giây cuối mới nháy đỏ
      const last = this.fuse < 1, t = U.now();
      const s = 1 + Math.sin(t * (last ? 30 : 8)) * 0.06;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 20);
      g.addColorStop(0, '#6b6b85'); g.addColorStop(1, '#1b1b29');
      ctx.fillStyle = last && Math.sin(t * 40) > 0 ? '#e83a5c' : g;
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#d9c08a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(4, -15); ctx.quadraticCurveTo(10, -26, 16, -22); ctx.stroke();
      Draw.sparkle(ctx, 16, -23, 8 + Math.random() * 3, '#ffe14d');
      ctx.restore();
    }

    results() {
      return this.ps.map((p) => ({ score: p.alive ? 100 : p.outOrder, text: p.alive ? 'Sống sót!' : `Nổ thứ ${p.outOrder}` }));
    }

    botInput(i) {
      const p = this.ps[i];
      const o = { mx: 0, my: 0, actP: false, jumpP: false };
      if (!p.alive) return o;
      let fx = 0, fy = 0;
      if (i === this.holder) {
        let tgt = null, td = Infinity;
        this.ps.forEach((q, j) => {
          if (j === i || !q.alive || (j === this.lastFrom && this.noReturn > 0)) return;
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d < td) { td = d; tgt = q; }
        });
        if (tgt) {
          fx = tgt.x + tgt.vx * 0.2 - p.x; fy = tgt.y + tgt.vy * 0.2 - p.y;
          if (td < 150 && p.dashCd <= 0 && Math.abs(U.angDiff(p.face, Math.atan2(fy, fx))) < 0.4 && Math.random() < 0.2) o.actP = true;
        }
      } else if (this.holder >= 0) {
        const h = this.ps[this.holder];
        const dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy) || 1;
        fx = dx / d; fy = dy / d;
        const m = 120;
        if (p.x < AX + m) fx += 1.2; if (p.x > AX + AW - m) fx -= 1.2;
        if (p.y < AY + m) fy += 1.2; if (p.y > AY + AH - m) fy -= 1.2;
        // chạy vòng tránh bị dồn vào góc
        fx += -fy * 0.5; fy += fx * 0.5;
        if (d < 80 && p.jumpCd <= 0 && Math.random() < 0.25) o.jumpP = true;
        if (d < 110 && h.dashT > 0 && p.z <= 0 && Math.random() < 0.5) o.jumpP = true;
      }
      const l = Math.hypot(fx, fy);
      if (l > 0.01) { o.mx = fx / l; o.my = fy / l; }
      return o;
    }
  }

  Party.register({
    id: 'potato', name: 'Truyền Bom', emoji: '🧨',
    tagline: 'Chạm người khác để chuyền bom · đừng ôm bom lúc nổ',
    how: 'Ai đang ôm bom thì chạy đi chạm người khác để chuyền sang. Không ai biết bom còn bao lâu — nghe tiếng tích tắc nhanh dần mà đoán, 1 giây cuối bom mới nháy đỏ. Bom nổ là người đang ôm bị loại! Đang nhảy trên không thì không bị chuyền bom. Người trụ lại cuối cùng thắng.',
    controls: { move: 'Di chuyển', act: 'Lao tới', jump: 'Nhảy né bom' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Potato(api),
  });
})();
