'use strict';
/* Chia Hay Cướp (NEW8) — tranh rương giữa sân. Một mình thì giữ Đánh để mở rương.
   Hai người cùng chạm một rương → 3 giây bí mật chọn: Đánh = Chia, Nhảy = Cướp (đổi ý thoải mái, chỉ tính lần bấm cuối).
   Chia–Chia: mỗi người +50 · Cướp–Chia: người cướp +100 · Cướp–Cướp: cả hai −30. */
(() => {
  const AX = 50, AY = 84, AW = W - 100, AH = H - 84 - 24;
  const CX = AX + AW / 2, CY = AY + AH / 2;
  const GAME_TIME = 60, CHOOSE_T = 3, REVEAL_T = 1.8, OPEN_T = 1.4, SOLO = 30;
  const PAY = { ss: [50, 50], ts: [100, 0], tt: [-30, -30] };
  const SPAWN = [[AX + 90, AY + 90], [AX + AW - 90, AY + AH - 90], [AX + AW - 90, AY + 90], [AX + 90, AY + AH - 90]];

  class Split {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.finished = false; this.elapsed = 0;
      this.ps = this.P.map((p, i) => ({
        x: SPAWN[i][0], y: SPAWN[i][1], vx: 0, vy: 0, r: 24, face: 0, walk: 0, coins: 0,
        stun: 0, dashT: 0, dashCd: 0, duel: null, open: 0, skip: false,
        hist: {}, // hist[j] = lần cuối người j chọn gì khi đấu với mình ('s' | 't')
        stats: { s: 0, t: 0 },
      }));
      this.chests = []; this.duels = []; this.spawnT = 0.5;
      for (let k = 0; k < Math.min(3, this.n); k++) this.addChest();
    }

    addChest() {
      for (let tries = 0; tries < 40; tries++) {
        const x = U.rand(AX + 80, AX + AW - 80), y = U.rand(AY + 80, AY + AH - 60);
        if (this.chests.some((c) => Math.hypot(c.x - x, c.y - y) < 180)) continue;
        if (this.ps.some((p) => Math.hypot(p.x - x, p.y - y) < 120)) continue;
        const gold = Math.random() < 0.2;
        this.chests.push({ x, y, gold, born: 0, duel: null, opener: -1 });
        return;
      }
    }

    startDuel(c, a, b) {
      const d = { c, a, b, t: CHOOSE_T, pick: { [a]: 's', [b]: 's' }, presses: 0, reveal: -1, mul: c.gold ? 2 : 1 };
      c.duel = d; c.opener = -1;
      [a, b].forEach((i) => { const p = this.ps[i]; p.duel = d; p.open = 0; p.vx = p.vy = 0; });
      // hai người đứng hai bên rương
      const pa = this.ps[a], pb = this.ps[b];
      const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x) || 0;
      pa.x = c.x - Math.cos(ang) * 52; pa.y = c.y - Math.sin(ang) * 52; pa.face = ang;
      pb.x = c.x + Math.cos(ang) * 52; pb.y = c.y + Math.sin(ang) * 52; pb.face = ang + Math.PI;
      // máy quyết định trước (có thể đổi ý giữa chừng)
      [a, b].forEach((i) => { if (this.P[i].bot) d.botPlan = Object.assign(d.botPlan || {}, { [i]: this.botPlan(i, i === a ? b : a, c) }); });
      this.duels.push(d);
      Sfx.play('warn');
    }

    /** máy chọn Chia / Cướp — mức Khó chơi "ăn miếng trả miếng", mức Dễ gần như ngẫu nhiên */
    botPlan(i, j, c) {
      const lv = this.api.botOf(i), me = this.ps[i], last = me.hist[j];
      let steal;
      if (lv.actDrop > 0.4) steal = Math.random() < 0.45;
      else {
        const behind = this.ps[j].coins - me.coins;
        let pSteal = last === 't' ? 0.75 : last === 's' ? 0.15 : 0.3;
        if (behind > 80) pSteal += 0.15; // đang thua xa thì liều hơn
        if (this.time < 8) pSteal += 0.25; // cuối trận ít sợ bị trả đũa
        if (c.gold) pSteal += 0.1;
        steal = Math.random() < pSteal;
      }
      const flip = Math.random() < 0.35; // giả vờ bấm qua lại
      return { final: steal ? 't' : 's', at: U.rand(0.4, CHOOSE_T - 0.4), fake: flip ? U.rand(0.2, 1.2) : -1, done: false, faked: false };
    }

    resolve(d) {
      const A = d.pick[d.a], B = d.pick[d.b], pa = this.ps[d.a], pb = this.ps[d.b], parts = this.api.parts;
      let ga, gb;
      if (A === 's' && B === 's') [ga, gb] = PAY.ss;
      else if (A === 't' && B === 't') [ga, gb] = PAY.tt;
      else if (A === 't') [ga, gb] = PAY.ts;
      else [gb, ga] = PAY.ts;
      ga *= d.mul; gb *= d.mul;
      pa.coins += ga; pb.coins += gb;
      pa.hist[d.b] = B; pb.hist[d.a] = A;
      pa.stats[A]++; pb.stats[B]++;
      d.gain = { [d.a]: ga, [d.b]: gb };
      const txt = (g) => (g > 0 ? `+${g}` : String(g));
      parts.text(pa.x, pa.y - 70, txt(ga), ga > 0 ? '#ffe14d' : '#ff6b6b', 34);
      parts.text(pb.x, pb.y - 70, txt(gb), gb > 0 ? '#ffe14d' : '#ff6b6b', 34);
      if (A === 't' && B === 't') { Sfx.play('boom'); FX.shake(8); parts.burst(d.c.x, d.c.y, ['#ff6b6b', '#3a2a4a'], 24, 300, 0.6, 6); Party.rumble(d.a); Party.rumble(d.b); }
      else if (A === 's' && B === 's') { Sfx.play('win'); parts.burst(d.c.x, d.c.y, ['#ffe14d', '#fff', '#7dff9a'], 30, 260, 0.8, 6); }
      else { Sfx.play('crown'); Party.rumble(A === 't' ? d.b : d.a, 0.6, 200); parts.burst(d.c.x, d.c.y, ['#ffe14d', '#fff'], 20, 260, 0.6, 6); }
    }

    endDuel(d) {
      this.chests = this.chests.filter((c) => c !== d.c);
      [d.a, d.b].forEach((i) => {
        const p = this.ps[i], o = this.ps[i === d.a ? d.b : d.a];
        p.duel = null; p.stun = 0;
        const a = Math.atan2(p.y - o.y, p.x - o.x);
        p.vx = Math.cos(a) * 300; p.vy = Math.sin(a) * 300;
      });
      this.duels = this.duels.filter((x) => x !== d);
      this.spawnT = 0.8;
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) {
        this.time -= dt; this.elapsed += dt;
        if (this.time <= 0 && !this.duels.length) { this.time = 0; this.finished = true; }
        this.time = Math.max(0, this.time);
      }
      // rương mới
      this.spawnT -= dt;
      const want = Math.min(3, this.n) + (this.n >= 4 ? 1 : 0);
      if (this.spawnT <= 0 && this.chests.length < want && this.time > 3) { this.addChest(); this.spawnT = 1.2; }
      for (const c of this.chests) c.born += dt;

      // các cuộc đấu trí
      for (const d of this.duels.slice()) {
        if (d.reveal < 0) {
          d.t -= dt;
          [d.a, d.b].forEach((i) => {
            const q = inp[i];
            if (this.P[i].bot && d.botPlan && d.botPlan[i]) {
              const bp = d.botPlan[i], el = CHOOSE_T - d.t;
              if (bp.fake > 0 && !bp.faked && el > bp.fake) { bp.faked = true; d.pick[i] = bp.final === 's' ? 't' : 's'; d.presses++; Sfx.tone(520, 0.04, 'square', 0.04); }
              if (!bp.done && el > bp.at) { bp.done = true; d.pick[i] = bp.final; d.presses++; Sfx.tone(520, 0.04, 'square', 0.04); }
            } else {
              if (q.actP) { d.pick[i] = 's'; d.presses++; Sfx.tone(520, 0.04, 'square', 0.04); }
              if (q.jumpP) { d.pick[i] = 't'; d.presses++; Sfx.tone(520, 0.04, 'square', 0.04); }
            }
          });
          if (d.t <= 0) { d.reveal = REVEAL_T; this.resolve(d); }
        } else {
          d.reveal -= dt;
          if (d.reveal <= 0) this.endDuel(d);
        }
      }

      this.ps.forEach((p, i) => {
        p.stun -= dt; p.dashT -= dt; p.dashCd -= dt;
        if (p.duel) { p.skip = true; return; }
        p.skip = false;
        const q = this.finished ? { mx: 0, my: 0 } : inp[i];
        // đứng trên rương mà giữ Đánh → mở rương một mình
        const c = this.chests.find((cc) => !cc.duel && Math.hypot(cc.x - p.x, cc.y - p.y) < p.r + 26);
        if (c && q.act && p.stun <= 0 && !this.finished && (c.opener < 0 || c.opener === i)) {
          c.opener = i; p.open += dt; p.vx *= 0.8; p.vy *= 0.8;
          if (p.open >= OPEN_T) {
            const g = SOLO * (c.gold ? 2 : 1);
            p.coins += g; p.open = 0; Sfx.play('pickup');
            parts.text(c.x, c.y - 50, `+${g}`, '#ffe14d', 30); parts.burst(c.x, c.y, ['#ffe14d', '#fff'], 16, 200, 0.5, 5);
            this.chests = this.chests.filter((x) => x !== c); this.spawnT = 1;
          }
        } else {
          if (p.open > 0 && c && c.opener === i) c.opener = -1;
          p.open = Math.max(0, p.open - dt * 2);
        }
        if (p.stun <= 0 && p.open <= 0) {
          if (q.mx || q.my) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
          // Nhảy: lao húc (đẩy người đang mở rương ra)
          if (q.jumpP && p.dashCd <= 0) { p.dashT = 0.22; p.dashCd = 1.3; p.vx = Math.cos(p.face) * 680; p.vy = Math.sin(p.face) * 680; Sfx.play('dash'); }
          if (p.dashT <= 0) { const k = Math.min(1, dt * 10); p.vx += (q.mx * 280 - p.vx) * k; p.vy += (q.my * 280 - p.vy) * k; }
        } else { p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt); }
        p.x = U.clamp(p.x + p.vx * dt, AX + p.r, AX + AW - p.r);
        p.y = U.clamp(p.y + p.vy * dt, AY + p.r, AY + AH - p.r);
      });
      Phys.separate(this.ps, 0.5, (a, b, nx, ny, imp, ia, ib) => {
        const hit = (atk, vic, sx, sy) => {
          if (atk.dashT <= 0) return;
          atk.dashT = 0; vic.stun = 0.6; vic.open = 0; vic.vx = sx * 420; vic.vy = sy * 420;
          Sfx.play('hit'); FX.shake(5);
          this.chests.forEach((c) => { if (c.opener === this.ps.indexOf(vic)) c.opener = -1; });
        };
        hit(a, b, nx, ny); hit(b, a, -nx, -ny);
      });
      // hai người cùng chạm một rương → đấu trí
      if (!this.finished) for (const c of this.chests) {
        if (c.duel || c.born < 0.5) continue;
        const near = this.ps.map((p, i) => ({ p, i })).filter(({ p }) => !p.duel && p.stun <= 0 && Math.hypot(p.x - c.x, p.y - c.y) < p.r + 30);
        if (near.length >= 2) {
          near.sort((u, v) => Math.hypot(u.p.x - c.x, u.p.y - c.y) - Math.hypot(v.p.x - c.x, v.p.y - c.y));
          this.startDuel(c, near[0].i, near[1].i);
        }
      }
    }

    draw(ctx) {
      ctx.fillStyle = '#3b2a1e'; ctx.fillRect(0, 0, W, H);
      Draw.rr(ctx, AX - 10, AY - 10, AW + 20, AH + 20, 26); ctx.fillStyle = '#6b4a2b'; ctx.fill();
      Draw.rr(ctx, AX, AY, AW, AH, 20);
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#c9a26b'; ctx.fillRect(AX, AY, AW, AH);
      ctx.fillStyle = 'rgba(120,80,40,0.12)';
      for (let x = AX; x < AX + AW; x += 60) for (let y = AY; y < AY + AH; y += 60) if (((x - AX) / 60 + (y - AY) / 60) % 2 === 0) ctx.fillRect(x, y, 60, 60);
      ctx.restore();
      const t = U.now();
      for (const c of this.chests) this.drawChest(ctx, c, t);
      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i], col = this.P[i].color;
        Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: col, face: p.face, walk: p.walk, stun: p.stun > 0 });
        if (p.open > 0) {
          ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(p.x, p.y - 4, p.r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * p.open / OPEN_T); ctx.stroke();
        }
      }
      // bong bóng lựa chọn: không lộ ai chọn gì cho tới lúc mở
      for (const d of this.duels) {
        [d.a, d.b].forEach((i) => {
          const p = this.ps[i], x = p.x, y = p.y - 64;
          Draw.rr(ctx, x - 34, y - 22, 68, 44, 18); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
          ctx.strokeStyle = this.P[i].color.main; ctx.lineWidth = 3; ctx.stroke();
          if (d.reveal < 0) Draw.text(ctx, '🤔', x, y + 1, { size: 26, stroke: null });
          else Draw.text(ctx, d.pick[i] === 's' ? '🤝' : '🗡️', x, y + 1, { size: 28, stroke: null });
        });
        const c = d.c;
        if (d.reveal < 0) {
          ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(c.x, c.y, 44, -Math.PI / 2, -Math.PI / 2 + TAU * d.t / CHOOSE_T); ctx.stroke();
          Draw.text(ctx, String(Math.ceil(d.t)), c.x, c.y - 52, { size: 26, color: '#ffe14d' });
        } else if (d.gain) {
          const A = d.pick[d.a], B = d.pick[d.b];
          const s = A === 's' && B === 's' ? 'Cùng chia!' : A === 't' && B === 't' ? 'Cùng cướp — mất cả!' : `${this.P[A === 't' ? d.a : d.b].name} cướp!`;
          Draw.text(ctx, s, c.x, c.y + 64, { size: 24, color: '#fff', sw: 5 });
        }
      }
      Draw.chips(ctx, this.P, this.ps.map((p) => `🪙 ${p.coins}`), { w: 180 });
      Draw.timer(ctx, this.time, W - 72, 38);
      if (this.elapsed < 5) Draw.text(ctx, 'Giữ Đánh trên rương để mở · Hai người cùng chạm: Đánh = 🤝 Chia, Nhảy = 🗡️ Cướp', W / 2, H - 12, { size: 17, color: '#ffe14d', sw: 4 });
    }

    drawChest(ctx, c, t) {
      const pop = Math.min(1, c.born / 0.3), s = U.outBack(pop);
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(s, s);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 18, 30, 9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = c.gold ? '#e8b923' : '#9c5a2a'; Draw.rr(ctx, -28, -14, 56, 32, 6); ctx.fill();
      ctx.fillStyle = c.gold ? '#ffd84d' : '#b8743b'; Draw.rr(ctx, -30, -26, 60, 16, 8); ctx.fill();
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-4, -14, 8, 12);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; Draw.rr(ctx, -28, -14, 56, 32, 6); ctx.stroke();
      if (c.gold && Math.sin(t * 6 + c.x) > 0.6) Draw.sparkle(ctx, 22, -26, 7, '#fff');
      ctx.restore();
      if (c.gold) Draw.text(ctx, '×2', c.x, c.y - 40, { size: 18, color: '#ffe14d', sw: 4 });
    }

    results() {
      return this.ps.map((p) => ({ score: p.coins, text: `🪙 ${p.coins} · chia ${p.stats.s} · cướp ${p.stats.t}` }));
    }

    botInput(i) {
      const p = this.ps[i], o = { mx: 0, my: 0, act: false, jumpP: false };
      if (p.duel || this.finished) return o;
      // rương gần nhất (tránh rương đang có đấu trí)
      let best = null, bd = Infinity;
      for (const c of this.chests) {
        if (c.duel) continue;
        let d = Math.hypot(c.x - p.x, c.y - p.y) - (c.gold ? 120 : 0);
        // rương có người khác đang mở: chạy tới tranh (sẽ thành đấu trí) — mức Khó thích tranh hơn
        if (c.opener >= 0 && c.opener !== i) d -= 80;
        if (d < bd) { bd = d; best = c; }
      }
      if (!best) return o;
      const dx = best.x - p.x, dy = best.y - p.y, d = Math.hypot(dx, dy);
      if (d > p.r + 18) { o.mx = dx / d; o.my = dy / d; }
      else o.act = true;
      // có người đang mở rương ngay trước mặt → húc
      if (best.opener >= 0 && best.opener !== i && d < 140 && Math.random() < 0.06) o.jumpP = true;
      return o;
    }
  }

  Party.register({
    id: 'split', name: 'Chia Hay Cướp', emoji: '🤝', cat: 'brain',
    tagline: 'Hai người cùng chạm rương: bí mật chọn Chia hay Cướp',
    how: 'Chạy tới rương, đứng trên rương giữ Đánh để mở một mình (ít tiền). Nếu hai người cùng chạm một rương, cả hai có vài giây bí mật chọn: '
      + 'bấm Đánh = 🤝 Chia, bấm Nhảy = 🗡️ Cướp. Đổi ý bao nhiêu lần cũng được, chỉ tính lần bấm cuối — màn hình không lộ lựa chọn nên nhìn trộm vô ích. '
      + 'Cùng Chia: mỗi người +50 · Một người Cướp: người cướp +100, người kia trắng tay · Cùng Cướp: cả hai −30. Rương vàng ×2. Ngoài lúc đấu trí, Nhảy = lao húc người đang mở rương.',
    controls: { move: 'Chạy', act: 'Mở rương · 🤝 Chia', jump: 'Lao húc · 🗡️ Cướp' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Split(api),
  });
})();
