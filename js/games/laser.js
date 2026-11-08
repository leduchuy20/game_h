'use strict';
/* Né Laser — tia laser quét sát sàn, nhảy qua để né. Mỗi người 3 tim. */
(() => {
  const AX = 80, AY = 100, AW = W - 160, AH = H - 100 - 30;
  const CX = AX + AW / 2, CY = AY + AH / 2;
  const GAME_TIME = 60;

  class Laser {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.elapsed = 0; this.finished = false;
      this.beams = []; this.spawnT = 1.5; this.waveN = 0; this.insX = 0; this.insY = 0;
      const pos = [[CX - 200, CY - 120], [CX + 200, CY + 120], [CX + 200, CY - 120], [CX - 200, CY + 120]];
      this.ps = this.P.map((p, i) => ({
        x: pos[i][0], y: pos[i][1], vx: 0, vy: 0, r: 24, face: 0, walk: 0, z: 0, vz: 0,
        hearts: 3, inv: 0, out: false, outTime: 0, squash: 0, skip: false,
      }));
      this.bot = this.P.map(() => ({ tx: CX, ty: CY, t: 0 }));
    }

    spawn() {
      this.waveN++;
      const sp = Math.min(380, 170 + this.waveN * 9);
      const types = this.waveN < 3 ? ['h', 'v'] : ['h', 'v', 'h', 'v', 'rot', 'cross'];
      const t = U.pick(types);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const add = (type) => {
        if (type === 'h') this.beams.push({ type, pos: dir > 0 ? AY - 6 : AY + AH + 6, vel: dir * sp, warn: 0.7 });
        if (type === 'v') this.beams.push({ type, pos: dir > 0 ? AX - 6 : AX + AW + 6, vel: dir * sp, warn: 0.7 });
      };
      if (t === 'cross') { add('h'); add('v'); }
      else if (t === 'rot') {
        this.beams.push({ type: 'rot', ang: U.rand(0, TAU), vel: dir * U.rand(0.9, 1.4 + this.waveN * 0.03), warn: 1.1, life: 5.5 });
      } else add(t);
      Sfx.play('warn');
    }

    beamHit(b, p) {
      if (b.warn > 0) return false;
      const fy = p.y + p.r * 0.5;
      if (b.type === 'h') return Math.abs(fy - b.pos) < 12;
      if (b.type === 'v') return Math.abs(p.x - b.pos) < p.r * 0.55 + 6;
      const dx = p.x - CX, dy = fy - CY;
      const along = dx * Math.cos(b.ang) + dy * Math.sin(b.ang);
      const perp = Math.abs(-dx * Math.sin(b.ang) + dy * Math.cos(b.ang));
      return along > 0 && perp < p.r * 0.55 + 6;
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) {
        this.time -= dt; this.elapsed += dt;
        if (this.time <= 0) { this.time = 0; this.finished = true; }
        // LAS3: từ 35% thời gian, sàn thu nhỏ dần về giữa
        const f = U.clamp((this.elapsed / this.total - 0.35) / 0.65, 0, 1);
        this.insX = f * 300; this.insY = f * 150;
        this.spawnT -= dt;
        if (this.spawnT <= 0) { this.spawn(); this.spawnT = Math.max(1.3, 3.1 - this.waveN * 0.09); }
      }
      for (const b of this.beams) {
        if (b.warn > 0) { b.warn -= dt; continue; }
        if (b.type === 'rot') { b.ang += b.vel * dt; b.life -= dt; }
        else b.pos += b.vel * dt;
      }
      this.beams = this.beams.filter((b) => b.type === 'rot' ? b.life > 0
        : b.type === 'h' ? b.pos > AY - 20 && b.pos < AY + AH + 20 : b.pos > AX - 20 && b.pos < AX + AW + 20);

      this.ps.forEach((p, i) => {
        if (p.out) return;
        const q = inp[i];
        p.inv -= dt; p.squash *= Math.pow(0.01, dt);
        if (q.mx || q.my) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        const k = Math.min(1, dt * 10);
        p.vx += (q.mx * 260 - p.vx) * k; p.vy += (q.my * 260 - p.vy) * k;
        if (q.jumpP && p.z <= 0) { p.vz = 430; Sfx.play('jump'); p.squash = -0.2; }
        p.vz -= 1500 * dt; p.z = Math.max(0, p.z + p.vz * dt);
        if (p.z <= 0 && p.vz < 0) { if (p.vz < -300) p.squash = 0.2; p.vz = 0; }
        p.x = U.clamp(p.x + p.vx * dt, AX + this.insX + p.r, AX + AW - this.insX - p.r);
        p.y = U.clamp(p.y + p.vy * dt, AY + this.insY + p.r, AY + AH - this.insY - p.r);
        if (this.finished || p.inv > 0 || p.z > 14) return;
        if (this.beams.some((b) => this.beamHit(b, p))) {
          p.hearts--; p.inv = 1.3;
          Sfx.play('hurt'); FX.shake(6); Party.rumble(i);
          parts.burst(p.x, p.y, ['#ff3b52', '#fff', this.P[i].color.main], 16, 260, 0.5, 6);
          if (p.hearts <= 0) { p.out = true; p.outTime = this.elapsed; parts.text(p.x, p.y - 40, 'Bị loại!', '#fff', 30); }
          else parts.text(p.x, p.y - 40, '−1 ♥', '#ff8fa8', 26);
        }
      });
      this.ps.forEach((p) => { p.skip = p.out || p.z > 14; });
      Phys.separate(this.ps, 0.5);
      if (!this.finished && this.n >= 2 && this.ps.filter((p) => !p.out).length <= 1) this.finished = true;
    }

    draw(ctx) {
      const t = U.now();
      ctx.fillStyle = '#0d0b1f'; ctx.fillRect(0, 0, W, H);
      Draw.rr(ctx, AX - 14, AY - 14, AW + 28, AH + 28, 20); ctx.fillStyle = '#2b2550'; ctx.fill();
      ctx.fillStyle = '#1a1636'; ctx.fillRect(AX, AY, AW, AH);
      ctx.strokeStyle = 'rgba(120,110,220,0.18)'; ctx.lineWidth = 2;
      for (let x = AX; x <= AX + AW; x += 56) { ctx.beginPath(); ctx.moveTo(x, AY); ctx.lineTo(x, AY + AH); ctx.stroke(); }
      for (let y = AY; y <= AY + AH; y += 56) { ctx.beginPath(); ctx.moveTo(AX, y); ctx.lineTo(AX + AW, y); ctx.stroke(); }
      if (this.insX > 0) {
        // phần sàn đã thu: tối lại + viền cảnh báo
        ctx.fillStyle = 'rgba(5,4,14,0.78)';
        ctx.fillRect(AX, AY, AW, this.insY); ctx.fillRect(AX, AY + AH - this.insY, AW, this.insY);
        ctx.fillRect(AX, AY + this.insY, this.insX, AH - 2 * this.insY); ctx.fillRect(AX + AW - this.insX, AY + this.insY, this.insX, AH - 2 * this.insY);
        ctx.strokeStyle = `rgba(255,200,60,${0.6 + 0.3 * Math.sin(t * 6)})`; ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
        ctx.strokeRect(AX + this.insX, AY + this.insY, AW - 2 * this.insX, AH - 2 * this.insY); ctx.setLineDash([]);
      }
      ctx.fillStyle = '#4a4380';
      ctx.beginPath(); ctx.arc(CX, CY, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff3b52'; ctx.beginPath(); ctx.arc(CX, CY, 9, 0, TAU); ctx.fill();

      // laser
      for (const b of this.beams) {
        const warn = b.warn > 0;
        ctx.save();
        ctx.lineCap = 'round';
        if (warn) { ctx.setLineDash([10, 12]); ctx.strokeStyle = `rgba(255,60,80,${0.35 + 0.3 * Math.sin(t * 20)})`; ctx.lineWidth = 3; }
        else { ctx.shadowColor = '#ff2b4a'; ctx.shadowBlur = 18; ctx.strokeStyle = '#ff3b52'; ctx.lineWidth = 8; }
        ctx.beginPath();
        if (b.type === 'h') { ctx.moveTo(AX, b.pos); ctx.lineTo(AX + AW, b.pos); }
        else if (b.type === 'v') { ctx.moveTo(b.pos, AY); ctx.lineTo(b.pos, AY + AH); }
        else { ctx.moveTo(CX, CY); ctx.lineTo(CX + Math.cos(b.ang) * 900, CY + Math.sin(b.ang) * 900); }
        ctx.save(); ctx.beginPath(); ctx.rect(AX, AY, AW, AH); ctx.clip();
        ctx.beginPath();
        if (b.type === 'h') { ctx.moveTo(AX, b.pos); ctx.lineTo(AX + AW, b.pos); }
        else if (b.type === 'v') { ctx.moveTo(b.pos, AY); ctx.lineTo(b.pos, AY + AH); }
        else { ctx.moveTo(CX, CY); ctx.lineTo(CX + Math.cos(b.ang) * 900, CY + Math.sin(b.ang) * 900); }
        ctx.stroke();
        if (!warn) { ctx.shadowBlur = 0; ctx.strokeStyle = '#ffd0d8'; ctx.lineWidth = 3; ctx.stroke(); }
        ctx.restore();
        ctx.restore();
        // đầu phát tia trên tường
        if (b.type !== 'rot') {
          ctx.fillStyle = '#ff3b52';
          if (b.type === 'h') { ctx.fillRect(AX - 14, b.pos - 8, 10, 16); ctx.fillRect(AX + AW + 4, b.pos - 8, 10, 16); }
          else { ctx.fillRect(b.pos - 8, AY - 14, 16, 10); ctx.fillRect(b.pos - 8, AY + AH + 4, 16, 10); }
        }
      }
      const order = this.ps.map((_, i) => i).filter((i) => !this.ps[i].out).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i];
        const blink = p.inv > 0 && Math.sin(t * 30) > 0;
        Draw.blob(ctx, { x: p.x, y: p.y, z: p.z, r: p.r, color: this.P[i].color, face: p.face, walk: p.walk, squash: p.squash, alpha: blink ? 0.4 : 1 });
      }
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.out ? 'Loại' : '♥'.repeat(p.hearts))), { dim: this.ps.map((p) => p.out) });
      Draw.timer(ctx, this.time, W - 72, 38);
    }

    results() {
      return this.ps.map((p) => (p.out
        ? { score: p.outTime, text: `Bị loại ở giây ${Math.floor(p.outTime)}` }
        : { score: 1000 + p.hearts * 100, text: `Còn ${p.hearts} ♥` }));
    }

    botInput(i) {
      const p = this.ps[i], st = this.bot[i];
      const o = { mx: 0, my: 0, jumpP: false };
      if (p.out) return o;
      st.t -= 1 / 60;
      if (st.t <= 0 || Math.hypot(st.tx - p.x, st.ty - p.y) < 20) {
        const mx = Math.min(80 + this.insX, AW / 2 - 10), my = Math.min(80 + this.insY, AH / 2 - 10);
        st.tx = U.rand(AX + mx, AX + AW - mx); st.ty = U.rand(AY + my, AY + AH - my); st.t = U.rand(1.5, 3);
      }
      const dx = st.tx - p.x, dy = st.ty - p.y, d = Math.hypot(dx, dy) || 1;
      o.mx = dx / d * 0.7; o.my = dy / d * 0.7;
      if (p.z > 0) return o;
      const fy = p.y + p.r * 0.5;
      for (const b of this.beams) {
        if (b.warn > 0.15) continue;
        let tt = Infinity;
        if (b.type === 'h') { const dd = (fy - b.pos) * Math.sign(b.vel); if (dd > -5) tt = dd / Math.abs(b.vel); }
        else if (b.type === 'v') { const dd = (p.x - b.pos) * Math.sign(b.vel); if (dd > -5) tt = dd / Math.abs(b.vel); }
        else {
          const a = Math.atan2(fy - CY, p.x - CX);
          let da = U.angDiff(b.ang, a) * Math.sign(b.vel);
          if (da < 0) da += TAU;
          tt = da / Math.abs(b.vel) + Math.max(0, b.warn);
          if (Math.hypot(p.x - CX, fy - CY) < 30) tt = 0;
        }
        if (tt < 0.2) { o.jumpP = true; break; }
      }
      return o;
    }
  }

  Party.register({
    id: 'laser', name: 'Né Laser', emoji: '🔴',
    tagline: 'Nhảy qua tia laser quét sàn · nhiều tim nhất là thắng',
    how: 'Tia laser quét sát sàn từ tường hoặc xoay quanh tâm. Đường nét đứt là tia sắp bật! Nhảy đúng lúc để tia lướt qua dưới chân. Về cuối trận sàn thu nhỏ dần nên khó né hơn. Mỗi người 3 tim.',
    controls: { move: 'Chạy', jump: 'Nhảy qua tia' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Laser(api),
  });
})();
