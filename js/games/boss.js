'use strict';
/* Đánh Trùm (co-op) — cả nhóm cùng đặt bom hạ Trùm. Trùm đuổi, lao húc và dậm đất tạo sóng xung kích
   (nhảy lên để né). Bị trúng đòn thì bị nhốt trong bong bóng — đồng đội chạm vào để cứu.
   Cả nhóm bị nhốt hết hoặc hết giờ là thua. */
(() => {
  const AX = 50, AY = 120, AW = W - 100, AH = H - 120 - 20;
  const GAME_TIME = 100, BOMB_R = 95, FUSE = 1.5;
  const BOSS_C = { main: '#6b3fa0', dark: '#3b1f63', light: '#c9a6ff' };
  // BOS2: nhiều loại Trùm — mỗi loại có thêm một đòn riêng
  const KINDS = {
    classic: { name: 'Trùm Tím', c: BOSS_C, bar: '#c94fff', hp: 1 },
    fire: { name: 'Trùm Lửa', c: { main: '#e2512b', dark: '#8a2410', light: '#ffb36b' }, bar: '#ff6b3d', hp: 0.85 },
    ice: { name: 'Trùm Băng', c: { main: '#5fb8e8', dark: '#2a6b99', light: '#d8f3ff' }, bar: '#7fd6ff', hp: 1 },
    fly: { name: 'Trùm Bay', c: { main: '#3e9a6a', dark: '#1d5c3b', light: '#a8f0c4' }, bar: '#5dff9b', hp: 0.65 },
  };
  const MODES = [
    { id: 'classic', name: 'Trùm Tím', desc: 'Trùm gốc: lao húc và dậm đất tạo sóng.' },
    { id: 'fire', name: 'Trùm Lửa', desc: 'Đi tới đâu để lại vệt lửa (nhảy qua được), thỉnh thoảng phun vòng cầu lửa — nhảy hoặc né.' },
    { id: 'ice', name: 'Trùm Băng', desc: 'Sàn trơn trượt. Trùm gọi mưa băng rơi vào các vòng đánh dấu — chạy ra khỏi vòng!' },
    { id: 'fly', name: 'Trùm Bay', desc: 'Bay lơ lửng nên bom không trúng. Trùm bay vút lên rồi đáp xuống chỗ bóng đen — sau cú đáp sẽ mệt, mau đặt bom!' },
    { id: 'random', name: 'Ngẫu nhiên', desc: 'Gặp một Trùm bất kỳ.' },
  ];

  class Boss {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.finished = false; this.won = false; this.endMsg = '';
      this.kind = api.mode === 'random' || !KINDS[api.mode] ? U.pick(Object.keys(KINDS)) : api.mode;
      this.K = KINDS[this.kind];
      const hp = Math.round((140 + this.n * 70) * Math.max(0.55, api.len.time) * this.K.hp);
      this.boss = { x: W / 2, y: AY + 140, vx: 0, vy: 0, r: 64, hp, max: hp, state: 'chase', t: 2.5, target: 0,
        dir: 0, flash: 0, z: 0, face: Math.PI / 2 };
      // cân bằng theo số người (BOS1): ít người thì Trùm chậm hơn, nghỉ lâu hơn giữa các đòn,
      // và người bị nhốt tự thoát được (bấm Đánh liên tục để thoát nhanh hơn)
      const few = { 2: { spd: 0.82, rest: 1, free: 5 }, 3: { spd: 0.92, rest: 0.4, free: 8 } }[this.n] || { spd: 1, rest: 0, free: 0 };
      this.spd = few.spd; this.rest = few.rest; this.freeT = few.free;
      this.ps = this.P.map((p, i) => ({ x: AX + 120 + i * (AW - 240) / Math.max(1, this.n - 1), y: AY + AH - 80, vx: 0, vy: 0, r: 22,
        face: -Math.PI / 2, walk: 0, z: 0, vz: 0, bubble: false, bubT: 0, inv: 1, bombCd: 0, dmg: 0, saves: 0, squash: 0, skip: false }));
      this.bombs = []; this.waves = []; this.fires = []; this.balls = []; this.hail = []; this.trailT = 0;
    }

    aliveIdx() { return this.ps.map((p, i) => (!p.bubble ? i : -1)).filter((i) => i >= 0); }

    hitPlayer(p, i) {
      if (p.bubble || p.inv > 0) return;
      p.bubble = true; p.bubT = 0;
      Sfx.play('hurt'); FX.shake(6); Party.rumble(i);
      this.api.parts.text(p.x, p.y - 40, 'Cứu với!', '#9fd8ff', 26);
    }

    update(dt, inp) {
      const parts = this.api.parts, B = this.boss;
      if (this.finished) return;
      this.time -= dt;
      // người chơi
      this.ps.forEach((p, i) => {
        const q = inp[i];
        p.inv -= dt; p.bombCd -= dt; p.squash *= Math.pow(0.01, dt);
        if (p.bubble) {
          p.bubT += dt;
          if (this.freeT) {
            if (q.actP) p.bubT += 0.35;
            if (p.bubT >= this.freeT) {
              p.bubble = false; p.inv = 1.8; Sfx.play('pickup');
              parts.burst(p.x, p.y, ['#9fd8ff', '#fff'], 14, 200, 0.5, 5);
              parts.text(p.x, p.y - 40, 'Tự thoát!', this.P[i].color.light, 24);
            }
          }
          p.x += Math.sin(p.bubT * 2 + i) * 20 * dt; p.y += Math.cos(p.bubT * 1.6 + i) * 14 * dt;
          return;
        }
        if (q.mx || q.my) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        const k = Math.min(1, dt * (this.kind === 'ice' ? 4.5 : 12));
        p.vx += (q.mx * 260 - p.vx) * k; p.vy += (q.my * 260 - p.vy) * k;
        p.x = U.clamp(p.x + p.vx * dt, AX + p.r, AX + AW - p.r); p.y = U.clamp(p.y + p.vy * dt, AY + p.r, AY + AH - p.r);
        if (q.jumpP && p.z <= 0) { p.vz = 440; Sfx.play('jump', 0.03); }
        p.vz -= 1500 * dt; p.z = Math.max(0, p.z + p.vz * dt); if (p.z <= 0) p.vz = Math.max(0, p.vz);
        if (q.actP && p.bombCd <= 0) {
          p.bombCd = 1.1;
          this.bombs.push({ x: p.x, y: p.y, t: FUSE, owner: i });
          Sfx.play('place');
        }
        // cứu đồng đội
        this.ps.forEach((o, j) => {
          if (j !== i && o.bubble && Math.hypot(o.x - p.x, o.y - p.y) < p.r + 34) {
            o.bubble = false; o.inv = 1.8; p.saves++;
            Sfx.play('crown');
            parts.burst(o.x, o.y, ['#9fd8ff', '#fff'], 18, 220, 0.5, 5);
            parts.text(o.x, o.y - 40, `${this.P[i].name} cứu ${this.P[j].name}!`, this.P[i].color.light, 24);
          }
        });
      });
      this.ps.forEach((p) => { p.skip = p.bubble; });
      Phys.separate(this.ps, 0.4);

      // bom
      for (const b of this.bombs) {
        b.t -= dt;
        if (b.t <= 0) {
          b.dead = true;
          Sfx.play('boom', 0.05); FX.shake(6);
          parts.burst(b.x, b.y, ['#ff7a1a', '#ffe14d', '#fff'], 26, 300, 0.6, 7);
          if (Math.hypot(B.x - b.x, B.y - b.y) < BOMB_R + B.r * 0.7 && B.z < 40) {
            const dmg = 8;
            B.hp -= dmg; B.flash = 0.2; this.ps[b.owner].dmg += dmg;
            parts.text(B.x, B.y - B.r - 20, `−${dmg}`, '#ffe14d', 30);
            Sfx.play('hit');
          }
        }
      }
      this.bombs = this.bombs.filter((b) => !b.dead);

      // trùm
      B.flash -= dt; B.t -= dt;
      const alive = this.aliveIdx();
      if (!alive.includes(B.target) && alive.length) B.target = U.pick(alive);
      const tgt = this.ps[B.target];
      if (B.state === 'chase') {
        const dx = tgt.x - B.x, dy = tgt.y - B.y, d = Math.hypot(dx, dy) || 1;
        B.vx = dx / d * 105 * this.spd; B.vy = dy / d * 105 * this.spd; B.face = Math.atan2(dy, dx);
        if (B.t <= 0) {
          const opts = { classic: ['aim', 'jump'], fire: ['aim', 'jump', 'flame', 'flame'], ice: ['aim', 'jump', 'hail', 'hail'], fly: ['rise', 'aim'] }[this.kind];
          B.state = U.pick(opts); B.t = { aim: 0.8, jump: 0.6, flame: 0.8, hail: 0.6, rise: 0.6 }[B.state];
          if (B.state === 'aim') B.dir = Math.atan2(dy, dx);
          Sfx.play('warn');
        }
      } else if (B.state === 'aim') {
        B.vx = B.vy = 0;
        if (B.t <= 0) { B.state = 'charge'; B.t = 0.65; Sfx.play('dash'); }
      } else if (B.state === 'charge') {
        B.vx = Math.cos(B.dir) * 620 * this.spd; B.vy = Math.sin(B.dir) * 620 * this.spd;
        if (B.t <= 0) { B.state = 'chase'; B.t = U.rand(2, 3.2) + this.rest; B.target = alive.length ? U.pick(alive) : 0; }
      } else if (B.state === 'flame') {
        B.vx = B.vy = 0;
        if (B.t <= 0) {
          const k0 = Math.random() * TAU, N = this.n <= 2 ? 8 : 10;
          for (let k = 0; k < N; k++) { const a = k0 + k * TAU / N; this.balls.push({ x: B.x + Math.cos(a) * B.r, y: B.y + Math.sin(a) * B.r, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, t: 0 }); }
          Sfx.play('boom', 0.05); B.state = 'chase'; B.t = U.rand(2, 3) + this.rest;
        }
      } else if (B.state === 'hail') {
        B.vx = B.vy = 0;
        if (B.t <= 0) {
          alive.forEach((j) => this.hail.push({ x: this.ps[j].x, y: this.ps[j].y, t: 1.2 }));
          for (let k = 0; k < 1 + this.n; k++) this.hail.push({ x: U.rand(AX + 60, AX + AW - 60), y: U.rand(AY + 60, AY + AH - 60), t: U.rand(1.2, 1.8) });
          Sfx.play('warn'); B.state = 'chase'; B.t = U.rand(2.4, 3.2) + this.rest;
        }
      } else if (B.state === 'rise') {
        B.vx = B.vy = 0; B.z = Math.min(240, B.z + 380 * dt);
        if (B.t <= 0) { B.state = 'track'; B.t = 1.3; }
      } else if (B.state === 'track') {
        // bay theo bóng của người bị nhắm, đáp xuống khi hết giờ
        const dx = tgt.x - B.x, dy = tgt.y - B.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(d / dt, 330 * this.spd);
        B.vx = dx / d * sp; B.vy = dy / d * sp; B.z = 240;
        if (B.t <= 0) { B.state = 'slam'; B.t = 0.28; B.vx = B.vy = 0; }
      } else if (B.state === 'slam') {
        B.vx = B.vy = 0; B.z = 240 * Math.max(0, B.t / 0.28);
        if (B.t <= 0) {
          B.z = 0; B.state = 'rest'; B.t = 3.6 + this.rest;
          this.waves.push({ x: B.x, y: B.y, r: B.r, t: 0 });
          this.ps.forEach((p, i) => { if (Math.hypot(p.x - B.x, p.y - B.y) < B.r + p.r) this.hitPlayer(p, i); });
          Sfx.play('boom'); FX.shake(14);
        }
      } else if (B.state === 'rest') {
        B.vx = B.vy = 0; B.z = 0;
        if (B.t <= 0) { B.state = 'chase'; B.t = U.rand(1.6, 2.4); }
      } else if (B.state === 'jump') {
        B.vx = B.vy = 0; B.z = Math.sin((1 - B.t / 0.6) * Math.PI) * 120;
        if (B.t <= 0) {
          B.z = 0; B.state = 'chase'; B.t = U.rand(2, 3) + this.rest;
          this.waves.push({ x: B.x, y: B.y, r: B.r, t: 0 });
          Sfx.play('boom'); FX.shake(12);
        }
      }
      // Trùm Bay: lơ lửng khi đi đuổi (bom không trúng), hạ thấp khi chuẩn bị lao húc
      if (this.kind === 'fly') {
        if (B.state === 'chase') B.z += (70 - B.z) * Math.min(1, dt * 3);
        else if (B.state === 'aim' || B.state === 'charge') B.z += (0 - B.z) * Math.min(1, dt * 8);
      }
      B.x += B.vx * dt; B.y += B.vy * dt;
      // Trùm Lửa: để lại vệt lửa
      if (this.kind === 'fire' && (B.state === 'chase' || B.state === 'charge')) {
        this.trailT -= dt;
        if (this.trailT <= 0) { this.trailT = B.state === 'charge' ? 0.07 : 0.3; this.fires.push({ x: B.x - Math.cos(B.face) * B.r * 0.6, y: B.y - Math.sin(B.face) * B.r * 0.6 + B.r * 0.4, t: 2.1 }); }
      }
      for (const f of this.fires) {
        f.t -= dt;
        this.ps.forEach((p, i) => { if (f.t > 0.3 && f.t < 1.95 && p.z < 12 && Math.hypot(p.x - f.x, p.y - f.y) < p.r + 12) this.hitPlayer(p, i); });
      }
      this.fires = this.fires.filter((f) => f.t > 0);
      for (const b of this.balls) {
        b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
        this.ps.forEach((p, i) => { if (!b.dead && p.z < 20 && !p.bubble && p.inv <= 0 && Math.hypot(p.x - b.x, p.y - b.y) < p.r + 12) { b.dead = true; this.hitPlayer(p, i); } });
        if (b.x < AX || b.x > AX + AW || b.y < AY || b.y > AY + AH) b.dead = true;
      }
      this.balls = this.balls.filter((b) => !b.dead);
      for (const h of this.hail) {
        h.t -= dt;
        if (h.t <= 0 && !h.done) {
          h.done = true; FX.shake(4); Sfx.play('crash', 0.05);
          parts.burst(h.x, h.y, ['#d8f3ff', '#ffffff', '#7fd6ff'], 16, 240, 0.5, 5);
          this.ps.forEach((p, i) => { if (Math.hypot(p.x - h.x, p.y - h.y) < 48 + p.r * 0.5) this.hitPlayer(p, i); });
        }
      }
      this.hail = this.hail.filter((h) => h.t > -0.3);
      if (B.x < AX + B.r || B.x > AX + AW - B.r) { B.x = U.clamp(B.x, AX + B.r, AX + AW - B.r); if (B.state === 'charge') { B.t = 0; FX.shake(8); } }
      if (B.y < AY + B.r || B.y > AY + AH - B.r) { B.y = U.clamp(B.y, AY + B.r, AY + AH - B.r); if (B.state === 'charge') { B.t = 0; FX.shake(8); } }
      // chỉ cú lao húc mới nhốt người; đi bộ chạm vào thì chỉ bị đẩy ra
      if (B.z < 30 && B.state !== 'slam') this.ps.forEach((p, i) => {
        if (p.bubble || p.z >= 30) return;
        const dx = p.x - B.x, dy = p.y - B.y, d = Math.hypot(dx, dy) || 1;
        if (d < B.r + p.r - 8) {
          if (B.state === 'charge') this.hitPlayer(p, i);
          else { p.x = B.x + dx / d * (B.r + p.r - 6); p.y = B.y + dy / d * (B.r + p.r - 6); p.vx += dx / d * 300; p.vy += dy / d * 300; }
        }
      });
      // sóng xung kích
      for (const w of this.waves) {
        const prev = w.r; w.t += dt; w.r = B.r + w.t * 330;
        this.ps.forEach((p, i) => {
          const d = Math.hypot(p.x - w.x, p.y - w.y);
          if (d >= prev - 6 && d <= w.r + 6 && p.z < 18) this.hitPlayer(p, i);
        });
      }
      this.waves = this.waves.filter((w) => w.t < 0.75);

      // kết thúc
      if (B.hp <= 0) {
        B.hp = 0; this.finished = true; this.won = true; this.endMsg = 'Hạ được Trùm!';
        Sfx.play('goal'); FX.shake(14);
        parts.burst(B.x, B.y, ['#c9a6ff', '#ffe14d', '#fff', '#ff7a1a'], 80, 520, 1.2, 9);
      } else if (!this.aliveIdx().length) { this.finished = true; this.endMsg = 'Cả nhóm bị nhốt hết…'; }
      else if (this.time <= 0) { this.time = 0; this.finished = true; this.endMsg = 'Hết giờ!'; }
    }

    draw(ctx) {
      const t = U.now(), B = this.boss;
      ctx.fillStyle = '#241838'; ctx.fillRect(0, 0, W, H);
      Draw.rr(ctx, AX, AY, AW, AH, 24); ctx.fillStyle = '#4a3a6e'; ctx.fill();
      ctx.save(); Draw.rr(ctx, AX, AY, AW, AH, 24); ctx.clip();
      ctx.fillStyle = '#54437a';
      for (let x = AX; x < AX + AW; x += 64) for (let y = AY; y < AY + AH; y += 64) if (((x - AX) / 64 + (y - AY) / 64) % 2 === 0) ctx.fillRect(x, y, 64, 64);
      ctx.restore();
      // sóng
      for (const w of this.waves) {
        ctx.strokeStyle = `rgba(255,180,90,${1 - w.t / 0.75})`; ctx.lineWidth = 12;
        ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke();
      }
      // vệt lửa, mưa băng, bóng đáp của Trùm Bay
      for (const f of this.fires) {
        const a = Math.min(1, f.t / 0.5), s = 0.8 + Math.sin(t * 18 + f.x) * 0.15;
        ctx.fillStyle = `rgba(255,120,40,${0.55 * a})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, 16 * s, 10 * s, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,220,90,${0.8 * a})`; ctx.beginPath(); ctx.ellipse(f.x, f.y - 3, 7 * s, 9 * s, 0, 0, TAU); ctx.fill();
      }
      for (const h of this.hail) {
        if (h.done) { ctx.fillStyle = 'rgba(220,245,255,0.5)'; ctx.beginPath(); ctx.arc(h.x, h.y, 48, 0, TAU); ctx.fill(); continue; }
        ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc(h.x, h.y, 48, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(160,220,255,0.25)'; ctx.beginPath(); ctx.arc(h.x, h.y, 48 * (1 - Math.min(1, h.t / 1.2)), 0, TAU); ctx.fill();
        const fy = h.y - h.t * 300; // cục băng đang rơi
        ctx.fillStyle = '#e8f8ff'; ctx.strokeStyle = '#7fb8d8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(h.x, fy + 16); ctx.lineTo(h.x - 9, fy - 10); ctx.lineTo(h.x + 9, fy - 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (this.kind === 'fly' && (B.state === 'track' || B.state === 'slam' || B.state === 'rise')) {
        ctx.fillStyle = `rgba(0,0,0,${0.25 + 0.2 * Math.sin(t * 20)})`; ctx.beginPath(); ctx.ellipse(B.x, B.y + B.r * 0.4, B.r + 10, (B.r + 10) * 0.45, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,60,80,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(B.x, B.y, B.r + 14, 0, TAU); ctx.stroke();
      }
      // vạch báo lao húc
      if (B.state === 'aim') {
        ctx.strokeStyle = `rgba(255,60,80,${0.4 + 0.4 * Math.sin(t * 25)})`; ctx.lineWidth = B.r * 1.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(B.x + Math.cos(B.dir) * 420, B.y + Math.sin(B.dir) * 420); ctx.stroke();
        ctx.lineCap = 'butt';
      }
      if (B.state === 'flame') {
        ctx.fillStyle = `rgba(255,120,40,${0.2 + 0.2 * Math.sin(t * 30)})`; ctx.beginPath(); ctx.arc(B.x, B.y, B.r + 26, 0, TAU); ctx.fill();
      }
      if (B.state === 'jump') {
        ctx.strokeStyle = 'rgba(255,180,90,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
        ctx.beginPath(); ctx.arc(B.x, B.y, B.r + 30, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      // bom
      for (const b of this.bombs) {
        const s = 1 + Math.sin((FUSE - b.t) * 20) * 0.08;
        ctx.strokeStyle = 'rgba(255,120,60,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x, b.y, BOMB_R, 0, TAU); ctx.stroke();
        ctx.save(); ctx.translate(b.x, b.y); ctx.scale(s, s);
        ctx.fillStyle = b.t < 0.4 && Math.sin(t * 40) > 0 ? '#e83a5c' : '#22222e';
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
        ctx.strokeStyle = this.P[b.owner].color.main; ctx.lineWidth = 3; ctx.stroke();
        Draw.sparkle(ctx, 8, -16, 5 + Math.random() * 3, '#ffe14d');
        ctx.restore();
      }
      // vật thể theo chiều sâu
      const items = this.ps.map((p, i) => ({ y: p.y, i })).concat([{ y: B.y, i: -1 }]).sort((a, b) => a.y - b.y);
      for (const it of items) {
        if (it.i < 0) {
          if (this.kind === 'fly') {
            // đôi cánh vỗ
            const fl = Math.sin(t * (B.z > 20 ? 18 : 4)) * 0.5;
            ctx.fillStyle = this.K.c.light; ctx.strokeStyle = this.K.c.dark; ctx.lineWidth = 3;
            for (const sd of [-1, 1]) {
              ctx.save(); ctx.translate(B.x + sd * B.r * 0.7, B.y - B.z - B.r * 0.3); ctx.rotate(sd * (0.5 + fl));
              ctx.beginPath(); ctx.ellipse(sd * 34, 0, 40, 18, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
            }
          }
          Draw.blob(ctx, { x: B.x, y: B.y, z: B.z, r: B.r, color: B.flash > 0 ? { main: '#fff', dark: '#ccc', light: '#fff' } : this.K.c,
            face: B.face, crown: true, squash: B.state === 'aim' || B.state === 'flame' ? 0.08 * Math.sin(t * 30) : 0, stun: B.state === 'rest' });
          if (this.kind === 'fire' && Math.random() < 0.5) this.api.parts.burst(B.x + U.rand(-30, 30), B.y - B.z - B.r * 0.8, ['#ffb36b', '#ffe14d'], 1, 60, 0.4, 4);
          // lông mày giận
          ctx.strokeStyle = '#1d1230'; ctx.lineWidth = 6;
          for (const s of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(B.x + s * 34, B.y - B.z - 34); ctx.lineTo(B.x + s * 8, B.y - B.z - 24); ctx.stroke();
          }
          continue;
        }
        const p = this.ps[it.i], c = this.P[it.i].color;
        if (p.bubble) {
          Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: c, stun: true, alpha: 0.8 });
          ctx.fillStyle = 'rgba(160,220,255,0.3)'; ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x, p.y - 4, p.r + 14 + Math.sin(t * 4) * 2, 0, TAU); ctx.fill(); ctx.stroke();
          if (this.freeT) {
            ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(p.x, p.y - 4, p.r + 20, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, p.bubT / this.freeT)); ctx.stroke();
            if (!this.P[it.i].bot) Draw.text(ctx, 'Bấm Đánh!', p.x, p.y - p.r - 34, { size: 16, color: '#ffe14d', sw: 4 });
          }
          continue;
        }
        const blink = p.inv > 0 && Math.sin(t * 30) > 0;
        Draw.blob(ctx, { x: p.x, y: p.y, z: p.z, r: p.r, color: c, face: p.face, walk: p.walk, alpha: blink ? 0.5 : 1 });
      }
      for (const b of this.balls) {
        ctx.fillStyle = 'rgba(255,120,40,0.4)'; ctx.beginPath(); ctx.arc(b.x - b.vx * 0.03, b.y - b.vy * 0.03, 14, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd04d'; ctx.beginPath(); ctx.arc(b.x, b.y, 10, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#e2512b'; ctx.lineWidth = 3; ctx.stroke();
      }
      if (this.kind === 'fly' && B.state === 'rest') Draw.text(ctx, 'Mệt rồi! Đặt bom!', B.x, B.y - B.r - 30, { size: 20, color: '#ffe14d', sw: 4 });
      // thanh máu Trùm
      Draw.rr(ctx, W / 2 - 300, 84, 600, 22, 11); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
      Draw.rr(ctx, W / 2 - 300, 84, 600 * B.hp / B.max, 22, 11); ctx.fillStyle = this.K.bar; ctx.fill();
      Draw.text(ctx, `${this.K.name.toUpperCase()}  ${B.hp}/${B.max}`, W / 2, 96, { size: 18, sw: 4 });
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.bubble ? '🫧' : `💥${p.dmg}`)));
      Draw.timer(ctx, this.time, W - 72, 38);
      if (this.finished && this.endMsg) Draw.banner(ctx, this.endMsg, 0.5, { color: this.won ? '#5dff9b' : '#ff8fa8', size: 60, y: H / 2 - 120 });
    }

    resultTitle() { return this.won ? `🎉 Cả nhóm hạ được ${this.K.name}!` : `💀 ${this.K.name} thắng rồi…`; }

    results() {
      return this.ps.map((p) => ({
        score: (this.won ? 1000 : 0) + p.dmg + p.saves * 5,
        text: `${this.won ? '🏆 Thắng Trùm' : '💀 Thua'} · gây ${p.dmg} sát thương · cứu ${p.saves} lần`,
      }));
    }

    botInput(i) {
      const p = this.ps[i], B = this.boss;
      const o = { mx: 0, my: 0, actP: false, jumpP: false };
      if (p.bubble) { o.actP = this.freeT > 0 && Math.random() < 0.25; return o; }
      // nhảy né sóng xung kích
      for (const w of this.waves) {
        const d = Math.hypot(p.x - w.x, p.y - w.y);
        if (d - w.r > 0 && d - w.r < 45 && p.z <= 0) o.jumpP = true;
      }
      const db = Math.hypot(B.x - p.x, B.y - p.y) || 1;
      // cầu lửa bay tới: nhảy qua
      for (const b of this.balls) {
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy);
        if (d < 70 && dx * b.vx + dy * b.vy > 0 && p.z <= 0) o.jumpP = true;
      }
      // tránh vòng mưa băng / bóng đáp của Trùm Bay / vệt lửa
      const flee = [];
      for (const h of this.hail) if (!h.done) flee.push([h.x, h.y, 48 + p.r + 16]);
      if (this.kind === 'fly' && (B.state === 'track' || B.state === 'slam')) flee.push([B.x, B.y, B.r + p.r + 70]);
      for (const f of this.fires) if (f.t > 0.2) flee.push([f.x, f.y, p.r + 24]);
      let fx = 0, fy = 0;
      for (const [x, y, r] of flee) { const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1; if (d < r) { fx += dx / d * (r - d) / r; fy += dy / d * (r - d) / r; } }
      if (fx || fy) {
        const m = Math.hypot(fx, fy); o.mx = fx / m; o.my = fy / m;
        if (p.x < AX + 60) o.mx += 0.8; if (p.x > AX + AW - 60) o.mx -= 0.8;
        if (p.y < AY + 60) o.my += 0.8; if (p.y > AY + AH - 60) o.my -= 0.8;
        if (this.kind === 'fire' && this.fires.some((f) => Math.hypot(p.x - f.x, p.y - f.y) < p.r + 18) && p.z <= 0) o.jumpP = true;
        return o;
      }
      // Trùm sắp đáp đất ngay cạnh: nhảy sẵn vì sóng sinh ra sát người
      if (B.state === 'jump' && B.t < 0.1 && db < B.r + 70 && p.z <= 0) o.jumpP = true;
      // né đường lao húc
      if (B.state === 'aim' || B.state === 'charge') {
        const ax = Math.cos(B.dir), ay = Math.sin(B.dir);
        const rx = p.x - B.x, ry = p.y - B.y, along = rx * ax + ry * ay, perp = -rx * ay + ry * ax;
        if (along > -40 && Math.abs(perp) < B.r + 60) {
          // chọn bên né không bị tường chặn
          let s = perp >= 0 ? 1 : -1;
          const room = (k) => { const tx = p.x - ay * k * 140, ty = p.y + ax * k * 140; return tx > AX + 30 && tx < AX + AW - 30 && ty > AY + 30 && ty < AY + AH - 30; };
          if (!room(s) && room(-s) && Math.abs(perp) < B.r) s = -s;
          o.mx = -ay * s; o.my = ax * s;
          if (!room(s) && !room(-s)) { o.mx = -ax; o.my = -ay; }
          return o;
        }
      }
      // cứu đồng đội gần
      const bub = this.ps.find((q) => q.bubble && Math.hypot(q.x - p.x, q.y - p.y) < 400);
      if (bub && Math.hypot(bub.x - B.x, bub.y - B.y) > B.r + 60) {
        const dx = bub.x - p.x, dy = bub.y - p.y, d = Math.hypot(dx, dy) || 1;
        o.mx = dx / d; o.my = dy / d; return o;
      }
      // giữ khoảng cách vừa tầm bom, đặt bom khi trùm ở gần
      const want = B.state === 'rest' ? 70 : B.target === i ? 200 : 120; // Trùm Bay đang mệt: lao vào đặt bom
      if (db > want + 20) { o.mx = (B.x - p.x) / db; o.my = (B.y - p.y) / db; }
      else if (db < want - 20) { o.mx = -(B.x - p.x) / db; o.my = -(B.y - p.y) / db; }
      else { o.mx = -(B.y - p.y) / db; o.my = (B.x - p.x) / db; }
      // tránh kẹt góc
      if (p.x < AX + 60) o.mx += 0.8; if (p.x > AX + AW - 60) o.mx -= 0.8;
      if (p.y < AY + 60) o.my += 0.8; if (p.y > AY + AH - 60) o.my -= 0.8;
      const lead = B.state === 'chase' ? 0.6 : 0;
      if (this.kind === 'fly' && B.z > 40 && B.state !== 'slam') return o; // Trùm đang bay: đặt bom phí
      if (Math.hypot(B.x + B.vx * lead - p.x, B.y + B.vy * lead - p.y) < BOMB_R + B.r * 0.4 && p.bombCd <= 0 && Math.random() < 0.2) o.actP = true;
      return o;
    }
  }

  Party.register({
    id: 'boss', name: 'Đánh Trùm', emoji: '👹', cat: 'team', coop: true,
    tagline: 'Cả nhóm cùng đặt bom hạ Trùm · Trùm Tím, Lửa, Băng, Bay · chạm bong bóng để cứu đồng đội',
    how: 'Cả nhóm cùng phe! Đặt bom (nút Đánh) gần Trùm để gây sát thương. Né vạch đỏ khi Trùm sắp lao húc (bị húc trúng là bị nhốt), nhảy (nút Nhảy) qua sóng xung kích khi Trùm dậm đất. Ai bị trúng sẽ bị nhốt trong bong bóng — chạm vào để cứu. Khi chơi ít người, người bị nhốt tự thoát sau vài giây (bấm Đánh liên tục để thoát nhanh hơn).',
    controls: { move: 'Di chuyển', act: 'Đặt bom', jump: 'Nhảy né sóng' },
    modes: MODES,
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Boss(api),
  });
})();
