'use strict';
/* Bóng Đá — chia 2 đội. Dắt bóng, chuyền, sút.
   Chế độ "Bóng đá thật": xoạc bóng, phạm lỗi → đá phạt / phạt đền, hòa thì đá luân lưu.
   Chế độ "Vui nhộn": húc cướp bóng, những giây cuối bàn thắng ×2, hòa thì bàn thắng vàng.
   Đội chỉ có 1 người có thủ môn tự động (SOC2). */
(() => {
  const FX0 = 70, FY0 = 100, FW = W - 140, FH = 590;
  const GH = 200, GY0 = FY0 + FH / 2 - GH / 2, GY1 = GY0 + GH, GD = 46;
  const GAME_TIME = 75, DOUBLE_AT = 20, BR = 13;
  const TAP = 0.18, CHARGE = 0.8, TWIN = 0.25;   // chạm < TAP = chuyền; giữ tới CHARGE = sút căng nhất; sút đôi trong TWIN giây
  const RUN = 340, DRIBBLE = 315, AIM_SP = 215;   // tốc độ chạy (đã tăng ~30% cho đỡ mất công chạy lấy bóng)
  const SLIDE_V = 720, SLIDE_T = 0.32, SLIDE_REC = 0.35; // xoạc bóng
  const BOX_D = 140, BOX_H = 300, SPOT_D = 118;   // vòng cấm, chấm phạt đền
  const SO_KICKS = 3;                             // luân lưu sau trận hòa: 3 lượt mỗi đội (ván ngắn/dài theo api.count) rồi đá chết
  const MODES = [
    { id: 'real', name: 'Bóng đá thật', desc: 'Nhảy = xoạc bóng. Xoạc trúng người từ phía sau là phạm lỗi → đá phạt (trong vòng cấm là phạt đền). Hết giờ hòa thì đá luân lưu.' },
    { id: 'shootout', name: 'Luân lưu', desc: 'Chỉ đá luân lưu, nhìn từ sau lưng người sút. Mỗi đội đá xen kẽ, hòa thì đá chết. Mọi người lần lượt làm người sút và thủ môn.',
      how: 'Đá luân lưu theo luật thật: bốc thăm đội đá trước, mỗi đội đá xen kẽ đủ số lượt, đội nào không thể gỡ nữa thì thua sớm; hòa thì đá chết từng lượt. Trong đội, mọi người lần lượt sút và bắt. '
        + 'Người sút: phím hướng di chuyển TÂM NGẮM trong khung thành, GIỮ Đánh lấy lực rồi thả để sút — lực càng căng bóng càng nhanh nhưng vòng tâm càng to (dễ lệch), quá vạch 100% thì bóng bốc lên xà. Giữ thêm Nhảy lúc thả = Panenka. Lúc chạy đà tâm ngắm bị ẩn và vẫn đổi hướng được — lừa thủ môn! '
        + 'Thủ môn: ← → đứng chặn; bóng bay rồi chỉ cần bấm Nhảy là bay theo bóng (cú căng vào góc thì phải đoán trước: Nhảy + hướng ngay lúc người sút chạy đà).',
      controls: { move: 'Tâm ngắm · Thủ môn: đứng chặn', act: 'Giữ: lấy lực, thả: sút', jump: 'Bay người · Giữ khi sút: Panenka' } },
    { id: 'fun', name: 'Vui nhộn', desc: 'Nhảy = húc cướp bóng, không có phạm lỗi. Những giây cuối bàn thắng ×2, hòa thì đá bàn thắng vàng.' },
  ];
  const darker = (hex) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.round(v * 0.55)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

  class Soccer {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.team = TEAMS.split(this.n);
      this.score = [0, 0]; this.time = this.total = api.T(GAME_TIME); this.doubleAt = api.T(DOUBLE_AT); this.golden = false; this.finished = false;
      this.goalT = 0; this.endAfterGoal = false;
      this.ps = this.P.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, r: 24, face: 0, walk: 0, dashT: 0, dashCd: 0,
        kickCd: 0, kickT: 0, stun: 0, squash: 0, skip: false, hold: 0, slideT: 0, slideDir: 0, slideBall: false, rec: 0, slideHit: null }));
      this.ball = { x: 0, y: 0, vx: 0, vy: 0, r: BR, spin: 0, fire: 0, fireTeam: -1, z: 0 };
      this.real = api.mode !== 'fun';
      if (this.real) this.doubleAt = -1;
      // SOC2: thủ môn tự động cho đội chỉ có 1 người
      this.keepers = [0, 1].filter((t) => this.team.filter((x) => x === t).length === 1).map((t) => ({
        t, x: t === 0 ? FX0 + 26 : FX0 + FW - 26, y: FY0 + FH / 2, vx: 0, vy: 0, r: 22, diveT: 0, diveCd: 0, saves: 0, face: t === 0 ? 0 : Math.PI, skip: false,
        color: { main: TEAMS.colors[t], dark: darker(TEAMS.colors[t]), light: '#ffffff' },
      }));
      this.set = null; this.pk = null; this.so = null; this.sub = null; this.soWin = -1;
      this.stats = this.P.map(() => ({ goals: 0, fouls: 0, tackles: 0 }));
      this.lastKick = null; this.clock = 0;
      this.bannerT = 9; this.bannerText = ''; this.bannerColor = '#fff';
      this.announced = false;
      this.kickoff();
      this.freeze = 0;
    }
    teamOf(i) { return this.team[i]; }
    posOf(i) { if (this.sub) return this.sub.posOf(i); const p = this.ps[i]; return { x: p.x, y: p.y - (p.z || 0) }; }

    /** giao bóng: đội vừa thủng lưới (hoặc ngẫu nhiên lúc đầu) được giao; đội kia đứng ngoài vòng tròn giữa sân một chút */
    kickoff(kt) {
      const cx = FX0 + FW / 2, cy = FY0 + FH / 2;
      if (kt === undefined) kt = Math.random() < 0.5 ? 0 : 1;
      this.kickTeam = kt;
      const cnt = [0, 0];
      this.ps.forEach((p, i) => {
        const t = this.team[i], k = cnt[t]++, side = t === 0 ? -1 : 1;
        const members = this.team.filter((x) => x === t).length;
        Object.assign(p, {
          x: cx + side * (k === 0 ? (t === kt ? 40 : 150) : 380), y: cy + (members === 1 ? 0 : k === 0 ? -80 : 90),
          vx: 0, vy: 0, face: t === 0 ? 0 : Math.PI, dashT: 0, stun: 0, slideT: 0,
        });
      });
      Object.assign(this.ball, { x: cx, y: cy, vx: 0, vy: 0, z: 0 });
      for (const k of this.keepers || []) { k.y = cy; k.vy = 0; k.diveT = 0; }
      // luật giao bóng: đội không giao phải đứng ngoài vòng tròn giữa sân tới khi bóng lăn
      this.ko = { t: 1 - kt, T: 3 };
      this.freeze = 1.0;
    }
    /** khung thành mà đội t phải giữ (đội Trái giữ khung bên trái) */
    goalLineX(t) { return t === 0 ? FX0 : FX0 + FW; }
    inBox(t, x, y) { const gx = this.goalLineX(t); return Math.abs(x - gx) < BOX_D && Math.abs(y - (FY0 + FH / 2)) < BOX_H / 2; }

    /* ---------- SOC7: phạm lỗi → đá phạt / phạt đền ---------- */
    foul(i, j) {
      const t = this.team[i], parts = this.api.parts, v = this.ps[j];
      this.stats[i].fouls++;
      Sfx.play('warn'); Party.rumble(j, 0.6, 200);
      parts.text(v.x, v.y - 50, 'PHẠM LỖI!', '#ffe14d', 30);
      const sx = U.clamp(v.x, FX0 + 30, FX0 + FW - 30), sy = U.clamp(v.y, FY0 + 30, FY0 + FH - 30);
      if (this.inBox(t, sx, sy)) { this.banner('PHẠT ĐỀN!', '#ff5a3a'); this.startPenalty(j, 'pen'); }
      else { this.banner('Đá phạt!', '#ffe14d'); this.startFreeKick(j, sx, sy); }
    }
    startFreeKick(j, x, y) {
      const b = this.ball, kt = this.team[j], gx = this.goalLineX(1 - kt), gy = FY0 + FH / 2;
      Object.assign(b, { x, y, vx: 0, vy: 0, fire: 0, z: 0 });
      const aim = Math.atan2(gy - y, gx - x);
      this.set = { kicker: j, t: 7, aim };
      const k = this.ps[j];
      k.face = aim; k.hold = 0; k.vx = k.vy = 0; k.slideT = 0; k.stun = 0;
      k.x = x - Math.cos(aim) * (k.r + b.r + 6); k.y = y - Math.sin(aim) * (k.r + b.r + 6);
      // hàng rào: người đội kia đứng chắn giữa bóng và khung thành
      const def = this.ps.map((_, i) => i).filter((i) => this.team[i] !== kt);
      def.forEach((i, n) => {
        const p = this.ps[i], off = (n - (def.length - 1) / 2) * 50;
        p.x = U.clamp(x + Math.cos(aim) * 100 - Math.sin(aim) * off, FX0 + p.r, FX0 + FW - p.r);
        p.y = U.clamp(y + Math.sin(aim) * 100 + Math.cos(aim) * off, FY0 + p.r, FY0 + FH - p.r);
        p.vx = p.vy = 0; p.slideT = 0; p.face = aim + Math.PI;
      });
      // đồng đội đứng cách bóng tối thiểu
      this.ps.forEach((p, i) => {
        if (i === j || this.team[i] !== kt) return;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < 130) { const a = Math.atan2(p.y - y, p.x - x) || 0; p.x = x + Math.cos(a) * 130; p.y = y + Math.sin(a) * 130; }
        p.vx = p.vy = 0;
      });
    }
    updateFreeKick(dt, inp) {
      const S = this.set, j = S.kicker, p = this.ps[j], b = this.ball, q = inp[j];
      S.t -= dt;
      if (q.mx || q.my) S.aim = Math.atan2(q.my, q.mx);
      p.face = S.aim;
      p.x = b.x - Math.cos(S.aim) * (p.r + b.r + 6); p.y = b.y - Math.sin(S.aim) * (p.r + b.r + 6);
      if (q.act) p.hold += dt;
      const released = (p.hold > 0 && !q.act) || (q.actP && !q.act);
      if (released || S.t <= 0) {
        const pw = released ? 600 + 760 * Math.min(1, p.hold / CHARGE) : 650;
        p.kickCd = 0; this.set = null; p.hold = 0;
        this.kick(p, j, S.aim, pw);
        this.freeze = 0;
      }
    }

    /* ---------- SOC6: phạt đền & đá luân lưu ---------- */
    startPenalty(shooter, kind) {
      const st = this.team[shooter], dt = 1 - st, gx = this.goalLineX(dt), dir = dt === 0 ? -1 : 1, cy = FY0 + FH / 2;
      // thủ môn: người đội kia (gần khung thành nhất), hoặc thủ môn tự động nếu ván luân lưu không có ai
      const defs = this.ps.map((_, i) => i).filter((i) => this.team[i] === dt);
      let keeper = defs.sort((a, c) => Math.abs(this.ps[a].x - gx) - Math.abs(this.ps[c].x - gx))[0];
      // nhớ chỗ đứng để trả lại sau quả phạt đền trong trận
      this.saved = this.ps.map((p) => ({ x: p.x, y: p.y }));
      const spot = { x: gx - dir * SPOT_D, y: cy };
      this.pk = { kind, shooter, keeper, st, dt, gx, dir, spot, phase: 'ready', t: 7, hold: 0, kd: 0, dove: false, kDir: 0, res: '', fly: null, wait: 0 };
      Object.assign(this.ball, { x: spot.x, y: spot.y, vx: 0, vy: 0, z: 0, fire: 0 });
      const S = this.ps[shooter], K = this.ps[keeper];
      Object.assign(S, { x: spot.x - dir * 46, y: cy, vx: 0, vy: 0, face: dir > 0 ? 0 : Math.PI, hold: 0, slideT: 0, stun: 0 });
      Object.assign(K, { x: gx - dir * 20, y: cy, vx: 0, vy: 0, face: dir > 0 ? Math.PI : 0, hold: 0, slideT: 0, stun: 0 });
      // những người khác đứng ở vòng tròn giữa sân
      let k = 0;
      this.ps.forEach((p, i) => { if (i !== shooter && i !== keeper) { p.x = FX0 + FW / 2 + (k % 2 ? 40 : -40); p.y = FY0 + FH / 2 + (k < 2 ? -110 : 110); k++; p.vx = p.vy = 0; } });
      this.pkBot = null;
    }
    updatePenalty(dt, inp) {
      const P = this.pk, b = this.ball, S = this.ps[P.shooter], K = this.ps[P.keeper], cy = FY0 + FH / 2;
      const qs = inp[P.shooter], qk = inp[P.keeper];
      // thủ môn: chọn hướng (↑ / ↓ / đứng giữa) + Nhảy để bay người — được đoán trước khi sút
      if (!P.dove && qk.jumpP && P.phase !== 'done') {
        P.dove = true; P.kDir = qk.my < -0.35 ? -1 : qk.my > 0.35 ? 1 : 0; P.kd = 0;
        Sfx.play('dash'); K.squash = -0.25;
      }
      if (P.dove) {
        P.kd += dt;
        const ty = cy + P.kDir * (GH / 2 - 28);
        K.y += U.clamp(ty - K.y, -380 * dt, 380 * dt);
      }
      if (P.phase === 'ready') {
        P.t -= dt;
        if (qs.act) P.hold += dt;
        const released = (P.hold > 0 && !qs.act) || (qs.actP && !qs.act);
        if (released || P.t <= 0) {
          const k = released ? P.hold / CHARGE : 0.5, dir = qs.my < -0.35 ? -1 : qs.my > 0.35 ? 1 : 0;
          const over = k > 1.12 && Math.random() < Math.min(1, (k - 1.12) * 4); // giữ quá lâu → bóng bay lên trời
          const kk = Math.min(1, k);
          let ty = cy + dir * (GH / 2 - 26) + U.rand(-1, 1) * (8 + 18 * kk);
          const wide = Math.abs(ty - cy) > GH / 2 - 6; // lệch cột
          const flight = 0.78 - 0.42 * kk;
          P.fly = { x0: b.x, y0: b.y, x1: P.gx + P.dir * 10, y1: ty, t: 0, dur: flight, over, wide, weak: kk < 0.35 };
          P.phase = 'fly'; S.kickT = 0.2; S.squash = 0.15; Sfx.play('kick'); FX.shake(3 + kk * 4);
        }
      } else if (P.phase === 'fly') {
        const F = P.fly; F.t += dt;
        const k = Math.min(1, F.t / F.dur);
        b.x = F.x0 + (F.x1 - F.x0) * k; b.y = F.y0 + (F.y1 - F.y0) * k; b.z = (F.over ? 120 : 26) * Math.sin(Math.PI * k * (F.over ? 0.6 : 1));
        b.spin += dt * 30;
        if (k >= 1) {
          const reach = (P.dove ? 36 : 30) + (F.weak ? 28 : 0);
          let res;
          if (F.over) res = 'over'; else if (F.wide) res = 'wide';
          else if (Math.abs(K.y - b.y) < reach) res = 'save'; else res = 'goal';
          P.res = res; P.phase = 'done'; P.wait = 1.8;
          const parts = this.api.parts;
          if (res === 'goal') { Sfx.play('goal'); FX.shake(8); parts.burst(b.x, b.y, ['#ffe14d', '#fff', TEAMS.colors[P.st]], 30, 300, 0.8, 6); }
          else if (res === 'save') { Sfx.play('crown'); parts.burst(b.x, b.y, ['#fff'], 14, 200, 0.4, 5); b.vx = -P.dir * 260; b.vy = U.rand(-200, 200); }
          else Sfx.play('fall');
          this.banner(res === 'goal' ? 'VÀO!' : res === 'save' ? 'CẢN PHÁ!' : res === 'over' ? 'Bay lên trời!' : 'Ra ngoài!', res === 'goal' ? TEAMS.colors[P.st] : '#fff');
        }
      } else if (P.phase === 'done') {
        b.x += (b.vx || 0) * dt; b.y += (b.vy || 0) * dt; b.vx *= Math.pow(0.1, dt); b.vy *= Math.pow(0.1, dt); b.z = 0;
        P.wait -= dt;
        if (P.wait <= 0) this.endPenalty();
      }
    }
    endPenalty() {
      const P = this.pk, goal = P.res === 'goal';
      this.pk = null;
      // phạt đền trong trận
      if (goal) { this.lastKick = { i: P.shooter, team: P.st, t: this.clock }; this.goal(P.st); return; }
      this.ps.forEach((p, i) => { if (this.saved) { p.x = this.saved[i].x; p.y = this.saved[i].y; } p.vx = p.vy = 0; });
      // không vào: thủ môn phát bóng
      Object.assign(this.ball, { x: P.gx - P.dir * 150, y: FY0 + FH / 2, vx: 0, vy: 0, z: 0 });
      this.freeze = 0.8;
    }
    startShootout() {
      // trận hòa → chuyển sang màn đá luân lưu (góc nhìn sau lưng người sút)
      this.sub = new PenaltyShootout(this.api, { kicks: this.api.count(SO_KICKS), match: true, matchScore: this.score.slice() });
      this.so = this.sub;
      Sfx.play('warn');
    }

    /* ---------- SOC2: thủ môn tự động ---------- */
    updateKeepers(dt) {
      const b = this.ball, cy = FY0 + FH / 2;
      for (const k of this.keepers) {
        k.diveT -= dt; k.diveCd -= dt;
        const gx = this.goalLineX(k.t), toward = k.t === 0 ? -b.vx : b.vx; // >0 = bóng đang bay về khung mình
        if (k.diveT <= 0) {
          let ty = cy;
          const own = Math.abs(b.x - gx) < FW * 0.55;
          if (own) ty = cy + (b.y - cy) * 0.75;
          // bóng bay nhanh về phía khung: đoán điểm tới và bay người
          if (toward > 480 && Math.abs(b.x - gx) < 420 && k.diveCd <= 0) {
            const tt = Math.abs(b.x - gx) / toward, py = b.y + b.vy * tt;
            if (py > GY0 - 10 && py < GY1 + 10 && Math.abs(py - k.y) > 20) { k.diveT = 0.32; k.diveCd = 1.1; k.vy = Math.sign(py - k.y) * 640; }
          }
          if (k.diveT <= 0) { const d = U.clamp(ty, GY0 + 12, GY1 - 12) - k.y; k.vy = U.clamp(d * 6, -230, 230); }
        }
        k.y = U.clamp(k.y + k.vy * dt, GY0 - 4, GY1 + 4);
        // đỡ bóng
        const dx = b.x - k.x, dy = b.y - k.y, d = Math.hypot(dx, dy);
        if (d < k.r + b.r && d > 0.01) {
          const nx = dx / d, ny = dy / d;
          b.x = k.x + nx * (k.r + b.r);
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny; }
          const out = k.t === 0 ? 1 : -1;
          if (b.vx * out < 260) b.vx = out * 260;
          if (Math.hypot(b.vx, b.vy) > 500 && k.diveT > -0.3) { k.saves++; this.api.parts.text(k.x, k.y - 40, 'Cản phá!', '#fff', 22); Sfx.play('kick'); }
          b.fire = 0;
        }
      }
    }

    /** sút bóng: dir = góc, pw = lực. Trả true nếu chạm được bóng */
    kick(p, i, dir, pw) {
      const b = this.ball, parts = this.api.parts;
      p.kickCd = 0.3; p.kickT = 0.15; p.squash = 0.15;
      if (Math.hypot(b.x - p.x, b.y - p.y) >= p.r + b.r + 24) return false;
      b.vx = Math.cos(dir) * pw + p.vx * 0.3; b.vy = Math.sin(dir) * pw + p.vy * 0.3;
      Sfx.play('kick'); FX.shake(3 + pw / 400);
      parts.burst(b.x, b.y, ['#fff', '#d9ffd0'], 8, 180, 0.35, 4);
      this.lastKick = { i, team: this.team[i], t: this.clock };
      return true;
    }
    /** SOC5: đồng đội bấm sút trong TWIN giây sau cú sút trước và đang ở gần bóng → bóng lửa */
    tryTwin(p, i) {
      const lk = this.lastKick, b = this.ball;
      if (!lk || lk.i === i || lk.team !== this.team[i] || this.clock - lk.t > TWIN) return false;
      if (Math.hypot(b.x - p.x, b.y - p.y) > 170) return false;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      b.vx = b.vx / sp * 1500; b.vy = b.vy / sp * 1500; b.fire = 1.4; b.fireTeam = this.team[i];
      this.lastKick = null;
      Sfx.play('boom'); FX.shake(8);
      this.api.parts.text(b.x, b.y - 40, 'SÚT ĐÔI! 🔥', '#ff8a2e', 32);
      return true;
    }
    /** đồng đội gần nhất để chuyền */
    mateFor(i) {
      const p = this.ps[i];
      let best = -1, bd = Infinity;
      this.ps.forEach((q, j) => { if (j !== i && this.team[j] === this.team[i]) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = j; } } });
      return best;
    }

    banner(s, c) { this.bannerText = s; this.bannerColor = c || '#fff'; this.bannerT = 0; }

    goal(t) {
      const pts = this.doubleAt >= 0 && this.time <= this.doubleAt && !this.golden ? 2 : 1;
      if (this.lastKick && this.lastKick.team === t) this.stats[this.lastKick.i].goals++;
      this.score[t] += pts;
      this.banner(`${TEAMS.names[t]} ghi bàn!${pts > 1 ? ' ×2' : ''}`, TEAMS.colors[t]);
      this.goalT = 1.8; this.endAfterGoal = this.golden; this.lastGoalTeam = t;
      Sfx.play('goal'); FX.shake(10);
      const gx = t === 0 ? FX0 + FW : FX0;
      this.api.parts.burst(gx, FY0 + FH / 2, ['#ffe14d', '#ff5c9d', '#4dd0ff', '#5dff9b', '#fff'], 50, 520, 1.2, 7, { g: 300 });
    }

    update(dt, inp) {
      const parts = this.api.parts, b = this.ball;
      this.bannerT += dt;
      for (const p of this.ps) { p.squash *= Math.pow(0.01, dt); p.kickT -= dt; }
      if (this.goalT > 0) {
        this.goalT -= dt;
        b.vx *= Math.pow(0.05, dt); b.vy *= Math.pow(0.05, dt);
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (this.goalT <= 0) { if (this.endAfterGoal) this.finished = true; else this.kickoff(1 - this.lastGoalTeam); }
        return;
      }
      if (this.sub) { this.sub.update(dt, inp); if (this.sub.finished && !this.finished) { this.finished = true; this.soWin = this.sub.winner; } return; }
      if (this.finished) return;
      if (this.pk) { this.updatePenalty(dt, inp); return; }
      if (this.set) { this.updateFreeKick(dt, inp); return; }
      if (this.freeze > 0) { this.freeze -= dt; return; }
      this.clock += dt;

      if (this.golden) {
        // bàn thắng vàng tối đa 30 giây, sau đó tính hòa
        this.goldenT = (this.goldenT || 0) + dt;
        if (this.goldenT >= 30) { this.finished = true; this.banner('Hòa!', '#fff'); return; }
      }
      if (!this.golden) {
        this.time -= dt;
        if (this.doubleAt >= 0 && this.time <= this.doubleAt && !this.announced) {
          this.announced = true; Sfx.play('warn');
          parts.text(W / 2, 170, 'Bàn thắng ×2!', '#ffe14d', 48);
        }
        if (this.time <= 0) {
          this.time = 0;
          if (this.score[0] === this.score[1]) {
            if (this.real) { this.startShootout(); return; }
            this.golden = true; this.banner('Bàn thắng vàng!', '#ffe14d'); Sfx.play('warn');
          }
          else { this.finished = true; return; }
        }
      }

      this.ps.forEach((p, i) => {
        const q = inp[i];
        p.dashT -= dt; p.dashCd -= dt; p.kickCd -= dt; p.stun -= dt; p.rec -= dt;
        const sliding = p.slideT > 0;
        if (sliding) { p.slideT -= dt; if (p.slideT <= 0) p.rec = SLIDE_REC; }
        const can = p.stun <= 0 && !sliding;
        if (can && (q.mx || q.my)) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        if (can && q.jumpP && p.dashCd <= 0) {
          if (this.real) {
            // SOC7: xoạc bóng theo hướng đang chạy
            p.slideT = SLIDE_T; p.slideDir = p.face; p.slideBall = false; p.slideHit = new Set(); p.dashCd = 1.1; p.hold = 0;
            p.vx = Math.cos(p.face) * SLIDE_V; p.vy = Math.sin(p.face) * SLIDE_V; Sfx.play('dash');
          } else {
            p.dashT = 0.25; p.dashCd = 1.0; p.squash = -0.2; Sfx.play('dash');
            p.vx = Math.cos(p.face) * 650; p.vy = Math.sin(p.face) * 650;
          }
        }
        if (sliding) { const f = Math.pow(0.25, dt); p.vx *= f; p.vy *= f; }
        else if (p.dashT <= 0) {
          const near = Math.hypot(b.x - p.x, b.y - p.y) < p.r + b.r + 14;
          const base = p.hold > TAP ? AIM_SP : near ? DRIBBLE : RUN;
          const sp = can ? base * (p.rec > 0 ? 0.45 : 1) : 0, k = Math.min(1, dt * (can ? 10 : 3));
          p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        }
        // SOC1: chạm Đánh = chuyền cho đồng đội gần nhất (không có đồng đội thì sút thường),
        // giữ Đánh = tích lực sút căng; máy gửi actP (không giữ) = sút thường, pass = chuyền
        if (can && q.act) p.hold += dt;
        const released = can && ((p.hold > 0 && !q.act) || (q.actP && !q.act));
        if (released && p.kickCd <= 0) {
          if (this.tryTwin(p, i)) { p.kickCd = 0.3; p.kickT = 0.15; }
          else if (this.P[i].bot && !q.pass) this.kick(p, i, p.face, 880);
          else if (p.hold >= TAP || (this.P[i].bot && !q.pass)) this.kick(p, i, p.face, 760 + 640 * Math.min(1, p.hold / CHARGE));
          else {
            const m = this.mateFor(i);
            if (m >= 0) {
              const mt = this.ps[m], lead = 0.35;
              const tx = mt.x + mt.vx * lead, ty = mt.y + mt.vy * lead, d = Math.hypot(tx - b.x, ty - b.y);
              this.kick(p, i, Math.atan2(ty - b.y, tx - b.x), U.clamp(d * 1.7, 420, 900));
            } else this.kick(p, i, p.face, 880);
          }
        }
        if (!q.act || !can) p.hold = 0;
        p.x += p.vx * dt; p.y += p.vy * dt;
        // xoạc: trúng bóng thì phá bóng đi, trúng người đội kia thì phạm lỗi hoặc cướp sạch
        if (p.slideT > 0) {
          const bd = Math.hypot(b.x - p.x, b.y - p.y);
          if (bd < p.r + b.r + 8 && !p.slideBall) {
            p.slideBall = true; this.stats[i].tackles++;
            b.vx = Math.cos(p.slideDir) * 560 + p.vx * 0.2; b.vy = Math.sin(p.slideDir) * 560 + p.vy * 0.2;
            this.lastKick = { i, team: this.team[i], t: this.clock }; Sfx.play('kick');
          }
          for (const [j, v] of this.ps.entries()) {
            if (j === i || this.team[j] === this.team[i] || p.slideHit.has(j)) continue;
            if (Math.hypot(v.x - p.x, v.y - p.y) < p.r + v.r + 2) {
              p.slideHit.add(j);
              const fromBehind = Math.cos(v.face - p.slideDir) > 0.35 && Math.hypot(v.vx, v.vy) > 60;
              if (!p.slideBall && fromBehind && !this.finished) { this.foul(i, j); return; }
              v.stun = 0.55; v.vx += Math.cos(p.slideDir) * 260; v.vy += Math.sin(p.slideDir) * 260;
              Sfx.play('hit'); parts.burst(v.x, v.y, ['#fff', '#7a5a2a'], 8, 180, 0.4, 5);
            }
          }
        }
        p.x = U.clamp(p.x, FX0 + p.r - 10, FX0 + FW - p.r + 10);
        p.y = U.clamp(p.y, FY0 + p.r, FY0 + FH - p.r);
      });
      if (this.pk || this.set) return; // vừa phạm lỗi
      if (this.ko) {
        const cx = FX0 + FW / 2, cy = FY0 + FH / 2, b0 = this.ball;
        this.ko.T -= dt;
        if (this.ko.T <= 0 || Math.hypot(b0.x - cx, b0.y - cy) > 8) this.ko = null;
        else this.ps.forEach((p, i) => {
          if (this.team[i] !== this.ko.t) return;
          const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1, R = 80 + p.r;
          if (d < R) { p.x = cx + dx / d * R; p.y = cy + dy / d * R; const vn = (p.vx * dx + p.vy * dy) / d; if (vn < 0) { p.vx -= vn * dx / d; p.vy -= vn * dy / d; } }
        });
      }
      this.updateKeepers(dt);
      for (const k of this.keepers) { k.vx = 0; k.skip = false; }
      Phys.separate(this.ps.concat(this.keepers), 0.5, (a, c, nx, ny) => {
        const hit = (atk, vic, sx, sy) => {
          if (!(atk.dashT > 0) || vic.diveCd !== undefined) return;
          atk.dashT = 0; vic.stun = 0.6; vic.vx += sx * 380; vic.vy += sy * 380;
          Sfx.play('hit'); FX.shake(6);
          parts.burst(vic.x, vic.y - 10, ['#fff', '#ffe14d'], 10, 220, 0.4, 5, { shape: 's' });
        };
        hit(a, c, nx, ny); hit(c, a, -nx, -ny);
      });

      for (const k of this.keepers) { k.x = k.t === 0 ? FX0 + 26 : FX0 + FW - 26; k.y = U.clamp(k.y, GY0 - 4, GY1 + 4); }
      // bóng chạm người: dắt bóng (bóng lửa thì húc văng người đội kia)
      b.fire -= dt;
      for (const [pi, p] of this.ps.entries()) {
        const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy), m = p.r + b.r;
        if (b.fire > 0 && d < m + 6 && this.team[pi] !== b.fireTeam) {
          const sp = Math.hypot(b.vx, b.vy) || 1;
          p.vx += b.vx / sp * 420; p.vy += b.vy / sp * 420; p.stun = 0.7; Party.rumble(pi, 0.7, 200);
          parts.burst(p.x, p.y, ['#ff8a2e', '#ffe14d'], 10, 220, 0.4, 5);
          continue;
        }
        if (d < m && d > 0.001) {
          const nx = dx / d, ny = dy / d;
          b.x = p.x + nx * m; b.y = p.y + ny * m;
          const pv = p.vx * nx + p.vy * ny, bv = b.vx * nx + b.vy * ny;
          const want = Math.max(0, pv) * 1.12 + 40;
          if (bv < want) { b.vx += nx * (want - bv); b.vy += ny * (want - bv); }
        }
      }
      // tranh chấp: hai người hai đội kẹp bóng đứng yên quá lâu → bóng bật ra một bên
      const near = this.ps.map((p, i) => i).filter((i) => Math.hypot(b.x - this.ps[i].x, b.y - this.ps[i].y) < this.ps[i].r + b.r + 10);
      if (Math.hypot(b.vx, b.vy) < 120 && near.some((i) => this.team[i] === 0) && near.some((i) => this.team[i] === 1)) {
        this.lock = (this.lock || 0) + dt;
        if (this.lock > 0.9) {
          this.lock = 0;
          const a = U.rand(0, TAU); b.vx = Math.cos(a) * 380; b.vy = Math.sin(a) * 380;
          parts.burst(b.x, b.y, ['#fff', '#7a5a2a'], 8, 160, 0.3, 4); Sfx.play('kick', 0.1);
        }
      } else this.lock = 0;
      // vật lý bóng
      b.x += b.vx * dt; b.y += b.vy * dt;
      const f = Math.pow(0.4, dt); b.vx *= f; b.vy *= f;
      b.spin += Math.hypot(b.vx, b.vy) * dt / b.r;
      const sp = Math.hypot(b.vx, b.vy);
      const cap = b.fire > 0 ? 1600 : 1100;
      if (sp > cap) { b.vx *= cap / sp; b.vy *= cap / sp; }
      if (b.y < FY0 + b.r) { b.y = FY0 + b.r; b.vy = Math.abs(b.vy) * 0.8; }
      if (b.y > FY0 + FH - b.r) { b.y = FY0 + FH - b.r; b.vy = -Math.abs(b.vy) * 0.8; }
      if (b.x < FX0 || b.x > FX0 + FW) {
        // bóng đang trong lưới: giữ trong khung
        if (b.y < GY0 + b.r) { b.y = GY0 + b.r; b.vy = Math.abs(b.vy) * 0.6; }
        if (b.y > GY1 - b.r) { b.y = GY1 - b.r; b.vy = -Math.abs(b.vy) * 0.6; }
      }
      const inMouth = b.y > GY0 + b.r * 0.6 && b.y < GY1 - b.r * 0.6;
      if (b.x < FX0 + b.r) {
        if (!inMouth) { b.x = FX0 + b.r; b.vx = Math.abs(b.vx) * 0.8; }
        else if (b.x < FX0 - b.r) { this.goal(1); return; }
      }
      if (b.x > FX0 + FW - b.r) {
        if (!inMouth) { b.x = FX0 + FW - b.r; b.vx = -Math.abs(b.vx) * 0.8; }
        else if (b.x > FX0 + FW + b.r) { this.goal(0); return; }
      }
    }

    draw(ctx) {
      if (this.sub) { this.sub.draw(ctx); return; }
      ctx.fillStyle = '#1d5e2c'; ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = k % 2 ? '#4ca84a' : '#55b553';
        ctx.fillRect(FX0 + k * FW / 14, FY0, FW / 14 + 1, FH);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4;
      ctx.strokeRect(FX0, FY0, FW, FH);
      ctx.beginPath(); ctx.moveTo(FX0 + FW / 2, FY0); ctx.lineTo(FX0 + FW / 2, FY0 + FH); ctx.stroke();
      ctx.beginPath(); ctx.arc(FX0 + FW / 2, FY0 + FH / 2, 80, 0, TAU); ctx.stroke();
      if (this.ko) { // vòng giao bóng sáng màu đội được giao
        ctx.save(); ctx.strokeStyle = TEAMS.colors[1 - this.ko.t]; ctx.lineWidth = 6; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(FX0 + FW / 2, FY0 + FH / 2, 80, 0, TAU); ctx.stroke(); ctx.restore();
      }
      ctx.strokeRect(FX0, FY0 + FH / 2 - 150, 140, 300);
      ctx.strokeRect(FX0 + FW - 140, FY0 + FH / 2 - 150, 140, 300);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(FX0 + FW / 2, FY0 + FH / 2, 5, 0, TAU); ctx.fill();
      // khung thành
      for (const [gx, t] of [[FX0 - GD, 0], [FX0 + FW, 1]]) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(gx, GY0, GD, GH);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
        for (let y = GY0; y <= GY1; y += 12) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + GD, y); ctx.stroke(); }
        for (let x = gx; x <= gx + GD; x += 12) { ctx.beginPath(); ctx.moveTo(x, GY0); ctx.lineTo(x, GY1); ctx.stroke(); }
        ctx.strokeStyle = TEAMS.colors[t]; ctx.lineWidth = 6;
        ctx.strokeRect(gx, GY0, GD, GH);
      }
      // người chơi + bóng theo chiều sâu
      const b = this.ball;
      const items = this.ps.map((p, i) => ({ y: p.y, i })).concat([{ y: b.y, i: -1 }]);
      if (!this.pk) this.keepers.forEach((k, n) => items.push({ y: k.y, i: -2 - n }));
      items.sort((a, c) => a.y - c.y);
      // đá phạt: vạch ngắm
      if (this.set) {
        const S = this.set, c = this.P[S.kicker].color;
        ctx.strokeStyle = c.light; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(S.aim) * 170, b.y + Math.sin(S.aim) * 170); ctx.stroke(); ctx.setLineDash([]);
      }
      for (const it of items) {
        if (it.i === -1) { this.drawBall(ctx); continue; }
        if (it.i <= -2) { this.drawKeeper(ctx, this.keepers[-2 - it.i]); continue; }
        const p = this.ps[it.i], t = this.team[it.i];
        ctx.strokeStyle = TEAMS.colors[t]; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.8, p.r * 1.05, p.r * 0.38, 0, 0, TAU); ctx.stroke();
        if (p.slideT > 0) {
          // xoạc: người nằm rạp, có vệt cỏ
          ctx.fillStyle = 'rgba(120,90,40,0.35)';
          ctx.beginPath(); ctx.ellipse(p.x - Math.cos(p.slideDir) * 24, p.y + 10 - Math.sin(p.slideDir) * 24, 30, 9, p.slideDir, 0, TAU); ctx.fill();
        }
        Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: this.P[it.i].color, face: p.face, walk: p.walk,
          squash: p.slideT > 0 ? -0.35 : p.squash, stun: p.stun > 0 });
        if (p.slideT <= 0) this.drawArrow(ctx, p, this.P[it.i].color, p.hold > TAP ? Math.min(1, p.hold / CHARGE) : 0);
        if (p.hold > TAP) {
          const k = Math.min(1, p.hold / CHARGE);
          ctx.strokeStyle = k >= 1 ? '#ff5a3a' : '#ffe14d'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 9, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
        }
        if (p.kickT > 0) {
          ctx.fillStyle = this.P[it.i].color.dark;
          ctx.beginPath(); ctx.arc(p.x + Math.cos(p.face) * (p.r + 6), p.y + p.r * 0.5 + Math.sin(p.face) * 10, 8, 0, TAU); ctx.fill();
        }
      }
      this.drawHud(ctx);
      if (this.bannerT < 1.6) Draw.banner(ctx, this.bannerText, this.bannerT, { color: this.bannerColor, size: 64, y: 300 });
    }

    /** mũi tên chỉ hướng nhân vật đang quay (= hướng sút/chuyền); khi giữ Đánh thì dài ra theo lực */
    drawArrow(ctx, p, col, charge) {
      const a = p.face, d0 = p.r + 7, len = 24 + charge * 24, w = 14 + charge * 3;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(d0 + len, 0); ctx.lineTo(d0, -w); ctx.lineTo(d0 + len * 0.28, 0); ctx.lineTo(d0, w); ctx.closePath();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(20,10,40,0.6)'; ctx.stroke();
      ctx.fillStyle = charge >= 1 ? '#ff5a3a' : charge > 0 ? '#ffe14d' : col.main; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.restore();
    }
    drawKeeper(ctx, k) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(k.x, k.y + k.r * 0.8, k.r * 1.05, k.r * 0.38, 0, 0, TAU); ctx.stroke();
      Draw.blob(ctx, { x: k.x, y: k.y, r: k.r, color: k.color, face: k.face, squash: k.diveT > 0 ? -0.3 : 0 });
      // găng tay
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(k.x + Math.cos(k.face) * 8, k.y + s * (k.r + 4), 7, 0, TAU); ctx.fill(); ctx.stroke(); }
      Draw.text(ctx, 'TM', k.x, k.y - k.r - 12, { size: 13, color: '#fff', sw: 3 });
    }

    drawBall(ctx) {
      const b = this.ball;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(b.x, b.y + b.r * 0.9, b.r, b.r * 0.35, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(0, -(b.z || 0));
      if (b.fire > 0) {
        ctx.fillStyle = 'rgba(255,140,40,0.55)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 9 + Math.random() * 4, 0, TAU); ctx.fill();
        this.api.parts.burst(b.x, b.y, ['#ff8a2e', '#ffe14d'], 1, 60, 0.35, 6);
      }
      ctx.save(); ctx.translate(b.x, b.y);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, b.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.clip();
      ctx.fillStyle = '#222';
      for (let k = 0; k < 3; k++) {
        const a = b.spin + k * TAU / 3;
        ctx.beginPath(); ctx.arc(Math.cos(a) * b.r * 0.55, Math.sin(a) * b.r * 0.3, b.r * 0.3, 0, TAU); ctx.fill();
      }
      ctx.restore();
      ctx.restore();
    }

    drawHud(ctx) {
      const cx = W / 2, y = 44;
      Draw.rr(ctx, cx - 250, y - 30, 500, 60, 30);
      ctx.fillStyle = 'rgba(15,25,15,0.75)'; ctx.fill();
      Draw.text(ctx, String(this.score[0]), cx - 34, y + 2, { size: 44, color: TEAMS.colors[0] });
      Draw.text(ctx, '–', cx, y, { size: 36 });
      Draw.text(ctx, String(this.score[1]), cx + 34, y + 2, { size: 44, color: TEAMS.colors[1] });
      for (const t of [0, 1]) {
        const ids = this.team.map((x, i) => (x === t ? i : -1)).filter((i) => i >= 0);
        ids.forEach((i, k) => {
          const bx = t === 0 ? cx - 90 - k * 40 : cx + 90 + k * 40;
          Draw.blob(ctx, { x: bx, y: y - 2, r: 15, color: this.P[i].color, shadow: false, face: t === 0 ? 0 : Math.PI });
        });
        Draw.text(ctx, TEAMS.names[t], t === 0 ? cx - 160 - (ids.length - 1) * 40 : cx + 160 + (ids.length - 1) * 40, y,
          { size: 20, color: TEAMS.colors[t], align: t === 0 ? 'right' : 'left', sw: 4 });
      }
      if (this.golden) Draw.label(ctx, `⚡ Bàn vàng ${Math.ceil(30 - (this.goldenT || 0))}s`, W - 130, 44);
      else Draw.timer(ctx, this.time, W - 72, 44);
      if (this.doubleAt >= 0 && this.time <= this.doubleAt && !this.golden) Draw.label(ctx, 'Bàn ×2', 80, 44);
      // hướng dẫn lúc đá phạt / phạt đền
      const P = this.pk;
      if (P && P.phase === 'ready') {
        const sn = this.P[P.shooter].name, kn = this.P[P.keeper].name;
        Draw.rr(ctx, W / 2 - 420, H - 74, 840, 58, 20); ctx.fillStyle = 'rgba(15,25,15,0.78)'; ctx.fill();
        Draw.text(ctx, `⚽ ${sn} sút: giữ Đánh lấy lực, giữ ↑ / ↓ (hoặc không) lúc thả để chọn góc`, W / 2, H - 56, { size: 18, color: this.P[P.shooter].color.light, sw: 3 });
        Draw.text(ctx, `🧤 ${kn} bắt: giữ ↑ / ↓ (hoặc không) rồi bấm Nhảy để bay người · ${Math.ceil(P.t)}s`, W / 2, H - 32, { size: 18, color: this.P[P.keeper].color.light, sw: 3 });
        if (P.hold > 0) {
          const S = this.ps[P.shooter], k = P.hold / CHARGE;
          ctx.strokeStyle = k > 1.12 ? '#ff3a3a' : k >= 0.9 ? '#ff8a3a' : '#ffe14d'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(S.x, S.y, S.r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, k)); ctx.stroke();
        }
      }
      if (this.set) {
        const S = this.set;
        Draw.rr(ctx, W / 2 - 330, H - 52, 660, 40, 20); ctx.fillStyle = 'rgba(15,25,15,0.78)'; ctx.fill();
        Draw.text(ctx, `🎯 ${this.P[S.kicker].name} đá phạt: chọn hướng, giữ Đánh lấy lực rồi thả · ${Math.ceil(S.t)}s`, W / 2, H - 32, { size: 18, color: this.P[S.kicker].color.light, sw: 3 });
      }
    }

    results() {
      return this.P.map((_, i) => {
        const t = this.team[i], st = this.stats[i];
        const so = this.sub ? ` · luân lưu ${this.sub.goals(t)}–${this.sub.goals(1 - t)}` : '';
        const me = st.goals ? ` · ghi ${st.goals}` : '';
        return { score: this.score[t] - this.score[1 - t] + (this.soWin === t ? 0.5 : this.soWin === 1 - t ? -0.5 : 0), text: `${TEAMS.names[t]} · ${this.score[t]} – ${this.score[1 - t]}${so}${me}` };
      });
    }

    botInput(i) {
      const p = this.ps[i], b = this.ball, t = this.team[i];
      const o = { mx: 0, my: 0, actP: false, jumpP: false };
      if (this.sub) return {};
      if (this.pk) return this.penaltyBot(i);
      if (this.set) {
        const S = this.set;
        if (S.kicker !== i) return o;
        // đá phạt: nhắm sát cột (tránh hàng rào), giữ lực rồi thả
        if (!S.bot) S.bot = { ty: FY0 + FH / 2 + (Math.random() < 0.5 ? -1 : 1) * (GH / 2 - 30), hold: CHARGE * U.rand(0.6, 0.95) };
        const gx = this.goalLineX(1 - t), a = Math.atan2(S.bot.ty - b.y, gx - b.x);
        o.mx = Math.cos(a); o.my = Math.sin(a);
        o.act = p.hold < S.bot.hold;
        return o;
      }
      if (this.freeze > 0 || this.goalT > 0 || p.stun > 0 || p.slideT > 0) return o;
      const goalX = t === 0 ? FX0 + FW + 30 : FX0 - 30, goalY = FY0 + FH / 2;
      const ownX = t === 0 ? FX0 : FX0 + FW;
      const myD = Math.hypot(b.x - p.x, b.y - p.y);
      const mateCloser = this.ps.some((q, j) => j !== i && this.team[j] === t && Math.hypot(b.x - q.x, b.y - q.y) < myD - 30);
      let tx, ty;
      if (mateCloser) {
        tx = ownX + (b.x - ownX) * 0.35; ty = goalY + (b.y - goalY) * 0.5;
      } else {
        let gx = goalX - b.x, gy = goalY - b.y;
        const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
        const off = p.r + b.r + 6;
        const bx = b.x - gx * off, by = b.y - gy * off;
        const rel = (p.x - b.x) * gx + (p.y - b.y) * gy;
        if (rel < -5 && Math.hypot(p.x - bx, p.y - by) < 34) {
          tx = b.x + gx * 40; ty = b.y + gy * 40;
          if (gl < 520 && p.kickCd <= 0 && myD < p.r + b.r + 20 && Math.random() < 0.2) o.actP = true;
        } else {
          tx = bx; ty = by;
          if (rel > -5) {
            const side = ((p.x - b.x) * -gy + (p.y - b.y) * gx) >= 0 ? 1 : -1;
            tx += -gy * side * 55 - gx * 30; ty += gx * side * 55 - gy * 30;
          }
        }
      }
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if (d > 8) { o.mx = dx / d; o.my = dy / d; }
      // sút khi đang ở gần bóng và mặt hướng về phía khung thành đối phương
      const toGoal = Math.atan2(goalY - p.y, goalX - p.x);
      if (myD < p.r + b.r + 20 && p.kickCd <= 0 && Math.abs(U.angDiff(p.face, toGoal)) < 0.7 && Math.random() < 0.25) o.actP = true;
      // chuyền cho đồng đội đứng gần khung thành đối phương hơn mình nhiều
      const m = this.mateFor(i);
      if (m >= 0 && !o.actP && myD < p.r + b.r + 20 && p.kickCd <= 0) {
        const mt = this.ps[m];
        if (Math.abs(goalX - mt.x) < Math.abs(goalX - p.x) - 220 && Math.random() < 0.04) { o.actP = true; o.pass = true; }
      }
      // sút đôi: đồng đội vừa sút mà mình ở gần bóng
      if (this.lastKick && this.lastKick.team === t && this.lastKick.i !== i && this.clock - this.lastKick.t < TWIN && Math.hypot(b.x - p.x, b.y - p.y) < 150 && p.kickCd <= 0 && Math.random() < 0.3) o.actP = true;
      this.ps.forEach((q, j) => {
        if (this.team[j] === t || p.dashCd > 0) return;
        const dq = Math.hypot(q.x - p.x, q.y - p.y);
        if (this.real) {
          // xoạc: chỉ xoạc thẳng vào bóng khi đối thủ đang đối mặt mình (tránh phạm lỗi từ sau lưng)
          const bd = Math.hypot(b.x - p.x, b.y - p.y), aB = Math.atan2(b.y - p.y, b.x - p.x);
          if (bd < 75 && Math.hypot(b.x - q.x, b.y - q.y) < 40 && Math.cos(q.face - Math.atan2(q.y - p.y, q.x - p.x)) < -0.1 && Math.random() < 0.012) {
            o.jumpP = true; o.mx = Math.cos(aB); o.my = Math.sin(aB);
          }
          return;
        }
        if (dq < 110 && Math.hypot(b.x - q.x, b.y - q.y) < 50 && Math.random() < 0.04) {
          o.jumpP = true; o.mx = (q.x - p.x) / dq; o.my = (q.y - p.y) / dq;
        }
      });
      return o;
    }

    /** máy trong lúc phạt đền / luân lưu */
    penaltyBot(i) {
      const P = this.pk, o = { mx: 0, my: 0, act: false, jumpP: false }, lv = this.api.botOf(i), cy = FY0 + FH / 2;
      if (i === P.shooter && P.phase === 'ready') {
        if (!P.sBot) P.sBot = { dir: U.pick([-1, -1, 0, 1, 1]), hold: CHARGE * U.rand(lv.actDrop > 0.4 ? 0.35 : 0.55, lv.actDrop > 0.4 ? 1.2 : 1.0), wait: U.rand(0.6, 2) };
        P.sBot.wait -= 1 / 60;
        if (P.sBot.wait > 0) return o;
        o.my = P.sBot.dir; o.act = P.hold < P.sBot.hold;
        return o;
      }
      if (i === P.keeper && !P.dove) {
        if (!P.kBot) P.kBot = { early: Math.random() < 0.12, react: lv.actDrop > 0.4 ? 0.32 : lv.actDrop > 0.1 ? 0.22 : 0.13, acc: lv.actDrop > 0.4 ? 0.3 : lv.actDrop > 0.1 ? 0.36 : 0.45 };
        const kb = P.kBot;
        let dir = null;
        if (P.phase === 'ready' && kb.early && P.hold > CHARGE * 0.4) dir = U.pick([-1, 0, 1]);
        if (P.phase === 'fly' && P.fly.t > kb.react) {
          const real = Math.abs(P.fly.y1 - cy) < 20 ? 0 : Math.sign(P.fly.y1 - cy);
          dir = Math.random() < kb.acc ? real : U.pick([-1, 0, 1].filter((d) => d !== real));
        }
        if (dir !== null) { o.my = dir; o.jumpP = true; }
      }
      return o;
    }
  }

  Party.register({
    id: 'soccer', name: 'Bóng Đá', emoji: '⚽',
    tagline: 'Chia 2 đội, sút bóng vào khung thành đối phương',
    how: 'Chạm bóng là dắt bóng. CHẠM nút Đánh để chuyền cho đồng đội gần nhất, GIỮ nút Đánh rồi thả để sút căng theo hướng đang đi. Hai người cùng đội sút gần như cùng lúc ngay cạnh bóng → bóng lửa! '
      + 'Đội chỉ có 1 người thì có thủ môn tự động (TM). Bóng đá thật: Nhảy = xoạc bóng — xoạc trúng bóng là cướp sạch, xoạc vào người từ phía sau là phạm lỗi → đội kia đá phạt (trong vòng cấm là phạt đền); hết giờ hòa thì đá luân lưu. '
      + 'Phạt đền: người sút giữ Đánh lấy lực (giữ quá lâu bóng bay lên trời), giữ ↑/↓ lúc thả để sút góc; thủ môn giữ ↑/↓ rồi bấm Nhảy để bay người. Luân lưu chơi giống chế độ Luân lưu.',
    controls: { move: 'Chạy & dắt bóng', act: 'Chạm: chuyền · Giữ: sút', jump: 'Xoạc bóng (thật) · Húc (vui)' },
    modes: MODES,
    minPlayers: 2, maxPlayers: 4, team: true,
    create: (api) => (api.mode === 'shootout' ? new PenaltyShootout(api) : new Soccer(api)),
  });
})();
