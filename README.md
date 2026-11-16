# Tròn Party 🎉

Bộ mini-game cho **2–4 người chơi chung một máy** (bàn phím và/hoặc tay cầm), lấy cảm hứng từ lối chơi của các game party. Không cần cài đặt, không cần server.

## Cách chạy

1. Mở file `index.html` bằng Chrome hoặc Edge (nhấp đúp là được).
2. Bấm **⛶ Toàn màn hình**, cắm laptop ra TV nếu muốn.
3. Sảnh là nơi **người thật** vào chơi (4 ô P1–P4, cần ít nhất 1 người):
   - **Thêm người:** bấm **🙋 Người chơi** ở ô trống rồi chọn bộ phím (hoặc bấm A trên tay cầm) — hay nhanh hơn: nhấn **nút Đánh** trong bộ phím của bạn là vào ngay.
   - **Đổi tên:** bấm vào tên (✏️), gõ tối đa 8 ký tự, Enter để lưu. **Đổi màu:** bấm vào hình Tròn. Tên và màu được nhớ theo từng ô cho lần sau.
   - **Xoá:** bấm **✕** ở góc ô, hoặc người đó giữ **nút Nhảy 1 giây** (chạm nhẹ không sao — để còn thử phím).

4. Chọn game → ở **màn giới thiệu** của game chỉnh đội hình cho ván đó (cột **Ai chơi · mức máy**):
   - **🤖 + Thêm máy** để thêm máy (tối đa theo số người của game); mỗi máy có nút **Dễ / TB / Khó** riêng, **✕** để bỏ máy.
   - Người thật bấm **💤** để nghỉ ván này (nếu đang ở số người tối thiểu thì một máy vào thay); người đang nghỉ bấm **▶ … vào chơi** (hết chỗ thì thay một máy).
   - Mặc định: mọi người thật trong sảnh (thừa so với số người của game thì người sau nghỉ) + máy Trung bình cho đủ số người tối thiểu. Mỗi lần chọn game là về mặc định; **↻ Chơi lại** thì giữ nguyên đội hình.

5. **Không nhớ phím?** Lúc đếm ngược có bảng **🎮 Phím của bạn** cho từng người; 12 giây đầu ván mỗi nhân vật có nhãn phím ngay bên dưới (chữ mũi tên trong luật được đổi thành phím thật của bạn, vd "A D lái"). Bấm **H** để bật/tắt bảng phím ở mép dưới màn hình suốt ván, hoặc **Esc** để tạm dừng — màn tạm dừng cũng liệt kê phím từng người.

> Nhớ **tắt Unikey/EVKey** (chuyển sang chế độ E) trước khi chơi để phím không bị nuốt.

## Chơi không cần trình duyệt (Windows)

Có bản ứng dụng riêng `dist/TronParty-Windows.zip` (Electron, ~145 MB): giải nén → bấm đúp `TronParty.exe`. Không cần cài đặt, không cần mạng, chép cả thư mục `TronParty` sang máy khác là chơi được. F11 = toàn màn hình, F5 = tải lại, Ctrl+Q = thoát. Game nằm trong `TronParty/game/` — có bản mới thì chép đè `index.html`, `css`, `js`, `assets`, `fonts`, `naobo` vào đó (hoặc chạy `cap-nhat-game.bat` nếu thư mục nằm trong `game_party/dist`). Cách đóng gói lại: xem `desktop/BUILD.md`.

**Phòng tập não bộ** (app luyện não 1 người, file gốc chép nguyên vào `naobo/phong-tap-nao-bo.html`): bấm **🧠 Phòng tập não bộ** ở màn đầu. Bản .exe có thêm nút **← Tròn Party** để quay về, mở thẳng bằng `TronParty.exe --naobo` (chuột phải biểu tượng trên thanh tác vụ, hoặc lối tắt do `tao-loi-tat.bat` tạo). Font chữ của cả hai nằm sẵn trong `fonts/`, không cần mạng.

## Chơi qua mạng (máy khác vào chơi cùng)

> **Đang tạm ẩn** — nút 🌐 Chơi qua mạng chưa hiện trong sảnh. Phần dưới để dành cho lúc bật lại.

Bạn bè ở máy khác — laptop, điện thoại, máy tính bảng, cùng mạng nhà hay ở xa — vào chơi cùng mà không cần cài gì:

1. Máy chủ (máy mở `index.html` hoặc bản .exe): vào **sảnh → 🌐 Chơi qua mạng → Tạo phòng**, đọc **mã phòng 4 số** cho bạn.
2. Máy khác mở file **`online.html`** (cùng thư mục game — chép thư mục sang, hoặc mở bản đưa lên web), nhập tên + mã phòng → **Vào phòng**. Người đó hiện trong sảnh như một người chơi (🌐 Máy khác).
3. Máy khác thấy đúng màn hình game của máy chủ (cả game 3D) và nghe tiếng (bấm 🔇 Bật tiếng). Phím: **WASD / mũi tên** di chuyển, **Space** = Đánh, **K** = Nhảy; tay cầm cắm vào máy khác cũng được; điện thoại có cần điều khiển + 2 nút cảm ứng; bấm chuột / chạm lên hình cũng được (Cờ Tỷ Phú, Caro…).

Lưu ý: cần **Internet lúc vào phòng** (hai máy tìm nhau qua máy chủ PeerJS miễn phí); sau đó hình và phím đi thẳng giữa hai máy. Chủ phòng điều khiển menu, người ở máy khác thấy màn chờ cho tới lúc vào chơi. Tối đa 4 người tính cả máy chủ. Rớt mạng giữa ván thì mở lại `online.html` trên cùng máy, vào lại đúng mã là về chỗ cũ. Game bài (sau này) mọi máy đang thấy cùng một màn hình — phần che bài riêng cho từng máy sẽ làm cùng game bài.

## Độ khó của máy

Chọn ở màn giới thiệu của từng game, **mỗi máy một mức**: 🟢 **Dễ**, 🟡 **TB** (Trung bình), 🔴 **Khó** — ví dụ Sumo có thể 1 máy Dễ + 1 máy Khó. Không nhớ giữa các game (mặc định Trung bình).

| | Dễ | Trung bình | Khó |
|---|---|---|---|
| Phản xạ (máy nghĩ lại hướng đi sau) | ~0,4 giây | ~0,2 giây | tức thì |
| Tốc độ chạy | 70% | 85% | 100% |
| Hồi chiêu thêm sau mỗi lần húc/lao/đặt bom/sút | +1,6 giây | +0,8 giây | 0 |
| Tỉ lệ bỏ lỡ chiêu | 55% | 30% | 0% |
| Thỉnh thoảng đi lạc | hay | ít | không |
| Tốc độ bấm Kéo Co | 3,8–5,2 lần/giây | 5,2–6,8 | 6,5–8,6 |

Muốn chỉnh thêm thì sửa bảng `BOT_LEVELS` ở đầu file `js/engine.js`.

## Tua nhanh

Nút **🐢 Tốc độ thường / ⚡ Tua nhanh ×1,3** ở sảnh: bật lên thì mọi game chạy nhanh hơn 30% (cả nhân vật lẫn đồng hồ).

