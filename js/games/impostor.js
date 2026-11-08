'use strict';
/* Ai Là Người Thật? — mỗi lượt 1 người làm Thợ Săn, những người còn lại trốn lẫn giữa đám đông máy
   (tất cả trông giống hệt nhau). Người trốn đứng ở ★ giữ nút Đánh để làm nhiệm vụ.
   Thợ săn ngắm & bắn — bắn nhầm máy là phí đạn. Mỗi người được làm thợ săn 1 lần. */
(() => {
  const AX = 50, AY = 92, AW = W - 100, AH = H - 92 - 20;
  const ROUND_TIME = 40, NPC = 16, TASK = 1.8;
  const GRAY = { main: '#b9b3cc', dark: '#7c7695', light: '#f1eff7' };

  class Impostor {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.points = new Array(this.n).fill(0);
      this.round = 0; this.finished = false;
      this.startRound();
    }

    randPos() { return [U.rand(AX + 40, AX + AW - 40), U.rand(AY + 40, AY + AH - 40)]; }

    startRound() {
      this.hunter = this.round % this.n;
      this.round++;
      this.time = this.api.T(ROUND_TIME); this.over = false; this.overT = 0;
      this.bodies = [];
      const mk = (pl) => {
        const [x, y] = this.randPos();
        return { x, y, vx: 0, vy: 0, r: 22, face: U.rand(0, TAU), walk: 0, player: pl, alive: true, wave: 0, task: 0,
          tx: x, ty: y, wait: U.rand(0, 2), deadT: 0, sus: 0 };
      };
      for (let k = 0; k < NPC; k++) this.bodies.push(mk(-1));
      this.P.forEach((_, i) => { if (i !== this.hunter) this.bodies.push(mk(i)); });
      U.shuffle(this.bodies);
      this.mine = this.P.map((_, i) => this.bodies.findIndex((b) => b.player === i));
      this.stations = [0, 1, 2].map(() => this.randPos());
      this.ret = { x: W / 2, y: H / 2 };
      this.bullets = this.n;          // số người trốn + 1
      this.shots = [];
      this.freeze = 2.2;
      this.bannerText = `${this.P[this.hunter].name} là Thợ Săn!`; this.bannerColor = this.P[this.hunter].color.light; this.bannerT = 0;
      this.botHunt = { tx: W / 2, ty: H / 2, t: 0, aim: -1 };
    }

    endRound(text) {
      this.over = true; this.overT = 3; this.bannerT = 0; this.bannerText = text; this.bannerColor = '#fff';
      for (const b of this.bodies) if (b.player >= 0 && b.alive) this.points[b.player] += 2;
      Sfx.play('crown');
    }

    npcStep(b, dt) {
      b.wait -= dt;
      if (b.wait > 0) { b.vx = b.vy = 0; if (Math.random() < dt * 0.3) b.wave = 0.6; return [0, 0]; }
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
      if (d < 8) {
        b.wait = U.rand(0.4, 2.2);
        if (Math.random() < (b.player >= 0 ? 0.5 : 0.25)) { const s = U.pick(this.stations); b.tx = s[0] + U.rand(-10, 10); b.ty = s[1] + U.rand(-10, 10); }
        else { [b.tx, b.ty] = this.randPos(); }
        return [0, 0];
      }
      return [dx / d, dy / d];
    }

    update(dt, inp) {
      const parts = this.api.parts;
      this.bannerT += dt;
      for (const s of this.shots) s.t -= dt;
      this.shots = this.shots.filter((s) => s.t > 0);
      for (const b of this.bodies) { b.wave -= dt; if (!b.alive) b.deadT += dt; }
      if (this.freeze > 0) { this.freeze -= dt; return; }
      if (this.over) {
        this.overT -= dt;
        if (this.overT <= 0 && !this.finished) {
          if (this.round >= this.n) this.finished = true; else this.startRound();
        }
        return;
      }
      this.time -= dt;

      // thân người: máy & người trốn
      for (const b of this.bodies) {
        if (!b.alive) continue;
        let mx = 0, my = 0;
        if (b.player < 0) [mx, my] = this.npcStep(b, dt);
        else {
          const q = inp[b.player];
          mx = q.mx; my = q.my;
          if (q.jumpP) b.wave = 0.6;
          const st = this.stations.findIndex((s) => Math.hypot(s[0] - b.x, s[1] - b.y) < 26);
          if (st >= 0 && q.act && !mx && !my) {
            b.task += dt;
            if (b.task >= TASK) {
              b.task = 0; this.points[b.player]++;
              Sfx.play('pickup');
              parts.burst(this.stations[st][0], this.stations[st][1], ['#ffe14d', '#fff'], 14, 200, 0.6, 6, { shape: 's' });
              this.stations[st] = this.randPos();
            }
          } else b.task = Math.max(0, b.task - dt * 2);
        }
        const l = Math.hypot(mx, my);
        if (l > 1) { mx /= l; my /= l; }
        b.vx = mx * 92; b.vy = my * 92;
        if (mx || my) { b.face = Math.atan2(my, mx); b.walk += dt * 10; }
        b.x = U.clamp(b.x + b.vx * dt, AX + b.r, AX + AW - b.r);
        b.y = U.clamp(b.y + b.vy * dt, AY + b.r, AY + AH - b.r);
      }

      // thợ săn
      const hq = inp[this.hunter];
      this.ret.x = U.clamp(this.ret.x + hq.mx * 430 * dt, AX, AX + AW);
      this.ret.y = U.clamp(this.ret.y + hq.my * 430 * dt, AY, AY + AH);
      if (hq.actP && this.bullets > 0) {
        this.bullets--;
        Sfx.play('shoot'); FX.shake(4);
        this.shots.push({ x: this.ret.x, y: this.ret.y, t: 0.3 });
        let hit = null, hd = 30;
        for (const b of this.bodies) {
          if (!b.alive) continue;
          const d = Math.hypot(b.x - this.ret.x, b.y - this.ret.y);
          if (d < hd) { hd = d; hit = b; }
        }
        if (hit) {
          hit.alive = false;
          if (hit.player >= 0) {
            this.points[this.hunter] += 3;
            Sfx.play('boom');
            parts.burst(hit.x, hit.y, [this.P[hit.player].color.main, '#fff'], 24, 300, 0.7, 6);
            parts.text(hit.x, hit.y - 40, `Bắt được ${this.P[hit.player].name}! +3`, this.P[this.hunter].color.light, 28);
          } else {
            Sfx.play('hurt');
            parts.text(hit.x, hit.y - 40, 'Bắn nhầm máy!', '#ccc', 26);
          }
        } else parts.text(this.ret.x, this.ret.y - 30, 'Trượt!', '#ccc', 24);
      }
      const hidersLeft = this.bodies.filter((b) => b.player >= 0 && b.alive).length;
      if (hidersLeft === 0) this.endRound('Thợ săn bắt hết!');
      else if (this.bullets <= 0) this.endRound('Thợ săn hết đạn!');
      else if (this.time <= 0) this.endRound('Hết giờ — người trốn thoát!');
    }

    draw(ctx) {
      const t = U.now();
      ctx.fillStyle = '#3d3552'; ctx.fillRect(0, 0, W, H);
      Draw.rr(ctx, AX, AY, AW, AH, 22); ctx.fillStyle = '#9ccf8a'; ctx.fill();
      ctx.save(); Draw.rr(ctx, AX, AY, AW, AH, 22); ctx.clip();
      ctx.fillStyle = '#d8c79a';
      ctx.fillRect(AX, AY + AH / 2 - 26, AW, 52); ctx.fillRect(AX + AW / 2 - 26, AY, 52, AH);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let k = 0; k < 30; k++) { ctx.beginPath(); ctx.ellipse(AX + (k * 173) % AW, AY + (k * 89) % AH, 14, 5, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
      // trạm nhiệm vụ
      for (const [x, y] of this.stations) {
        ctx.fillStyle = 'rgba(255,225,77,0.3)'; ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill();
        Draw.text(ctx, '★', x, y + 1, { size: 34, color: '#ffe14d', sw: 5 });
      }
      const order = this.bodies.slice().sort((a, b) => a.y - b.y);
      for (const b of order) {
        if (!b.alive) {
          if (b.deadT > 2) continue;
          const col = b.player >= 0 ? this.P[b.player].color : GRAY;
          Draw.blob(ctx, { x: b.x, y: b.y, r: b.r, color: col, dead: true, alpha: 1 - b.deadT / 2 });
          continue;
        }
        const reveal = this.over && b.player >= 0;
        Draw.blob(ctx, { x: b.x, y: b.y, r: b.r, color: reveal ? this.P[b.player].color : GRAY, face: b.face, walk: b.walk, squash: b.wave > 0 ? Math.sin(b.wave * 20) * 0.12 : 0 });
        if (b.wave > 0) {
          ctx.fillStyle = GRAY.light; ctx.strokeStyle = 'rgba(20,10,40,0.5)'; ctx.lineWidth = 2;
          const hx = b.x + b.r * 0.9, hy = b.y - b.r * 0.8 + Math.sin(b.wave * 25) * 6;
          ctx.beginPath(); ctx.arc(hx, hy, 7, 0, TAU); ctx.fill(); ctx.stroke();
        }
        if (b.task > 0) {
          ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * b.task / TASK); ctx.stroke();
        }
        if (reveal) Draw.text(ctx, this.P[b.player].name, b.x, b.y - b.r - 14, { size: 18, color: this.P[b.player].color.light, sw: 4 });
      }
      // tâm ngắm
      if (!this.over) {
        const c = this.P[this.hunter].color, { x, y } = this.ret;
        ctx.strokeStyle = c.main; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, 24, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 34, y); ctx.lineTo(x - 12, y); ctx.moveTo(x + 12, y); ctx.lineTo(x + 34, y);
        ctx.moveTo(x, y - 34); ctx.lineTo(x, y - 12); ctx.moveTo(x, y + 12); ctx.lineTo(x, y + 34); ctx.stroke();
        ctx.fillStyle = c.main; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
      }
      for (const s of this.shots) {
        ctx.fillStyle = `rgba(255,240,180,${s.t * 3})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 30 * (1.3 - s.t), 0, TAU); ctx.fill();
      }
      Draw.label(ctx, `Lượt ${this.round}/${this.n}`, 80, 38);
      Draw.chips(ctx, this.P, this.points.map((p, i) => (i === this.hunter ? '🎯 ' : '') + p), { w: 170 });
      Draw.timer(ctx, this.time, W - 72, 38);
      if (!this.over) {
        Draw.text(ctx, `${this.P[this.hunter].name} săn · đạn: ${'●'.repeat(this.bullets)}${'○'.repeat(Math.max(0, this.n - this.bullets))}`,
          W / 2, AY + AH - 2, { size: 20, color: this.P[this.hunter].color.light, sw: 4, base: 'bottom' });
      }
      if (this.bannerT < 2.2 || this.over) {
        Draw.banner(ctx, this.bannerText, this.bannerT, { color: this.bannerColor, size: 56, y: 300,
          sub: this.freeze > 0 ? 'Người trốn: tìm xem mình là ai, ra ★ giữ nút Đánh!' : null });
      }
    }

    results() { return this.points.map((p) => ({ score: p, text: `${p} điểm` })); }

    /** vị trí nhân vật trên màn hình (cho biểu cảm, rung tay cầm...) — null nếu đang không hiện */
    posOf(i) {
      if (i === this.hunter) return { x: this.ret.x, y: this.ret.y };
      const b = this.bodies[this.mine[i]];
      return b ? { x: b.x, y: b.y } : null;
    }

    botInput(i) {
      const o = { mx: 0, my: 0, act: false, actP: false, jumpP: false };
      if (this.freeze > 0 || this.over) return o;
      if (i === this.hunter) {
        const st = this.botHunt;
        // nghi ngờ: ai đang làm nhiệm vụ (vòng vàng) hoặc đứng ở ★ lâu
        let best = null, bs = 0;
        for (const b of this.bodies) {
          if (!b.alive) continue;
          const onSt = this.stations.some((s) => Math.hypot(s[0] - b.x, s[1] - b.y) < 30);
          b.sus = Math.max(0, b.sus + (b.task > 0.3 ? 3 : onSt ? 0.6 : -0.4) * (1 - this.api.bot.actDrop * 0.8) / 60);
          if (b.sus > bs) { bs = b.sus; best = b; }
        }
        let tx, ty;
        if (best && bs > 0.5) { tx = best.x; ty = best.y; }
        else {
          st.t -= 1 / 60;
          if (st.t <= 0) { [st.tx, st.ty] = this.randPos(); st.t = 2; }
          tx = st.tx; ty = st.ty;
        }
        const dx = tx - this.ret.x, dy = ty - this.ret.y, d = Math.hypot(dx, dy);
        const sp = this.api.bot.speed;
        if (d > 4) { o.mx = dx / d * Math.min(1, d / 60) * sp; o.my = dy / d * Math.min(1, d / 60) * sp; }
        if (best && bs > 0.9 && d < 10) o.actP = true;
        return o;
      }
      // người trốn: bắt chước máy, thỉnh thoảng làm nhiệm vụ
      const b = this.bodies[this.mine[i]];
      if (!b || !b.alive) return o;
      const onSt = this.stations.some((s) => Math.hypot(s[0] - b.x, s[1] - b.y) < 22);
      if (onSt && (b.wait > 0 || b.task > 0)) { o.act = true; b.wait -= 1 / 60; return o; }
      const [mx, my] = this.npcStep(b, 1 / 60);
      if (b.wait > 0 && Math.random() < 0.004) o.jumpP = true;
      o.mx = mx; o.my = my;
      return o;
    }
  }

  Party.register({
    id: 'impostor', name: 'Ai Là Người Thật?', emoji: '🕵️',
    tagline: 'Trốn lẫn giữa đám đông máy · thợ săn phải đoán ra ai là người',
    how: 'Mỗi lượt 1 người làm Thợ Săn (ngắm & bắn), những người khác trốn lẫn vào đám đông giống hệt nhau. Người trốn ra ★ giữ nút Đánh để kiếm điểm, nút Nhảy để vẫy tay giả làm máy. Thợ săn bắt được người +3, người trốn sống sót +2.',
    controls: { move: 'Đi / ngắm (thợ săn)', act: 'Giữ ở ★ · bắn (thợ săn)', jump: 'Vẫy tay' },
    minPlayers: 2, maxPlayers: 4,
    rawBot: true, // máy trốn phải đi chậm như đám đông, không làm chậm thêm
    create: (api) => new Impostor(api),
  });
})();
