# CLAUDE.md — Tròn Party

Bộ mini-game party cho **2–4 người chơi chung một máy** (bàn phím và/hoặc gamepad), chạy trong trình duyệt bằng cách mở `index.html`. Lấy cảm hứng từ lối chơi của bloopparty.com nhưng **tên, nhân vật, giao diện là tự thiết kế** — không sao chép thương hiệu/hình ảnh của họ (không dùng chữ "Bloop" trong game).

- Ngôn ngữ giao tiếp với chủ project: **tiếng Việt**, giữ thuật ngữ kỹ thuật bằng tiếng Anh.
- Toàn bộ chữ trong game (UI, luật chơi, thông báo) là **tiếng Việt có dấu**. Comment trong code cũng tiếng Việt.

## Ràng buộc kiến trúc (đừng phá)

- **Không build step, không framework, không server.** Mở `index.html` trực tiếp bằng `file://` phải chạy được.
- Vì `file://`, **chỉ dùng classic `<script>`** — không dùng ES modules (`import/export`), không `fetch` file local.
- Hình ảnh: **được dùng ảnh** (PNG/JPG/SVG) đặt trong thư mục `assets/` của dự án (chủ project bỏ ràng buộc "chỉ vẽ Canvas" ngày 12/11/2026 — dùng chơi với bạn bè, ưu tiên đẹp mắt). Ảnh phải là file local (chạy được bằng `file://` và trong bản .exe, không tải từ mạng lúc chơi), ưu tiên bộ hình có giấy phép tự do và ghi nguồn trong `assets/CREDITS.md`; game nên tự vẽ Canvas khi thiếu ảnh. Không đưa logo, linh vật hay artwork gốc của thương hiệu khác vào (vd. Monopoly). Âm thanh vẫn tổng hợp bằng WebAudio (`Sfx`). Font "Baloo 2" lấy từ Google Fonts nhưng có fallback, offline vẫn chạy.
- Canvas logic cố định **1280×720**; `#stage` được scale cho vừa cửa sổ. Mọi toạ độ trong game dùng hệ 1280×720 (`W`, `H`).
- Thứ tự script trong `index.html`: `engine.js` → các file `js/games/*.js` → `app.js` (cuối cùng).

## Cấu trúc

```
index.html            khung HTML các màn hình (title, lobby, menu, intro, result, board, pause) + nạp script
css/style.css         giao diện menu/overlay (DOM). Gameplay vẽ trên canvas.
js/engine.js          phần dùng chung (global): hằng số, U, Input, Sfx, FX, Particles, Phys, Draw,
                      BOT_LEVELS, TEAMS, GAME_CATS/GAME_CAT_OF, Party.register
js/app.js             object App: vòng lặp, máy trạng thái màn hình, sảnh, menu theo tab,
                      intro (đội hình: thêm máy, mức từng máy, người nghỉ) + sẵn sàng, đếm ngược, kết quả, weakenBot()
js/games/*.js         mỗi file 1 game (doors.js đăng ký 2 game: Đố Toán + Đoán Màu)
js/games/push_base.js khung PushKit dùng chung cho Đấu Sumo + Lăn Tuyết (phải nạp TRƯỚC sumo.js/snowball.js)
js/games/board_base.js BoardKit dùng chung cho game cờ (ảnh, con trỏ phím, đồng hồ, máy nghĩ trong Web Worker) — nạp TRƯỚC các game cờ
js/games/chess_engine.js ChessEngineFactory/window.ChessEngine: luật + AI Cờ Vua (hàm factory để nhúng vào worker)
js/games/chess.js     Cờ Vua
js/games/xiangqi_engine.js XiangqiEngineFactory/window.XiangqiEngine: luật + AI + ký hiệu Việt Cờ Tướng
js/games/xiangqi.js   Cờ Tướng
js/games/shootout.js  lớp PenaltyShootout (đá luân lưu nhìn từ sau lưng người sút) — phải nạp TRƯỚC soccer.js
tools/smoke-test.js   test headless bằng Playwright: cho bot chơi hết mọi game
assets/               ảnh dùng trong game (kèm CREDITS.md) — nhớ chép cả thư mục này khi đóng gói bản .exe
desktop/              bản ứng dụng Windows không cần trình duyệt (Electron 44.10.0): main.js, package.json, HUONG-DAN.txt, cap-nhat-game.bat, BUILD.md
README.md             hướng dẫn cho người chơi + bảng game + mẫu thêm game
```

Luồng `App.state`: `title → lobby → menu → intro → countdown → play ⇄ paused → ending → result`.

**Người chơi & máy (12/11/2026):** sảnh chỉ ghép **người thật** (`App.slots`, cần ≥1 người). Máy và độ khó chọn ở màn giới thiệu của từng game: `App.seats` = `[{ h: ô sảnh } | { bot: true, level }]`, `App.bench` = người thật nghỉ ván này. `startGame(def)` dựng đội hình mặc định (`defaultSeats`: mọi người thật, thừa thì nghỉ, thiếu thì thêm máy `normal` cho đủ `minPlayers`) — **không nhớ** giữa các game; `startGame(def, { keep: true })` (Chơi lại / Chơi lại game này) giữ đội hình; `startGame(def, { seats })` cho smoke test. `seatEdit(op)` (add / rm / lv / bench / in) rồi `setupGame()` dựng lại `players` (máy tên "Máy 1..", màu chưa ai dùng, `p.level`), `api`, instance. **Chơi tiệc đã gỡ hẳn** theo yêu cầu chủ project (vòng quay sự kiện, cược, bàn cờ tiệc, hiệp phụ quyết tử, màn chọn tiệc) — `api.sudden` luôn `false`, code PushKit/Đấu Kiếm đọc nó vẫn để nguyên.