## Độ dài ván

Trong sảnh, bấm nút **Ván: …** để đổi ⚡ **Ngắn** → ⏱ **Vừa** → 🐢 **Dài** (game tự nhớ lựa chọn). Màn giới thiệu mỗi game ghi rõ "Ván này: …".

| | Ngắn | Vừa | Dài |
|---|---|---|---|
| Game tính giờ | 30 giây | 60 giây | 90 giây (tỉ lệ ×0,5 / ×1 / ×1,5) |
| Game theo hiệp (Sumo, Vệt Sáng, Võ Đài, Lăn Tuyết, Kéo Co) | thắng 1 hiệp | thắng 2 / 3 hiệp | thắng 3 / 5 hiệp |
| Đua Xe · Đố Toán / Đoán Màu · Xếp Hộp · Đấu Kiếm | 2 vòng · 7 câu · 6 hộp · 3 điểm | 3 · 12 · 10 · 5 | 5 · 18 · 13 · 8 |
| Bóng Chày · Pha Trà Sữa · Thuyền Chèo | 6 cú ném · 3 đơn · đường ngắn | 10 · 5 · vừa | 15 · 8 · dài |

Các game loại dần người chơi (Truyền Bom, Chim Bay, Né Laser, Gạch Sập, Nhớ Chuỗi, Cầu Kính...) vẫn kết thúc khi chỉ còn 1 người, độ dài chỉ đổi giới hạn thời gian tối đa.

## Biểu cảm & rung tay cầm

- Lúc đếm ngược và lúc vừa hết ván: bấm **Đánh** hoặc **Nhảy** để nhân vật bắn biểu cảm chọc bạn bè (😂😎🔥💪 / 😡💀😱🙈).
- Chơi bằng tay cầm (Chrome/Edge): tay cầm rung nhẹ khi màn hình rung, rung mạnh khi chính bạn bị trúng đòn hoặc mất mạng.

## Phím điều khiển

| Người | Di chuyển | Nút Đánh | Nút Nhảy |
|---|---|---|---|
| Phím trái | W A S D | Q | E |
| Phím giữa | I J K L | U | O |
| Mũi tên | ↑ ← ↓ → | `.` | `/` |
| Phím số | 8 4 5 6 (numpad) | 7 | 9 |
| Tay cầm | Cần trái / D-pad | A | B |

- **Esc** hoặc **P**: tạm dừng · **Enter**: bấm nút đang chọn trên menu.
- Bàn phím rẻ tiền có thể không nhận nhiều phím cùng lúc (key ghosting). Nếu chơi 3–4 người, nên cắm thêm tay cầm USB/Bluetooth.
- **Thử phím**: trong sảnh, dưới mỗi người đã vào có 6 ô ↑ ↓ ← → Đánh Nhảy sáng lên khi phím đang được nhận; dòng dưới liệt kê mọi phím bàn phím đang giữ. Cả nhóm cùng giữ phím — ô nào không sáng là bàn phím bị kẹt.
- **Đổi phím**: nút **⌨️ Đổi phím** ở sảnh → chọn ô rồi nhấn phím mới (Esc huỷ, phím trùng thì tự đổi chỗ). Game nhớ bộ phím (localStorage), có nút **Khôi phục mặc định**. Enter, Esc, Space, Tab, P dành cho menu nên không gán được.

## Các game

