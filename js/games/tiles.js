'use strict';
/* Gạch Sập — né các ô nháy đỏ sắp sập. Nhảy qua hố, đấm choáng đối thủ. Mỗi người 3 tim. */
(() => {
  const TC = 12, TR = 7, TS = 84;
  const OX = (W - TC * TS) / 2, OY = 100;
  const GAME_TIME = 60, GONE = 2.3;
  const SPAWN = [[2, 1], [9, 5], [9, 1], [2, 5]];
  const STEP_WARN = 1.3, STEP_GONE = 5;   // chế độ Bước chân: ô vừa giẫm sập sau 1,3s, 5s sau lành lại
  const MODES = [
    { id: 'waves', name: 'Sập theo đợt', desc: 'Từng đợt ô nháy đỏ rồi sập, vài giây sau lành lại.' },
    { id: 'step', name: 'Bước chân', desc: 'Ô nào bị giẫm lên sẽ sập sau chốc lát — đừng đứng yên, và chặn đường nhau!' },
  ];

  class Tiles {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.tiles = [];
      for (let i = 0; i < TC * TR; i++) this.tiles.push({ s: 0, t: 0, pop: 0 });
      this.time = this.total = api.T(GAME_TIME); this.elapsed = 0; this.finished = false;
      this.waveT = 2; this.waveN = 0; this.step = api.mode === 'step';
      this.ps = this.P.map((p, i) => ({
        x: OX + (SPAWN[i][0] + 0.5) * TS, y: OY + (SPAWN[i][1] + 0.5) * TS, vx: 0, vy: 0, r: 24,
        face: 0, walk: 0, z: 0, vz: 0, hearts: 3, out: false, outTime: 0,
        falling: false, fallT: 0, stun: 0, punchCd: 0, punchT: 0, inv: 0, squash: 0, skip: false,
      }));
      this.stars = Array.from({ length: 80 }, () => [Math.random() * W, Math.random() * H, Math.random() * 2 + 0.5]);
    }

    tileAt(x, y) {
      const tx = Math.floor((x - OX) / TS), ty = Math.floor((y - OY) / TS);
      if (tx < 0 || ty < 0 || tx >= TC || ty >= TR) return null;
      return this.tiles[ty * TC + tx];
    }

    spawnWave() {
      this.waveN++;
      const ok = [];
      for (let k = 0; k < this.tiles.length; k++) if (this.tiles[k].s === 0) ok.push(k);
      let pick = [];
      const kind = this.waveN < 3 ? 'random' : U.pick(['random', 'random', 'rows', 'cols', 'checker', 'ring', 'half']);
      const X = (k) => k % TC, Y = (k) => Math.floor(k / TC);
      if (kind === 'random') pick = U.shuffle(ok.slice()).slice(0, Math.min(ok.length, 8 + this.waveN * 2));
      else if (kind === 'rows') { const r = U.shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, 3); pick = ok.filter((k) => r.includes(Y(k))); }
      else if (kind === 'cols') { const c = U.shuffle([...Array(TC).keys()]).slice(0, 5); pick = ok.filter((k) => c.includes(X(k))); }
      else if (kind === 'checker') { const par = U.randi(0, 1); pick = ok.filter((k) => (X(k) + Y(k)) % 2 === par); }
      else if (kind === 'ring') {
        const inner = Math.random() < 0.5;
        pick = ok.filter((k) => { const e = X(k) === 0 || Y(k) === 0 || X(k) === TC - 1 || Y(k) === TR - 1; return inner ? !e && X(k) > 2 && X(k) < TC - 3 : e; });
      } else if (kind === 'half') {
        const side = U.randi(0, 3);
        pick = ok.filter((k) => [X(k) < TC / 2, X(k) >= TC / 2, Y(k) < 3, Y(k) > 3][side]);
      }
      // luôn chừa lại ít nhất ~30% số ô còn lành
      const maxPick = Math.floor(ok.length * 0.7);
      if (pick.length > maxPick) pick = U.shuffle(pick).slice(0, maxPick);
      const warn = Math.max(0.85, 1.3 - this.waveN * 0.025);
      for (const k of pick) { this.tiles[k].s = 1; this.tiles[k].t = warn; }
      if (pick.length) Sfx.play('warn');
    }

    safeSpot(i) {
      const cands = [];
      for (let k = 0; k < this.tiles.length; k++) if (this.tiles[k].s === 0) cands.push(k);
      if (!cands.length) return [OX + TC * TS / 2, OY + TR * TS / 2];
      let best = cands[0], bs = -Infinity;
      for (const k of cands) {
        const x = OX + (k % TC + 0.5) * TS, y = OY + (Math.floor(k / TC) + 0.5) * TS;
        let s = Math.random() * 50;
        this.ps.forEach((q, j) => { if (j !== i && !q.out) s += Math.min(300, Math.hypot(q.x - x, q.y - y)) * 0.2; });
        if (s > bs) { bs = s; best = k; }
      }
      return [OX + (best % TC + 0.5) * TS, OY + (Math.floor(best / TC) + 0.5) * TS];
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) {
        this.time -= dt; this.elapsed += dt;
        if (this.time <= 0) { this.time = 0; this.finished = true; }
        this.waveT -= dt;
        if (this.waveT <= 0 && !this.step) { this.spawnWave(); this.waveT = Math.max(1.25, 2.6 - this.waveN * 0.07); }
      }
      let crumble = false;
      for (const t of this.tiles) {
        t.pop = Math.max(0, t.pop - dt * 3);
        if (t.s === 1) { t.t -= dt; if (t.t <= 0) { t.s = 2; t.t = this.step ? STEP_GONE : GONE; crumble = true; } }
        else if (t.s === 2) { t.t -= dt; if (t.t <= 0) { t.s = 0; t.pop = 1; } }
      }
      if (crumble) { Sfx.play('crumble', 0.2); FX.shake(3); }

      this.ps.forEach((p, i) => {
        if (p.out) return;
        const q = inp[i];
        p.squash *= Math.pow(0.01, dt);
        if (p.falling) {
          p.fallT += dt;
          if (p.fallT > 0.9) {
            if (p.hearts > 0 && !this.finished) {
              const [x, y] = this.safeSpot(i);
              p.x = x; p.y = y; p.vx = p.vy = 0; p.falling = false; p.inv = 1.5; p.z = 60; p.vz = 0;
            } else if (p.hearts <= 0) { p.out = true; p.outTime = this.elapsed; }
          }
          return;
        }
        p.stun -= dt; p.punchCd -= dt; p.punchT -= dt; p.inv -= dt;
        const canAct = p.stun <= 0 && !this.finished;
        if (canAct && (q.mx || q.my)) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        const sp = canAct ? 260 : 0;
        const k = Math.min(1, dt * (p.stun > 0 ? 2.5 : 10));
        p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        if (canAct && q.jumpP && p.z <= 0) { p.vz = 430; Sfx.play('jump'); p.squash = -0.2; }
        p.vz -= 1500 * dt; p.z = Math.max(0, p.z + p.vz * dt);
        if (p.z <= 0 && p.vz < 0) { if (p.vz < -300) p.squash = 0.2; p.vz = 0; }
        // TIL5: đang ở trên không bấm Đánh = dậm đất, 4 ô quanh chỗ đáp lập tức nháy đỏ
        if (canAct && q.actP && p.z > 15 && !p.slam) { p.slam = true; p.vz = -900; Sfx.play('dash'); }
        if (p.slam && p.z <= 0) {
          p.slam = false; p.squash = 0.3; FX.shake(5); Sfx.play('boom', 0.1);
          const tx = Math.floor((p.x - OX) / TS), ty = Math.floor((p.y + 8 - OY) / TS);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const x = tx + dx, y = ty + dy;
            if (x < 0 || y < 0 || x >= TC || y >= TR) continue;
            const tl = this.tiles[y * TC + x];
            if (tl.s === 0) { tl.s = 1; tl.t = 0.55; }
          }
          parts.burst(p.x, p.y + 10, ['#fff', '#c9b8ff'], 16, 260, 0.4, 5);
        }
        if (canAct && q.actP && p.punchCd <= 0 && p.z <= 15) {
          p.punchCd = 0.6; p.punchT = 0.18; Sfx.play('punch');
          this.ps.forEach((o, j) => {
            if (j === i || o.out || o.falling || o.z > 30) return;
            const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
            if (d < 80 && Math.abs(U.angDiff(p.face, Math.atan2(dy, dx))) < 1.1) {
              o.stun = 1.0; o.vx += dx / d * 420; o.vy += dy / d * 420;
              Sfx.play('hit'); FX.shake(6);
              parts.burst(o.x, o.y - 20, ['#fff', '#ffe14d'], 12, 240, 0.45, 6, { shape: 's' });
            }
          });
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.x = U.clamp(p.x, OX - 30, OX + TC * TS + 30);
        p.y = U.clamp(p.y, OY - 30, OY + TR * TS + 30);
        if (p.z <= 0) {
          const t = this.tileAt(p.x, p.y + 8);
          // chế độ Bước chân: giẫm lên ô lành → ô bắt đầu nứt
          if (this.step && t && t.s === 0 && !this.finished) { t.s = 1; t.t = STEP_WARN; }
          if (!t || t.s === 2) {
            p.falling = true; p.fallT = 0; p.hearts--;
            Sfx.play('fall'); FX.shake(4); Party.rumble(i);
            parts.text(p.x, p.y - 40, p.hearts > 0 ? '−1 ♥' : 'Bị loại!', '#ff7a9a', 28);
          }
        }
      });
      this.ps.forEach((p) => { p.skip = p.out || p.falling || p.z > 20; });
      Phys.separate(this.ps, 0.6);

      if (!this.finished) {
        const alive = this.ps.filter((p) => !p.out && !(p.falling && p.hearts <= 0)).length;
        if (alive <= 1) this.finished = true;
      }
    }

    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1a1240'); g.addColorStop(1, '#070418');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (const [x, y, s] of this.stars) ctx.fillRect(x, y, s, s);

      const t = U.now();
      // người đang rơi (dưới sàn)
      this.ps.forEach((p, i) => {
        if (!p.falling) return;
        const s = Math.max(0, 1 - p.fallT / 0.9);
        Draw.blob(ctx, { x: p.x, y: p.y + p.fallT * 160, r: p.r, color: this.P[i].color, face: p.face, scale: s, alpha: s, stun: true, shadow: false });
      });
      for (let ty = 0; ty < TR; ty++) {
        for (let tx = 0; tx < TC; tx++) {
          const tl = this.tiles[ty * TC + tx];
          let x = OX + tx * TS, y = OY + ty * TS, a = 1, s = 1;
          if (tl.s === 2) {
            const f = GONE - tl.t;
            if (f > 0.5) continue;
            y += f * f * 600; a = 1 - f * 2; s = 1 - f;
          }
          if (tl.s === 1) { x += U.rand(-2, 2); y += U.rand(-2, 2); }
          if (tl.pop > 0) s = 1 + Math.sin(tl.pop * Math.PI) * 0.08;
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate(x + TS / 2, y + TS / 2); ctx.scale(s, s);
          const w = TS - 6;
          ctx.fillStyle = '#4a3a8a';
          Draw.rr(ctx, -w / 2, -w / 2 + 10, w, w, 12); ctx.fill();
          ctx.fillStyle = (tx + ty) % 2 ? '#9fd8ff' : '#8ccbf7';
          if (tl.s === 1 && Math.sin(t * 22) > -0.2) ctx.fillStyle = '#ff5a6e';
          Draw.rr(ctx, -w / 2, -w / 2, w, w, 12); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          Draw.rr(ctx, -w / 2 + 6, -w / 2 + 6, w - 12, 10, 5); ctx.fill();
          ctx.restore();
        }
      }
      const order = this.ps.map((_, i) => i).filter((i) => !this.ps[i].falling && !this.ps[i].out)
        .sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i];
        const blink = p.inv > 0 && Math.sin(t * 30) > 0;
        Draw.blob(ctx, { x: p.x, y: p.y, z: p.z, r: p.r, color: this.P[i].color, face: p.face, walk: p.walk,
          squash: p.squash, stun: p.stun > 0, alpha: blink ? 0.5 : 1 });
        if (p.punchT > 0) {
          const fx = p.x + Math.cos(p.face) * 38, fy = p.y - p.z + Math.sin(p.face) * 30;
          ctx.fillStyle = this.P[i].color.light; ctx.strokeStyle = 'rgba(20,10,40,0.6)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(fx, fy, 11, 0, TAU); ctx.fill(); ctx.stroke();
        }
      }
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.out ? 'Loại' : '♥'.repeat(Math.max(0, p.hearts)))),
        { dim: this.ps.map((p) => p.out) });
      Draw.timer(ctx, this.time, W - 72, 38);
    }

    results() {
      return this.ps.map((p) => {
        const out = p.out || p.hearts <= 0;
        return {
          score: out ? (p.outTime || this.elapsed) : 1000 + p.hearts * 100,
          text: out ? `Rơi ở giây ${Math.floor(p.outTime || this.elapsed)}` : `Còn ${p.hearts} ♥`,
        };
      });
    }

    botInput(i) {
      const p = this.ps[i];
      const o = { mx: 0, my: 0, actP: false, jumpP: false };
      if (p.out || p.falling) return o;
      const cur = this.tileAt(p.x, p.y + 8);
      const tileOk = (t) => t && t.s === 0;
      let tx = null, ty = null;
      if (!tileOk(cur) || Math.random() < 0.002) {
        let bd = Infinity;
        for (let k = 0; k < this.tiles.length; k++) {
          if (this.tiles[k].s !== 0) continue;
          const x = OX + (k % TC + 0.5) * TS, y = OY + (Math.floor(k / TC) + 0.5) * TS;
          let d = Math.hypot(x - p.x, y - p.y);
          const ex = k % TC, ey = Math.floor(k / TC);
          if (ex === 0 || ey === 0 || ex === TC - 1 || ey === TR - 1) d += 40;
          if (d < bd) { bd = d; tx = x; ty = y; }
        }
      } else {
        const cx = OX + (Math.floor((p.x - OX) / TS) + 0.5) * TS, cy = OY + (Math.floor((p.y + 8 - OY) / TS) + 0.5) * TS;
        if (Math.hypot(cx - p.x, cy - p.y) > 20) { tx = cx; ty = cy; }
      }
      if (tx !== null) {
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
        o.mx = dx / d; o.my = dy / d;
        const ahead = this.tileAt(p.x + o.mx * 40, p.y + 8 + o.my * 40);
        if ((!ahead || ahead.s === 2 || (cur && cur.s === 1 && cur.t < 0.25)) && p.z <= 0 && Math.random() < 0.5) o.jumpP = true;
      }
      // dậm đất cạnh đối thủ khi đang nhảy
      if (p.z > 40 && !p.slam && this.ps.some((q, j) => j !== i && !q.out && !q.falling && Math.hypot(q.x - p.x, q.y - p.y) < 130) && Math.random() < 0.15) o.actP = true;
      this.ps.forEach((q, j) => {
        if (j === i || q.out || q.falling) return;
        if (Math.hypot(q.x - p.x, q.y - p.y) < 75 && p.punchCd <= 0 && Math.random() < 0.06) {
          o.actP = true;
          o.mx = (q.x - p.x) / 75; o.my = (q.y - p.y) / 75;
        }
      });
      return o;
    }
  }

  Party.register({
    id: 'tiles', name: 'Gạch Sập', emoji: '🧱',
    tagline: 'Né ô nháy đỏ sắp sập · nhảy qua hố · nhiều tim nhất là thắng',
    how: 'Ô nào nháy đỏ sắp sập — chạy ngay! Nhảy để bay qua hố, đấm cho đối thủ choáng. Đang nhảy mà bấm Đánh = dậm đất: 4 ô quanh chỗ đáp lập tức nháy đỏ để bẫy người bên cạnh. Mỗi người 3 tim, rơi là mất 1 tim.',
    controls: { move: 'Di chuyển', act: 'Đấm · trên không: dậm đất', jump: 'Nhảy qua hố' },
    modes: MODES,
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Tiles(api),
  });
})();