## Thêm một game mới

1. Tạo `js/games/<id>.js`, bọc trong IIFE `(() => { ... })();`, `'use strict'`.
2. Thêm `<script src="js/games/<id>.js"></script>` vào `index.html` **trước** `app.js`.
3. Gọi `Party.register(def)`:

```js
Party.register({
  id: 'sumo',                 // duy nhất, viết thường
  name: 'Đấu Sumo', emoji: '🤼',
  cat: 'fight',               // fight | dodge | collect | team | brain (tab trong menu)
  tagline: '...',             // 1 dòng trên thẻ game (bị cắt 3 dòng)
  how: '...',                 // luật chơi ở màn intro
  controls: { move: 'Di chuyển', act: 'Húc', jump: 'Nhảy' },  // bỏ key nào thì cột đó ẩn
  minPlayers: 2, maxPlayers: 4,
  coop: false,                // hiện chữ "co-op" trên thẻ
  rawBot: false,              // true = app KHÔNG làm yếu bot; game tự xử lý độ khó (xem dưới)
  create: (api) => new Sumo(api),
});
```

Instance trả về từ `create` phải có:

| Thành phần | Bắt buộc | Ghi chú |
|---|---|---|
| `update(dt, inputs)` | ✓ | `inputs[i] = { mx, my, act, jump, actP, jumpP }` — `mx/my` ∈ [-1,1]; `actP/jumpP` = vừa bấm (edge) |
| `draw(ctx)` | ✓ | vẽ toàn bộ khung hình, kể cả HUD. App vẽ particles (`api.parts`) đè lên sau |
| `finished` | ✓ | đặt `true` khi xong. App vẫn gọi `update/draw` thêm ~1,6s để chạy hiệu ứng → **đừng cộng điểm sau khi finished** |
| `results()` | ✓ | mảng theo thứ tự người chơi: `{ score, text }`. Điểm cao xếp trên, bằng điểm = đồng hạng. App gọi **ngay lúc finished** |
| `botInput(i)` | nên có | trả input cho người chơi máy (cùng shape, thiếu key = false/0) |
| `teamOf(i)` | game đội | intro hiện cột Đội. Dùng `TEAMS.split(n)` → P1,P3 Đội Trái; P2,P4 Đội Phải |
| `resultTitle()` | tuỳ chọn | ghi đè tiêu đề màn kết quả (game co-op) |
| `posOf(i)` | nên có | `{x,y}` vị trí nhân vật trên màn hình (đã trừ độ cao nhảy) hoặc `null` khi đang ẩn. Không có thì `App.posOf(i)` tự đọc `ps[i].x/y/z`. Smoke test kiểm tra toạ độ hợp lệ |

**Chế độ chơi & lựa chọn riêng từng người** (tuỳ chọn, trong `def`):
- `modes: [{ id, name, desc, icon?, how?, controls? }]` → màn intro có hàng thẻ chọn chế độ (biểu tượng + tên, thẻ đang chọn viền vàng ✓, mô tả của chế độ đang chọn hiện ngay dưới; bấm chuột vào thẻ = `App.setMode(id)`, nút Nhảy của người thật = chuyển sang thẻ kế tiếp `cycleMode()`; lưu `localStorage` key `tronparty.modes`). Biểu tượng: `icon` trong mode, nếu không có thì `MODE_ICONS` trong app.js (`'gameId:modeId'` rồi tới `modeId`). `how`/`controls` của mode (nếu có) thay luật chơi và tên cột phím ở intro. Game đọc `api.mode`.
- `playerChoices: { label, def, botDef?, items: [{ id, name, icon, desc }] }` → cột lựa chọn ở intro, mỗi người thật đổi bằng ← →; máy chọn ngẫu nhiên (hoặc `botDef` nếu có). Game đọc `api.choices[i]` (chỉ số trong `items`).
- `options: [{ id, label, items: [{ id, name, icon, desc }] }]` → các hàng thẻ tuỳ chọn hiển thị (vd. bộ quân, kiểu bàn cờ) đặt cạnh nhau ở intro, bấm chuột hoặc chọn bằng phím + Enter; lưu `tronparty.opts`; game đọc `api.opts[id]` lúc vẽ (app không tạo lại instance).
- Instance có thể có `onPointer(x, y, 'down'|'move'|'up')` (chuột, toạ độ 1280×720, chỉ gọi lúc play/ending), `teamNames`/`teamColors`/`teamLabel` (thay chữ Đội Trái/Phải ở intro, vd. ♔ Trắng / ♚ Đen), `ownEndBanner` (app không vẽ chữ "Kết thúc!").
- `variants: { label, items: [{ id, name, icon, desc }] }` → hàng thẻ thứ hai ở intro (vd. đường đua), bấm thẻ = `App.setVariant(id)`, nút Lên = `cycleVariant()` (khi game không có `looks`); lưu `tronparty.variants`. Game đọc `api.variant`.
- Khi đổi chế độ/lựa chọn, app **tạo lại instance** (`def.create(api)`) — constructor không được có side effect ngoài instance.
- Nếu game chỉ có đội ở một số chế độ: đặt `this.teamOf = null` trong constructor ở các chế độ còn lại (app kiểm tra `inst.teamOf`).

