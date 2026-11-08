'use strict';
/* Đại Bác Công Thành (NEW1) — hai bên sông, mỗi bên một thành có tường gạch.
   Giữ Đánh để tăng tầm bắn (vòng ngắm chạy sang bờ bên kia), thả ra để bắn đạn vòng cung. Đạn bay thấp đập vào tường gạch thì vỡ gạch;
   bắn xa thì bay qua tường. Nhảy = lướt né. Hết tim cả bên là thua hiệp. 3–4 người: chia đội. */
(() => {
  const AX = 40, AY = 84, AW = W - 80, AH = H - 84 - 20;
  const CS = 34, ROWS = Math.floor(AH / CS);
  const WALL = [[AX + 300, AX + 300 + CS], [AX + AW - 300 - CS * 2, AX + AW - 300 - CS]]; // cột gạch đầu tiên mỗi bên (x bắt đầu)
  const YARD = [[AX + 24, AX + 290], [AX + AW - 290, AX + AW - 24]];
  const HEARTS = 2, CHARGE = 1.25, RMIN = 220, RMAX = 900, BOOM_R = 54;

  class Cannon {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.team = TEAMS.split(this.n);
      this.need = api.wins; this.maxRounds = api.wins * 2 - 1; this.wins = [0, 0]; this.round = 0;
      this.finished = false;
      this.ps = this.P.map((p, i) => ({ i, x: 0, y: 0, vx: 0, vy: 0, r: 22, face: 0, walk: 0, hearts: HEARTS, out: false, hold: 0, cd: 0,
        dashT: 0, dashCd: 0, inv: 0, hits: 0, skip: false }));
      this.startRound();
    }
    teamOf(i) { return this.team[i]; }

    startRound() {
      this.round++; this.over = 0; this.bannerT = 0; this.rt = 0; this.roundCap = 36; // độ dài ván đã đổi số hiệp nên mỗi hiệp giữ cố định
      this.shells = []; this.booms = [];
      // tường: 2 cột gạch mỗi bên
      this.bricks = [];
      for (let s = 0; s < 2; s++) for (let c = 0; c < 2; c++) for (let r = 0; r < ROWS; r++) this.bricks.push({ s, x: WALL[s][0] + c * CS, y: AY + r * CS, hp: 1 });
      const cnt = [0, 0];
      this.ps.forEach((p, i) => {
        const t = this.team[i], solo = this.team.filter((x) => x === t).length === 1, k = cnt[t]++;
        p.x = t === 0 ? YARD[0][0] + 120 : YARD[1][1] - 120; p.y = AY + AH * (solo ? 0.5 : k ? 0.72 : 0.28);
        p.hearts = solo && this.n > 2 ? HEARTS + 1 : HEARTS; p.out = false; p.hold = 0; p.cd = 0.5; p.inv = 1; p.dashT = 0; p.vx = p.vy = 0;
        p.face = t === 0 ? 0 : Math.PI; p.solo = solo;
      });
    }

    fire(p, i) {
      const t = this.team[i], dir = t === 0 ? 1 : -1, k = U.clamp(p.hold / CHARGE, 0, 1);
      const range = RMIN + (RMAX - RMIN) * k, tx = U.clamp(p.x + dir * range, AX + 10, AX + AW - 10);
      const dur = 0.4 + range / 1500, peak = 40 + range * 0.3;
      this.shells.push({ owner: i, team: t, x0: p.x, y: p.y, tx, t: 0, dur, peak, x: p.x, z: 0 });
      p.cd = p.solo && this.n > 2 ? 0.35 : 0.5; p.hold = 0;
      Sfx.play('boom', 0.05); FX.shake(2);
      this.api.parts.burst(p.x + dir * 26, p.y - 10, ['#fff', '#bbb'], 8, 120, 0.4, 5);
    }

    explode(s, x, y, wallHit) {
      const parts = this.api.parts;
      this.booms.push({ x, y, t: 0 });
      Sfx.play(wallHit ? 'crash' : 'boom', 0.04); FX.shake(5);
      parts.burst(x, y, ['#ff8a3d', '#ffe14d', '#666'], 18, 260, 0.5, 6);
      for (const b of this.bricks) if (b.hp > 0 && Math.hypot(b.x + CS / 2 - x, b.y + CS / 2 - y) < BOOM_R + 8) {
        b.hp--; if (b.hp <= 0) parts.burst(b.x + CS / 2, b.y + CS / 2, ['#b5523b', '#7a3326'], 6, 160, 0.5, 5, { shape: 's' });
      }
      if (wallHit) return;
      this.ps.forEach((p, j) => {
        if (p.out || this.team[j] === s.team || p.inv > 0 || p.dashT > 0) return;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < BOOM_R + p.r * 0.6) {
          p.hearts--; p.inv = 1.2; this.ps[s.owner].hits++;
          const a = Math.atan2(p.y - y, p.x - x); p.vx = Math.cos(a) * 340; p.vy = Math.sin(a) * 340;
          Sfx.play('hurt'); Party.rumble(j);
          if (p.hearts <= 0) { p.out = true; parts.text(p.x, p.y - 40, 'Gục!', '#fff', 28); }
        }
      });
    }

    update(dt, inp) {
      this.bannerT += dt;
      if (this.over > 0) {
        this.over -= dt;
        if (this.over <= 0) {
          if (this.wins.some((w) => w >= this.need) || this.round >= this.maxRounds) this.finished = true;
          else this.startRound();
        }
      }
      if (this.finished) return;
      this.rt += dt;
      this.ps.forEach((p, i) => {
        p.skip = p.out;
        if (p.out) return;
        const q = this.over > 0 || this.bannerT < 1.2 ? { mx: 0, my: 0 } : inp[i], t = this.team[i];
        p.cd -= dt; p.inv -= dt; p.dashT -= dt; p.dashCd -= dt;
        if (q.mx || q.my) p.walk += dt * 14;
        if (q.act && p.cd <= 0) p.hold = Math.min(CHARGE, p.hold + dt);
        else if (p.hold > 0) this.fire(p, i);
        if (q.jumpP && p.dashCd <= 0 && (q.mx || q.my)) {
          const a = Math.atan2(q.my, q.mx); p.dashT = 0.22; p.dashCd = 1.3; p.vx = Math.cos(a) * 640; p.vy = Math.sin(a) * 640; Sfx.play('dash');
        }
        if (p.dashT <= 0) { const sp = p.hold > 0 ? 150 : 260, k = Math.min(1, dt * 10); p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k; }
        p.x = U.clamp(p.x + p.vx * dt, YARD[t][0] + p.r, YARD[t][1] - p.r);
        p.y = U.clamp(p.y + p.vy * dt, AY + p.r, AY + AH - p.r);
        p.face = t === 0 ? 0 : Math.PI;
      });
      Phys.separate(this.ps, 0.5);
      for (const s of this.shells) {
        s.t += dt;
        const k = Math.min(1, s.t / s.dur);
        s.x = s.x0 + (s.tx - s.x0) * k; s.z = s.peak * 4 * k * (1 - k);
        // tường gạch đối thủ chặn đạn ở hàng đó: phải phá thủng tường mới bắn tới người phía sau
        if (!s.done) {
          const b = this.bricks.find((bb) => bb.hp > 0 && bb.s !== s.team && s.x > bb.x - 4 && s.x < bb.x + CS + 4 && s.y > bb.y - 6 && s.y < bb.y + CS + 6);
          if (b) { s.done = true; this.explode(s, b.x + CS / 2, s.y, true); continue; }
        }
        if (k >= 1 && !s.done) { s.done = true; this.explode(s, s.tx, s.y, false); }
      }
      this.shells = this.shells.filter((s) => !s.done);
      for (const b of this.booms) b.t += dt;
      this.booms = this.booms.filter((b) => b.t < 0.5);
      // hết hiệp: một bên gục hết, hoặc hết giờ hiệp thì bên còn nhiều tim hơn thắng
      if (this.over <= 0) {
        const alive = [0, 1].map((t) => this.ps.some((p, i) => this.team[i] === t && !p.out));
        const timeUp = this.rt >= this.roundCap;
        if (!alive[0] || !alive[1] || timeUp) {
          const hp = [0, 1].map((t) => this.ps.reduce((s2, p, i) => s2 + (this.team[i] === t && !p.out ? p.hearts : 0), 0));
          const br = [0, 1].map((t) => this.bricks.filter((b) => b.s === t && b.hp > 0).length);
          const w = timeUp && alive[0] && alive[1] ? (hp[0] !== hp[1] ? (hp[0] > hp[1] ? 0 : 1) : br[0] !== br[1] ? (br[0] > br[1] ? 0 : 1) : -1) : alive[0] ? 0 : alive[1] ? 1 : -1;
          if (w >= 0) this.wins[w]++;
          this.over = 2.2; this.bannerT = 0; this.winner = w;
          Sfx.play('win');
        }
      }
    }

    draw(ctx) {
      const t = U.now();
      ctx.fillStyle = '#3d6b3a'; ctx.fillRect(0, 0, W, H);
      // sông giữa
      const rx0 = WALL[0][0] + CS * 2 + 30, rx1 = WALL[1][0] - 30;
      ctx.fillStyle = '#2f7fc0'; ctx.fillRect(rx0, AY, rx1 - rx0, AH);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 3;
      for (let k = 0; k < 10; k++) { const y = AY + 30 + k * 60; ctx.beginPath(); for (let x = rx0; x <= rx1; x += 30) ctx.lineTo(x, y + Math.sin(x * 0.03 + t * 2 + k) * 5); ctx.stroke(); }
      // sân trong thành
      [0, 1].forEach((s) => { ctx.fillStyle = s ? '#c9b58a' : '#c7b48c'; ctx.fillRect(YARD[s][0] - 14, AY, YARD[s][1] - YARD[s][0] + 28, AH); ctx.fillStyle = TEAMS.colors[s] + '22'; ctx.fillRect(YARD[s][0] - 14, AY, YARD[s][1] - YARD[s][0] + 28, AH); });
      // tường gạch
      for (const b of this.bricks) {
        if (b.hp <= 0) { ctx.fillStyle = 'rgba(90,60,40,0.4)'; ctx.fillRect(b.x + 4, b.y + 8, CS - 8, CS - 12); continue; }
        ctx.fillStyle = b.hp === 2 ? '#b5523b' : '#8a3d2c'; ctx.fillRect(b.x + 1, b.y + 1, CS - 2, CS - 2);
        ctx.strokeStyle = 'rgba(60,25,15,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(b.x + 1, b.y + 1, CS - 2, CS - 2);
        if (b.hp === 1) { ctx.beginPath(); ctx.moveTo(b.x + 8, b.y + 6); ctx.lineTo(b.x + 18, b.y + 18); ctx.lineTo(b.x + 12, b.y + 28); ctx.stroke(); }
      }
      // điểm rơi của đạn đang bay (ai cũng thấy để né)
      for (const s of this.shells) {
        const k = Math.min(1, s.t / s.dur);
        ctx.strokeStyle = `rgba(255,70,70,${0.4 + 0.5 * k})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.tx, s.y, BOOM_R * (1.3 - k * 0.3), 0, TAU); ctx.stroke();
      }
      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i], c = this.P[i].color, dir = this.team[i] === 0 ? 1 : -1;
        if (p.out) { Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: c, dead: true, alpha: 0.5 }); continue; }
        // ống đại bác
        ctx.save(); ctx.translate(p.x, p.y + 6); ctx.scale(dir, 1); ctx.rotate(-0.35 - p.hold / CHARGE * 0.3);
        ctx.fillStyle = '#3a3a48'; Draw.rr(ctx, 0, -9, 46, 18, 8); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#6b4a2b'; ctx.beginPath(); ctx.arc(p.x + dir * 6, p.y + 18, 10, 0, TAU); ctx.fill();
        Draw.blob(ctx, { x: p.x - dir * 6, y: p.y, r: p.r, color: c, face: p.face, walk: p.walk, alpha: p.inv > 0 && Math.sin(t * 30) > 0 ? 0.45 : 1 });
        if (p.hold > 0) {
          const range = RMIN + (RMAX - RMIN) * (p.hold / CHARGE), tx = U.clamp(p.x + dir * range, AX + 10, AX + AW - 10);
          ctx.strokeStyle = c.light; ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, p.y); ctx.stroke(); ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(tx, p.y, BOOM_R, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tx - 12, p.y); ctx.lineTo(tx + 12, p.y); ctx.moveTo(tx, p.y - 12); ctx.lineTo(tx, p.y + 12); ctx.stroke();
        }
      }
      // đạn
      for (const s of this.shells) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 6, 9, 4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(s.x, s.y - s.z, 9 + s.z / 60, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(s.x - 3, s.y - s.z - 3, 3, 0, TAU); ctx.fill();
      }
      for (const b of this.booms) { ctx.fillStyle = `rgba(255,170,60,${0.6 * (1 - b.t / 0.5)})`; ctx.beginPath(); ctx.arc(b.x, b.y, BOOM_R * (0.6 + b.t), 0, TAU); ctx.fill(); }
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.out ? 'Gục' : '♥'.repeat(p.hearts))), { dim: this.ps.map((p) => p.out), w: 170 });
      Draw.label(ctx, `Hiệp ${this.round}/${this.maxRounds}`, 90, 38);
      Draw.timer(ctx, Math.max(0, this.roundCap - this.rt), W - 72, 38);
      Draw.text(ctx, `${'★'.repeat(this.wins[0])}${'☆'.repeat(Math.max(0, this.need - this.wins[0]))}`, (YARD[0][0] + YARD[0][1]) / 2, AY + 16, { size: 22, color: TEAMS.colors[0] });
      Draw.text(ctx, `${'★'.repeat(this.wins[1])}${'☆'.repeat(Math.max(0, this.need - this.wins[1]))}`, (YARD[1][0] + YARD[1][1]) / 2, AY + 16, { size: 22, color: TEAMS.colors[1] });
      if (this.bannerT < 1.4 && this.over <= 0) Draw.banner(ctx, `Hiệp ${this.round}`, this.bannerT, { size: 60, y: 160, sub: 'Giữ Đánh ngắm · thả ra bắn · Nhảy lướt né' });
      if (this.over > 0) Draw.banner(ctx, this.winner >= 0 ? `${TEAMS.names[this.winner]} thắng hiệp!` : 'Hòa hiệp!', this.bannerT, { size: 56, y: 160, color: this.winner >= 0 ? TEAMS.colors[this.winner] : '#fff' });
    }

    results() {
      return this.ps.map((p, i) => {
        const t = this.team[i];
        return { score: this.wins[t] * 100 + p.hits * 0.1, text: `${TEAMS.names[t]} ${this.wins[t]}–${this.wins[1 - t]} hiệp · bắn trúng ${p.hits}` };
      });
    }

    botInput(i) {
      const p = this.ps[i], o = { mx: 0, my: 0, act: false, jumpP: false };
      if (p.out || this.over > 0 || this.finished) return o;
      const t = this.team[i], dir = t === 0 ? 1 : -1, lv = this.api.bot;
      // né điểm rơi
      for (const s of this.shells) {
        if (s.team === t) continue;
        if (!s.seen) s.seen = {};
        if (s.seen[i] === undefined) s.seen[i] = Math.random() < 0.6; // không phải lúc nào cũng kịp thấy
        if (!s.seen[i]) continue;
        const left = s.dur - s.t, d = Math.hypot(s.tx - p.x, s.y - p.y);
        if (d < BOOM_R + p.r + 10 && left < 0.9) {
          const ay = p.y >= s.y ? 1 : -1;
          o.my = (p.y + ay * 80 > AY + AH - p.r || p.y + ay * 80 < AY + p.r) ? -ay : ay; o.mx = 0;
          if (left < 0.35 && p.dashCd <= 0) o.jumpP = true;
          return o;
        }
      }
      // mục tiêu: địch còn sống gần theo chiều dọc
      const foes = this.ps.filter((q, j) => this.team[j] !== t && !q.out);
      if (!foes.length) return o;
      if (p.tg === undefined || !foes.includes(this.ps[p.tg])) p.tg = U.pick(foes).i;
      const f = this.ps[p.tg];
      // căn cùng hàng với địch (lệch chút theo mức)
      if (p.aimErr === undefined || Math.random() < 0.01) p.aimErr = U.rand(-1, 1) * lv.actDrop * 120;
      const ty = f.y + p.aimErr, dy = ty - p.y;
      if (Math.abs(dy) > 12) o.my = Math.sign(dy) * Math.min(1, Math.abs(dy) / 60);
      // đứng gần tường mình cho an toàn
      const homeX = t === 0 ? YARD[0][1] - 32 : YARD[1][0] + 32;
      if (Math.abs(p.x - homeX) > 30) o.mx = Math.sign(homeX - p.x) * 0.6;
      // tầm cần thiết; tường địch còn gạch ngay hàng đó thì bắn qua đầu tường hoặc phá tường trước
      const dist = Math.abs(f.x - p.x) + (p.rErr || 0);
      if (p.cd <= 0 && Math.abs(dy) < 40) {
        const need = U.clamp((dist - RMIN) / (RMAX - RMIN), 0, 1) * CHARGE;
        if (p.hold < need) o.act = true;
        else p.rErr = U.rand(-1, 1) * lv.actDrop * 160;
      }
      void dir;
      return o;
    }
  }

  Party.register({
    id: 'cannon', name: 'Đại Bác Công Thành', emoji: '💥', cat: 'fight',
    tagline: 'Ngắm bắn đại bác qua sông, phá tường gạch thành đối thủ',
    how: 'Mỗi bên một thành có tường gạch. Giữ Đánh để tăng tầm bắn — vòng ngắm chạy dần sang bờ bên kia — thả ra để bắn đạn vòng cung. '
      + 'Tường gạch của đối thủ chặn đạn ở hàng đó: bắn vỡ gạch để mở lỗ thủng rồi mới bắn trúng người phía sau; núp sau đoạn tường còn nguyên thì an toàn. Vòng đỏ là chỗ đạn sắp rơi — chạy hoặc bấm Nhảy (kèm hướng) để lướt né. '
      + 'Hết tim cả bên là thua hiệp. 3–4 người thì chia đội; đội 1 người có thêm tim và nạp đạn nhanh hơn.',
    controls: { move: 'Đi lại trong thành', act: 'Giữ: ngắm xa · Thả: bắn', jump: 'Lướt né' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Cannon(api),
  });
})();
