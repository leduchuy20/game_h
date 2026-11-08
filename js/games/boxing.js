'use strict';
/* Võ Đài — đấm đối thủ hết máu. Né lướt để bất tử một nhịp. 3 hiệp, thắng 2 hiệp trước. */
(() => {
  const RX = 300, RY = 112, RW = 680, RH = 570;
  const ROUND_TIME = 40;
  const HEAVY_MIN = 0.45, HEAVY_MAX = 0.9, PARRY = 0.2;   // giữ Đánh ≥ HEAVY_MIN rồi thả = đòn mạnh; bấm Nhảy trong PARRY giây trước cú đấm = đỡ hoàn hảo

  class Boxing {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.wins = new Array(this.n).fill(0);
      this.round = 0; this.need = api.wins; this.maxRounds = api.wins * 2 - 1; this.finished = false;
      this.startRound();
    }

    startRound() {
      this.round++;
      const cx = RX + RW / 2, cy = RY + RH / 2;
      this.ps = this.P.map((p, i) => {
        const a = Math.PI + i * TAU / this.n;
        return {
          x: cx + Math.cos(a) * 200, y: cy + Math.sin(a) * 180, vx: 0, vy: 0, r: 28, face: a + Math.PI, walk: 0,
          hp: 100, alive: true, punchT: 0, punchCd: 0.3, side: 1, hitDone: true, dodgeT: 0, dodgeCd: 0,
          inv: 0, stun: 0, flash: 0, squash: 0, skip: false, deadT: 0, hold: 0, heavy: false, parryWin: 0, parryT: 0,
        };
      });
      this.time = ROUND_TIME; this.over = false; this.overT = 0;
      this.bannerText = `Hiệp ${this.round}`; this.bannerColor = '#fff'; this.bannerT = 0;
      this.freeze = this.round === 1 ? 0 : 1.3;
    }

    update(dt, inp) {
      const parts = this.api.parts;
      this.bannerT += dt;
      if (this.freeze > 0) { this.freeze -= dt; return; }
      if (!this.over) this.time -= dt;
      this.ps.forEach((p, i) => {
        p.squash *= Math.pow(0.01, dt); p.flash -= dt;
        if (!p.alive) { p.deadT += dt; p.skip = true; return; }
        const q = inp[i];
        p.punchT -= dt; p.punchCd -= dt; p.dodgeT -= dt; p.dodgeCd -= dt; p.inv -= dt; p.stun -= dt; p.parryWin -= dt; p.parryT -= dt;
        const can = p.stun <= 0 && !this.over;
        if (can && (q.mx || q.my)) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        // BOX1: chạm Đánh = đấm nhanh; giữ Đánh = gồng đòn mạnh, thả ra (hoặc gồng đầy) thì tung
        if (can && q.actP && p.punchCd <= 0 && p.dodgeT <= 0) {
          p.punchT = 0.16; p.punchCd = 0.38; p.side *= -1; p.hitDone = false; p.heavy = false;
          Sfx.play('punch', 0.02);
        }
        if (can && q.act && p.dodgeT <= 0) p.hold += dt;
        if (p.hold > 0 && (!q.act || p.hold >= HEAVY_MAX || !can)) {
          if (can && p.hold >= HEAVY_MIN) {
            p.punchT = 0.24; p.punchCd = 0.6; p.side *= -1; p.hitDone = false; p.heavy = true;
            const a = p.face; p.vx += Math.cos(a) * 320; p.vy += Math.sin(a) * 320;
            Sfx.play('dash'); Sfx.play('punch', 0.02);
          }
          p.hold = 0;
        }
        if (can && q.jumpP) p.parryWin = PARRY;
        if (can && q.jumpP && p.dodgeCd <= 0) {
          const a = (q.mx || q.my) ? Math.atan2(q.my, q.mx) : p.face + Math.PI;
          p.dodgeT = 0.2; p.inv = 0.28; p.dodgeCd = 0.9;
          p.vx = Math.cos(a) * 620; p.vy = Math.sin(a) * 620;
          Sfx.play('dash');
        }
        if (p.dodgeT <= 0) {
          const sp = can ? (p.punchT > 0 ? 110 : p.hold > 0.2 ? 120 : 235) : 0, k = Math.min(1, dt * (can ? 10 : 3));
          p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        }
        // trúng đòn ở giữa cú đấm
        if (p.punchT > 0 && p.punchT < 0.1 && !p.hitDone) {
          p.hitDone = true;
          this.ps.forEach((o, j) => {
            if (j === i || !o.alive) return;
            const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
            if (d < p.r + o.r + (p.heavy ? 44 : 32) && Math.abs(U.angDiff(p.face, Math.atan2(dy, dx))) < 0.75) {
              // BOX2: vừa bấm Nhảy ngay trước cú đấm → đỡ hoàn hảo, người đấm bị choáng
              if (o.parryWin > 0) {
                o.parryWin = 0; o.parryT = 0.4; o.inv = Math.max(o.inv, 0.3);
                p.stun = p.heavy ? 1.2 : 0.9; p.vx = -dx / d * 380; p.vy = -dy / d * 380; p.flash = 0.2;
                Sfx.play('crown'); FX.shake(6); Party.rumble(i, 0.5, 200);
                parts.text(o.x, o.y - 60, 'Đỡ hoàn hảo!', '#9fd8ff', 28);
                return;
              }
              // né lướt thì tránh được đòn thường, đòn mạnh vẫn trúng
              if (o.inv > 0 && !p.heavy) return;
              const dmg = p.heavy ? U.randi(22, 27) : U.randi(11, 15);
              o.hp -= dmg; o.stun = p.heavy ? 0.6 : 0.25; o.flash = 0.15; o.squash = 0.25;
              const kb = p.heavy ? 650 : 300;
              o.vx += dx / d * kb; o.vy += dy / d * kb;
              if (p.heavy) parts.text(o.x, o.y - 76, 'BỐP!', '#ffe14d', 34);
              Sfx.play('hit'); FX.shake(5); Party.rumble(j, 0.6, 150);
              parts.burst(o.x - dx / d * o.r, o.y - dy / d * o.r, ['#fff', '#ffe14d'], 10, 220, 0.35, 5, { shape: 's' });
              parts.text(o.x, o.y - 50, `−${dmg}`, '#ff8fa8', 24);
              if (o.hp <= 0) {
                o.hp = 0; o.alive = false;
                Sfx.play('boom'); FX.shake(10);
                parts.text(o.x, o.y - 80, 'K.O.!', '#ffe14d', 46);
              }
            }
          });
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        // dây đài: nảy lại
        if (p.x < RX + p.r) { p.x = RX + p.r; p.vx = Math.abs(p.vx) * 0.6; }
        if (p.x > RX + RW - p.r) { p.x = RX + RW - p.r; p.vx = -Math.abs(p.vx) * 0.6; }
        if (p.y < RY + p.r) { p.y = RY + p.r; p.vy = Math.abs(p.vy) * 0.6; }
        if (p.y > RY + RH - p.r) { p.y = RY + RH - p.r; p.vy = -Math.abs(p.vy) * 0.6; }
        p.skip = false;
      });
      Phys.separate(this.ps, 0.4);

      if (!this.over) {
        const alive = this.ps.map((p, i) => (p.alive ? i : -1)).filter((i) => i >= 0);
        let w = -2;
        if (alive.length <= 1) w = alive.length ? alive[0] : -1;
        else if (this.time <= 0) {
          const best = Math.max(...alive.map((i) => this.ps[i].hp));
          const top = alive.filter((i) => this.ps[i].hp === best);
          w = top.length === 1 ? top[0] : -1;
        }
        if (w > -2) {
          this.over = true; this.overT = 2.4; this.bannerT = 0;
          if (w >= 0) {
            this.wins[w]++;
            this.bannerText = `${this.P[w].name} thắng hiệp!`; this.bannerColor = this.P[w].color.light;
          } else { this.bannerText = 'Hòa!'; this.bannerColor = '#fff'; }
          Sfx.play('crown');
        }
      } else {
        this.overT -= dt;
        if (this.overT <= 0 && !this.finished) {
          if (this.round >= this.maxRounds || Math.max(...this.wins) >= this.need) this.finished = true;
          else this.startRound();
        }
      }
    }

    draw(ctx) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 800);
      g.addColorStop(0, '#2b1d4f'); g.addColorStop(1, '#0c0818');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // khán giả
      for (let k = 0; k < 40; k++) {
        const x = (k * 97) % W, y = k % 2 ? 640 + (k % 3) * 20 : 120 + (k % 5) * 50;
        if (x > RX - 40 && x < RX + RW + 40) continue;
        ctx.fillStyle = `hsla(${(k * 47) % 360},40%,55%,0.35)`;
        ctx.beginPath(); ctx.arc(x, y + Math.sin(U.now() * 4 + k) * 3, 16, 0, TAU); ctx.fill();
      }
      // sàn đài
      ctx.fillStyle = '#1d3f8f'; ctx.fillRect(RX - 26, RY - 26, RW + 52, RH + 52);
      ctx.fillStyle = '#3c78d8'; ctx.fillRect(RX, RY, RW, RH);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(RX + RW / 2, RY + RH / 2, 90, 0, TAU); ctx.stroke();
      // dây đài
      const ropes = ['#e8384f', '#fff', '#3d9bff'];
      ropes.forEach((c, k) => {
        ctx.strokeStyle = c; ctx.lineWidth = 5;
        const o = 6 + k * 7;
        ctx.strokeRect(RX - o, RY - o, RW + o * 2, RH + o * 2);
      });
      for (const [x, y] of [[RX - 22, RY - 22], [RX + RW + 22, RY - 22], [RX - 22, RY + RH + 22], [RX + RW + 22, RY + RH + 22]]) {
        ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e8384f'; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
      }
      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i], c = this.P[i].color;
        if (!p.alive) {
          Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: c, dead: true, squash: 0.35, alpha: 0.8 });
          continue;
        }
        const blink = p.inv > 0 && Math.sin(U.now() * 40) > 0;
        Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: c, face: p.face, walk: p.walk, squash: p.squash,
          stun: p.stun > 0.1, alpha: blink ? 0.5 : 1 });
        if (p.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
        // găng
        for (const s of [-1, 1]) {
          const dur = p.heavy ? 0.24 : 0.16;
          const ext = p.punchT > 0 && s === p.side ? (p.heavy ? 46 : 34) * Math.sin(Math.max(0, dur - p.punchT) / dur * Math.PI) : (p.hold > 0.2 && s === p.side ? -8 : 0);
          const a = p.face + s * 0.65 * (1 - ext / 60);
          const gx = p.x + Math.cos(a) * (p.r + 6 + ext), gy = p.y + Math.sin(a) * (p.r + 6 + ext) - 4;
          ctx.fillStyle = '#e8384f'; ctx.strokeStyle = 'rgba(20,10,40,0.6)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(gx, gy, 12, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(gx - 3, gy - 4, 4, 0, TAU); ctx.fill();
        }
        if (p.hold > 0.2) {
          const k = Math.min(1, p.hold / HEAVY_MIN);
          ctx.strokeStyle = k >= 1 ? '#ff5a3a' : '#ffe14d'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 12, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
        }
        if (p.parryT > 0) { ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 10 + (0.4 - p.parryT) * 60, 0, TAU); ctx.stroke(); }
        // thanh máu
        const bw = 64, bx = p.x - bw / 2, by = p.y - p.r - 30;
        Draw.rr(ctx, bx, by, bw, 10, 5); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
        Draw.rr(ctx, bx, by, bw * p.hp / 100, 10, 5); ctx.fillStyle = p.hp > 50 ? '#5dff9b' : p.hp > 25 ? '#ffc23a' : '#ff3b52'; ctx.fill();
      }
      Draw.label(ctx, `Hiệp ${this.round}/${this.maxRounds}`, 90, 38);
      Draw.chips(ctx, this.P, this.wins.map((w) => '★'.repeat(w) + '☆'.repeat(Math.max(0, this.need - w))), { dim: this.ps.map((p) => !p.alive) });
      Draw.timer(ctx, this.time, W - 72, 38);
      if (this.bannerT < 1.4 || this.over) Draw.banner(ctx, this.bannerText, this.bannerT, { color: this.bannerColor, size: 66, y: 300 });
    }

    results() { return this.wins.map((w) => ({ score: w, text: `${w} hiệp thắng` })); }

    botInput(i) {
      const p = this.ps[i], st = this.bot || (this.bot = this.P.map(() => ({ hold: 0 })));
      const o = { mx: 0, my: 0, actP: false, jumpP: false, act: false };
      if (!p.alive || this.freeze > 0 || this.over) return o;
      // đang gồng đòn mạnh: giữ nút, tiến về đối thủ
      if (st[i].hold > 0) {
        st[i].hold -= 1 / 60; o.act = st[i].hold > 0;
        let tg = null, dd = Infinity;
        this.ps.forEach((q, j) => { if (j !== i && q.alive) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < dd) { dd = d; tg = q; } } });
        if (tg) { const a = Math.atan2(tg.y - p.y, tg.x - p.x); o.mx = Math.cos(a) * (dd > 80 ? 1 : 0.2); o.my = Math.sin(a) * (dd > 80 ? 1 : 0.2); }
        return o;
      }
      let tgt = null, td = Infinity;
      this.ps.forEach((q, j) => {
        if (j === i || !q.alive) return;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < td) { td = d; tgt = q; }
      });
      if (!tgt) return o;
      const a = Math.atan2(tgt.y - p.y, tgt.x - p.x);
      // né khi đối thủ vừa vung tay về phía mình
      this.ps.forEach((q, j) => {
        if (j === i || !q.alive || q.punchT < 0.08) return;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < 100 && Math.abs(U.angDiff(q.face, Math.atan2(p.y - q.y, p.x - q.x))) < 0.6 && p.dodgeCd <= 0 && Math.random() < 0.35) {
          o.jumpP = true; const s = Math.random() < 0.5 ? 1 : -1;   // né lướt (trúng thời điểm thì thành đỡ hoàn hảo)
          o.mx = Math.cos(a + s * Math.PI / 2); o.my = Math.sin(a + s * Math.PI / 2);
        }
      });
      if (o.jumpP) return o;
      if (p.hp < 30 && td < 120 && Math.random() < 0.5) { o.mx = -Math.cos(a); o.my = -Math.sin(a); return o; }
      if (td > 72) { o.mx = Math.cos(a); o.my = Math.sin(a); }
      else { o.mx = Math.cos(a) * 0.15; o.my = Math.sin(a) * 0.15; }
      if (td < 90 && Math.abs(U.angDiff(p.face, a)) < 0.4 && p.punchCd <= 0 && Math.random() < 0.3) {
        // thỉnh thoảng gồng đòn mạnh khi đối thủ đang choáng / vừa né xong
        if ((tgt.stun > 0.1 || tgt.dodgeCd > 0.4) && Math.random() < 0.5 * (1 - this.api.bot.actDrop)) { st[i].hold = HEAVY_MIN + 0.05; o.act = true; }
        else o.actP = true;
      }
      return o;
    }
  }

  Party.register({
    id: 'boxing', name: 'Võ Đài', emoji: '🥊',
    tagline: 'Đấm đối thủ hết máu · thắng nhiều hiệp nhất',
    how: 'Chạm Đánh = đấm nhanh (11–15 máu). Giữ Đánh để gồng rồi thả = đòn mạnh (22–27 máu, văng xa, xuyên qua né lướt) nhưng gồng thì đi chậm. Nút Nhảy = né lướt; bấm Nhảy ngay trước khi cú đấm chạm mình = ĐỠ HOÀN HẢO, đối thủ bị choáng. Hết máu là K.O.! Hết giờ thì ai còn nhiều máu nhất thắng hiệp.',
    controls: { move: 'Di chuyển', act: 'Chạm: đấm · Giữ: đòn mạnh', jump: 'Né / đỡ đúng lúc' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Boxing(api),
  });
})();
