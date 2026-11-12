'use strict';
/* Bóng Chày — mỗi người 1 làn, cùng nhận chung 1 loạt cú ném. Bấm Đánh đúng lúc bóng chạm vạch trắng.
   Bóng nhanh, bóng chậm, bóng đổi tốc... và BÓNG BOM: đừng đánh! */
(() => {
  const TOP = 84, HX = 250, PX = 1130, INTERVAL = 1.9;
  const TYPES = [
    { id: 'normal', sp: 720, w: 4 }, { id: 'fast', sp: 1000, w: 3 }, { id: 'slow', sp: 480, w: 2 },
    { id: 'change', sp: 820, w: 2 }, { id: 'bomb', sp: 640, w: 2 },
  ];

  const TNAME = { normal: 'Thường', fast: 'Nhanh', slow: 'Chậm', change: 'Đổi tốc', bomb: '💣 Bom' };
  const PATHS = [{ id: 'straight', name: 'Thẳng' }, { id: 'stop', name: 'Khựng' }, { id: 'accel', name: 'Tăng tốc' }];
  const MODES = [
    { id: 'classic', name: 'Máy ném', desc: 'Máy ném bóng, mọi người cùng đánh.' },
    { id: 'pitcher', name: 'Người ném', desc: 'Đổi vai mỗi cú ném: một người làm người ném — ↑↓ chọn loại bóng, ←→ chọn đường ném (Thẳng / Khựng giữa đường / Tăng tốc cuối), bấm Đánh để ném. Bóng ngụy trang tới giữa đường mới lộ là bom! Người đánh trượt thì người ném +1, đánh trúng bom thì người ném +2.' },
  ];
  const MID = (PX + HX) / 2;

  class Baseball {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.pitches = api.count(10); this.k = 0; this.finished = false; this.t = 1.4;
      this.LH = (H - TOP - 10) / this.n;
      this.ps = this.P.map(() => ({ score: 0, swingT: 0, swung: false, res: null, resT: 0, hits: 0 }));
      this.ball = null; this.flying = [];
      this.bot = this.P.map(() => ({ off: 0, skip: false }));
      const pool = TYPES.flatMap((tp) => Array(tp.w).fill(tp));
      this.seq = Array.from({ length: this.pitches }, (_, k) => (k < 2 ? TYPES[0] : U.pick(pool)));
      this.pm = api.mode === 'pitcher';
      if (this.pm) {
        this.per = api.count(3); this.pitches = this.per * this.n; this.order = U.shuffle(this.P.map((_, i) => i));
        this.pitcher = -1; this.sel = { t: 0, p: 0 }; this.aimT = 0; this.prevIn = { mx: 0, my: 0 }; this.botPlan = null;
      }
    }
    /** BSB1: người ném chọn loại bóng & đường ném */
    updateAim(dt, inp) {
      const q = inp[this.pitcher], pv = this.prevIn;
      this.aimT += dt;
      const ey = Math.abs(q.my) > 0.5 && Math.abs(pv.my) <= 0.5 ? Math.sign(q.my) : 0;
      const ex = Math.abs(q.mx) > 0.5 && Math.abs(pv.mx) <= 0.5 ? Math.sign(q.mx) : 0;
      this.prevIn = { mx: q.mx, my: q.my };
      if (ey) { this.sel.t = (this.sel.t + ey + TYPES.length) % TYPES.length; Sfx.play('select'); }
      if (ex) { this.sel.p = (this.sel.p + ex + PATHS.length) % PATHS.length; Sfx.play('select'); }
      if ((q.actP && this.aimT > 0.4) || this.aimT > 5) {
        this.aiming = false;
        this.pitch(TYPES[this.sel.t], PATHS[this.sel.p].id);
      }
    }

    pitch(forced, path = 'straight') {
      const tp = forced || this.seq[this.k]; this.k++;
      this.ball = { x: PX - 40, sp: tp.sp * U.rand(0.92, 1.08), type: tp.id, t: 0, done: false, path, hold: 0, disguise: this.pm };
      this.ps.forEach((p) => { p.swung = false; });
      this.bot.forEach((b, j) => {
        const lv = this.api.botOf(j); // mỗi máy một mức
        b.off = U.rand(-1, 1) * (8 + lv.actDrop * 95);
        b.skip = tp.id === 'bomb' && Math.random() < 1 - lv.actDrop * 0.8;
      });
      Sfx.play('dash');
    }

    judge(p, i, x) {
      if (this.pm && i === this.pitcher) return;
      const parts = this.api.parts, y = TOP + this.LH * (i + 0.5);
      const err = Math.abs(x - HX);
      let pts = 0, txt = 'Trượt!', col = '#ccc';
      if (this.ball.type === 'bomb') {
        if (err < 60) { pts = -2; txt = 'BÙM! −2'; col = '#ff5a5a'; Sfx.play('boom'); FX.shake(8);
          parts.burst(HX + 30, y, ['#ff7a1a', '#ffe14d', '#333'], 30, 320, 0.6, 7); }
        else txt = 'Hú hồn!';
      } else if (err < 12) { pts = 3; txt = 'HOME RUN! +3'; col = '#ffe14d'; Sfx.play('goal', 0.05); }
      else if (err < 28) { pts = 2; txt = 'Tốt! +2'; col = '#5dff9b'; Sfx.play('kick'); }
      else if (err < 55) { pts = 1; txt = 'Chạm bóng +1'; col = '#9fd8ff'; Sfx.play('kick'); }
      else txt = x > HX ? 'Sớm quá!' : 'Trễ rồi!';
      p.score += pts; p.res = { txt, col }; p.resT = 1.2;
      if (this.pm) { const pp = this.ps[this.pitcher]; if (this.ball.type === 'bomb' ? pts < 0 : pts === 0) pp.score += this.ball.type === 'bomb' ? 2 : 1; }
      if (pts > 0) {
        p.hits++;
        this.flying.push({ x: HX + 20, y, vx: 500 + pts * 260, vy: -220 - pts * 130, lane: i, t: 1.4, hr: pts === 3 });
      }
    }

    update(dt, inp) {
      if (this.finished) return;
      for (const p of this.ps) { p.swingT -= dt; p.resT -= dt; }
      for (const f of this.flying) { f.t -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 600 * dt; }
      this.flying = this.flying.filter((f) => f.t > 0);
      if (!this.ball || this.ball.done) {
        this.t -= dt;
        if (this.t <= 0) {
          if (this.k >= this.pitches) { this.finished = true; return; }
          if (this.pm) {
            if (!this.aiming) {
              this.aiming = true; this.aimT = 0; this.pitcher = this.order[this.k % this.n]; this.botPlan = null;
              this.prevIn = { mx: inp[this.pitcher].mx, my: inp[this.pitcher].my };
            }
            this.updateAim(dt, inp);
            if (!this.aiming) this.t = 1.2;
          } else { this.pitch(); this.t = INTERVAL; }
        }
      }
      const b = this.ball;
      if (b && !b.done) {
        b.t += dt;
        let sp = b.sp;
        if (b.type === 'change' && b.x < PX - 380) sp = b.sp * 0.42; // bóng đổi tốc: chậm hẳn lại giữa đường
        if (b.path === 'stop' && b.x < MID && b.hold < 0.35) { b.hold += dt; sp = 0; }
        if (b.path === 'accel') sp *= b.x > HX + (PX - HX) * 0.4 ? 0.6 : 1.5;
        if (b.disguise && b.x < MID) { b.disguise = false; if (b.type === 'bomb') Sfx.play('warn'); }
        b.x -= sp * dt;
        inp.forEach((q, i) => {
          const p = this.ps[i];
          if (this.pm && i === this.pitcher) return;
          if (q.actP && !p.swung) { p.swung = true; p.swingT = 0.25; this.judge(p, i, b.x); }
        });
        if (b.x < HX - 90) {
          b.done = true;
          this.ps.forEach((p, i) => {
            if (this.pm && i === this.pitcher) return;
            if (!p.swung && this.pm && b.type !== 'bomb') this.ps[this.pitcher].score += 1;
            if (!p.swung) { p.res = { txt: b.type === 'bomb' ? 'Né bom giỏi!' : 'Bỏ lỡ', col: b.type === 'bomb' ? '#5dff9b' : '#ccc' }; p.resT = 1; }
          });
        }
      }
    }

    drawBall(ctx, x, y, type, s = 1) {
      if (type === 'bomb') {
        ctx.fillStyle = '#1b1b29'; ctx.beginPath(); ctx.arc(x, y, 12 * s, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#d9c08a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 4, y - 10); ctx.lineTo(x + 9, y - 17); ctx.stroke();
        Draw.sparkle(ctx, x + 9, y - 18, 5 + Math.random() * 3, '#ffe14d');
        return;
      }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 10 * s, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#e8384f'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x - 6 * s, y, 7 * s, -0.9, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 6 * s, y, 7 * s, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
    }

    draw(ctx) {
      ctx.fillStyle = '#2f7d3a'; ctx.fillRect(0, 0, W, H);
      this.ps.forEach((p, i) => {
        const y0 = TOP + this.LH * i, cy = y0 + this.LH / 2, c = this.P[i].color;
        ctx.fillStyle = i % 2 ? '#4aa04a' : '#52ab52'; ctx.fillRect(0, y0, W, this.LH);
        ctx.fillStyle = '#c9a26b'; ctx.fillRect(HX - 40, cy - 12, PX - HX + 80, 24);
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(HX - 3, y0 + 8, 6, this.LH - 16);
        // người ném
        const isP = this.pm && i === this.pitcher;
        Draw.blob(ctx, { x: PX + 30, y: cy, r: Math.min(26, this.LH * 0.28), color: this.pm && this.pitcher >= 0 ? this.P[this.pitcher].color : { main: '#b9b3cc', dark: '#7c7695', light: '#f1eff7' }, face: Math.PI });
        if (isP) {
          ctx.fillStyle = 'rgba(20,12,40,0.55)'; ctx.fillRect(0, y0, W, this.LH);
          Draw.text(ctx, `🎯 ${this.P[i].name} đang ném  ·  ${p.score} điểm`, W / 2, cy - (this.aiming ? this.LH * 0.22 : 0), { size: 22, color: c.light, sw: 4 });
          if (this.aiming) {
            const row = (items, k, y, lab) => {
              Draw.text(ctx, lab, 180, y, { size: 16, color: '#ccc', sw: 3 });
              items.forEach((it, j) => {
                const x = 300 + j * 140;
                Draw.rr(ctx, x - 62, y - 15, 124, 30, 15); ctx.fillStyle = j === k ? c.main : 'rgba(255,255,255,0.12)'; ctx.fill();
                Draw.text(ctx, it, x, y + 1, { size: 16, sw: 3 });
              });
            };
            row(TYPES.map((tp) => TNAME[tp.id]), this.sel.t, cy + this.LH * 0.05, 'Bóng (↑↓)');
            row(PATHS.map((pt) => pt.name), this.sel.p, cy + this.LH * 0.05 + 36, 'Đường (←→)');
            Draw.text(ctx, `Bấm Đánh để ném · tự ném sau ${Math.max(0, Math.ceil(5 - this.aimT))}s`, 1085, cy + this.LH * 0.05 + 18, { size: 15, color: '#ffe14d', sw: 3 });
          }
          return;
        }
        // người đánh + gậy
        const r = Math.min(26, this.LH * 0.28);
        Draw.blob(ctx, { x: HX - 60, y: cy, r, color: c, face: 0 });
        const sw = p.swingT > 0 ? 1 - p.swingT / 0.25 : 0;
        const a = -1.9 + sw * 2.6;
        ctx.strokeStyle = '#a8743a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(HX - 46, cy); ctx.lineTo(HX - 46 + Math.cos(a) * 58, cy + Math.sin(a) * 58); ctx.stroke();
        Draw.text(ctx, `${this.P[i].name}  ${p.score}`, 70, y0 + 18, { size: 18, color: c.light, sw: 4 });
        if (p.resT > 0) Draw.text(ctx, p.res.txt, HX + 140, cy - this.LH * 0.28, { size: 24, color: p.res.col, sw: 5 });
        if (this.ball && !this.ball.done) this.drawBall(ctx, this.ball.x, cy, this.ball.disguise ? 'normal' : this.ball.type);
      });
      for (const f of this.flying) {
        this.drawBall(ctx, f.x, f.y, 'normal', 0.9);
        if (f.hr && Math.random() < 0.5) Draw.sparkle(ctx, f.x - 10, f.y + 6, 6, '#ffe14d');
      }
      Draw.label(ctx, `Cú ném ${Math.min(this.k, this.pitches)}/${this.pitches}`, 100, 38);
      Draw.chips(ctx, this.P, this.ps.map((p) => `⚾ ${p.score}`), { w: 170 });
      if (this.ball && !this.ball.done && this.ball.type === 'bomb' && !this.ball.disguise) Draw.text(ctx, '💣 BÓNG BOM — ĐỪNG ĐÁNH!', W / 2 + 120, TOP - 14, { size: 22, color: '#ff8a8a', sw: 4 });
    }

    results() { return this.ps.map((p) => ({ score: p.score, text: `${p.score} điểm · ${p.hits} lần đánh trúng` })); }

    /** vị trí nhân vật trên màn hình (cho biểu cảm, rung tay cầm...) — null nếu đang không hiện */
    posOf(i) { return { x: HX - 60, y: TOP + this.LH * i + this.LH / 2 }; }

    botInput(i) {
      const p = this.ps[i], st = this.bot[i], b = this.ball;
      const o = { actP: false, mx: 0, my: 0 };
      if (this.pm && i === this.pitcher) {
        if (!this.aiming) return o;
        // máy ném: chọn bóng & đường ngẫu nhiên, đôi khi đổi ý phút chót
        if (!this.botPlan) this.botPlan = { t: U.randi(0, TYPES.length - 1), p: U.randi(0, PATHS.length - 1), at: U.rand(1, 2.6), step: 0 };
        const bp = this.botPlan;
        bp.step++;
        if (bp.step % 2 === 0) return o; // nhả cần gạt giữa các lần bấm
        if (this.sel.t !== bp.t) o.my = 1; else if (this.sel.p !== bp.p) o.mx = 1;
        else if (this.aimT > bp.at) o.actP = true;
        return o;
      }
      if (!b || b.done || p.swung || st.skip) return o;
      // bấm khi bóng tới vạch (cộng độ lệch ngẫu nhiên)
      if (b.x <= HX + st.off + 6) o.actP = true;
      return o;
    }
  }

  Party.register({
    id: 'baseball', name: 'Bóng Chày', emoji: '⚾', cat: 'brain',
    tagline: 'Đập bóng đúng lúc chạm vạch · tránh đánh bóng bom',
    how: 'Mỗi cú ném, bấm nút Đánh đúng lúc bóng chạm vạch trắng: càng chuẩn càng nhiều điểm (Home run +3). Coi chừng bóng chậm, bóng đổi tốc giữa đường — và BÓNG BOM màu đen: đánh trúng là −2!',
    controls: { move: 'Người ném: chọn bóng & đường', act: 'Vung gậy / Ném' },
    modes: MODES,
    minPlayers: 2, maxPlayers: 4,
    rawBot: true, // máy tự xử lý độ khó bằng độ lệch thời gian
    create: (api) => new Baseball(api),
  });
})();
