'use strict';
/* Đấu Kiếm — đâm trúng đối thủ để ghi điểm, giơ khiên đỡ để phản đòn. Ai được 5 điểm trước thắng. */
(() => {
  const AX = 70, AY = 96, AW = W - 140, AH = H - 96 - 24;
  const GAME_TIME = 60, TARGET = 5;
  const SPAWN = [[AX + 160, AY + AH / 2], [AX + AW - 160, AY + AH / 2], [AX + AW / 2, AY + 110], [AX + AW / 2, AY + AH - 110]];
  const MODES = [
    { id: 'points', name: 'Tính điểm', desc: 'Đâm trúng đủ số lần trước là thắng.' },
    { id: 'march', name: 'Tiến quân', desc: 'Đội Trái tiến sang phải, Đội Phải tiến sang trái. Mỗi lần hạ địch thì cả trận tiến một màn về phía đối thủ — tới màn cuối là thắng!' },
  ];

  class Fencing {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.finished = false;
      this.march = api.mode === 'march';
      if (this.march) {
        this.team = TEAMS.split(this.n); this.zones = api.count(4); this.zone = 0; this.freeze = 0; this.bannerT = 9;
        this.total = this.time = api.T(90);
      } else { this.target = api.sudden ? 1 : api.count(TARGET); this.teamOf = null; } // ALL13: hiệp phụ quyết tử = 1 chạm
      this.swords = [];
      this.ps = this.P.map((p, i) => ({
        x: SPAWN[i][0], y: SPAWN[i][1], vx: 0, vy: 0, r: 24,
        face: Math.atan2(AY + AH / 2 - SPAWN[i][1], AX + AW / 2 - SPAWN[i][0]), walk: 0,
        lungeT: 0, lungeCd: 0, hitDone: true, blockT: 0, blockCd: 0, stun: 0, dead: 0, inv: 0, points: 0, squash: 0, skip: false, sword: true,
      }));
      if (this.march) this.placeTeams();
    }
    teamOf(i) { return this.team[i]; }
    foes(a, b) { return !this.march || this.team[a] !== this.team[b]; }
    /** chế độ Tiến quân: xếp mỗi đội về phía mình */
    placeTeams() {
      const cnt = [0, 0];
      this.ps.forEach((p, i) => {
        const t = this.team[i], k = cnt[t]++, mem = this.team.filter((x) => x === t).length;
        Object.assign(p, { x: t === 0 ? AX + 160 : AX + AW - 160, y: AY + AH / 2 + (mem > 1 ? (k ? 100 : -100) : 0), vx: 0, vy: 0, dead: 0, inv: 0.8, stun: 0, lungeT: 0, face: t === 0 ? 0 : Math.PI, sword: true });
      });
      this.swords = [];
    }
    /** FEN5: kiếm văng khỏi tay, rơi xuống sân */
    disarm(p, i) {
      if (!p.sword) return;
      p.sword = false;
      const a = U.rand(0, TAU), d = U.rand(110, 190);
      const x = U.clamp(p.x + Math.cos(a) * d, AX + 30, AX + AW - 30), y = U.clamp(p.y + Math.sin(a) * d, AY + 30, AY + AH - 30);
      this.swords.push({ x, y, owner: i, fx: p.x, fy: p.y, t: 0 });
      this.api.parts.text(p.x, p.y - 56, 'Văng kiếm!', '#ffb36b', 26);
    }

    tip(p) { const L = p.sword ? p.r + (p.lungeT > 0 ? 50 : 30) : p.r + (p.lungeT > 0 ? 18 : 6); return [p.x + Math.cos(p.face) * L, p.y + Math.sin(p.face) * L]; }

    respawn(p, i) {
      let best = SPAWN[0], bs = -1;
      for (const s of SPAWN) {
        let m = Infinity;
        this.ps.forEach((q, j) => { if (j !== i && q.dead <= 0) m = Math.min(m, Math.hypot(q.x - s[0], q.y - s[1])); });
        if (m + Math.random() * 50 > bs) { bs = m; best = s; }
      }
      if (this.march) {
        const t = this.team[i];
        Object.assign(p, { x: t === 0 ? AX + 120 : AX + AW - 120, y: U.rand(AY + 100, AY + AH - 100), vx: 0, vy: 0, inv: 1.0, stun: 0, face: t === 0 ? 0 : Math.PI, sword: true });
        this.swords = this.swords.filter((sw) => sw.owner !== i);
        return;
      }
      Object.assign(p, { x: best[0], y: best[1], vx: 0, vy: 0, inv: 1.0, stun: 0, face: Math.atan2(AY + AH / 2 - best[1], AX + AW / 2 - best[0]), sword: true });
      this.swords = this.swords.filter((sw) => sw.owner !== i);
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (this.march) { this.bannerT += dt; if (this.freeze > 0) { this.freeze -= dt; return; } }
      if (!this.finished) { this.time -= dt; if (this.time <= 0) { this.time = 0; this.finished = true; } }
      for (const sw of this.swords) sw.t += dt;
      this.ps.forEach((p, i) => {
        p.squash *= Math.pow(0.01, dt);
        if (p.dead > 0) { p.dead -= dt; p.skip = true; if (p.dead <= 0) this.respawn(p, i); return; }
        p.skip = false;
        const q = inp[i];
        p.lungeT -= dt; p.lungeCd -= dt; p.blockT -= dt; p.blockCd -= dt; p.stun -= dt; p.inv -= dt;
        const can = p.stun <= 0 && !this.finished;
        if (can && (Math.abs(q.mx) > 0.05 || Math.abs(q.my) > 0.05) && p.lungeT <= 0) {
          p.face += U.clamp(U.angDiff(p.face, Math.atan2(q.my, q.mx)), -9 * dt, 9 * dt);
          p.walk += dt * 14;
        }
        if (can && q.jumpP && p.blockCd <= 0 && p.lungeT <= 0) { p.blockT = 0.45; p.blockCd = 1.0; Sfx.play('place'); }
        if (can && q.actP && p.lungeCd <= 0 && p.blockT <= 0) {
          p.lungeT = 0.18; p.lungeCd = 0.75; p.hitDone = false; p.squash = -0.15;
          p.vx = Math.cos(p.face) * 600; p.vy = Math.sin(p.face) * 600;
          Sfx.play('dash');
        }
        if (p.lungeT <= 0) {
          const sp = can ? (p.blockT > 0 ? 90 : 240) : 0, k = Math.min(1, dt * (can ? 10 : 3));
          p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        }
        p.x = U.clamp(p.x + p.vx * dt, AX + p.r, AX + AW - p.r);
        p.y = U.clamp(p.y + p.vy * dt, AY + p.r, AY + AH - p.r);
        // nhặt lại kiếm của mình
        if (!p.sword) {
          const k = this.swords.findIndex((sw) => sw.owner === i && sw.t > 0.4 && Math.hypot(sw.x - p.x, sw.y - p.y) < p.r + 16);
          if (k >= 0) { this.swords.splice(k, 1); p.sword = true; Sfx.play('pickup'); }
        }
      });
      // FEN5: hai mũi kiếm đâm vào nhau cùng lúc → cả hai văng kiếm
      for (let a = 0; a < this.n; a++) for (let b = a + 1; b < this.n; b++) {
        const A = this.ps[a], B = this.ps[b];
        if (A.dead > 0 || B.dead > 0 || A.lungeT <= 0 || B.lungeT <= 0 || !A.sword || !B.sword || !this.foes(a, b)) continue;
        const [ax, ay] = this.tip(A), [bx, by] = this.tip(B);
        if (Math.hypot(ax - bx, ay - by) < 26) {
          A.lungeT = B.lungeT = 0; A.hitDone = B.hitDone = true;
          this.disarm(A, a); this.disarm(B, b);
          Sfx.play('crash'); FX.shake(6);
          parts.burst((ax + bx) / 2, (ay + by) / 2, ['#fff', '#ffe14d'], 18, 300, 0.4, 5, { shape: 's' });
        }
      }
      // mũi kiếm
      this.ps.forEach((p, i) => {
        // mũi kiếm chỉ tính trúng sau một nhịp vung (để đối thủ kịp giơ khiên)
        if (p.dead > 0 || p.lungeT <= 0 || p.lungeT > 0.13 || p.hitDone) return;
        const [tx, ty] = this.tip(p);
        for (let j = 0; j < this.n; j++) {
          const o = this.ps[j];
          if (j === i || o.dead > 0 || o.inv > 0 || !this.foes(i, j)) continue;
          if (Math.hypot(tx - o.x, ty - o.y) > o.r + 5) continue;
          p.hitDone = true;
          const front = Math.abs(U.angDiff(o.face, Math.atan2(p.y - o.y, p.x - o.x))) < 1.25;
          if (o.blockT > 0 && front) {
            p.stun = 0.9; p.lungeT = 0; p.vx = -Math.cos(p.face) * 380; p.vy = -Math.sin(p.face) * 380;
            Sfx.play('crown'); FX.shake(4);
            parts.burst(tx, ty, ['#fff', '#9fd8ff', '#ffe14d'], 14, 260, 0.4, 5, { shape: 's' });
            parts.text(o.x, o.y - 50, 'Đỡ!', '#9fd8ff', 30);
            // FEN5: đỡ hoàn hảo (vừa giơ khiên xong) thì kiếm đối thủ văng đi
            if (o.blockT > 0.3) this.disarm(p, i);
          } else if (!p.sword) {
            // tay không: chỉ đẩy lùi + choáng, không tính điểm
            o.stun = 0.5; o.vx = Math.cos(p.face) * 420; o.vy = Math.sin(p.face) * 420;
            Sfx.play('punch'); parts.text(o.x, o.y - 50, 'Bốp!', '#fff', 24);
          } else if (!this.finished && this.march) {
            o.dead = 1.1; o.vx = Math.cos(p.face) * 300; o.vy = Math.sin(p.face) * 300; p.points++;
            Sfx.play('hit'); FX.shake(7); Party.rumble(j);
            parts.burst(o.x, o.y, ['#fff', this.P[j].color.main, '#ffe14d'], 20, 300, 0.6, 6);
            this.advance(this.team[i]);
          } else if (!this.finished) {
            p.points++;
            o.dead = 1.1; o.vx = Math.cos(p.face) * 300; o.vy = Math.sin(p.face) * 300;
            Sfx.play('hit'); FX.shake(7); Party.rumble(j);
            parts.burst(o.x, o.y, ['#fff', this.P[j].color.main, '#ffe14d'], 20, 300, 0.6, 6);
            parts.text(p.x, p.y - 50, `Trúng! ${p.points}/${this.target}`, this.P[i].color.light, 30);
            if (p.points >= this.target) this.finished = true;
          }
          break;
        }
      });
      Phys.separate(this.ps, 0.4);
    }

    /** chế độ Tiến quân: đội t hạ địch → trận tiến một màn về phía đối thủ */
    advance(t) {
      this.zone += t === 0 ? 1 : -1;
      const won = Math.abs(this.zone) >= this.zones;
      this.bannerT = 0; this.bannerColor = TEAMS.colors[t];
      this.bannerText = won ? `${TEAMS.names[t]} chiếm thành!` : `${TEAMS.names[t]} tiến ${t === 0 ? '→' : '←'}`;
      Sfx.play(won ? 'goal' : 'crown');
      if (won) { this.finished = true; return; }
      this.freeze = 1.1;
      this.placeTeams();
    }

    draw(ctx) {
      ctx.fillStyle = '#2a2236'; ctx.fillRect(0, 0, W, H);
      Draw.rr(ctx, AX, AY, AW, AH, 24);
      // mỗi màn một màu sàn khác (Tiến quân)
      const ZC = ['#c9a26b', '#b8c97a', '#9fc4c9', '#c99f9f', '#b9a6d6', '#d6c08a', '#8fb39a'];
      ctx.fillStyle = this.march ? ZC[(this.zone + 70) % ZC.length] : '#c9a26b'; ctx.fill();
      ctx.save(); Draw.rr(ctx, AX, AY, AW, AH, 24); ctx.clip();
      for (let x = AX; x < AX + AW; x += 64) { ctx.fillStyle = (x - AX) / 64 % 2 ? '#c09865' : '#cfa974'; ctx.fillRect(x, AY, 64, AH); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(AX + AW / 2, AY + AH / 2, 100, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 8; Draw.rr(ctx, AX, AY, AW, AH, 24); ctx.stroke();

      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i], c = this.P[i].color;
        if (p.dead > 0) {
          Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: c, dead: true, alpha: p.dead, scale: 0.6 + p.dead * 0.4 });
          continue;
        }
        const blink = p.inv > 0 && Math.sin(U.now() * 30) > 0;
        const [tx, ty] = this.tip(p);
        const hx = p.x + Math.cos(p.face) * (p.r - 4), hy = p.y + Math.sin(p.face) * (p.r - 4) - 2;
        const drawSword = () => {
          ctx.strokeStyle = '#e6edf5'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty - 2); ctx.stroke();
          ctx.strokeStyle = '#8a95a8'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty - 2); ctx.stroke();
          ctx.fillStyle = '#ffd23f';
          ctx.beginPath(); ctx.arc(hx, hy, 6, 0, TAU); ctx.fill();
        };
        if (Math.sin(p.face) < 0) drawSword();
        Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: c, face: p.face, walk: p.walk, squash: p.squash, stun: p.stun > 0, alpha: blink ? 0.5 : 1 });
        if (Math.sin(p.face) >= 0) drawSword();
        if (p.blockT > 0) {
          ctx.strokeStyle = 'rgba(160,220,255,0.9)'; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 12, p.face - 1.1, p.face + 1.1); ctx.stroke();
        }
        if (p.lungeT > 0) Draw.sparkle(ctx, tx, ty - 2, 8, '#fff');
      }
      // kiếm rơi
      for (const sw of this.swords) {
        const k = Math.min(1, sw.t / 0.4), x = U.lerp(sw.fx, sw.x, k), y = U.lerp(sw.fy, sw.y, k) - Math.sin(k * Math.PI) * 60;
        ctx.save(); ctx.translate(x, y); ctx.rotate(sw.t * (k < 1 ? 14 : 0) + 0.6);
        ctx.strokeStyle = '#e6edf5'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(22, 0); ctx.stroke();
        ctx.fillStyle = this.P[sw.owner].color.main; ctx.beginPath(); ctx.arc(-22, 0, 6, 0, TAU); ctx.fill();
        ctx.restore();
      }
      if (this.march) {
        const lead = this.zone > 0 ? 0 : this.zone < 0 ? 1 : -1;
        Draw.chips(ctx, this.P, this.ps.map((p, i) => `${this.team[i] ? 'Phải' : 'Trái'} · 🗡${p.points}`), {});
        // thanh màn: ô giữa là màn đầu, hai đầu là thành của mỗi đội
        const n = this.zones * 2 + 1, w = 34, x0 = W / 2 - n * w / 2, y0 = H - 18;
        for (let k = 0; k < n; k++) {
          const z = k - this.zones;
          ctx.fillStyle = z === this.zone ? '#ffe14d' : z === -this.zones ? TEAMS.colors[0] : z === this.zones ? TEAMS.colors[1] : 'rgba(255,255,255,0.25)';
          Draw.rr(ctx, x0 + k * w + 3, y0 - 8, w - 6, 14, 6); ctx.fill();
        }
        void lead;
        if (this.bannerT < 1.4) Draw.banner(ctx, this.bannerText, this.bannerT, { color: this.bannerColor, size: 56, y: 300 });
      } else {
        const lead = this.ps.reduce((bi, p, i, a) => (p.points > a[bi].points ? i : bi), 0);
        Draw.chips(ctx, this.P, this.ps.map((p) => `🗡 ${p.points}/${this.target}`), { crown: this.ps[lead].points > 0 ? lead : -1 });
      }
      Draw.timer(ctx, this.time, W - 72, 38);
    }

    results() {
      if (this.march) {
        return this.ps.map((p, i) => {
          const t = this.team[i], adv = t === 0 ? this.zone : -this.zone;
          return { score: adv * 100 + p.points, text: `${TEAMS.names[t]} · ${adv > 0 ? `tiến ${adv} màn` : adv < 0 ? `lùi ${-adv} màn` : 'hòa màn'} · hạ ${p.points}` };
        });
      }
      return this.ps.map((p) => ({ score: p.points, text: `${p.points} điểm` }));
    }

    botInput(i) {
      const p = this.ps[i];
      const o = { mx: 0, my: 0, actP: false, jumpP: false };
      if (p.dead > 0 || p.stun > 0) return o;
      let tgt = null, td = Infinity;
      this.ps.forEach((q, j) => {
        if (j === i || q.dead > 0 || !this.foes(i, j)) return;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < td) { td = d; tgt = q; }
      });
      // mất kiếm: chạy đi nhặt
      if (!p.sword) {
        const sw = this.swords.find((x) => x.owner === i);
        if (sw) { const dx = sw.x - p.x, dy = sw.y - p.y, d = Math.hypot(dx, dy) || 1; o.mx = dx / d; o.my = dy / d; return o; }
      }
      if (!tgt) return o;
      const a = Math.atan2(tgt.y - p.y, tgt.x - p.x);
      // đỡ khi có người đâm về phía mình
      for (let j = 0; j < this.n; j++) {
        const q = this.ps[j];
        if (j === i || q.dead > 0 || q.lungeT <= 0 || !this.foes(i, j)) continue;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < 130 && Math.abs(U.angDiff(q.face, Math.atan2(p.y - q.y, p.x - q.x))) < 0.5 && p.blockCd <= 0 && Math.random() < 0.15) {
          o.jumpP = true; o.mx = Math.cos(Math.atan2(q.y - p.y, q.x - p.x)) * 0.1; o.my = Math.sin(Math.atan2(q.y - p.y, q.x - p.x)) * 0.1;
          return o;
        }
      }
      // ở xa thì áp sát, ở gần thì nhích chậm và luôn chĩa kiếm về đối thủ
      const m = td > 125 ? 1 : 0.25;
      o.mx = Math.cos(a) * m; o.my = Math.sin(a) * m;
      if (td < 105 && Math.abs(U.angDiff(p.face, a)) < 0.3 && p.lungeCd <= 0 && tgt.blockT <= 0 && Math.random() < 0.1) o.actP = true;
      return o;
    }
  }

  Party.register({
    id: 'fencing', name: 'Đấu Kiếm', emoji: '🤺',
    tagline: 'Đâm trúng đối thủ trước, giơ khiên để đỡ · đủ điểm trước là thắng',
    how: 'Kiếm chỉ theo hướng bạn đi. Nút Đánh để lao tới đâm, nút Nhảy để giơ khiên — đỡ được cú đâm từ phía trước sẽ làm đối thủ choáng, đỡ ngay khi vừa giơ khiên thì kiếm đối thủ văng ra! Hai mũi kiếm đâm trúng nhau thì cả hai văng kiếm. Mất kiếm thì chạy đi nhặt lại (tay không chỉ đẩy được, không ghi điểm). Ai đâm trúng đủ số lần trước thắng!',
    controls: { move: 'Di chuyển & xoay kiếm', act: 'Đâm', jump: 'Đỡ (khiên)' },
    minPlayers: 2, maxPlayers: 4, modes: MODES,
    create: (api) => new Fencing(api),
  });
})();