| Game | Lối chơi |
|---|---|
| 🤼 **Đấu Sumo** | Giữ Đánh tích lực rồi thả để húc văng đối thủ khỏi sàn (sàn vỡ dần từ ngoài vào). Có thanh %, dậm đất, đứng tấn, thoát hiểm ở mép, 3 kiểu võ sĩ, 6 sàn đấu (có sàn bập bênh), chướng ngại, vật phẩm, phụ kiện trang trí và 5 chế độ (xem dưới). |
| 💣 **Đặt Bom** | Kiểu Bomberman: phá hộp, nhặt 💣🔥👟 và 👢 đá bom, 🧤 ném bom (đứng trên bom bấm Đánh), 📡 bom hẹn giờ (Nhảy để nổ). Bom bay tới thì bấm Nhảy đúng lúc để đánh bật. 3 tim; 3–4 người thì ai bị loại thành 👻 ma ném bom từ tường. Cuối trận tường khép lại. |
| 🎨 **Tô Màu** | Chạy tô màu sàn, nhặt 🎨 để tô cả vùng. Chạy trên màu mình nhanh hơn, lội qua màu đối thủ chậm lại (🐌). Tô đủ thì Nhảy ném bom sơn; đứng một mình cạnh trụ giữa sân để trụ phun sơn chữ thập. Chế độ Mỗi người một màu / Đồng đội. |
| ⚡ **Vệt Sáng** | Kiểu Tron: rẽ 90°, đừng đâm tường hay vệt sáng. Chạy sát vệt được tăng tốc, nút Nhảy bay qua vệt (hồi 6 giây). Sau 25 giây tường khép dần. Chế độ Có tường / Xuyên mép. |
| 👑 **Giữ Vương Miện** | Đội vương miện càng lâu càng nhiều điểm, húc để cướp. Đội lâu thì vương miện nặng, đi chậm dần. Cuối trận ×2. |
| 🧱 **Gạch Sập** | Né ô nháy đỏ sắp sập, nhảy qua hố, đấm choáng đối thủ; đang nhảy bấm Đánh = dậm đất làm 4 ô quanh đó sắp sập. Chế độ Sập theo đợt / Bước chân (ô bị giẫm sẽ sập). 3 tim. |
| ⚽ **Bóng Đá** | Chia 2 đội: chạm Đánh = chuyền, giữ Đánh = sút căng. Hai người cùng đội sút cùng lúc → bóng lửa. Chế độ **Bóng đá thật** (mặc định): Nhảy = xoạc bóng — xoạc trúng bóng là cướp, xoạc trúng người từ phía sau là phạm lỗi → đá phạt (trong vòng cấm là phạt đền); đội chỉ có 1 người thì có thủ môn tự động (TM); hết giờ hòa thì đá luân lưu 3 lượt rồi đá chết. Đá phạt/phạt đền: hướng = chọn góc, giữ Đánh lấy lực rồi thả (giữ quá lâu dễ vọt xà); thủ môn bấm Nhảy + hướng để bay người. Chế độ **Vui nhộn**: Nhảy = húc cướp bóng, không phạm lỗi, cuối trận bàn ×2, hòa thì bàn thắng vàng. Chế độ **Luân lưu**: chỉ đá luân lưu, nhìn từ sau lưng người sút — bốc thăm đội đá trước, mỗi đội 5 lượt xen kẽ (ván ngắn 3, dài 8), không thể gỡ thì thua sớm, hòa thì đá chết; mọi người lần lượt sút và bắt. Người sút dùng phím hướng di chuyển tâm ngắm (có mũi tên từ bóng tới tâm), giữ Đánh lấy lực rồi thả — thanh lực chia Nhẹ/Vừa/Căng/Quá, càng căng bóng càng nhanh nhưng vòng tâm càng to, quá 100% thì tâm bốc lên xà; giữ thêm Nhảy = Panenka; lúc chạy đà tâm bị ẩn và vẫn đổi hướng được. Thủ môn ←→ đứng chặn; bóng bay rồi chỉ cần bấm Nhảy là bay theo bóng, cú căng vào góc thì phải đoán trước (Nhảy + hướng lúc đối thủ chạy đà). Trận Bóng đá thật hòa cũng đá luân lưu kiểu này (3 lượt). |
| 🪢 **Kéo Co** | Chia 2 đội, bấm nút Đánh liên tục để kéo nút thắt về phía mình. Thắng 2 hiệp. |
| 🏎️ **Đua Xe** | Lái như xe thật: ← → đánh lái, ↑ ga, ↓ phanh/lùi (máy cũng lái y vậy). 3 đường đua dài, bản đồ lớn hơn màn hình — camera tự đi theo và thu phóng để luôn thấy đủ các xe. Chọn đường ở màn giới thiệu (hoặc 🎲 ngẫu nhiên): 🌳 **Đồng Cỏ** (khúc chữ U sâu, đường tắt đất băng qua sông — phải tăng tốc lên cầu nhảy mới bay qua), 🌵 **Sa Mạc** (2 vực cắt ngang đường, đường tắt cát có xương rồng), ❄️ **Núi Tuyết** (đèo ngoằn ngoèo, mảng băng trơn, suối băng phải nhảy qua, đường tắt cắt ngang hồ băng). Đánh = tăng tốc; hộp ? cho 🍌🚀🛡️ (chạm Nhảy để dùng), giữ Nhảy khi ôm cua để drift rồi nhả ra tăng tốc. Rơi xuống sông/vực thì hồi lại phía sau. Chế độ **Đấu bong bóng**: mỗi xe 3 🎈, bắn tên lửa / thả chuối / tăng tốc húc thẳng vào xe khác để làm nổ — hết bóng bị loại. |
| 🐟 **Cá Lớn Nuốt Cá Bé** | Nuốt cá nhỏ hơn để lớn, né cá to hơn và cá mập. Cá càng to càng tự sụt cân dần. Hết giờ, nặng nhất thắng. |
| 🐔 **Bắt Gà** | Ôm gà về chuồng mình, vào chuồng người khác để trộm, húc người đang ôm gà để làm rơi. |
| 🪖 **Xe Tăng** | Chạy & xoay nòng, đạn bắn ra lúc nhả nút Đánh và nảy 1 lần khi chạm tường (coi chừng tự bắn mình). Hạ nhiều nhất thắng. Chế độ **Cướp cờ** (2–2): lấy cờ đội bạn mang về căn cứ mình, hạ người cầm cờ thì cờ rơi, chạm cờ nhà đang rơi để trả về; cướp 3 cờ thắng. |
| 🧨 **Truyền Bom** | Chạm người khác để chuyền bom, nhảy lên thì không bị chuyền. Không biết bom còn bao lâu — chỉ nghe tích tắc nhanh dần. Ai ôm bom lúc nổ bị loại. |
| 🚦 **Đèn Xanh Đèn Đỏ** | Đèn xanh thì chạy, đèn đỏ đứng im. Nhúc nhích hay vung tay lúc đèn đỏ là bị kéo về vạch. |
| 🔴 **Né Laser** | Tia laser quét sát sàn (nét đứt = sắp bật), nhảy đúng lúc để né. Cuối trận sàn thu nhỏ dần. 3 tim. |
| 🥊 **Võ Đài** | Đấm đối thủ hết máu (K.O.): chạm Đánh = đấm nhanh, giữ Đánh = đòn mạnh. Nhảy = né lướt; bấm đúng lúc trước cú đấm = đỡ hoàn hảo làm đối thủ choáng. |
| 🤺 **Đấu Kiếm** | Kiếm chỉ theo hướng đi, Đánh = đâm, Nhảy = giơ khiên đỡ (đỡ được thì đối thủ choáng). Đỡ ngay lúc vừa giơ khiên hoặc hai mũi kiếm chạm nhau → kiếm văng, phải chạy đi nhặt (tay không chỉ đẩy được). 5 điểm thắng. Chế độ **Tiến quân** (đội): mỗi lần hạ địch cả trận tiến một màn về phía đối thủ, tới màn cuối là thắng. |
| 🕵️ **Ai Là Người Thật?** | Mỗi lượt 1 người làm Thợ Săn, còn lại trốn lẫn trong đám đông giống hệt nhau, ra ★ giữ nút Đánh để kiếm điểm. |
| 🧮 **Đố Toán** | Tính nhanh rồi chạy tới đứng dưới cửa có đáp án đúng; vào cửa đúng sớm nhất +1. Đánh = húc người khác. Nửa sau trận cửa đúng chỉ có 2 chỗ (câu cuối 1 chỗ). Mỗi người 5 tim. |
| 🌈 **Đoán Màu** | Chạy tới cửa ghi đúng tên MÀU NỀN — chữ trên bảng là để lừa bạn! |
| 🐤 **Chim Bay** | Bấm Nhảy (hoặc Đánh) để vỗ cánh, trái/phải để tiến lùi, lách qua khe ống. Chạm ống/đất mất 1 tim. |
| 🌉 **Cầu Kính** | Mỗi hàng 2 tấm kính, 1 giả. Nhảy = tấm trên, Đánh = tấm dưới. Rơi là về đầu cầu. |
| 👥 **Đội Quân** | Chạm người xám để họ theo mình, chạm quân người khác để cướp (lao tới thì cướp cả đoạn). Có từ 10 quân thì bấm Nhảy để hoá 🦣 khổng lồ 5 giây: húc người khác rơi nửa đội quân, không ai cướp được của mình. |
| 📦 **Xếp Hộp** | Bấm Đánh để thả hộp đang chạy qua lại; phải đè lên hộp dưới ít nhất một nửa. 10 hộp trước thắng. Chế độ **Tháp lắc**: hộp chạm là đứng nhưng xếp lệch thì tháp nghiêng (vạch trọng tâm đỏ = sắp đổ), trọng tâm lệch ra ngoài là phần trên đổ sập — xếp bù sang bên kia. |
| ✈️ **Máy Bay Bắn Địch** | Máy bay tự bắn, chỉ cần lái. Hạ địch, giữa trận có Tàu Bay Trùm. Trúng đạn bị tê liệt & mất điểm. |
| 🧠 **Nhớ Chuỗi** | Xem chuỗi nút (↑↓←→ ● ▲) rồi bấm lại đúng thứ tự. Mỗi vòng dài thêm 1 nút, sai là loại. |
| ⛄ **Lăn Tuyết** | Lăn để quả cầu tuyết to dần (to hơn = nặng hơn, húc mạnh hơn), húc người khác rơi khỏi sàn. Cùng bộ tính năng với Đấu Sumo, sàn riêng (hồ băng, bão tuyết...). |
| 🤸 **Nhảy Dây** | Bấm Nhảy đúng lúc dây sắp chạm đất. Dây quay nhanh dần, sau 30 giây có 2 dây. 3 tim. |
| 💰 **Chuyển Tiền** | Băng qua 6 làn xe lên kho lấy 💰, mang về ngân hàng (+$100). Bị xe đụng là rơi tiền. |
| 👹 **Đánh Trùm** *(co-op)* | Cả nhóm cùng đặt bom hạ Trùm, né cú lao húc, nhảy qua sóng xung kích, chạm bong bóng để cứu đồng đội. Chơi 2–3 người thì Trùm chậm hơn và người bị nhốt tự thoát sau vài giây (bấm Đánh để thoát nhanh). Chọn Trùm ở màn giới thiệu: 🟣 Tím (gốc) · 🔥 Lửa (vệt lửa + vòng cầu lửa, nhảy qua được) · ❄️ Băng (sàn trơn, mưa băng rơi vào vòng đánh dấu) · 🦅 Bay (bay nên bom không trúng; đáp xuống chỗ bóng đen rồi mệt vài giây — đặt bom lúc đó) · Ngẫu nhiên. |
| 🔦 **Trốn Đèn** | Đèn rọi quét phòng tối; đứng trong vùng sáng quá lâu là mất 1 tim. Đèn viền đỏ bám theo người. Chế độ **Người cầm đèn**: mỗi lượt một người điều khiển đèn (Đánh = loé sáng), còn lại trốn — trong tối gần như vô hình, chạy nhanh thì để lại bụi, giữ Nhảy để đi rón rén. Bắt được +2, trốn hết lượt +3; ai cũng được cầm đèn một lần. |
| 🧋 **Pha Trà Sữa** | Đơn hiện vài giây rồi ẩn — nhớ đơn, lấy đúng topping (Đánh ở trạm), giao ở quầy. Giao đúng +2, cộng tip theo thời gian còn lại, giao đầu tiên +1; trễ đơn −1. |
| 🚣 **Thuyền Chèo** | Đội 2 người: mỗi người 1 mái chèo, chèo cùng lúc thì lao vọt, 1 bên thì rẽ. Đội 1 người: Đánh/Nhảy = 2 mái. Né đá. |
| ⚾ **Bóng Chày** | Bấm Đánh đúng lúc bóng chạm vạch trắng (Home run +3). Có bóng chậm, bóng đổi tốc và bóng bom (đánh trúng −2). Chế độ **Người ném**: đổi vai mỗi cú ném — người ném chọn loại bóng (↑↓) và đường ném (←→: Thẳng / Khựng / Tăng tốc), bóng ngụy trang tới giữa đường mới lộ là bom. Người đánh trượt thì người ném +1, đánh trúng bom thì người ném +2. |
| 🤝 **Chia Hay Cướp** | Đứng trên rương giữ Đánh để mở một mình (ít tiền). Hai người cùng chạm một rương → vài giây bí mật chọn: Đánh = 🤝 Chia, Nhảy = 🗡️ Cướp (đổi ý thoải mái, chỉ tính lần bấm cuối, màn hình không lộ). Cùng chia +50 mỗi người · một người cướp +100 · cùng cướp −30 cả hai. Rương vàng ×2. Ngoài lúc đấu trí, Nhảy = lao húc người đang mở rương. |
| 🔢 **Đếm Tròn** | Một đoàn Tròn đủ màu, đội vương miện / mũ / đeo kính chạy qua, rồi mới hỏi (vd "bao nhiêu Tròn ĐỎ đội VƯƠNG MIỆN?"). Đánh +1, Nhảy −1, bấm Xuống để chốt. Gần đúng nhất +2, đúng tuyệt đối +1, chốt đúng sớm nhất +1. |
| ⛏️ **Đào Kho Báu** | Vòng radar dưới chân nháy càng nhanh, càng đỏ khi gần rương chôn. Giữ Đánh để đào ô đang đứng; trúng rương thì giữ Đánh thêm để mở. Ô có vết nứt có thể có mìn — đào trúng hoặc bị húc văng vào là nổ, mất tiền. Nhảy = lao húc để cướp rương. |
| 🪃 **Vua Boomerang** | Giữ Đánh lấy đà, thả ra ném boomerang — lượn rồi tự bay về tay; vướng tường thì rơi, phải chạy nhặt. Nhảy = lướt chém gần. Nấp trong bụi cỏ gần như vô hình. Còn người cuối cùng (hoặc nhiều tim nhất) thắng. |
| 🪢 **Dây Thun** | 2 đội trên cây cầu nổi, đồng đội nối nhau bằng dây thun. Kéo căng dây quét ngang gạt đội kia rơi xuống nước (+1 điểm). Chạm Nhảy = nhảy qua khúc gỗ / qua dây, giữ Nhảy = mỏ neo (giữ được đồng đội đang rơi). Đánh = lao húc. Đội 1 người không có dây nhưng nặng hơn. |
| 💥 **Đại Bác Công Thành** | Hai thành hai bên sông. Giữ Đánh để tăng tầm (vòng ngắm chạy sang bờ kia), thả ra để bắn. Tường gạch chặn đạn ở hàng đó — phá thủng rồi mới bắn trúng người phía sau. Vòng đỏ = chỗ đạn sắp rơi, Nhảy (kèm hướng) để lướt né. Theo hiệp; 3–4 người chia đội. |
| ⌨️ **Bấm Nhanh Ký Tự** | Mỗi người một băng chuyền "từ" gồm 3–5 ký hiệu (↑ ↓ ← → ● = Đánh, ▲ = Nhảy). Gõ đúng hết một từ thì chạy lên một bậc; bấm sai bị khựng, gõ lại từ đầu. Từ viền ⚡ bắn sét đẩy người dẫn đầu lùi một bậc. Về đích trước thắng. |
| ✏️ **Vẽ Theo Khuôn** | Hình mẫu hiện vài giây rồi ẩn; vẽ lại trên bảng của mình: giữ Đánh để tô, giữ Nhảy để tẩy. Chấm % khớp (tô thừa cũng bị trừ), cộng qua các hình. |
| 🚚 **Chuyển Đồ Điên Loạn** *(co-op)* | Cả nhóm chuyển đồ trong nhà lên xe tải bên kia sông. Giữ Đánh để khiêng, chạm Nhảy để quăng. Đồ lớn 👥 cần 2 người cùng giữ Đánh (một mình chỉ kéo lê), hai người cùng bấm Nhảy để quăng qua sông. Quăng hụt rơi xuống sông là mất! |
| 🐱 **Cat and Dog** *(2 người)* | Mèo (trái) và Chó (phải) thay phiên ném đồ qua hàng rào cao. Giữ Đánh cho thanh lực dâng (giữ quá đỉnh thì tụt lại), thả ra để ném — vạch trắng trên thanh là lực lần trước. Trước khi giữ lực, ↑ ↓ canh góc ném 40°–75° (chạm = 1°, giữ = chạy nhanh; mũi tên ngắm + số độ, góc nhớ qua các lượt; góc thấp dễ vướng rào, góc cao bay lâu hơn và dễ lệch theo gió). Gió đổi mỗi lượt (cờ trên rào + mũi tên). Trúng đầu −25, trúng người −15, rơi sát bên −5; mỗi lượt 10 giây. Mỗi hiệp mỗi bên có 4 vật phẩm dùng một lần (← → chọn, Nhảy dùng, hoặc bấm chuột): ✌️ Ném đôi, 💪 Ném mạnh (×1,5), 🩹 Hồi máu +25 (mất lượt), 🍃 Lặng gió. Chuột: giữ rồi thả để ném. Hết máu là thua hiệp. Chơi một mình thì đấu máy 3 mức. **Chế độ**: 🎯 Cổ điển (đứng yên) / 🏃 Né tránh (khi bị ném được chạy ← → trong sân mình; đồ qua đỉnh thì hiện bóng đổ chỗ sắp rơi; ném xong tự về chỗ cũ; mỗi bên 80 máu). **Bản đồ**: 🏡 Sân sau (hàng rào), 🏖️ Bãi biển (lưới bóng chuyền, gió mạnh hơn), 🌙 Mái nhà ban đêm (ống khói cao, khói bay theo gió), 🎲 Ngẫu nhiên (mỗi hiệp một bản đồ). Tuỳ chọn **Góc ném**: 📐 Tự canh góc (mặc định) / 📌 Cố định 55° như bản gốc. Tuỳ chọn **Gợi ý đường bay** cho người mới: lúc giữ lực hiện một đoạn đầu đường bay. |
| ⌨️ **Gõ Chữ Tiếng Anh** *(1 người)* | Luyện gõ 10 ngón và học từ vựng tiếng Anh: Kiểm Tra Tốc Độ, Luyện Ngón, Thẻ Từ, Bắn Thiên Thạch, Đua Xe Gõ Chữ, Tiến Độ (xem mục riêng bên dưới). |
| 🧩 **Jigsaw Puzzle** *(1 người)* | Ghép tranh răng cưa: kéo mảnh vào khung, mảnh đúng tự hút dính, nhóm đúng chỗ thì khoá lại. Chế độ Thư giãn (tự lưu ván để chơi tiếp), Thi giờ (kỷ lục riêng từng tranh × số mảnh) và Bức mỗi ngày (giữ chuỗi ngày). Ghép được cả ảnh của bạn. Xem mục riêng bên dưới. |
| 🔢 **2048** *(1 người)* | Trượt bàn, hai ô cùng số chạm nhau thì gộp thành ô gấp đôi — lên tới ô 2048. Ô số nổi khối, càng lớn càng rực (phát sáng, lấp lánh, vương miện, ô thiên hà chữ cầu vồng), bàn 3×3 đến 6×6, tự lưu ván dở + kỷ lục từng cỡ bàn. Chế độ Thử thách (12 màn có ô đá / giới hạn nước, chấm sao), Ván mỗi ngày (giữ chuỗi ngày) và nút Gợi ý nước đi. Xem mục riêng bên dưới. |