`api = { players, parts, bot, botOf, len, T, wins, count, mode, variant, opts, choices }`: `players[i]` có `name` ('P1'..), `color` ({main,dark,light}), `bot` (bool), `src`; `parts` là `Particles`; `bot` là object mức độ khó hiện tại trong `BOT_LEVELS`.

**Độ dài ván** (`GAME_LENGTHS` trong engine, người chơi chọn Ngắn/Vừa/Dài ở sảnh) — game mới **phải** dùng các hàm này thay vì số cứng:
- `api.T(sec)` → thời gian ván (×0,5 / ×1 / ×1,5). Quy ước: `this.time = this.total = api.T(GAME_TIME)`; các mốc tương đối (×2 điểm cuối trận, boss xuất hiện, vòng tử thần...) cũng qua `api.T(...)` hoặc tỉ lệ `this.total`.
- `api.wins` → số hiệp cần thắng; quy ước `this.need = api.wins; this.maxRounds = api.wins * 2 - 1`.
- `api.count(n)` → số lượng (câu hỏi, vòng đua, hộp, điểm...). Lưu vào `this.laps / this.qn / this.goal / this.target`.
- App đọc các field `total, need, laps, qn, goal, target` của instance để hiện dòng "Ván này: …" ở màn intro (`App.lengthInfo()`), nên đặt đúng tên field.
- Chữ trong `how`/`tagline` **không ghi số cứng** (60 giây, 2 hiệp, 12 câu...) vì sẽ sai khi đổi độ dài.

Quy ước gameplay đang dùng: ván ~60s hoặc 3 hiệp (thắng 2 trước), HUD trên cùng bằng `Draw.chips(...)` + `Draw.timer(...)` ở góc phải, `Draw.label('Hiệp 1/3')` ở góc trái, banner bằng `Draw.banner(...)`. Chữ trong chip phải **ngắn** (~8 ký tự) kẻo tràn đè tên.

## Engine — những thứ hay dùng

- `U`: `clamp, lerp, rand, randi, pick, shuffle, dist, approach, angDiff, outBack, fmtTime, now`.
- `Draw`: `rr` (rounded rect path), `text(ctx,s,x,y,{size,color,align,base,stroke,sw})`, `blob(ctx,{x,y,r,color,face,walk,z,squash,scale,alpha,stun,dead,crown,shadow})` (nhân vật Tròn), `crown`, `sparkle`, `banner`, `chips`, `timer`, `label`.
- `Phys.separate(list, rest, onHit(a,b,nx,ny,impact,i,j))` — đẩy các hình tròn `{x,y,vx,vy,r,skip}` ra khỏi nhau; `Phys.circleRect(c, rect)`.
- `Particles`: `burst(x,y,color|[colors],n,speed,life,size,{g,shape:'s'})`, `text(x,y,s,color,size)`.
- `FX.shake(amount)`.
- `Sfx.play(name, minGap)` với name ∈ `move select join leave dash hit boom fall pickup paint count go win hurt jump punch crash crown tick warn place crumble kick goal eat shoot pull`; hoặc `Sfx.tone(freq, dur, type, vol)`.
- Input: 4 bộ phím (`KB_SCHEMES`: WASD+Q/E, IJKL+U/O, mũi tên+./, numpad 8456+7/9) + gamepad (A = Đánh, B = Nhảy). Dùng `KeyboardEvent.code` nên không phụ thuộc layout.

## Bot & độ khó

- `BOT_LEVELS` trong `engine.js`: `easy | normal | hard`, mỗi mức có `react, speed, actCd, actDrop, wander, look, tug`. **Mỗi máy một mức** (`players[i].level`, chọn ở màn giới thiệu). Game đọc mức của máy i bằng `api.botOf(i)` — **đừng dùng `api.bot`** trong game mới (chỉ đúng bên trong `botInput(i)`, vì app gán `api.bot` = mức của máy i ngay trước khi gọi; ngoài đó nó là mức của máy đầu tiên). Các game cũ đã đổi hết sang `botOf`.
- Mặc định `App.weakenBot()` bọc output `botInput()`: phản xạ trễ (giữ hướng cũ `react` giây), nhân tốc độ, thêm hồi chiêu `actCd` và tỉ lệ bỏ lỡ `actDrop` cho `actP/jumpP`, thỉnh thoảng đi lạc. Mức `hard` = bot gốc không bị làm yếu.
- Game cần nhịp chính xác (Kéo Co, Chim Bay, Nhảy Dây, Nhớ Chuỗi, Ai Là Người Thật?) đặt `rawBot: true` và **tự** đọc `this.api.botOf(i)` để đưa lỗi vào (độ lệch thời gian, tỉ lệ sai...). Lý do: gate `actDrop/actCd` chung sẽ làm bot các game này không chơi nổi.
- Game di chuyển theo lưới/hướng (Đặt Bom, Đua Xe) nhân `this.api.botOf(i).speed` bên trong game vì scale `mx/my` không có tác dụng.
- **Bài học đã gặp:** bot "gốc" phải thật sự chơi tốt — đã có lần bot Đua Xe đâm dầu mọi vòng, bot Đấu Kiếm giật hướng kiếm, bot Chuyển Tiền kẹt ở mép kho; khi đó mức Khó lại thua mức Dễ. Luôn đo tỉ lệ thắng theo mức (xem Test).

## Test

