'use strict';
/* Xếp Hộp — hộp chạy qua lại phía trên tháp, bấm đúng lúc để thả. Hộp phải đè lên hộp dưới ít nhất một nửa.
   Ai xây đủ 10 hộp trước thắng. */
(() => {
  const GROUND = H - 50, BW = 96, BH = 40, GOAL = 10, GAME_TIME = 60;
  const MODES = [
    { id: 'classic', name: 'Cổ điển', desc: 'Hộp phải đè lên hộp dưới ít nhất một nửa, không thì rơi mất.' },
    { id: 'physics', name: 'Tháp lắc', desc: 'Có vật lý: hộp chạm là đứng, nhưng xếp lệch thì tháp nghiêng — trọng tâm lệch ra ngoài là cả phần trên đổ sập! Xếp bù sang bên kia để giữ thăng bằng.' },
  ];

  class Stack {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.goal = Math.min(13, api.count(GOAL)); this.elapsed = 0; this.finished = false; this.place = 0;
      this.laneW = W / this.n; this.phys = api.mode === 'physics';
      this.ps = this.P.map((p, i) => {
        const cx = this.laneW * (i + 0.5);
        return { cx, stack: [cx], sx: cx - this.laneW * 0.3, dir: 1, falling: [], drop: null, done: false, rank: 0, time: 0, misses: 0, cool: 0, tilt: 0, risk: 0, falls: 0 };
      });
    }

    topY(p) { return GROUND - p.stack.length * BH; }
    /** STK1: kiểm tra thăng bằng — trọng tâm phần trên lệch khỏi mặt đỡ ở tầng nào thì phần trên tầng đó đổ */
    balance(p) {
      const st = p.stack, m = st.length - 1;
      let worst = 0, side = 0, fall = -1;
      for (let k = 0; k < m; k++) {
        let sum = 0; for (let j = k + 1; j <= m; j++) sum += st[j];
        const off = sum / (m - k) - st[k], half = k === 0 ? BW / 2 + 10 : BW / 2, r = Math.abs(off) / half;
        if (r > worst) { worst = r; side = Math.sign(off); }
        if (r > 1 && fall < 0) fall = k;
      }
      return { worst, side, fall };
    }
    settle(p, i) {
      const b = this.balance(p);
      if (b.fall >= 0) {
        const parts = this.api.parts, n = p.stack.length - 1 - b.fall;
        for (let k = b.fall + 1; k < p.stack.length; k++) {
          const y = GROUND - (k + 1) * BH;
          p.falling.push({ x: p.stack[k] + b.side * (k - b.fall) * 6, y, vx: b.side * U.rand(120, 260), vy: -U.rand(60, 200), rot: 0, vr: b.side * U.rand(2, 5) });
        }
        p.stack.length = b.fall + 1; p.falls++; p.cool = 0.8;
        Sfx.play('crash'); FX.shake(8); Party.rumble(i, 0.8, 300);
        parts.text(p.cx, this.topY(p) - 30, `Tháp đổ! −${n}`, '#ff8fa8', 30);
      } else if (b.worst > 0.7) this.api.parts.text(p.cx, this.topY(p) - 30, 'Lung lay…', '#ffe14d', 20);
      const nb = this.balance(p); p.risk = nb.worst; p.tilt = nb.side * nb.worst;
    }
    speed(p) { return 210 + p.stack.length * 32; }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) { this.time -= dt; this.elapsed += dt; if (this.time <= 0) { this.time = 0; this.finished = true; } }
      this.ps.forEach((p, i) => {
        for (const f of p.falling) { f.vy += 1400 * dt; f.y += f.vy * dt; f.x += f.vx * dt; f.rot += f.vr * dt; }
        p.falling = p.falling.filter((f) => f.y < H + 80);
        if (p.done) return;
        p.cool -= dt;
        const half = this.laneW / 2 - BW / 2 - 6;
        if (!p.drop) {
          p.sx += p.dir * this.speed(p) * dt;
          if (p.sx > p.cx + half) { p.sx = p.cx + half; p.dir = -1; }
          if (p.sx < p.cx - half) { p.sx = p.cx - half; p.dir = 1; }
          if (inp[i].actP && p.cool <= 0 && !this.finished) {
            p.drop = { x: p.sx, y: this.topY(p) - 104, vy: 0 };
            Sfx.play('place');
          }
          return;
        }
        // hộp đang rơi xuống tháp
        const d = p.drop;
        d.vy += 2200 * dt; d.y += d.vy * dt;
        const land = this.topY(p) - BH;
        if (d.y >= land) {
          const topX = p.stack[p.stack.length - 1];
          const overlap = BW - Math.abs(d.x - topX);
          if (overlap >= BW * (this.phys ? 0.12 : 0.5)) {
            p.stack.push(d.x);
            const perfect = Math.abs(d.x - topX) < 6;
            if (perfect) { p.stack[p.stack.length - 1] = topX; parts.text(d.x, land - 10, 'Hoàn hảo!', '#ffe14d', 24); }
            Sfx.play(perfect ? 'crown' : 'pickup');
            parts.burst(d.x, land + BH, ['#fff', this.P[i].color.light], 8, 120, 0.4, 4);
            if (this.phys) this.settle(p, i);
            if (p.stack.length - 1 >= this.goal) {
              p.done = true; p.rank = ++this.place; p.time = this.elapsed;
              Sfx.play('win'); FX.shake(5);
              parts.burst(p.cx, this.topY(p), ['#ffe14d', '#fff', this.P[i].color.main], 30, 360, 0.9, 6);
            }
          } else {
            p.misses++; p.cool = 0.6;
            p.falling.push({ x: d.x, y: land, vx: (d.x > topX ? 1 : -1) * 140, vy: -120, rot: 0, vr: (d.x > topX ? 1 : -1) * 4 });
            Sfx.play('hurt');
            parts.text(d.x, land - 10, 'Trượt!', '#ff8fa8', 24);
          }
          p.drop = null;
          p.sx = p.cx + (Math.random() < 0.5 ? -1 : 1) * (this.laneW / 2 - BW / 2 - 6); p.dir = p.sx > p.cx ? -1 : 1;
        }
      });
      if (!this.finished && (this.ps.every((p) => p.done) || this.place >= Math.max(1, this.n - 1))) this.finished = true;
    }

    drawBox(ctx, x, y, c, rot = 0, alpha = 1) {
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y + BH / 2); ctx.rotate(rot);
      ctx.fillStyle = c.dark; Draw.rr(ctx, -BW / 2, -BH / 2, BW, BH, 6); ctx.fill();
      ctx.fillStyle = c.main; Draw.rr(ctx, -BW / 2 + 3, -BH / 2 + 3, BW - 6, BH - 10, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-BW / 2 + 10, -BH / 2 + 9); ctx.lineTo(BW / 2 - 10, -BH / 2 + 9); ctx.stroke();
      ctx.restore();
    }

    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#ffd59e'); g.addColorStop(1, '#ff9f7a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(W - 160, 170, 60, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8a5a3b'; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = '#6fbf5a'; ctx.fillRect(0, GROUND, W, 10);
      const goalY = GROUND - (this.goal + 1) * BH;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.setLineDash([12, 10]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, goalY); ctx.lineTo(W, goalY); ctx.stroke(); ctx.setLineDash([]);
      Draw.text(ctx, `🏁 ${this.goal} hộp`, 70, goalY - 16, { size: 20 });
      this.ps.forEach((p, i) => {
        const c = this.P[i].color;
        if (i > 0) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(this.laneW * i - 2, 80, 4, GROUND - 80); }
        // bệ
        ctx.fillStyle = '#5b5e78'; Draw.rr(ctx, p.cx - BW / 2 - 10, GROUND - BH, BW + 20, BH, 6); ctx.fill();
        // tháp lắc: nghiêng theo độ lệch trọng tâm, rung khi sắp đổ
        const ang = this.phys ? p.tilt * 0.05 + (p.risk > 0.6 ? Math.sin(U.now() * 14) * (p.risk - 0.6) * 0.04 : 0) : 0;
        ctx.save(); ctx.translate(p.cx, GROUND - BH); ctx.rotate(ang); ctx.translate(-p.cx, -(GROUND - BH));
        for (let k = 1; k < p.stack.length; k++) this.drawBox(ctx, p.stack[k], GROUND - (k + 1) * BH, c);
        if (this.phys && p.stack.length > 2) {
          // vạch trọng tâm
          let sum = 0; for (let k = 1; k < p.stack.length; k++) sum += p.stack[k];
          const com = sum / (p.stack.length - 1);
          ctx.strokeStyle = p.risk > 0.7 ? '#ff3b52' : 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([3, 5]);
          ctx.beginPath(); ctx.moveTo(com, GROUND - BH); ctx.lineTo(com, this.topY(p)); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.restore();
        for (const f of p.falling) this.drawBox(ctx, f.x, f.y, c, f.rot, 0.8);
        const topY = this.topY(p);
        if (!p.done) {
          if (p.drop) this.drawBox(ctx, p.drop.x, p.drop.y, c);
          else {
            ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(p.sx, topY - 64); ctx.lineTo(p.sx, topY - 44); ctx.stroke(); ctx.setLineDash([]);
            this.drawBox(ctx, p.sx, topY - 104, c, 0, p.cool > 0 ? 0.4 : 1);
          }
        }
        const bx = p.stack[p.stack.length - 1];
        Draw.blob(ctx, { x: bx, y: topY - (p.drop || !p.done ? 0 : Math.abs(Math.sin(U.now() * 8)) * 14) - 24 + (p.done ? 0 : 0),
          r: 20, color: c, face: -Math.PI / 2, shadow: false, crown: p.done && p.rank === 1 });
        Draw.text(ctx, `${p.stack.length - 1}/${this.goal}`, p.cx, GROUND + 26, { size: 22, color: c.light });
      });
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.done ? `🏁 #${p.rank}` : `📦 ${p.stack.length - 1}` + (this.phys && p.risk > 0.7 ? ' ⚠️' : ''))));
      Draw.timer(ctx, this.time, W - 72, 38);
    }

    results() {
      return this.ps.map((p) => (p.done
        ? { score: 1000 - p.rank, text: `Xong thứ ${p.rank} · ${p.time.toFixed(1)} giây` }
        : { score: p.stack.length - 1 - p.misses * 0.01, text: `${p.stack.length - 1} hộp · trượt ${p.misses}` + (this.phys ? ` · đổ ${p.falls}` : '') }));
    }

    /** vị trí nhân vật trên màn hình (cho biểu cảm, rung tay cầm...) — null nếu đang không hiện */
    posOf(i) { const p = this.ps[i]; return { x: p.stack[p.stack.length - 1], y: this.topY(p) - 24 }; }

    botInput(i) {
      const p = this.ps[i];
      const o = { actP: false };
      if (p.done || p.drop || p.cool > 0) return o;
      const lv = this.api.bot;
      const topX = p.stack[p.stack.length - 1];
      // máy chờ hộp tới gần tháp rồi mới thả; máy dễ ngắm kém hơn
      // mỗi lần thả máy ngắm lệch một chút (máy càng dễ càng lệch nhiều)
      if (p.aim === undefined) p.aim = U.rand(-1, 1) * (8 + lv.actDrop * 110);
      const lead = p.dir * this.speed(p) * 0.04;
      // tháp lắc: ngắm bù về phía ngược độ nghiêng để kéo trọng tâm về giữa
      const want = this.phys ? U.clamp(topX - p.tilt * 40 + (p.cx - topX) * 0.3, topX - BW * 0.45, topX + BW * 0.45) : topX;
      if (Math.abs(p.sx + lead - (want + p.aim)) < 10 && Math.random() < 0.6) { o.actP = true; p.aim = undefined; }
      return o;
    }
  }

  Party.register({
    id: 'stack', name: 'Xếp Hộp', emoji: '📦', cat: 'brain',
    tagline: 'Bấm đúng lúc để thả hộp · xây đủ tầng trước là thắng',
    how: 'Hộp chạy qua lại phía trên tháp của bạn — bấm nút Đánh để thả. Hộp phải đè lên hộp dưới ít nhất một nửa, không thì rơi mất. Tháp càng cao hộp chạy càng nhanh!',
    controls: { move: '(không dùng)', act: 'Thả hộp' },
    modes: MODES,
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Stack(api),
  });
})();