**Đấu Sumo & Lăn Tuyết — điều khiển và chế độ**

- **Giữ Đánh**: tích lực (vòng vàng quanh nhân vật) → **thả** để húc. Tích càng lâu húc càng xa, nhưng lúc tích đi chậm.
- **Chạm Nhảy**: dậm đất, đẩy mọi người xung quanh (hồi 5 giây). **Giữ Nhảy**: đứng tấn — đứng yên, bị đẩy ít hơn, tốn sức (vòng xanh).
- Bị đẩy ra mép mà không quá mạnh → nhân vật **chới với** (dấu "!") khoảng nửa giây: bấm **Nhảy** để bật về sàn.
- **Thanh %** trên đầu: bị húc càng nhiều càng dễ văng xa; đứng yên không bị húc một lúc thì % giảm dần.
- **Võ sĩ** (chọn ở màn giới thiệu bằng ← →): 🪶 Nhẹ (nhanh, dễ bị đẩy) · ⚖️ Cân bằng · 🪨 Nặng (chậm, húc mạnh, khó bị đẩy).
- **Vật phẩm**: 🍙 siêu nặng · 🌶️ tăng tốc · 🛡️ khiên chặn 1 cú húc · 🧊 đóng băng đối thủ gần nhất · 💨 quạt gió đẩy mọi người.
- **Chế độ** (đổi ở màn giới thiệu bằng nút Nhảy hoặc bấm chuột):