- Nhanh: `node --check js/games/<file>.js` (bắt lỗi cú pháp — ví dụ khai báo trùng tên biến `const` trong cùng scope làm **cả game biến mất khỏi menu** mà không báo gì trên UI).
- Đầy đủ: `node tools/smoke-test.js [id...] [--shots] [--len=short|normal|long]` — cho bot chơi mọi game ở mức easy/hard với 2 và 4 người, báo game không kết thúc / lỗi JS; `--shots` chụp ảnh giữa trận vào `tools/shots/`. Cần `npm i -D playwright && npx playwright install chromium` lần đầu.
- Khi đổi bot/độ khó: đo kiểu "1 bot gốc (không weaken) đấu 1 bot theo mức" vài ván — mong đợi Dễ ≈ luôn thua, Trung bình thua phần lớn, Khó ≈ 50/50.
- Sau khi sửa, luôn xem ảnh chụp: lỗi hay gặp là chữ tràn trong `Draw.chips`, HUD đè lên sân chơi, banner che nhân vật.

## Quy ước code

- 2 dấu cách thụt lề, nháy đơn, có dấu chấm phẩy, `'use strict'`.
- Hằng số layout của game (toạ độ sân, thời gian ván...) khai báo `const` viết HOA ở đầu IIFE.
- Không thêm thư viện ngoài. Không dùng `localStorage` cho gì ngoài tiện ích nhỏ (hiện lưu độ dài ván, chế độ / biến thể / tuỳ chọn từng game, tua nhanh, bộ phím đã đổi), luôn bọc `try/catch`.
- Khi thêm game: cập nhật bảng game trong `README.md` và (nếu cần) `GAME_CAT_OF` hoặc khai báo `cat` trong `register`.

## PushKit (push_base.js) — Đấu Sumo & Lăn Tuyết

- `PushKit.PushArena(api, cfg)` là class gốc; game con `extends` và cung cấp `drawBody(ctx, b, {scale, alpha, stun, wob})`.
- `cfg`: `baseR`, `arenas` (id trong `PushKit.ARENAS`), hook tuỳ chọn `onSpawn(b, cls)`, `onMove(b, dt, game)`, `massMul(b)`, `accMul(b)`, `hitMul(b)`, `dashMul(b)`.
- Gồm: tích lực (giữ act), thanh %, đứng tấn (giữ jump ≥ `TAP`), dậm đất (chạm jump), chới với ở mép (`teeter`, bấm jumpP để thoát), 3 lớp võ sĩ (`CLASSES`), sàn chia mảnh vỡ dần từ ngoài vào (tròn: lõi + 3 vòng × 16 mảnh; vuông 8×8), chướng ngại (cột nảy, thanh quét, mạch nham, gió), vật phẩm, 5 chế độ (`MODES`: rounds/team/stocks/koth/train), ma quấy rối, phụ kiện `LOOKS`, sàn bập bênh, `api.sudden` (hiệp phụ quyết tử).
- Bot: tự xử lý giữ nút tích lực (`act` giữ không bị weakenBot gate) nên đọc `api.botOf(i).actDrop/actCd` trong `botInput` để tự làm yếu. Đo ngày làm: gốc vs Dễ ≈ 23/24, vs TB ≈ 17–22/24, vs Khó ≈ 50/50.
- Smoke test tự lặp qua mọi `modes` của game (id hiện dạng `sumo:koth`).

## Việc còn mở / ý tưởng

