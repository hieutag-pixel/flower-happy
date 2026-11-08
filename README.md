# 🌸 Flowers Happy – Website kinh doanh hoa tươi (Dự án tốt nghiệp)

Công nghệ: **Node.js + Express** (backend API) · **MongoDB + Mongoose** (cơ sở dữ liệu) · **HTML/CSS/JavaScript thuần** (giao diện, do chính Express phục vụ).
Chỉ cần chạy **một lệnh** là có cả web khách hàng, trang quản trị và API.

---

## 1. Cần cài gì trước (chỉ làm 1 lần)

| Phần mềm | Dùng để | Tải ở đâu | Kiểm tra đã cài chưa |
|---|---|---|---|
| **Node.js bản LTS** | Chạy server | nodejs.org | Mở terminal gõ `node -v` và `npm -v` |
| **MongoDB Community Server** | Cơ sở dữ liệu chạy trên máy | mongodb.com → Products → Community Server | Cài xong chọn "Install as a Service" để tự chạy |
| **MongoDB Compass** | Xem dữ liệu bằng giao diện | (thường cài kèm Community Server) | Mở Compass → Connect `mongodb://127.0.0.1:27017` |
| **VS Code** | Viết code | code.visualstudio.com | — |

> Không muốn cài MongoDB lên máy? Dùng **MongoDB Atlas** (miễn phí, trên mạng): tạo cluster → lấy chuỗi kết nối `mongodb+srv://...` → dán vào `MONGODB_URI` trong file `.env`.

Khi mở thư mục này bằng VS Code, VS Code sẽ gợi ý cài các extension có ích (MongoDB, Prettier, ESLint, REST Client) – bấm **Install**.

---

## 2. Chạy dự án lần đầu (từng bước)