| Chế độ | Luật |
|---|---|
| Đấu hiệp | Người cuối cùng còn trên sàn thắng hiệp. Người rơi thành 👻 ma bay quanh sàn, bấm Đánh để thổi gió quấy rối. |
| Đồng đội | P1+P3 đấu P2+P4, đội còn người trên sàn thắng hiệp. |
| Mạng | Mỗi người vài mạng (theo độ dài ván), rơi thì hồi sinh từ trên trời; hết mạng thành ma. Hết giờ thì ai còn nhiều mạng hơn thắng. |
| Vua võ đài | Đứng **một mình** trong vòng sáng để ghi điểm, vòng sáng đổi chỗ liên tục. Rơi thì hồi sinh. |
| Tập luyện | Máy đứng yên làm bình nộm, làm theo từng bước hướng dẫn (đi, húc tích lực, dậm đất, đứng tấn, đẩy rơi, nhặt vật phẩm) để học hết các nút. |

- **Phụ kiện** (chọn ở màn giới thiệu bằng nút Lên): 🎩 🧢 👑 🎀 🕶️ 🌸 — chỉ để trang trí.
- **Sàn bập bênh** ⚖️: mọi người dồn về phía nào thì sàn nghiêng, ai cũng trượt về phía đó.
- Cú húc quyết định (người cuối rơi) được chiếu chậm và phóng to; cú húc tích đầy lực có khựng hình nhẹ.

## Cờ (tab ♟️ Cờ trong menu)

Chơi được bằng bàn phím, tay cầm hoặc chuột.