- Đã sửa (08/11/2026): Đánh Trùm cân bằng theo số người (2–3 người: Trùm chậm hơn, nghỉ lâu hơn, người bị nhốt tự thoát sau vài giây — bấm Đánh để nhanh hơn; bot né lao húc biết tránh tường). Đo bot: 2/3/4 người thắng ≈ 11–12/12 ở mọi mức. Nhảy Dây: máy (kể cả Khó) thỉnh thoảng lơ đễnh → gốc vs Khó ≈ 50/50, Khó mất TB ~0,8 tim/ván.
- Đợt 1 (08/11/2026) đã làm: ALL3 Chơi tiệc tự chọn (`App.partySet` {count 3/5/8, off[]} lưu `tronparty.partySet`, màn `#s-partyset`), ALL11 rung tay cầm (`Input.rumble(padIndex, s, ms)`, `FX.onShake` → rung nhẹ mọi tay cầm người thật; game gọi `Party.rumble(i, s, ms)` khi người i bị trúng/mất mạng — đã gắn ở các game có tim/bị loại), ALL12 biểu cảm (`App.tauntInput` trong countdown/ending, dùng `App.posOf`), TRN1+TRN5 (+ chế độ Có tường/Xuyên mép, tường khép sau 25s), POT1, PNT2, FSH2, CRW1, LAS3, BOB1, MTH3+MTH4 (chỉ Đố Toán).
- Đợt 2 (08/11/2026) đã làm: BOM1 (👢 đá bom `kickBomb`, 🧤 ném `throwBomb` — bom có `slide`/`fly`, 📡 `remote`), BOM3 (ma báo thù khi ≥3 người: `gs` vị trí trên vòng tường, `ghostCell`), BOM6 (đánh bật bom đang bay trong `PARRY_WIN`), PNT1 (thanh `meter` → bom sơn), PNT4 (chế độ team: ô lưu chỉ số đội 0/1 = màu P1/P2), PNT6 (trụ phun sơn giữa sân), RAC1 (hộp ?: 🍌🚀🛡️, chạm Nhảy dùng) + RAC2 (giữ Nhảy drift), SOC1 (chạm Đánh chuyền, giữ sút căng; máy gửi `pass:true` để chuyền) + SOC5 (sút đôi → bóng lửa), BOX1 (giữ Đánh đòn mạnh) + BOX2 (đỡ hoàn hảo `parryWin`), TIL1 (chế độ Bước chân) + TIL5 (dậm đất trên không), ALL2 (vòng quay sự kiện `App.openEvent`, state `event`), ALL9 (`App.fast` → `speedMul` 1,3 nhân dt của game), ALL10 (cược `App.bets`, nút Xuống ở intro).
- Đợt 3 (08/11/2026) đã làm: PushKit — chế độ `train` (bước `TRAIN`, máy làm bình nộm khi có người thật), `looks` (game khai báo `looks: LOOKS`, App truyền `api.looks`, đổi bằng nút Lên ở intro, nhớ `App.lookMem`; vẽ bằng `drawLook`), sàn `seesaw`/`snowsaw` (`A.seesaw`, `this.tilt`), slow-mo cú quyết định (`this.slow`) + `hitStop`; S18; FEN2 (mode `march`, `TEAMS.split`, `this.zone`) + FEN5 (`p.sword`, kiếm rơi `swords[]`); ARM5 (khổng lồ: `GIANT_NEED`/`GIANT_T`, `jumpP`); RAC4 (mode `balloon`: `c.bal`, `pop()`, `balloonBot`); TNK3 (mode `ctf`: `flags[]`, `BASE`, đường đi bot `navDir` = Dijkstra trên `NODES` góc chướng ngại); SPT2 (mode `hunter`: `phase` pre/play/post, đèn `hunter:true` do người điều khiển, người trốn gần vô hình trong tối, `hideBot`/`hunterBot` — máy cầm đèn chỉ "thấy" người bị rọi/ồn/sát đèn); BOS2 (mode = loại Trùm `KINDS` classic/fire/ice/fly/random; đòn riêng `flame`/`hail`/`rise→track→slam→rest`); STK1 (mode `physics`: `balance()`/`settle()` kiểm trọng tâm từng tầng); BSB1 (mode `pitcher`: `updateAim`, `TYPES` × `PATHS`, bóng `disguise` tới `MID`); ALL13 (`App.trySudden` khi hòa nhất cuối tiệc → `party.sd`, `api.sudden`: PushKit 1 hiệp trên vòng lõi, Đấu Kiếm 1 chạm; `showSuddenResult`); ALL14 (engine `KB_DEFAULT`/`bindKey`/`resetKeys`/`loadKeys`, lưu `tronparty.keys`; màn `#s-keys` state `keys`; thử phím trong sảnh `updateKeyTest`); ALL15 (`partySet.board`, state `pboard`, bàn vẽ trên canvas `drawPBoard`, `party.pos/curse`, bùa đảo phím đảo `mx,my` trong `gatherInputs`).
- Đợt 4 (08/11/2026) thêm 9 game mới (34 → 43): `split.js` Chia Hay Cướp (NEW8: `startDuel`/`resolve`, máy chọn kiểu ăn miếng trả miếng qua `p.hist`, lựa chọn của máy quyết định trong game chứ không qua input), `count.js` Đếm Tròn (NEW9, rawBot: máy "nhớ" sai theo mức), `treasure.js` Đào Kho Báu (NEW7: lưới 18×9, `radar()`, mìn nổ khi đào hoặc bị húc văng vào `p.fly`), `boomerang.js` Vua Boomerang (NEW2: thả nút để ném, lực kéo về tay + lượn cong, bụi cỏ `BUSH`), `bungee.js` Dây Thun (NEW4: lò xo `REST/MAXL`, dây căng quét đẩy địch, neo = giữ Nhảy, khúc gỗ `logs`), `cannon.js` Đại Bác Công Thành (NEW1: theo hiệp + `roundCap`, tường gạch chặn đạn cùng hàng), `combo.js` Bấm Nhanh Ký Tự (NEW5, rawBot: đọc cạnh lên của hướng thành ký hiệu), `sketch.js` Vẽ Theo Khuôn (NEW6, rawBot: lưới 12×12, `SHAPES`, chấm theo giao/hợp), `moving.js` Chuyển Đồ Điên Loạn (NEW3, co-op: đồ lớn 2 người khiêng kiểu cáng `it.ang`, máy đi bằng BFS lưới 20px `navDir`, máy đi theo người thật đang khiêng chung qua `lastIn`).
- Lưu ý mức máy: Trung bình có `actDrop` 0,3 — khi game tự chia mức theo `actDrop` thì ngưỡng Dễ phải là `> 0.4` (không phải `> 0.25`), kẻo Trung bình bị xếp chung với Dễ.
- Bước nền đã có cho các đề xuất: Xe Tăng bắn lúc NHẢ nút và lưu `p.lastHold` (cho TNK5 pháo cối); Chim Bay cho tiến/lùi ngang trong `XMIN..XMAX` (cho FLP5); `posOf(i)`/`App.posOf(i)` cho mọi game (cho ALL11, ALL12).
- Danh sách game cảm hứng đã làm hết (Đợt 4 thêm Đại Bác, Vua Boomerang, Chuyển Đồ, Dây Thun, Bấm Nhanh Ký Tự, Vẽ Theo Khuôn, Đào Kho Báu, Chia Hay Cướp, Đếm Tròn — không dùng chữ Bloop trong game).
- Đề xuất nâng cấp từng game nằm trong tài liệu "Kế hoạch nâng cấp Tròn Party" (mã ALL*, BOM*, S15+...).
- Tủ Arcade (`arcade.html`, thử nghiệm 08/11/2026): chạy ROM bằng EmulatorJS 4.x từ CDN (ROM truyền bằng `File` vào `EJS_gameUrl`, thư viện IndexedDB `tronparty-arcade`, phím 4 người từ `tronparty.keys`). Đã chạy được Robby Roto. **Đã tạm gỡ khỏi menu** theo yêu cầu chủ project — file `arcade.html` vẫn để trong thư mục, muốn bật lại thì thêm thẻ `data-act="arcade"` vào `renderMenu()` và `case 'arcade'` mở `arcade.html`. Đây là ngoại lệ có chủ ý của ràng buộc offline/không thư viện ngoài.
- Sảnh (09/11/2026): mỗi ô có nút 🙋 Người chơi (chọn bộ phím, state `App.picking`) / 🤖 Máy, ✕ xoá (`removeSlot`), bấm tên để đổi (`startRename`, `<input id="nm-input">`, `App.editing` — lúc gõ thì `Input` bỏ qua phím vì target là INPUT), bấm Tròn đổi màu (`cycleColor`, `COLOR_CHOICES` 10 màu trong engine, không trùng người khác). Hồ sơ từng ô lưu `tronparty.profiles` [{name,color}], `NAME_MAX` = 8. Rời sảnh = giữ Nhảy 1 giây (`leaveT`, thanh `.leavebar`) thay vì chạm Nhảy. `Draw.chips` tự thu nhỏ/cắt tên dài. Esc trong sảnh: huỷ chọn bộ phím hoặc quay lại; nút B tay cầm không còn quay lại màn tiêu đề.
- Bóng Đá thật (09/11/2026, SOC2/SOC6/SOC7): `modes` real (mặc định) / fun; `this.real`. Tốc độ `RUN 340 / DRIBBLE 315`. Real: Nhảy = xoạc (`slideT/slideDir/slideBall/rec`), xoạc trúng người từ sau (`cos(face−slideDir)>0.35`, chưa chạm bóng) → `foul()` → `startFreeKick` (state `this.set`) hoặc `startPenalty(i,'pen')` nếu trong `inBox` (state `this.pk`). Hết giờ hòa → `startShootout()` (xem mục Luân lưu bên dưới). Đội 1 người có thủ môn tự động `this.keepers` (`updateKeepers`, vẽ `drawKeeper`). update: `pk` → `updatePenalty`, `set` → `updateFreeKick` rồi return sớm. Giao bóng `kickoff(kt)` cho đội vừa thủng lưới; đội kia bị chặn ngoài vòng tròn giữa sân (`this.ko`, tới khi bóng lăn hoặc 3 giây, vòng sáng màu đội giao) — không dùng `stun` vì trông như lỗi; bóng chậm bị 2 đội kẹp > 0,9s thì tự bật ra (chống kẹt 0–0 của máy). Máy: `penaltyBot`, chỉ xoạc khi đối thủ quay mặt về phía mình.
- Luân lưu (09/11/2026): `shootout.js` → `window.PenaltyShootout(api, {kicks, match, matchScore})`. Bóng Đá có mode `shootout` (create trả thẳng PenaltyShootout) và trận real hòa thì `startShootout()` tạo `this.sub` (update/draw/posOf/botInput ủy quyền cho sub, `soWin = sub.winner`). Luật IFAB: `first` bốc thăm, xen kẽ `nextTeam()`, `decide(rec)` dừng sớm/đá chết (tối đa kicks+10 lượt rồi hòa), người sút xoay `idx`, thủ môn = người đội kia không phải người sút kế tiếp. Pha mỗi lượt `pre → aim → run → fly → res`. Sút (sửa 10/11 theo góp ý "khó chơi"): tâm ngắm `k.ax/ay` di chuyển bằng phím hướng (`AIM_SP`, kẹp trong `AX0..AX1/AY0..AY1` để không sát cột), vẽ `drawAim` (mũi tên nét đứt + vòng tâm cỡ theo `spread(pw)`, đỏ khi ra ngoài/quá lực); lực `pw` (CHARGE_T 0,85s = 100%, quá 1 thì `aimPoint()` bốc lên), thanh lực ngang `drawPower` chia vùng Nhẹ/Vừa/Căng/Quá; thả Đánh → pha `run` (tâm ẩn, vẫn đổi hướng được = động tác giả, máy có `BOT.feint`) → `shoot()` lúc chạm bóng; Nhảy giữ lúc thả = chip; thủ môn bấm Nhảy không hướng khi bóng đang bay = tự bay theo bóng; `judge()` xét xà/cột (`post`/`postin`), `keeperGeo()` (thân + găng, bay người `doDive` chỉ từ pha run), chạm găng mép với cú căng có thể `tip` vẫn vào. Máy điều khiển BÊN TRONG lớp (`planBot`/`botShooter`/`botKeeper` theo `BOT` + mức suy từ `api.bot.actDrop`), `botInput` trả {} nên weakenBot không ảnh hưởng. Đo máy: máy vs máy vào ~0,65–0,78; người sút góc chuẩn (lực ~90%) vs máy Khó ~86%, sút giữa ~40%; thủ môn người chỉ phản xạ 0,25–0,3s cản ~43%, đoán bừa một bên ~22%. App: mode có thể ghi đè `how`/`controls` ở intro (`md.how`, `md.controls`); `lengthInfo` thêm `kicks`.
- Đua Xe (10/11/2026, RAC3 + RAC9; sửa cùng ngày: bỏ kiểu lái Dễ, đường dài gấp ~1,8): bản đồ `WW×WH` = 2200×1240 lớn hơn màn hình, camera `this.cam {x,y,z}` (`updateCam`: khung bao các xe còn đua + lề 230, nhìn trước 0,35s theo vận tốc, z trong `[ZMIN, ZMAX]` với ZMIN = thấy cả bản đồ; thu nhỏ nhanh, phóng to chậm), vẽ thế giới trong `ctx.translate/scale` rồi chữ trên đầu xe + HUD theo toạ độ màn hình (`toScreen`); hiệu ứng dùng `this.fx` (Particles riêng, vẽ trong camera) thay cho `api.parts`; `posOf` trả toạ độ màn hình hoặc null khi ngoài khung. Đường đua là dữ liệu `TRACKS` (meadow ~5500 / desert ~5300 / snow ~6300 đơn vị) → `buildTrack(def)` (cache `BUILT`) trả `T = {S, NS, CUM, ANG, L, TW, oils, boxes, ramps, ice, hazards, sc}`; nền vẽ một lần `trackCanvas(T)` cỡ bản đồ (thứ tự: đường tắt → sông ngoài đường chính → đường chính → vực/suối cắt đường chính). Chỉ số đường = điểm điều khiển × 20. `variants` chọn đường (`random` giữ trong `api.randTrack`). Lái chỉ còn kiểu thật (`steer`: ← → × `STEER` theo tốc độ, ↑ ga, ↓ phanh/lùi, thả = trôi); máy: `botInput` cho hướng mục tiêu → `botDrive` đổi thành đánh lái/ga/phanh (phanh khi tốc > tốc an toàn theo độ gắt khúc cua 22 điểm phía trước). Vật lý: `vx/vy` + hướng `h`, tách dọc/ngang mỗi khung, ngang giảm theo `grip` (9, drift 4, băng 2, đường tắt `sc.grip`); tăng tốc ×2 gia tốc. Cầu nhảy `T.ramps` (đường chính `k` hoặc đường tắt `rampX`): `vz = v·LAUNCH`, `GRAV` 1400 → bay ≈ v²/700; trên không bỏ qua dầu/chuối/hộp, va chạm chỉ khi cùng độ cao. Vùng rơi `hazards` (poly tự cho, hoặc `main:[k0,k1]` tự dựng): chạm đất trong đó → `startFall` → `respawn` tại `respawnK`. Đường tắt `sc`: polyline mở, `from/to` chỉ số đường chính (si nội suy khi đang trên đường tắt để tính vòng), `surface` dirt/sand/ice, `cacti` (xe bật ra), `split` = điểm tách khỏi đường chính. Máy: `c.plan` quyết định đi đường tắt theo mức (sông cần còn tăng tốc, bấm từ 300 đơn vị trước cầu), lách xương rồng, né băng/dầu; `avoidHazard` cho Đấu bong bóng. Người đi ngược chiều có nhắc `wrongT`. Vũng dầu đã bỏ khỏi cả 3 đường theo yêu cầu (khó lách) — `oils: []`, code dầu vẫn giữ. Đo: máy Khó 3 vòng ~45–65s, Dễ ~80–110s; người lái phím ← → (không tăng tốc) ~58–66s, không rơi oan.
- Bản Windows không cần trình duyệt (12/11/2026): `desktop/` + `dist/TronParty-Windows.zip` (dist/ trong .gitignore). Electron tải game từ thư mục `game/` cạnh `TronParty.exe` (cập nhật = chép đè, không cần đóng gói lại); F11/F5/Ctrl+Q; autoplay âm thanh bật sẵn. Đã chạy thử bản Linux cùng phiên bản trong xvfb: vào menu và chơi Đua Xe bình thường. Lưu ý: đóng gói lại khi có thay đổi lớn theo `desktop/BUILD.md`. Lúc đóng gói phát hiện `army.js`, `snowball.js`, `sumo.js` trên máy chủ project là bản trước Đợt 3 (chép file hồi đó không ăn) — đã chép lại bản đúng.
- Hướng dẫn phím trong game (12/11/2026, chủ project góp ý "lần đầu chơi không biết nhấn nút nào"): `App.helpRows()` lấy `controls` (hoặc `controls` của mode) + `srcLabels` của từng người thật, chữ ←→↑↓ trong nhãn đổi thành phím thật của bộ phím đó. Đếm ngược → `drawHelpBig` (bảng "Phím của bạn"); `HELP_FLOAT_T` = 12 giây đầu ván → `drawHelpFloat` (nhãn dưới nhân vật theo `posOf`, tự né nhau); phím **H** (nếu không bị gán cho bộ phím nào) bật/tắt `drawHelpStrip` (dải ở mép dưới, mờ khi nhân vật ở gần, nhớ `tronparty.helpbar`); `drawHelpTag` dòng chữ nhỏ cuối màn hình; màn tạm dừng có bảng phím (`#pause-help`). Game có thể thêm `def.helpExtra` (vd. Cờ Vua: chuột). Các nhãn `controls` nên ngắn để vừa dải.
- Tay cầm (12/11/2026): lúc đang chơi chỉ nút Start mới tạm dừng (trước đây nút B — cũng là nút Nhảy — làm tạm dừng game); bàn phím vẫn Esc / P.
- Game cờ — Đợt 1 (12/11/2026, kế hoạch "Kế hoạch 3 game cờ"): tab menu `board` ♟️ Cờ. **Cờ Vua** (`chess.js`): 2 người, P1 Trắng/P2 Đen rồi đổi màu sau mỗi ván (`swapSides`, đổi trong `results()`); bàn lật khi đúng 1 người thật cầm Đen. Lõi `chess_engine.js`: bàn 0x88, nước = số nguyên (from|to<<7|promo<<14|cờ<<17), make/unmake + Zobrist (`hl/hh`), `status()` (chiếu hết, pat, 50 nước, lặp 3 lần, không đủ quân), `canMate()` cho hết giờ, `san()`; đã kiểm perft 5 thế chuẩn (thế đầu độ sâu 5 = 4.865.609). AI: negamax alpha-beta + PVS, bảng chuyển vị 2^20, quiescence MVV-LVA, nước sát thủ + history, nước rỗng, LMR; eval = bảng vị trí Simplified Eval chia trung/tàn cuộc + cặp Tượng + Tốt chồng/cô lập + dồn vua khi tàn cuộc hơn quân. Mức máy (`botOpt`): Dễ `multi` độ sâu 2 + nhiễu 70cp + 25% đi bừa trong 300cp; TB độ sâu 3 + nhiễu 25 + 8% trong 120cp; Khó tìm theo thời gian 1,5–2,5 giây (8 nửa nước đầu `multi` độ sâu 4 nhiễu 15 cho đa dạng khai cuộc); có đồng hồ thì giới hạn theo giờ còn lại. Đo máy vs máy: TB thắng Dễ 10/10, Khó (0,25s/nước) thắng TB 6/6. Máy nghĩ trong worker `BoardKit.ai('chess', ChessEngineFactory, AI_HANDLER, CE)` — worker tạo từ Blob chạy được với `file://` (đã thử Chromium); lỗi worker thì tự chạy trên luồng chính (≤0,7s). Smoke test đặt `BoardKit.sync = true` (vòng test đồng bộ không chờ được worker). Đồng hồ là `variants` (`BoardKit.TIME_CONTROLS`, bắt đầu chạy sau nước đầu); bộ quân + bàn cờ là `options`. Quân là SVG trong `assets/chess/<bộ>/` (wK.svg…), `BoardKit.img` vẽ sẵn ra canvas 160px; thiếu ảnh thì vẽ ký tự ♔. Chuột: bấm quân → bấm ô, hoặc kéo thả; bấm lại quân đang chọn để bỏ chọn. Phong cấp hiện cột 4 quân (phím hướng + Đánh, hoặc chuột).
- Game cờ — Đợt 2 (12/11/2026): **Cờ Tướng** (`xiangqi.js` + `xiangqi_engine.js`). Ô `sq = (hàng+2)*16 + (cột+3)` (hàng 0 = hàng cuối Đỏ), bảng `IN/PAL/HALF`, nước `from | to<<8`; `attacked()` tính cả lộ mặt tướng (Tướng địch là quân đầu tiên trên cùng cột) — **lưu ý chân Mã**: `HD`/`HL` phải khớp từng cặp (đã có lỗi -18/-14 đảo chân, perft sai từ độ sâu 3). Perft đã khớp 5 thế chuẩn (thế đầu: 44 / 1.920 / 79.666 / 3.290.240). Hết nước đi = thua (search trả −MATE cả khi không bị chiếu). Luật tầng game: `cycleInfo()` dùng `pos.firstRep()` + `hist[].check` — lặp lần 3 mà một bên chiếu ở mọi nước trong vòng → bên đó thua `perpetual`, không thì hòa; lặp lần 2 → cảnh báo `this.warn`; 120 nửa nước không ăn quân → hòa; `hasAttackers` cả hai bên hết → hòa. Máy tránh chiếu dài: `bannedMoves()` (nước chiếu làm lặp thế khi bên mình đang chiếu liên tục) truyền vào `think(o.ban)`. Ký hiệu Việt `note()` (cột đếm từ phải sang của bên đi, t/g/s khi cùng cột); sách khai cuộc `BOOK0` (+ bản đối xứng `mirrorNote`), `openingName()` hiện ở biên bản, `bookMove()` cho máy (Dễ 40%, còn lại 85% trong 8 nửa nước đầu). Eval: giá trị Xe 900, Pháo 470→410 (tàn cuộc), Mã 390→440, Sĩ/Tượng 200, Tốt 100 + PST (qua sông +70…), phạt thiếu Sĩ/Tượng khi đối phương còn Xe/Pháo. Quân vẽ Canvas (đĩa gỗ, cache `pieceCanvas`): `script` = han (帥仕相車馬炮兵 / 將士象車馬砲卒, font KaiTi → Noto Serif CJK) / viet / icon (emoji trên đĩa tô màu theo bên); bàn `boardCanvas` (wood/paper/jade, sông 楚河 漢界 hoặc SỞ HÀ HÁN GIỚI, số cột hai mép — bàn đối xứng nên lật bàn không xoay ảnh). Đo máy vs máy (node): TB thắng Dễ 8/8, Khó (0,3s/nước) thắng TB 6/6; máy cùng mức trong trình duyệt: không còn thua vì chiếu dài.
- Ý tưởng lớn hơn: điện thoại làm tay cầm qua WebSocket (cần server Node chạy trong LAN) — hiện chưa làm vì chủ project chọn chơi chung bàn phím/gamepad.
