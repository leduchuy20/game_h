# Tròn Party 🎉

Bộ mini-game cho **2–4 người chơi chung một máy** (bàn phím và/hoặc tay cầm), lấy cảm hứng từ lối chơi của các game party. Không cần cài đặt, không cần server.

## Cách chạy

1. Mở file `index.html` bằng Chrome hoặc Edge (nhấp đúp là được).
2. Bấm **⛶ Toàn màn hình**, cắm laptop ra TV nếu muốn.
3. Trong sảnh có 4 ô P1–P4:
   - **Thêm người:** bấm **🙋 Người chơi** ở ô trống rồi chọn bộ phím (hoặc bấm A trên tay cầm) — hay nhanh hơn: nhấn **nút Đánh** trong bộ phím của bạn là vào ngay. Bấm **🤖 Máy** ở ô trống (hoặc **🤖 + Thêm máy**) để thêm người máy.
   - **Đổi tên:** bấm vào tên (✏️), gõ tối đa 8 ký tự, Enter để lưu. **Đổi màu:** bấm vào hình Tròn. Tên và màu được nhớ theo từng ô cho lần sau.
   - **Xoá:** bấm **✕** ở góc ô, hoặc người đó giữ **nút Nhảy 1 giây** (chạm nhẹ không sao — để còn thử phím).

> Nhớ **tắt Unikey/EVKey** (chuyển sang chế độ E) trước khi chơi để phím không bị nuốt.

## Độ khó của máy

Trong sảnh, bấm nút **Máy: …** để đổi qua lại 🟢 **Dễ** → 🟡 **Trung bình** → 🔴 **Khó** (game tự nhớ lựa chọn).

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
| 🎉 **Chơi tiệc** | 3 / 5 / 8 game ngẫu nhiên liên tiếp, tự bật/tắt từng game được bốc (nhớ lựa chọn), cộng điểm (hạng 1 được nhiều điểm nhất). Giữa các game có 🎡 vòng quay sự kiện (điểm ×2, tua nhanh, chia điểm, người bét chọn game...). Ở màn giới thiệu bấm nút Xuống để 🎲 cược 1 điểm: nhất +2, bét mất cược. Bật **🎲 Bàn cờ** ở màn chọn tiệc: sau mỗi game mọi người đi trên bàn 25 ô, về càng cao xúc xắc càng to (nhất 3–6, bét 1–3); ô 🪙 +1, ⭐ +3, 🏁 đi qua +3, 🦹 cướp 2 điểm của người dẫn đầu, ⏪ lùi 3 ô, 🛒 trả 3 điểm mua bùa 🔄 đảo phím người dẫn đầu ở game sau. Hết tiệc mà hòa điểm cao nhất → **⚔️ hiệp phụ quyết tử**: chỉ những người hòa đấu 1 ván Sumo trên lõi sàn hoặc Đấu Kiếm 1 chạm, ai thắng +1 điểm. |

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

**Game đồng đội** (Bóng Đá, Kéo Co, Dây Thun, Đại Bác Công Thành, Xe Tăng – Cướp cờ, Đấu Kiếm – Tiến quân, Sumo – Đồng đội): 2 người đấu 1–1, 3 người đấu 2–1, 4 người đấu 2–2. P1 và P3 ở Đội Trái, P2 và P4 ở Đội Phải. Muốn đổi đội thì đổi chỗ trong sảnh.

## Cấu trúc code

```
index.html          giao diện + nạp các script
css/style.css       giao diện menu
js/engine.js        input (phím + tay cầm), âm thanh, vẽ nhân vật, hiệu ứng, vật lý
js/app.js           luồng: sảnh → chọn game → sẵn sàng → đếm ngược → chơi → kết quả
js/games/*.js       mỗi game 1 file
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