| Game | Lối chơi |
|---|---|
| ♟️ **Cờ Vua** | 2 người. Đủ luật quốc tế: nhập thành, bắt tốt qua đường, phong cấp (chọn Hậu/Xe/Tượng/Mã), chiếu hết, hòa pat, lặp lại 3 lần, luật 50 nước, không đủ quân. Người–người thay phiên đi trên cùng bàn; đấu máy chọn mức ở màn giới thiệu (🟢 Dễ hay đi hớ, 🟡 Trung bình nhìn 3 nước, 🔴 Khó nghĩ 1,5–3 giây mỗi nước). Phím hướng di ô chọn (giữ để chạy), Đánh = chọn quân / đi, Nhảy = bỏ chọn; chuột: bấm quân rồi bấm ô, hoặc kéo thả. Màn giới thiệu chọn đồng hồ (Không giới hạn, 3+2, 5, 10, 15+10 — hết giờ là thua), bộ quân (Cổ điển / Merida / Maestro) và bàn cờ (Gỗ / Cẩm thạch / Xanh lá). Có chấm ô đi được, tô nước vừa đi, vua bị chiếu sáng đỏ, biên bản nước đi, quân đã ăn và chênh lệch quân. Ván sau tự đổi màu quân. |
| 🀄 **Cờ Tướng** | 2 người. Đủ luật: Tướng/Sĩ trong cung, cản chân Mã, cản mắt Tượng, Tượng không qua sông, Pháo ăn cách một quân, Tốt qua sông được đi ngang, hai Tướng không được đối mặt. Thắng khi chiếu bí hoặc đối phương hết nước đi. **Chiếu dài** (cứ chiếu làm lặp thế cờ): lặp lần 2 có cảnh báo đỏ, lần 3 bên chiếu bị xử thua; lặp thế thường thì hòa; 60 nước không ăn quân hoặc hai bên hết quân tấn công cũng hòa. Màn giới thiệu chọn đồng hồ, **mặt quân** (Chữ Hán — mặc định / Chữ Việt / Hình cho người mới) và bàn (Gỗ / Giấy đỏ / Ngọc). Biên bản ghi kiểu Việt: quân (X Xe, P Pháo, M Mã, T Tượng, S Sĩ, Tg Tướng, B Tốt) + cột tính từ phải sang của bên đi + `.` tiến / `/` thoái / `-` bình + số bước (Xe, Pháo, Tốt, Tướng) hoặc cột đến (Mã, Tượng, Sĩ), vd. **P2-5**, **M8.7**; hai quân cùng cột ghi `t` (trước) / `s` (sau). Hiện tên khai cuộc (Pháo đầu, Bình phong mã, Thuận pháo, Nghịch pháo, Tiên nhân chỉ lộ, Phi tượng…); máy đi theo sách khai cuộc vài nước đầu và tự tránh chiếu dài. Mép bàn có số cột 1–9 của mỗi bên. Điều khiển giống Cờ Vua (phím hướng / chuột). |
| 🎩 **Cờ Tỷ Phú 3D** | 2–4 người (người + máy). **Bàn cờ 3D** đặt giữa phố phường (nhà, cây, đường xá dựng bằng code): quân là các bạn Tròn 3D nhảy từng ô, xúc xắc 3D tung ra nảy trên bàn, nhà xanh / khách sạn đỏ mọc trên ô, tấm màu chủ ở mép ô; kéo chuột trên bàn để xoay / nghiêng, nút 🎥 về góc nhìn chuẩn. Tuỳ chọn Bàn cờ: 3D / 3D nhẹ (máy yếu) / Phẳng (bàn 2D cũ phủ kín màn hình, tự dùng khi máy không có WebGL). Bàn 40 ô "vòng quanh thế giới": 22 thành phố chia 8 nhóm màu (Châu Phi → Siêu đô thị, có nhóm Việt Nam: Đà Nẵng, Hà Nội, TP.HCM), 4 sân bay, Điện lực, Cấp nước, thuế, 32 thẻ Cơ hội / Khí vận kiểu "meme" (tiêu đề vui to + tác dụng ngắn, vd. 🌊 Mưa ngập tới gối → dạt vào Bãi đỗ xe; 🎂 Sinh nhật — mỗi người tặng $30), bốc ra là thẻ bay lên từ chồng thẻ rồi lật mặt, tù. **Ván nhanh** (mặc định): mỗi người được chia sẵn 2 thành phố, 3 nhà là lên khách sạn, chơi theo số vòng (Ngắn/Vừa/Dài ở sảnh) — hết vòng hoặc có 2 người phá sản thì ai nhiều tài sản nhất thắng. **Ván đầy đủ**: chơi tới khi chỉ còn 1 người, tự lưu sau mỗi lượt (mở lại game được hỏi chơi tiếp). Menu (bàn 3D: góc trái dưới; bàn phẳng: giữa bàn): Lên/Xuống chọn, Đánh đồng ý, Nhảy quay lại; chuột bấm được. Không mua thì **đấu giá**: mọi người cùng bấm phím của mình (Đánh +$10, Nhảy +$50), mỗi lần trả giá đồng hồ 5 giây chạy lại. **Nhà & thế chấp**: chọn ô bằng ← →, xây đều trong nhóm, bán nhà nửa giá, thế chấp lấy nửa giá, chuộc thêm 10%. **Giao dịch**: 2 cột đất / tiền / thẻ ra tù, đối tác bấm Đồng ý; máy cũng tự đề nghị mua ô còn thiếu để đủ nhóm. Rê chuột lên ô để xem bảng tiền thuê. Tuỳ chọn tốc độ lượt Thong thả (mặc định, chơi chill: xúc xắc dừng lâu, quân đi từng ô 0,7 giây, máy nghĩ chậm rãi) / Nhanh. |
| ❌ **Cờ Caro** | 2–4 người (người + máy). X–O trên giấy tập kẻ ô rộng 50×50, màn hình tự cuộn theo con trỏ và nước vừa đi (kéo chuột để xem chỗ khác); xếp 5 quân thẳng hàng trước là thắng ván, thắng đủ số ván là thắng chung cuộc, ván sau đổi bên đi trước. 3–4 người chia 2 đội thay phiên người đánh. Luật: Chặn hai đầu (mặc định, kiểu Việt Nam) / Tự do / Đúng 5; bàn Giấy tập (✕ đỏ ⭕ xanh nét bút bi) hoặc Bàn gỗ (quân đá); gợi ý cảnh báo nước nguy hiểm cho người mới; thời gian Thong thả / 30 giây / 15 giây mỗi nước. Máy 3 mức (Khó tìm chuỗi bốn liên tục). Phím hướng di con trỏ, Đánh = đánh quân, Nhảy = về nước vừa đi; hoặc bấm chuột vào ô. |
| 🐴 **Cờ Cá Ngựa 3D** | 2–4 người (người + máy). Bàn chữ thập 3D (vòng 56 ô, 4 chuồng ngựa có hàng rào, chuồng đích 6 bậc), dựng hoàn toàn bằng code với Three.js. Mặc định: 2 xúc xắc, đổ đôi hoặc 1+6 mới xuất chuồng, đi tổng 2 con (đôi được chọn đi cả hoặc nửa), không nhảy qua đầu ngựa, dừng đúng ô có ngựa đối thủ thì đá về chuồng, đôi / 1+6 được đổ tiếp, đếm thẳng vào chuồng, 4 ngựa ở bậc 3–6 là thắng, người còn lại chơi tiếp tranh hạng. Luật nhà chọn ở màn giới thiệu: 1 hay 2 xúc xắc, điều kiện xuất chuồng, nhảy qua đầu, 3 kiểu vào chuồng, điều kiện thắng, tranh hạng; tốc độ Thong thả / Nhanh; đồ hoạ 3D Cao / Thấp (máy yếu). Đổ xong các điểm đến hiện ngay trên bàn (ngựa mờ + nhãn "8 → bậc 6", nhãn đỏ "ĐÁ!"): ← → chọn, Đánh để đi, hoặc bấm chuột vào điểm đến / nút; kéo chuột để xoay bàn. Máy không có WebGL thì tự chuyển bàn 2D. |

## Gõ Chữ Tiếng Anh (tab 🧠 Trí tuệ & Phản xạ)

Một người chơi, gõ bằng cả bàn phím (Space sang từ sau, Backspace để sửa). **Tắt Unikey/EVKey trước khi chơi** — game nhận ra bộ gõ tiếng Việt đang bật và nhắc. Tiến độ lưu theo **tên người chơi ở sảnh** (từ đã thuộc, kỷ lục, chữ đã mở, chuỗi ngày luyện, Bộ từ của tôi). Hết ván: **Enter** chơi lại, **M** về chọn chế độ.

