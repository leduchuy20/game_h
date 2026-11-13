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

## Thư viện

| File | Nội dung | Tác giả | Giấy phép |
| --- | --- | --- | --- |
| `js/lib/three.min.js` | Three.js r159 (bản `<script>` thường, dùng cho Cờ Cá Ngựa 3D và bàn 3D Cờ Tỷ Phú) | Three.js Authors | MIT — xem `js/lib/three.LICENSE.txt` |
