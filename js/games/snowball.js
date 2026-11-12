'use strict';
/* Lăn Tuyết — lăn quả cầu tuyết to dần rồi húc đối thủ rơi khỏi sàn. Dùng khung PushKit (push_base.js).
   Cầu càng to càng nặng & húc càng mạnh nhưng tăng tốc chậm hơn. Võ sĩ quyết định cỡ ban đầu và cỡ tối đa. */
(() => {
  const { PushArena, CHOICES, MODES, LOOKS } = PushKit;
  const SNOW = { main: '#eef4ff', dark: '#a9bcd8', light: '#ffffff' };
  const START = { light: 16, mid: 18, heavy: 21 };
  const MAX = { light: 44, mid: 52, heavy: 58 };

  class Snowball extends PushArena {
    constructor(api) {
      const self = {
        baseR: 18,
        arenas: ['snow', 'snowice', 'snowsq', 'snowspin', 'blizzard', 'snowsaw'],
        onSpawn: (b, c) => { b.r = START[c.id]; b.rMax = MAX[c.id]; },
        onMove: (b, dt, g) => {
          const sp = Math.hypot(b.vx, b.vy);
          b.roll += sp * dt / b.r;
          if (!g.over) b.r = Math.min(b.rMax, b.r + sp * dt * 0.006 * (g.A.grow ?? 1));
          if (sp > 120 && Math.random() < dt * 8) g.api.parts.burst(b.x - b.vx / sp * b.r, b.y + b.r * 0.6, '#ffffff', 1, 30, 0.5, 4);
        },
        massMul: (b) => Math.pow(b.r / 24, 1.2),
        accMul: (b) => Math.pow(18 / b.r, 0.35),
        hitMul: (b) => U.clamp(Math.pow(b.r / 26, 0.6), 0.75, 1.6),
      };
      super(api, self);
      this.flakes = Array.from({ length: 70 }, () => [Math.random() * W, Math.random() * H, U.rand(20, 60)]);
    }

    update(dt, inp) {
      super.update(dt, inp);
      const wind = this.wind && this.wind.warn <= 0 ? this.wind.a : null;
      for (const f of this.flakes) {
        f[1] += f[2] * dt; f[0] += Math.sin(f[1] * 0.02) * 10 * dt;
        if (wind !== null) { f[0] += Math.cos(wind) * 500 * dt; f[1] += Math.sin(wind) * 500 * dt; }
        if (f[1] > H) f[1] -= H; if (f[1] < 0) f[1] += H;
        if (f[0] > W) f[0] -= W; if (f[0] < 0) f[0] += W;
      }
    }

    draw(ctx) {
      super.draw(ctx);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (const [x, y] of this.flakes) { ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill(); }
    }

    drawBody(ctx, b, o = {}) {
      const c = this.P[b.i].color, scale = o.scale ?? 1, alpha = o.alpha ?? 1, r = this.radOf(b) * scale;
      const x = b.x + (o.wob || 0), y = b.y - b.z;
      ctx.save(); ctx.globalAlpha = alpha;
      if (scale >= 1) {
        ctx.fillStyle = 'rgba(40,80,140,0.25)';
        ctx.beginPath(); ctx.ellipse(x, b.y + r * 0.85, r, r * 0.3, 0, 0, TAU); ctx.fill();
      }
      ctx.translate(x, y);
      ctx.scale(1 + b.squash, 1 - b.squash);
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
      g.addColorStop(0, SNOW.light); g.addColorStop(0.5, SNOW.main); g.addColorStop(1, SNOW.dark);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = c.main; ctx.stroke();
      // vân tuyết xoay theo khi lăn
      ctx.fillStyle = 'rgba(150,175,215,0.5)';
      for (let k = 0; k < 5; k++) {
        const a = b.roll + k * 1.3, rr = r * (0.3 + (k % 3) * 0.2);
        ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a * 0.7) * rr * 0.8, r * 0.07, 0, TAU); ctx.fill();
      }
      ctx.restore();
      // Tròn bám trên quả cầu (người Nặng to hơn một chút)
      const rr = 13 * this.cls[b.i].size;
      Draw.blob(ctx, { x: x - Math.cos(b.face) * r * 0.2, y: y - r * 0.75, r: rr * scale, color: c, face: b.face,
        shadow: false, alpha, stun: o.stun, walk: b.walk });
      this.drawLook(ctx, b, x - Math.cos(b.face) * r * 0.2, y - r * 0.75 - rr * scale, scale);
      if (b.dashT > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 4 + b.dashCh * 4;
        ctx.beginPath(); ctx.arc(x, y, r + 6, b.face - 0.9, b.face + 0.9); ctx.stroke();
      }
    }
  }

  Party.register({
    id: 'snowball', name: 'Lăn Tuyết', emoji: '⛄', cat: 'fight',
    tagline: 'Lăn cầu tuyết to dần, tích lực húc đối thủ rơi khỏi sàn · nhiều chế độ',
    how: 'Lăn quanh sàn để quả cầu tuyết to dần — càng to càng nặng, húc càng mạnh nhưng tăng tốc chậm hơn (trên hồ băng thì to chậm). '
      + 'Giữ nút Đánh để tích lực rồi thả ra để lao. Chạm Nhảy để dậm đất, giữ Nhảy để đứng tấn. Bị đẩy ra mép thì bấm Nhảy để thoát! '
      + 'Sàn vỡ dần từ ngoài vào, coi chừng bão tuyết thổi bạn đi.',
    controls: { move: 'Lăn cầu tuyết', act: 'Giữ: tích lực · Thả: lao', jump: 'Chạm: dậm đất · Giữ: đứng tấn' },
    minPlayers: 2, maxPlayers: 4,
    modes: MODES, playerChoices: CHOICES, looks: LOOKS,
    create: (api) => new Snowball(api),
  });
})();