| Chế độ | Lối chơi |
|---|---|
| ⏱️ **Kiểm Tra Tốc Độ** | Gõ một đoạn từ ngẫu nhiên trong thời gian ván (đồng hồ chạy từ phím đầu tiên). WPM = số ký tự gõ đúng ÷ 5 ÷ phút; độ chính xác tính cả phím sai đã sửa. Hết giờ hiện WPM, độ chính xác, các từ gõ sai kèm nghĩa tiếng Việt và phím yếu. |
| 🖐️ **Luyện Ngón** | Bắt đầu với 8 phím hàng cơ sở, mở dần thêm chữ (a s d f j k l e → i r u …) khi đạt 20 WPM và 95%. Bàn phím trên màn hình tô màu theo ngón, từ luyện ưu tiên chữ hay gõ sai. |
| 📚 **Thẻ Từ** | Hiện nghĩa tiếng Việt + từ loại + chữ đầu, gõ từ tiếng Anh rồi Enter (`?` = gợi ý thêm chữ). Sai thì gõ lại đúng 3 lần. Ôn lại theo kiểu hộp Leitner: nhớ đúng thì lâu mới hỏi lại (1, 2, 4, 8, 16 ngày), sai thì về hộp đầu. |
| ☄️ **Bắn Thiên Thạch** | Thiên thạch mang từ tiếng Anh rơi về trạm: gõ chữ đầu để khoá mục tiêu, mỗi phím đúng là một phát bắn (Backspace bỏ khoá, Enter = bom quét sạch, mỗi đợt 1 lần). 3 khiên; mỗi đợt từ dài hơn, rơi nhanh hơn; cuối đợt có **Trùm** mang một câu ví dụ phải gõ hết (có chữ hoa, dấu câu). Tốc độ rơi tự chỉnh theo WPM gần đây của bạn (bị trúng thì chậm lại, sạch đợt thì nhanh lên). Hết ván hiện câu của Trùm kèm bản dịch. |
| 🏎️ **Đua Xe Gõ Chữ** | Gõ một đoạn gồm vài câu ví dụ, xe chạy theo số chữ gõ đúng. Đua với 3 xe máy (🐢 🦊 🐆) chạy quanh WPM gần đây của bạn và xe 👻 chạy lại đúng ván kỷ lục của chính bạn. Enter = 🔥 Nitro bỏ qua từ đang gõ (1 lần mỗi ván). Hết ván hiện thứ hạng, bản dịch các câu, từ gõ sai. |
| 📈 **Tiến Độ** | Bản đồ phím (xanh = chắc tay, đỏ = hay sai/chậm), biểu đồ WPM 14 ngày, số từ trong từng hộp Leitner, kỷ lục từng chế độ, chuỗi ngày luyện. |

Màn giới thiệu chọn **mức từ**: 🎲 Ngẫu nhiên (mặc định), A1 → C2, hoặc **📝 Của tôi**. Kho ~8.600 từ theo CEFR-J; nghĩa tiếng Việt hiện có cho A1–B1 (~4.400 từ) — chọn B2 trở lên ở Thẻ Từ thì tạm lấy thẻ A1–B1. 180 câu ví dụ (A1/A2/B1) tự soạn kèm bản dịch dùng cho Đua Xe và Trùm. Từ gõ sai ở Kiểm Tra Tốc Độ, Bắn Thiên Thạch, Đua Xe được đưa vào hộp 1 để ôn ở Thẻ Từ.

**📝 Bộ từ của tôi**: chọn mức "Của tôi" → lần đầu hiện ô dán chữ, mỗi dòng một từ `word - nghĩa` (hoặc `word = nghĩa`, `word: nghĩa`, hoặc chỉ `word` — game tự lấy nghĩa trong kho nếu có), Ctrl+Enter để lưu. Đang chơi bấm **F2** để sửa. Dùng được cho Kiểm Tra Tốc Độ, Thẻ Từ, Bắn Thiên Thạch, Đua Xe.

Thêm/sửa nghĩa: sửa `tools/words-vi/*.txt` (dòng `word=nghĩa`) hoặc câu ví dụ `tools/words-vi/sentences.txt` (dòng `MỨC | câu | bản dịch`) rồi chạy `node tools/pack-words.js`.

## Jigsaw Puzzle (tab 🧠 Trí tuệ & Phản xạ)

Ghép hình 1 người. Kéo mảnh từ quanh bàn vào khung giữa: hai mảnh đúng đặt gần nhau thì tự dính thành nhóm, nhóm đặt đúng chỗ trong khung thì khoá lại (không nhặt được nữa). Ghép hết là xong; bảng tổng kết có **Enter** = bức mới, **M** = về màn chọn tranh.

| Chế độ | Cách chơi |
|---|---|
| 🧘 **Thư giãn** | Khung trống (bật **Ảnh mờ trong khung** ở tuỳ chọn nếu muốn dễ hơn), đồng hồ chỉ để xem. Thoát giữa chừng thì lần sau vào lại chơi tiếp đúng chỗ (cùng số mảnh + kiểu xoay). Nút 🔀 Xáo lại = bỏ ván dở, cắt bức mới. |
| ⏱ **Thi giờ** | Không ảnh mờ, giờ chạy từ lúc nhặt mảnh đầu, mỗi gợi ý +15 giây. Kỷ lục lưu riêng cho từng tranh × số mảnh × xoay. |
| 📅 **Bức mỗi ngày** | Mỗi ngày một bức cố định (tranh + cách cắt theo ngày), 48 mảnh, không xoay — không theo tuỳ chọn tranh / số mảnh. Giờ chạy từ mảnh đầu, gợi ý +15 giây. Ghép xong mỗi ngày để giữ 🔥 chuỗi ngày; bảng tổng kết có 14 ô của 14 ngày gần nhất. Thoát giữa chừng thì trong ngày vào lại chơi tiếp. |