Mở VS Code → **File > Open Folder** → chọn `E:\Tailieuhoctap\DATN1` → mở Terminal (**Ctrl + `**).

```bash
# Bước 1: vào thư mục backend
cd backend

# Bước 2: cài thư viện (tạo thư mục node_modules, mất 1-2 phút)
npm install

# Bước 3: tạo file cấu hình .env từ file mẫu
copy .env.example .env

# Bước 4: nạp dữ liệu mẫu vào MongoDB (20 sản phẩm, đơn hàng, mã giảm giá, bài viết...)
npm run seed

# Bước 5: chạy server
npm run dev
```

Thấy dòng `🌸 Flower Happy đang chạy tại: http://localhost:5000` là thành công. Mở trình duyệt:

- Web khách hàng: **http://localhost:5000** (đăng nhập tại `/login.html`)
- Trang quản trị: **http://localhost:5000/admin/login.html** (trang đăng nhập riêng, chỉ nhận tài khoản admin; có link nhỏ "Quản trị" ở chân trang web)

> Phiên đăng nhập khách và phiên quản trị **tách riêng** (localStorage `fh_token`/`fh_user` cho khách, `fh_admin_token`/`fh_admin_user` cho admin). Cùng một trình duyệt có thể mở tab 1 đăng nhập khách, tab 2 đăng nhập admin mà không ảnh hưởng nhau; đăng xuất bên nào chỉ thoát bên đó.

### Tài khoản dùng thử (do `npm run seed` tạo)

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | admin@flowerhappy.vn | Admin@123 |
| Khách hàng | khach@flowerhappy.vn | Khach@123 |

Mã giảm giá mẫu: `WELCOME10` (giảm 10%, đơn từ 300k), `GIAM50K` (đơn từ 500k), `VALENTINE` (15%, đơn từ 800k).

> ⚠️ `npm run seed` **xoá sạch** dữ liệu cũ rồi tạo lại. Chỉ chạy khi muốn làm mới database.

### Lỗi hay gặp

| Thông báo | Nguyên nhân / cách sửa |
|---|---|
| `'node' is not recognized` | Chưa cài Node.js, hoặc cài xong chưa mở lại VS Code |
| `Kết nối MongoDB thất bại ... ECONNREFUSED` | MongoDB chưa chạy. Mở **Services** của Windows → tìm *MongoDB Server* → Start. Hoặc thử kết nối bằng Compass |
| `Thiếu JWT_SECRET` / `Thiếu MONGODB_URI` | Chưa tạo file `.env` (bước 3) |
| `EADDRINUSE :5000` | Đã có server khác chạy cổng 5000 → tắt terminal cũ hoặc đổi `PORT` trong `.env` |
| Trang web trống, báo "Không tải được dữ liệu" | Chưa chạy `npm run seed` hoặc server đang tắt |

---

## 3. Cấu trúc thư mục

```
DATN1/
├── backend/
│   ├── .env.example          ← mẫu cấu hình (copy thành .env)
│   ├── api-test.http         ← thử API ngay trong VS Code (extension REST Client)
│   ├── package.json
│   ├── uploads/              ← ảnh admin tải lên
│   └── src/
│       ├── server.js         ← điểm khởi động
│       ├── config/db.js      ← kết nối MongoDB
│       ├── models/           ← cấu trúc dữ liệu (theo ERD cấp 2)
│       ├── controllers/      ← xử lý nghiệp vụ
│       ├── routes/index.js   ← danh sách toàn bộ API
│       ├── middleware/       ← kiểm tra đăng nhập, phân quyền, xử lý lỗi
│       ├── utils/helpers.js  ← hàm dùng chung (tạo slug, phân trang...)
│       └── seed/             ← dữ liệu mẫu + script nạp dữ liệu
└── frontend/
    ├── index.html, products.html, product.html, cart.html, checkout.html,
    │   orders.html, account.html, login.html, register.html,
    │   posts.html, post.html, compare.html
    ├── css/style.css
    ├── js/                   ← common.js (dùng chung) + 1 file cho mỗi trang
    ├── images/               ← logo + ảnh 20 sản phẩm
    └── admin/                ← trang quản trị (login.html + login.js, index.html, admin.js,
                                admin-auth.js = phiên admin riêng, admin.css)
```

### Mô hình dữ liệu (đối chiếu ERD cấp 2)

| Bảng trong ERD | Collection MongoDB | Ghi chú |
|---|---|---|
| Người dùng | `users` | Mật khẩu được mã hoá bcrypt |
| Địa chỉ | `addresses` | 1 người dùng – nhiều địa chỉ, có địa chỉ mặc định |
| Sản phẩm + Ảnh sản phẩm + Thành phần sản phẩm | `products` | Ảnh và thành phần **nhúng** trong sản phẩm (cách làm chuẩn của MongoDB) |
| Loại sản phẩm + Sản phẩm–Loại | `categories` + mảng `product.categories` | Quan hệ n-n không cần bảng trung gian |
| Loại hoa | `flowertypes` | Có `pricePerStem` (giá mỗi cành) |
| Giỏ hàng | `carts` | Mỗi người 1 giỏ, nhiều dòng sản phẩm; mỗi dòng có `stemChanges`, `adjustAmount`, `customerRequest` |
| Đơn hàng + Chi tiết đơn hàng | `orders` | Chi tiết **nhúng** trong đơn, lưu tên + giá + số cành + giá mỗi cành tại thời điểm mua, kèm báo giá yêu cầu của khách |
| Mã giảm giá | `discounts` | |
| Bài viết | `posts` | |
| *(chưa có trong ERD)* | `reviews` | Đánh giá/bình luận – use case có nhưng ERD thiếu |

---

## 4. Chức năng đã làm (theo Use Case)

**Khách hàng:** đăng ký, đăng nhập/đăng xuất, quản lý tài khoản (sửa thông tin, đổi mật khẩu, sổ địa chỉ), tìm kiếm – lọc theo dịp/kiểu/giá – sắp xếp – phân trang sản phẩm, xem chi tiết (thành phần hoa, ảnh), **tăng/giảm số cành từng loại hoa** (giá cập nhật ngay), **gửi yêu cầu riêng và nhận báo giá**, giỏ hàng (đổi số lượng, xoá), áp mã giảm giá, đặt hàng (ngày giao, khung giờ, lời nhắn thiệp), lịch sử đơn + huỷ đơn khi đang chờ xác nhận, đánh giá sản phẩm (chỉ khi đã nhận hàng), xem bài viết, so sánh tối đa 4 sản phẩm.

**Admin:** thống kê doanh thu theo ngày/tháng/năm, đếm đơn theo trạng thái, top bán chạy, sắp hết hàng; quản lý đơn (lọc theo trạng thái / thanh toán / "Chờ báo giá", sắp xếp **đặt trước xử lý trước** (mặc định) hoặc mới nhất trước, đơn "Chờ xác nhận" được tô nổi bật, báo giá yêu cầu của khách, cập nhật trạng thái theo luồng Chờ xác nhận → Đã xác nhận → Đang giao → Hoàn thành, huỷ đơn tự hoàn kho); quản lý sản phẩm (thêm/sửa/xoá mềm/ẩn hiện, upload ảnh, thành phần hoa với số cành Min/Max và "Cho tăng giảm"); loại sản phẩm; loại hoa (có giá mỗi cành); mã giảm giá (thêm, sửa); người dùng (xem, khoá, tìm kiếm, phân trang); bài viết.

### Tăng/giảm số cành

- Mỗi thành phần sản phẩm có `stems` (số cành mặc định), `minStems`, `maxStems`, `adjustable` (cho tăng giảm). Mỗi loại hoa có `pricePerStem`.
- Ở trang chi tiết, khách bấm − / + trong khoảng Min–Max. Giá = giá sản phẩm + Σ (số cành chọn − số cành mặc định) × giá mỗi cành (tăng thì cộng, giảm thì trừ).
- Client chỉ gửi `{ flowerType, stems }`. **Server tự tính lại tiền từ database** và kiểm tra min/max ở giỏ hàng và khi đặt hàng (không tin giá client gửi). Không còn phụ thu cố định `SWAP_FEE`.

### Luồng "Yêu cầu của khách hàng" có báo giá

1. Khách ghi yêu cầu (ví dụ "Thêm thiệp lớn, gói giấy màu kem...") ở trang sản phẩm → đặt hàng → dòng sản phẩm có `requestStatus = waiting_quote`.
2. Admin vào **Đơn hàng** (lọc "Chờ báo giá") → Chi tiết → nhập phụ thu + ghi chú → **Gửi báo giá** → `quoted`. (`PUT /api/orders/:id/items/:itemId/quote`, chỉ admin)
3. Khách thấy **chấm đỏ** ở mục "Đơn hàng của tôi" → bấm **Đồng ý** (`accepted`, phụ thu được cộng vào tổng) hoặc **Từ chối** (`rejected`, phụ thu = 0, cửa hàng làm theo mẫu gốc). (`PUT /api/orders/:id/items/:itemId/quote-response`, chỉ chủ đơn)
4. Khi đơn còn dòng `waiting_quote` hoặc `quoted`, admin **không thể** chuyển đơn sang "Đã xác nhận".

Tổng đơn = Tạm tính + Phí ship − Giảm giá + Phụ thu các yêu cầu khách đã đồng ý (`requestFeeTotal`).

---

## 5. ⚠️ Những điểm còn thiếu / cần bạn quyết định

1. **ERD và Use Case chưa khớp nhau** (nên sửa lại sơ đồ trước khi bảo vệ):
   - Use case Admin có **"Quản lý Thương hiệu"** nhưng ERD **không có bảng Thương hiệu** → chưa làm. Hoa tươi thường không có thương hiệu: đề xuất **bỏ** use case này.
   - Use case có **"Quản lý danh mục bài viết"** nhưng ERD không có bảng → chưa làm. Đề xuất bỏ, hoặc thêm bảng *Danh mục bài viết* vào ERD.
   - Use case có **"Bình luận"** và **"Đánh giá đơn hàng"** nhưng ERD thiếu bảng → đã **thêm bảng `reviews`**, cần vẽ bổ sung vào ERD.
   - Bảng Sản phẩm có cả "mã danh mục" lẫn bảng n-n "Sản phẩm – Loại" (trùng ý) → đã gộp thành 1 quan hệ n-n, loại thẻ phân biệt *Dịp tặng* / *Kiểu dáng*.
2. **Thanh toán online (MoMo/VNPay) chưa tích hợp** – cần đăng ký tài khoản sandbox của cổng thanh toán. Hiện có COD và Chuyển khoản (admin tự đánh dấu "đã thanh toán").
3. **Dữ liệu mẫu là giả**: giá, tồn kho, mô tả sản phẩm, thông tin liên hệ ở chân trang ("cập nhật") – hãy sửa lại cho đúng.
4. Chưa có: quên mật khẩu qua email, gửi email xác nhận đơn, đưa web lên hosting (deploy). Có thể làm tiếp nếu giảng viên yêu cầu.

---

## 6. Cách làm việc với Claude cho hiệu quả

- **Mỗi lần một việc nhỏ, nói rõ kết quả mong muốn.** Ví dụ: *"Thêm chức năng quên mật khẩu gửi mã qua email"* thay vì *"làm tiếp web"*.
- **Khi lỗi, gửi nguyên văn thông báo lỗi** (copy toàn bộ chữ đỏ trong terminal hoặc tab Console của trình duyệt – F12) + bạn đang làm bước nào.
- **Kết nối thư mục `E:\Tailieuhoctap\DATN1`** khi bắt đầu cuộc trò chuyện để Claude đọc và sửa code trực tiếp.
- **Nhờ giải thích để hiểu code** – hội đồng sẽ hỏi: *"Giải thích luồng đặt hàng trong orderController.js"*, *"Tại sao dùng JWT?"*.
- **Dùng Git** (`git init`, `git commit`) trước mỗi thay đổi lớn để quay lại được khi cần.
- Có thể nhờ viết tiếp **báo cáo đồ án** (chương phân tích thiết kế, mô tả API, kịch bản kiểm thử) dựa trên code này.
