'use strict';
/* Kéo Co — 2 đội bấm nút Đánh thật nhanh. Kéo nút thắt qua vạch bên mình là thắng hiệp. */
(() => {
  const WIN = 240, ROUND_TIME = 25, CY = 452;

  class Tug {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.team = TEAMS.split(this.n);
      this.size = [0, 1].map((t) => this.team.filter((x) => x === t).length);
      this.wins = [0, 0]; this.round = 0; this.need = api.wins; this.maxRounds = api.wins * 2 - 1;
      this.finished = false;
      this.lean = this.P.map(() => 0);
      this.rate = this.P.map(() => 0);
      this.bot = this.P.map(() => ({ t: U.rand(0.1, 0.3), rate: U.rand(...api.bot.tug) }));
      this.clouds = Array.from({ length: 5 }, () => [U.rand(0, W), U.rand(40, 200), U.rand(0.6, 1.3)]);
      this.startRound();
    }
    teamOf(i) { return this.team[i]; }

    startRound() {
      this.round++;
      this.knot = 0; this.v = 0; this.time = ROUND_TIME;
      this.over = false; this.overT = 0; this.winner = -1;
      this.freeze = this.round === 1 ? 0 : 1.3;
      this.bannerText = `Hiệp ${this.round}`; this.bannerColor = '#fff'; this.bannerT = 0;
      this.rt = 0;
    }

    update(dt, inp) {
      this.bannerT += dt;
      this.lean = this.lean.map((l) => l * Math.pow(0.003, dt));
      this.rate = this.rate.map((r) => r * Math.pow(0.3, dt));
      for (const c of this.clouds) { c[0] += c[2] * 12 * dt; if (c[0] > W + 120) c[0] = -120; }
      if (this.freeze > 0) { this.freeze -= dt; return; }
      const parts = this.api.parts;
      if (!this.over) {
        this.time -= dt; this.rt += dt;
        inp.forEach((q, i) => {
          if (!q.actP) return;
          const t = this.team[i];
          this.v += (t === 0 ? -1 : 1) * 22 / this.size[t];
          this.lean[i] = 1; this.rate[i] += 1;
          if (!this.P[i].bot) Sfx.play('pull', 0.04);
          if (Math.random() < 0.3) {
            const x = this.memberX(i), dir = t === 0 ? -1 : 1;
            parts.burst(x - dir * 10, CY + 40, ['#a07a4a', '#c9a46e'], 2, 80, 0.4, 4, { g: 200 });
          }
        });
        this.v *= Math.pow(0.2, dt);
        this.knot += this.v * dt;
        let w = -1;
        if (this.knot <= -WIN) w = 0;
        else if (this.knot >= WIN) w = 1;
        else if (this.time <= 0) w = Math.abs(this.knot) < 4 ? 2 : this.knot < 0 ? 0 : 1;
        if (w >= 0) {
          this.over = true; this.overT = 2.4; this.bannerT = 0; this.winner = w;
          if (w < 2) {
            this.wins[w]++;
            this.bannerText = `${TEAMS.names[w]} thắng hiệp!`; this.bannerColor = TEAMS.colors[w];
            Sfx.play('win'); FX.shake(8);
            parts.burst(W / 2 + this.knot, CY - 20, ['#ffe14d', '#ff5c9d', '#4dd0ff', '#fff'], 40, 420, 1, 6, { g: 300 });
          } else { this.bannerText = 'Hòa!'; this.bannerColor = '#fff'; }
        }
      } else {
        if (this.winner < 2) this.knot += (this.winner === 0 ? -1 : 1) * 70 * dt;
        this.overT -= dt;
        if (this.overT <= 0 && !this.finished) {
          if (this.round >= this.maxRounds || Math.max(...this.wins) >= this.need) this.finished = true;
          else this.startRound();
        }
      }
    }

    memberX(i) {
      const t = this.team[i];
      const k = this.team.slice(0, i).filter((x) => x === t).length;
      return W / 2 + this.knot + (t === 0 ? -1 : 1) * (170 + k * 110);
    }

    draw(ctx) {
      // trời
      const g = ctx.createLinearGradient(0, 0, 0, CY);
      g.addColorStop(0, '#6cc4ff'); g.addColorStop(1, '#c9ecff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [x, y, s] of this.clouds) {
        for (const [ox, oy, r] of [[0, 0, 26], [26, -10, 32], [56, 0, 24]]) {
          ctx.beginPath(); ctx.arc(x + ox * s, y + oy * s, r * s, 0, TAU); ctx.fill();
        }
      }
      ctx.fillStyle = '#8fd17a';
      ctx.beginPath(); ctx.ellipse(250, CY + 30, 420, 130, 0, Math.PI, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(1030, CY + 30, 460, 160, 0, Math.PI, TAU); ctx.fill();
      // mặt đất
      ctx.fillStyle = '#5fb24d'; ctx.fillRect(0, CY + 20, W, H - CY - 20);
      ctx.fillStyle = '#6bbf58';
      for (let x = 0; x < W; x += 80) ctx.fillRect(x, CY + 20, 40, H - CY - 20);
      // vũng bùn ở giữa
      ctx.fillStyle = '#7a5532';
      ctx.beginPath(); ctx.ellipse(W / 2, CY + 70, 110, 34, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#946b43';
      ctx.beginPath(); ctx.ellipse(W / 2 - 10, CY + 64, 70, 18, 0, 0, TAU); ctx.fill();
      // vạch thắng
      for (const t of [0, 1]) {
        const x = W / 2 + (t === 0 ? -WIN : WIN);
        ctx.strokeStyle = TEAMS.colors[t]; ctx.lineWidth = 6; ctx.setLineDash([14, 10]);
        ctx.beginPath(); ctx.moveTo(x, CY + 24); ctx.lineTo(x, H - 30); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#6b4a2a'; ctx.fillRect(x - 3, CY - 120, 6, 145);
        ctx.fillStyle = TEAMS.colors[t];
        ctx.beginPath(); ctx.moveTo(x + 3, CY - 120); ctx.lineTo(x + 3 + (t === 0 ? -50 : 50), CY - 104); ctx.lineTo(x + 3, CY - 88); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(W / 2, CY + 24); ctx.lineTo(W / 2, H - 30); ctx.stroke();

      // dây
      const kx = W / 2 + this.knot;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#8a6334'; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(kx - 620, CY + 4); ctx.lineTo(kx + 620, CY + 4); ctx.stroke();
      ctx.strokeStyle = '#d4a868'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(kx - 620, CY + 2); ctx.lineTo(kx + 620, CY + 2); ctx.stroke();
      ctx.strokeStyle = '#a77c45'; ctx.lineWidth = 3; ctx.setLineDash([6, 10]);
      ctx.beginPath(); ctx.moveTo(kx - 620, CY + 2); ctx.lineTo(kx + 620, CY + 2); ctx.stroke();
      ctx.setLineDash([]); ctx.lineCap = 'butt';
      // nút thắt
      ctx.fillStyle = '#e8384f';
      ctx.beginPath(); ctx.arc(kx, CY + 3, 11, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(kx - 4, CY + 8); ctx.lineTo(kx - 16, CY + 48); ctx.lineTo(kx + 2, CY + 40); ctx.fill();
      ctx.beginPath(); ctx.moveTo(kx + 4, CY + 8); ctx.lineTo(kx + 16, CY + 48); ctx.lineTo(kx - 2, CY + 40); ctx.fill();

      // người chơi
      this.P.forEach((p, i) => {
        const t = this.team[i], dir = t === 0 ? -1 : 1;
        const x = this.memberX(i) + dir * this.lean[i] * 10;
        const won = this.over && this.winner === t;
        Draw.blob(ctx, { x, y: CY - 6 - (won ? Math.abs(Math.sin(U.now() * 8)) * 20 : 0), r: 36, color: p.color,
          face: t === 0 ? 0.25 : Math.PI - 0.25, walk: this.lean[i] * 3, squash: this.lean[i] * 0.16,
          stun: this.over && this.winner !== t && this.winner < 2 });
        ctx.fillStyle = p.color.light; ctx.strokeStyle = 'rgba(20,10,40,0.5)'; ctx.lineWidth = 3;
        for (const hx of [-dir * 22, -dir * 40]) {
          ctx.beginPath(); ctx.arc(x + hx, CY + 4, 9, 0, TAU); ctx.fill(); ctx.stroke();
        }
        if (this.rate[i] > 0.5) {
          Draw.text(ctx, p.name, x, CY - 66, { size: 20, color: p.color.light, sw: 4 });
        }
      });

      // HUD
      Draw.label(ctx, `Hiệp ${this.round}/${this.maxRounds}`, 90, 38);
      for (const t of [0, 1]) {
        const x = W / 2 + (t === 0 ? -170 : 170);
        Draw.rr(ctx, x - 140, 14, 280, 50, 25);
        ctx.fillStyle = 'rgba(20,12,40,0.6)'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = TEAMS.colors[t]; ctx.stroke();
        Draw.text(ctx, TEAMS.names[t], x - 50, 40, { size: 22, color: TEAMS.colors[t], sw: 4 });
        Draw.text(ctx, '★'.repeat(this.wins[t]) + '☆'.repeat(Math.max(0, this.need - this.wins[t])), x + 70, 40, { size: 24, sw: 4 });
      }
      Draw.timer(ctx, this.time, W - 72, 38);
      if (!this.over && this.freeze <= 0 && this.rt < 3.5) {
        const s = 1 + 0.06 * Math.sin(U.now() * 14);
        ctx.save(); ctx.translate(W / 2, 190); ctx.scale(s, s);
        Draw.text(ctx, 'BẤM NÚT ĐÁNH LIÊN TỤC!', 0, 0, { size: 46, color: '#ffe14d', sw: 10 });
        ctx.restore();
      }
      if (this.bannerT < 1.4 || this.over) Draw.banner(ctx, this.bannerText, this.bannerT, { color: this.bannerColor, size: 66, y: 260 });
    }

    results() {
      return this.P.map((_, i) => {
        const t = this.team[i];
        return { score: this.wins[t] - this.wins[1 - t], text: `${TEAMS.names[t]} · thắng ${this.wins[t]} hiệp` };
      });
    }

    /** vị trí nhân vật trên màn hình (cho biểu cảm, rung tay cầm...) — null nếu đang không hiện */
    posOf(i) { return { x: this.memberX(i), y: CY - 6 }; }

    botInput(i) {
      const st = this.bot[i];
      const o = { actP: false };
      if (this.freeze > 0 || this.over) return o;
      st.t -= 1 / 60;
      if (st.t <= 0) { o.actP = true; st.t = 1 / (st.rate * U.rand(0.75, 1.25)); }
      return o;
    }
  }

  Party.register({
    id: 'tug', name: 'Kéo Co', emoji: '🪢',
    tagline: 'Cả đội bấm thật nhanh · kéo nút thắt qua vạch bên mình',
    how: 'Bấm nút Đánh liên tục thật nhanh để kéo dây! Kéo nút thắt đỏ qua vạch cờ bên đội mình là thắng hiệp. Đội ít người được tính lực mạnh hơn cho công bằng.',
    controls: { move: '(không dùng)', act: 'Bấm liên tục để kéo' },
    minPlayers: 2, maxPlayers: 4, team: true,
    rawBot: true, // Kéo Co tự xử lý độ khó bằng tốc độ bấm
    create: (api) => new Tug(api),
  });
})();