- **Tranh**: 12 cảnh tự vẽ bằng code (Vườn hoa, Đáy biển, Phố đêm, Vũ trụ, Làng Tròn, Mèo và Chó, Xứ kẹo, Hoàng hôn biển, Rừng thu, Phố đèn lồng, Nông trại, Làng tuyết), 🖼️ Ảnh của bạn hoặc 🎲 Ngẫu nhiên. Mỗi ván cắt mảnh ngẫu nhiên khác nhau.
- **🖼️ Ảnh của bạn**: chọn tranh "Ảnh của bạn" → hiện bộ sưu tập; bấm ô ＋ **Thêm ảnh từ máy** (chọn được nhiều ảnh JPG / PNG / WEBP…). Ảnh được cắt giữa theo khung 16:9 và lưu lại trong máy (tối đa 11 ảnh), lần sau chỉ cần bấm ảnh để ghép; ✕ (bấm 2 lần) để xoá. Thêm đúng 1 ảnh thì vào ghép luôn.
- **Số mảnh**: Theo độ dài ván (Ngắn 24 · Vừa 48 · Dài 96) hoặc chọn 12 / 24 / 48 / 96.
- **Xoay mảnh**: Không xoay (mặc định) hoặc Có xoay — mảnh bị xoay ngẫu nhiên, xoay 90° bằng chuột phải, lăn chuột, phím R (Shift+R xoay ngược) hoặc Nhảy khi đang cầm mảnh. Chỉ ghép được khi cùng chiều.
- **🧲 Xếp gọn** (nút hoặc phím **X**): mảnh rời xếp thành hàng quanh khung — 4 góc + mảnh viền nằm sát khung, mảnh giữa ra phía ngoài (trong cùng loại vẫn trộn lẫn), nhóm đã nối giữ nguyên chỗ.
- **Chuột**: kéo thả mảnh. **Space** (giữ) hoặc nút 👁 = xem ảnh gốc to; **G** hoặc nút 💡 = gợi ý (một mảnh nhấp nháy cùng chỗ của nó trong khung, tự tắt sau 4 giây; đang gợi ý mà bấm lần nữa thì tắt ngay, không tính thêm lượt).
- **Bàn phím / tay cầm**: phím hướng di chuyển bàn tay (nhanh dần, chậm lại khi đi qua mảnh), Đánh = nhặt / thả, Nhảy chạm = nhảy tới mảnh kế (đang cầm thì xoay), giữ Nhảy = xem ảnh. Con trỏ phím hút dính rộng hơn chuột một chút cho dễ đặt.

## 2048 (tab 🧠 Trí tuệ & Phản xạ)

Mỗi lần trượt, mọi ô chạy hết cỡ về một phía; hai ô cùng số chạm nhau thì gộp thành một ô gấp đôi và cộng điểm bằng số mới (một ô chỉ gộp một lần mỗi nước; ba ô giống nhau thì hai ô phía trước gộp). Sau mỗi nước có một ô 2 (90%) hoặc 4 (10%) mới. Lên tới ô mục tiêu là thắng — chơi tiếp được để phá kỷ lục; hết chỗ và không gộp được nữa là hết ván (**Enter** = chơi lại, **M** = đổi game). Không có hoàn tác.

| Chế độ | Cách chơi |
|---|---|
| 🔢 **Cổ điển** | Luật gốc như trên, chọn cỡ bàn ở tuỳ chọn. Lên ô mục tiêu là thắng, chơi tiếp được. 3 lần gợi ý mỗi ván. |
| 🗺️ **Thử thách** | 12 màn: có màn có **ô đá** (đứng yên, không gộp, chặn đường trượt), có màn **giới hạn số nước**, bàn 3×3 đến 6×6, mục tiêu từ 128 đến 2048. Lên ô mục tiêu là qua màn; qua trong càng ít nước càng nhiều sao (tối đa 3). Qua màn mở màn kế. Thoát giữa màn thì lần sau chơi tiếp. |
| 🌞 **Ván mỗi ngày** | Cả ngày chỉ một ván cố định (cùng ô đá nếu có, cùng thứ tự ô mới cho mọi lần chơi), 250 nước, điểm càng cao càng tốt. Lưu điểm cao nhất từng ngày, chơi mỗi ngày để giữ 🔥 chuỗi. Không có gợi ý. |

- **💡 Gợi ý** (nút, phím **G** hoặc Nhảy): máy tính trước vài nước (expectimax) rồi hiện mũi tên lớn chỉ hướng nên trượt. 3 lần mỗi ván (Cổ điển, Thử thách).
- **Cỡ bàn** (Cổ điển): 3×3 (mục tiêu 256) · 4×4 (2048, mặc định) · 5×5 (4096) · 6×6 (8192). Kỷ lục lưu riêng từng cỡ.
- **Ô số**: mỗi số một màu gradient nổi khối, chữ to viền dày. Từ 128 ô phát sáng, từ 512 lấp lánh, từ 1024 có vệt sáng quét qua, ô mục tiêu trở lên đội vương miện, 16384 và 32768 là ô thiên hà chữ cầu vồng. Gộp ra ô lớn có vòng sáng loé + tia màu.
- **Bộ sưu tập ô số** (cột phải): 15 ô từ 2 đến 32768, ô nào đã từng tạo ra thì mở khoá (tính chung mọi cỡ bàn).
- Thoát giữa chừng thì lần sau vào lại cùng cỡ bàn là chơi tiếp. **↻ Ván mới** (hoặc phím **N**, hoặc giữ nút Đánh 1 giây) = bỏ ván dở — đã đi vài nước thì phải bấm 2 lần.
- **Điều khiển**: mũi tên / WASD / phím hướng của bộ phím đang dùng, tay cầm, hoặc vuốt chuột trên màn hình.

**Game đồng đội** (Bóng Đá, Kéo Co, Dây Thun, Đại Bác Công Thành, Xe Tăng – Cướp cờ, Đấu Kiếm – Tiến quân, Sumo – Đồng đội): 2 người đấu 1–1, 3 người đấu 2–1, 4 người đấu 2–2. P1 và P3 ở Đội Trái, P2 và P4 ở Đội Phải. Thứ tự trong bảng ở màn giới thiệu quyết định đội (người 1, 3 một đội; 2, 4 một đội).

## Cấu trúc code

```
index.html          giao diện + nạp các script
css/style.css       giao diện menu
js/engine.js        input (phím + tay cầm), âm thanh, vẽ nhân vật, hiệu ứng, vật lý
js/app.js           luồng: sảnh (người thật) → chọn game → giới thiệu (đội hình + máy) → đếm ngược → chơi → kết quả
js/games/*.js       mỗi game 1 file
assets/             ảnh (quân cờ...) kèm CREDITS.md ghi nguồn + giấy phép
```

## Thêm game mới

Tạo file `js/games/ten-game.js`, rồi thêm `<script src="js/games/ten-game.js"></script>` vào `index.html` (trước `app.js`):

```js
(() => {
  class MyGame {
    constructor(api) {           // api.players: [{name, color:{main,dark,light}, bot}], api.parts: hiệu ứng hạt
      this.api = api; this.P = api.players;
      this.finished = false;     // đặt true khi game kết thúc
    }
    update(dt, inputs) {         // inputs[i] = {mx, my, act, jump, actP, jumpP}  (actP/jumpP = vừa bấm)
    }
    draw(ctx) {                  // canvas 1280×720; dùng Draw.blob(), Draw.chips(), Draw.timer()...
    }
    results() {                  // điểm càng cao xếp càng trên
      return this.P.map(() => ({ score: 0, text: '0 điểm' }));
    }
    botInput(i) {                // (tuỳ chọn) điều khiển cho máy
      return { mx: 0, my: 0, actP: false, jumpP: false };
    }
  }
  Party.register({
    id: 'mygame', name: 'Game Của Tui', emoji: '🎯',
    cat: 'fight',                // nhóm trong menu: fight | dodge | collect | team | brain
    tagline: 'Mô tả ngắn trên thẻ game',
    how: 'Luật chơi hiện ở màn hình giới thiệu',
    controls: { move: 'Di chuyển', act: 'Hành động', jump: 'Nhảy' },   // bỏ jump nếu không dùng
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new MyGame(api),
  });
})();
```
