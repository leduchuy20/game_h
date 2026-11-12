'use strict';
/* Đấu Sumo — húc văng đối thủ khỏi sàn. Dùng khung PushKit (push_base.js). */
(() => {
  const { PushArena, CHOICES, MODES, LOOKS } = PushKit;

  class Sumo extends PushArena {
    constructor(api) {
      super(api, { baseR: 30, arenas: ['sand', 'ice', 'lava', 'square', 'spin', 'seesaw'] });
    }

    drawBody(ctx, b, o = {}) {
      const c = this.P[b.i].color, s = o.scale ?? 1, r = this.radOf(b);
      const x = b.x + (o.wob || 0);
      Draw.blob(ctx, { x, y: b.y, z: b.z, r, color: c, face: b.face, walk: b.walk, squash: b.squash, scale: s, alpha: o.alpha ?? 1, stun: o.stun });
      if (s < 0.05) return;
      // đai mawashi
      ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
      ctx.translate(x, b.y - b.z); ctx.scale(s * (1 + b.squash), s * (1 - b.squash));
      ctx.fillStyle = '#f4f1e8'; ctx.strokeStyle = 'rgba(20,10,40,0.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, r * 0.48, r * 0.86, r * 0.2, 0, 0, Math.PI); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d94a3a';
      ctx.beginPath(); ctx.ellipse(0, r * 0.62, r * 0.13, r * 0.1, 0, 0, TAU); ctx.fill();
      ctx.restore();
      this.drawLook(ctx, b, x, b.y - b.z - r * s, s);
      if (b.dashT > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 4 + b.dashCh * 4;
        ctx.beginPath(); ctx.arc(x, b.y - b.z, r + 6, b.face - 0.9, b.face + 0.9); ctx.stroke();
      }
    }
  }

  Party.register({
    id: 'sumo', name: 'Đấu Sumo', emoji: '🤼', cat: 'fight',
    tagline: 'Tích lực húc văng đối thủ khỏi sàn · nhiều sàn đấu, vật phẩm, chế độ tập luyện',
    how: 'Giữ nút Đánh để tích lực rồi thả ra để húc — tích càng lâu càng văng xa. Bị húc nhiều thì % tăng và càng dễ văng. '
      + 'Chạm nút Nhảy để dậm đất đẩy người xung quanh, giữ nút Nhảy để đứng tấn chống bị đẩy. Bị đẩy ra mép sàn thì bấm Nhảy thật nhanh để thoát! '
      + 'Sàn sẽ vỡ dần từ ngoài vào. Nhặt vật phẩm 🍙🌶️🛡️🧊💨 để lật kèo.',
    controls: { move: 'Di chuyển', act: 'Giữ: tích lực · Thả: húc', jump: 'Chạm: dậm đất · Giữ: đứng tấn' },
    minPlayers: 2, maxPlayers: 4,
    modes: MODES, playerChoices: CHOICES, looks: LOOKS,
    create: (api) => new Sumo(api),
  });
})();
