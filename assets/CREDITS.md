# Nguồn hình ảnh

Mọi ảnh trong `assets/` là file local (chạy được bằng `file://` và trong bản .exe, không tải từ mạng lúc chơi). Dự án chỉ dùng chơi với bạn bè, không thương mại.

| Thư mục | Nội dung | Tác giả | Giấy phép | Lấy từ |
|---|---|---|---|---|
| `chess/cburnett/` | Bộ quân cờ vua "Cổ điển" (12 SVG) | Colin M.L. Burnett | GPLv2+ | lichess-org/lila `public/piece/cburnett` |
| `chess/merida/` | Bộ quân cờ vua "Merida" (12 SVG) | Armando Hernandez Marroquin | GPLv2+ | lichess-org/lila `public/piece/merida` |
| `chess/maestro/` | Bộ quân cờ vua "Maestro" (12 SVG) | sadsnake1 | CC BY-NC-SA 4.0 (không thương mại) | lichess-org/lila `public/piece/maestro` |
| `monopoly/city_*.svg`, `monopoly/icon_*.svg` | Tranh 22 thành phố + 11 biểu tượng ô của Cờ Tỷ Phú | Tự vẽ cho dự án (13/11/2026) | Dùng tự do trong dự án | — |
| `monopoly/art.js` | Toàn bộ tranh trong `monopoly/` gói dạng data URI (sinh bằng `node tools/pack-art.js`) để làm texture 3D khi mở bằng `file://` | Như các file gốc | Như các file gốc | — |
| `monopoly/globe.svg` | Quả địa cầu giữa bàn Cờ Tỷ Phú | Đường bờ biển từ Natural Earth (qua gói npm `world-atlas` 2.0.2) | Public domain (Natural Earth); world-atlas ISC | naturalearthdata.com |

Giấy phép từng bộ quân lấy theo bảng trong `COPYING.md` của lichess-org/lila (12/11/2026).

Khi thiếu file ảnh, game tự vẽ quân bằng ký tự (♔♕♖♗♘♙) để vẫn chơi được; Cờ Tỷ Phú thiếu tranh thì quay về emoji.

## Ảnh thẻ game

`assets/thumbs/*.webp` — ảnh chụp màn hình của chính Tròn Party (tự tạo bằng `tools/make-thumbs.js`), không dùng ảnh ngoài.

## Kho từ tiếng Anh (Gõ Chữ Tiếng Anh)

`js/games/typing_words.js` tự sinh bằng `tools/pack-words.js` từ hai bộ dữ liệu của Open Language Profiles (file gốc + điều khoản trong `tools/words-src/`):

- **CEFR-J Vocabulary Profile 1.5** (mức A1–B2) — The CEFR-J Wordlist Version 1.5, compiled by Yukio Tono, Tokyo University of Foreign Studies (Tono Laboratory, TUFS) — http://www.cefr-j.org/download.html. Được dùng miễn phí cho nghiên cứu và thương mại khi ghi nguồn.
- **Octanove Vocabulary Profile C1/C2 1.0** (mức C1–C2) — Octanove Labs (http://www.octanove.com/), giấy phép Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0).

Nghĩa tiếng Việt (`tools/words-vi/*.txt`) và 180 câu ví dụ kèm bản dịch (`tools/words-vi/sentences.txt`, `window.TYPING_SENTS`) do Tròn Party tự soạn. Vì có dữ liệu Octanove nên `typing_words.js` (gồm cả phần nghĩa) phát hành theo **CC BY-SA 4.0**.

## Thư viện

| File | Nội dung | Tác giả | Giấy phép |
| --- | --- | --- | --- |
| `js/lib/peerjs.min.js` | PeerJS 1.5.4 (WebRTC + tìm phòng qua máy chủ PeerJS miễn phí, dùng cho Chơi qua mạng) | Michelle Bu, Eric Zhang và cộng sự | MIT — xem `js/lib/peerjs.LICENSE.txt` |
| `fonts/` | Font Baloo 2 (Tròn Party), Lexend + Be Vietnam Pro (Phòng tập não bộ) — bản woff2 của Fontsource 5, chỉ bộ chữ latin, latin-ext, vietnamese; tạo bằng `tools/pack-fonts.js` | The Baloo 2 Project Authors (Ek Type), The Lexend Project Authors, The Be Vietnam Pro Project Authors | SIL Open Font License 1.1 — xem `fonts/<font>/LICENSE` |
| `js/lib/three.min.js` | Three.js r159 (bản `<script>` thường, dùng cho Cờ Cá Ngựa 3D và bàn 3D Cờ Tỷ Phú) | Three.js Authors | MIT — xem `js/lib/three.LICENSE.txt` |
