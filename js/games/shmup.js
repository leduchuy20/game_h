'use strict';
/* Máy Bay Bắn Địch — máy bay tự bắn, lái để hạ địch. Giữa trận có Tàu Bay Trùm.
   Trúng đạn địch thì máy bay tê liệt 1,5 giây và mất điểm. Nhiều điểm nhất thắng. */
(() => {
  const TOP = 76, GAME_TIME = 60, BOSS_AT = 32;

  class Shmup {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.bossAt = api.T(BOSS_AT); this.elapsed = 0; this.finished = false;
      this.ps = this.P.map((p, i) => ({ x: W * (i + 1) / (this.n + 1), y: H - 110, vx: 0, vy: 0, score: 0, fireT: 0, hitT: 0, inv: 0, kills: 0, tilt: 0 }));
      this.shots = []; this.enemies = []; this.ebullets = [];
      this.spawnT = 1; this.boss = null; this.bossDone = false;
      this.stars = Array.from({ length: 90 }, () => [Math.random() * W, Math.random() * H, U.rand(40, 160)]);
    }

    spawnEnemy() {
      const big = Math.random() < 0.22;
      const x = U.rand(80, W - 80);
      this.enemies.push(big
        ? { kind: 'mid', x, y: TOP - 30, hp: 5, max: 5, r: 30, vy: 70, t: 0, fire: U.rand(1, 2), pts: 30, x0: x }
        : { kind: 'small', x, y: TOP - 20, hp: 1, max: 1, r: 18, vy: U.rand(120, 170), t: U.rand(0, 6), fire: 99, pts: 10, x0: x, amp: U.rand(40, 120) });
    }

    award(i, pts, x, y) {
      const p = this.ps[i];
      p.score += pts;
      this.api.parts.text(x, y, `+${pts}`, this.P[i].color.light, 22);
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) { this.time -= dt; this.elapsed += dt; if (this.time <= 0) { this.time = 0; this.finished = true; } }
      for (const s of this.stars) { s[1] += s[2] * dt; if (s[1] > H) { s[1] = 0; s[0] = Math.random() * W; } }
      // người chơi
      this.ps.forEach((p, i) => {
        const q = inp[i];
        p.hitT -= dt; p.inv -= dt; p.fireT -= dt;
        const sp = p.hitT > 0 ? 120 : 360, k = Math.min(1, dt * 12);
        p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        p.x = U.clamp(p.x + p.vx * dt, 30, W - 30); p.y = U.clamp(p.y + p.vy * dt, H * 0.42, H - 40);
        p.tilt = U.clamp(p.vx / 900, -0.35, 0.35);
        if (p.hitT <= 0 && p.fireT <= 0 && !this.finished) {
          p.fireT = 0.17;
          this.shots.push({ x: p.x - 9, y: p.y - 24, owner: i }, { x: p.x + 9, y: p.y - 24, owner: i });
          Sfx.play('tick', 0.12);
        }
      });
      // địch
      if (!this.finished) {
        this.spawnT -= dt;
        const busy = this.boss ? 2.2 : Math.max(0.45, 1.1 - this.elapsed * 0.012);
        if (this.spawnT <= 0) { this.spawnEnemy(); this.spawnT = busy; }
        if (!this.boss && !this.bossDone && this.elapsed >= this.bossAt) {
          const bhp = Math.round((70 + this.n * 25) * Math.max(0.6, this.api.len.time));
          this.boss = { x: W / 2, y: TOP - 120, hp: bhp, max: bhp, r: 80, t: 0, fire: 2, enter: true };
          Sfx.play('warn');
          parts.text(W / 2, H / 2 - 60, '⚠ Tàu Bay Trùm xuất hiện!', '#ff7a7a', 44);
        }
      }
      const aimAt = (x, y, sp) => {
        const alive = this.ps.filter((p) => p.hitT <= 0);
        const tg = alive.length ? U.pick(alive) : this.ps[0];
        const a = Math.atan2(tg.y - y, tg.x - x);
        this.ebullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
      };
      for (const e of this.enemies) {
        e.t += dt; e.y += e.vy * dt;
        if (e.kind === 'small') e.x = e.x0 + Math.sin(e.t * 2) * e.amp;
        else if (e.y > 170) e.vy = 20;
        e.fire -= dt;
        if (e.kind === 'mid' && e.fire <= 0 && e.y > TOP && !this.finished) { e.fire = U.rand(1.4, 2.2); aimAt(e.x, e.y + 20, 260); }
      }
      this.enemies = this.enemies.filter((e) => e.y < H + 60 && e.hp > 0);
      const b = this.boss;
      if (b) {
        b.t += dt;
        if (b.enter) { b.y += 80 * dt; if (b.y >= 190) b.enter = false; }
        else b.x = W / 2 + Math.sin(b.t * 0.7) * 360;
        b.fire -= dt;
        if (b.fire <= 0 && !b.enter && !this.finished) {
          b.fire = 1.5;
          const kind = Math.floor(b.t) % 2;
          if (kind === 0) for (let k = -3; k <= 3; k++) { const a = Math.PI / 2 + k * 0.22; this.ebullets.push({ x: b.x, y: b.y + 50, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230 }); }
          else { aimAt(b.x - 50, b.y + 40, 300); aimAt(b.x + 50, b.y + 40, 300); }
        }
      }
      // đạn người chơi
      for (const s of this.shots) {
        s.y -= 780 * dt;
        for (const e of this.enemies) {
          if (e.hp > 0 && Math.abs(s.x - e.x) < e.r && Math.abs(s.y - e.y) < e.r) {
            s.dead = true; e.hp--;
            if (e.hp <= 0) {
              this.award(s.owner, e.pts, e.x, e.y); this.ps[s.owner].kills++;
              Sfx.play('boom', 0.05); parts.burst(e.x, e.y, ['#ffb12e', '#ff5a2e', '#fff'], e.kind === 'mid' ? 26 : 14, 260, 0.6, 6);
            }
            break;
          }
        }
        if (!s.dead && b && !b.enter && Math.abs(s.x - b.x) < 110 && Math.abs(s.y - b.y) < 50) {
          s.dead = true; b.hp--; this.ps[s.owner].score += 2;
          if (Math.random() < 0.3) parts.burst(s.x, s.y, ['#fff', '#ffe14d'], 3, 100, 0.25, 3);
          if (b.hp <= 0) {
            this.award(s.owner, 100, b.x, b.y - 60);
            Sfx.play('goal'); FX.shake(14);
            parts.burst(b.x, b.y, ['#ffb12e', '#ff5a2e', '#fff', '#ffe14d'], 80, 520, 1.2, 9);
            parts.text(b.x, b.y, `${this.P[s.owner].name} hạ Tàu Trùm!`, this.P[s.owner].color.light, 36);
            this.boss = null; this.bossDone = true;
          }
        }
      }
      this.shots = this.shots.filter((s) => !s.dead && s.y > TOP - 20);
      // đạn địch
      for (const eb of this.ebullets) {
        eb.x += eb.vx * dt; eb.y += eb.vy * dt;
        for (let i = 0; i < this.n; i++) {
          const p = this.ps[i];
          if (p.inv > 0 || p.hitT > 0) continue;
          if (Math.hypot(eb.x - p.x, eb.y - p.y) < 16) {
            eb.dead = true; p.hitT = 1.5; p.inv = 2.6;
            const lost = Math.min(p.score, 20); p.score -= lost;
            Sfx.play('hurt'); FX.shake(5); Party.rumble(i);
            parts.burst(p.x, p.y, ['#ff5a2e', '#fff', this.P[i].color.main], 16, 220, 0.5, 5);
            if (lost) parts.text(p.x, p.y - 30, `−${lost}`, '#ff8fa8', 24);
            break;
          }
        }
      }
      // đâm vào địch cũng bị tê liệt
      for (const e of this.enemies) for (const p of this.ps) {
        if (p.inv <= 0 && p.hitT <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 14) { p.hitT = 1.5; p.inv = 2.6; e.hp = 0; Sfx.play('crash'); }
      }
      this.ebullets = this.ebullets.filter((eb) => !eb.dead && eb.y < H + 20 && eb.y > TOP - 40 && eb.x > -20 && eb.x < W + 20);
    }

    drawPlane(ctx, x, y, c, tilt, alpha) {
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(tilt);
      ctx.fillStyle = c.dark;
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(34, 10); ctx.lineTo(34, 16); ctx.lineTo(0, 10); ctx.lineTo(-34, 16); ctx.lineTo(-34, 10); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(14, 26); ctx.lineTo(-14, 26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.main; Draw.rr(ctx, -9, -28, 18, 54, 9); ctx.fill();
      ctx.fillStyle = '#ffb12e';
      ctx.beginPath(); ctx.moveTo(-5, 26); ctx.lineTo(0, 36 + Math.random() * 8); ctx.lineTo(5, 26); ctx.fill();
      ctx.restore();
      Draw.blob(ctx, { x, y: y - 6, r: 10, color: c, face: -Math.PI / 2, shadow: false, alpha });
    }

    draw(ctx) {
      ctx.fillStyle = '#0a0f2c'; ctx.fillRect(0, 0, W, H);
      for (const [x, y, s] of this.stars) { ctx.fillStyle = `rgba(255,255,255,${s / 200})`; ctx.fillRect(x, y, s > 120 ? 3 : 2, s > 120 ? 3 : 2); }
      for (const s of this.shots) { ctx.fillStyle = this.P[s.owner].color.light; ctx.fillRect(s.x - 2, s.y - 8, 4, 14); }
      for (const e of this.enemies) {
        ctx.save(); ctx.translate(e.x, e.y);
        if (e.kind === 'small') {
          ctx.fillStyle = '#9b5cff';
          ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(18, -10); ctx.lineTo(0, -4); ctx.lineTo(-18, -10); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(0, 2, 5, 0, TAU); ctx.fill();
        } else {
          ctx.fillStyle = '#e8384f'; Draw.rr(ctx, -30, -20, 60, 40, 12); ctx.fill();
          ctx.fillStyle = '#7a1a2a'; ctx.fillRect(-42, -6, 84, 12);
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
          ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 2, 4, 0, TAU); ctx.fill();
          ctx.fillStyle = '#5dff9b'; ctx.fillRect(-26, -30, 52 * e.hp / e.max, 5);
        }
        ctx.restore();
      }
      const b = this.boss;
      if (b) {
        ctx.save(); ctx.translate(b.x, b.y);
        ctx.fillStyle = '#5b5e78'; Draw.rr(ctx, -120, -40, 240, 80, 30); ctx.fill();
        ctx.fillStyle = '#8d90ad'; Draw.rr(ctx, -100, -30, 200, 40, 18); ctx.fill();
        ctx.fillStyle = '#e8384f';
        for (const k of [-60, 0, 60]) { ctx.beginPath(); ctx.arc(k, 38, 12, 0, TAU); ctx.fill(); }
        for (const s of [-1, 1]) {
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(s * 30, -10, 16, 13, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#e8384f'; ctx.beginPath(); ctx.arc(s * 30, -6, 7, 0, TAU); ctx.fill();
        }
        ctx.restore();
        Draw.rr(ctx, W / 2 - 250, 90, 500, 16, 8); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
        Draw.rr(ctx, W / 2 - 250, 90, 500 * b.hp / b.max, 16, 8); ctx.fillStyle = '#ff3b52'; ctx.fill();
        Draw.text(ctx, 'TÀU BAY TRÙM', W / 2, 118, { size: 18, color: '#ffb0b8', sw: 4, base: 'top' });
      }
      for (const eb of this.ebullets) {
        ctx.fillStyle = '#ff5a6e'; ctx.beginPath(); ctx.arc(eb.x, eb.y, 7, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eb.x, eb.y, 3, 0, TAU); ctx.fill();
      }
      this.ps.forEach((p, i) => {
        const blink = p.inv > 0 && Math.sin(U.now() * 30) > 0;
        this.drawPlane(ctx, p.x, p.y, this.P[i].color, p.tilt, p.hitT > 0 ? 0.4 : blink ? 0.6 : 1);
        if (p.hitT > 0) Draw.text(ctx, '⚡', p.x, p.y - 40, { size: 24, stroke: null });
      });
      const lead = this.ps.reduce((bi, p, i, a) => (p.score > a[bi].score ? i : bi), 0);
      Draw.chips(ctx, this.P, this.ps.map((p) => p.score), { crown: this.ps[lead].score > 0 ? lead : -1 });
      Draw.timer(ctx, this.time, W - 72, 38);
    }

    results() { return this.ps.map((p) => ({ score: p.score, text: `${p.score} điểm · hạ ${p.kills} địch` })); }

    botInput(i) {
      const p = this.ps[i];
      const o = { mx: 0, my: 0 };
      // né đạn gần
      for (const eb of this.ebullets) {
        const dx = p.x - eb.x, dy = p.y - eb.y;
        if (dy > -10 && dy < 130 && Math.abs(dx) < 34 && eb.vy > 0) { o.mx = dx >= 0 ? 1 : -1; o.my = 0.3; return o; }
      }
      let tx = null, best = Infinity;
      const targets = this.enemies.filter((e) => e.y > TOP && e.y < p.y - 60);
      if (this.boss && !this.boss.enter) targets.push({ x: this.boss.x, y: this.boss.y, r: 100 });
      for (const e of targets) {
        const d = Math.abs(e.x - p.x) + (p.y - e.y) * 0.2;
        if (d < best) { best = d; tx = e.x; }
      }
      if (tx !== null && Math.abs(tx - p.x) > 8) o.mx = U.clamp((tx - p.x) / 60, -1, 1);
      o.my = U.clamp((H - 120 - p.y) / 60, -1, 1);
      // không đâm vào địch
      for (const e of this.enemies) if (Math.abs(e.x - p.x) < e.r + 30 && e.y > p.y - 120 && e.y < p.y + 20) { o.my = 1; o.mx = e.x > p.x ? -1 : 1; }
      return o;
    }
  }

  Party.register({
    id: 'shmup', name: 'Máy Bay Bắn Địch', emoji: '✈️', cat: 'fight',
    tagline: 'Máy bay tự bắn, lái để hạ địch và Tàu Bay Trùm · nhiều điểm nhất thắng',
    how: 'Máy bay tự động bắn — bạn chỉ cần lái. Hạ địch nhỏ +10, địch đỏ +30, mỗi phát trúng Tàu Bay Trùm +2, phát hạ Trùm +100. Trúng đạn địch thì tê liệt 1,5 giây và mất tối đa 20 điểm.',
    controls: { move: 'Lái máy bay 8 hướng' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Shmup(api),
  });
})();
