# SmartStock

Backend và frontend cho ứng dụng quản lý kho SmartStock. Repository hiện là
skeleton để cả team phát triển theo cùng một cấu trúc.

## Cấu trúc dự án

```text
KITS-CLT-SmartStock/
├── backend/                 # REST API Node.js + Express + TypeScript
│   ├── db/
│   │   └── migration/       # Các file SQL tạo và thay đổi schema PostgreSQL
│   ├── src/
│   │   ├── config/          # Đọc biến môi trường và cấu hình database
│   │   ├── controllers/     # Nhận request, trả response HTTP
│   │   ├── middlewares/     # Middleware dùng chung (vd. xác thực, xử lý lỗi)
│   │   ├── repo/            # Truy vấn và thao tác dữ liệu PostgreSQL
│   │   ├── routes/          # Khai báo endpoint và nối tới controller
│   │   ├── services/        # Nghiệp vụ ứng dụng
│   │   ├── app.ts           # Khởi tạo Express app và đăng ký middleware/routes
│   │   └── server.ts        # Chạy HTTP server
│   ├── .env                 # Cấu hình cục bộ, không commit Git
│   ├── .env.example         # Mẫu cấu hình để thành viên mới sao chép
│   └── package.json         # Dependencies và scripts của backend
├── frontend/                # React + Vite client
└── .gitignore
```

### Quy ước luồng xử lý backend

```text
Route → Controller → Service → Repository → PostgreSQL
```

- **routes** chỉ map URL, HTTP method và controller.
- **controllers** kiểm tra request ở mức HTTP, gọi service và trả response.
- **services** chứa quy tắc nghiệp vụ; không nên đặt câu SQL trực tiếp ở đây.
- **repo** là nơi duy nhất truy cập PostgreSQL.
- **middlewares** xử lý các phần dùng chung trước/sau route, ví dụ CORS, xác thực JWT và lỗi.
- **config** tập trung cấu hình, không rải `process.env` khắp codebase.
- **db/migration** lưu các thay đổi schema theo thứ tự số (`001_...sql`, `002_...sql`). Không sửa migration đã được áp dụng cho môi trường dùng chung; hãy tạo migration mới.

## Setup cho thành viên mới

### 1. Điều kiện cần có

- Node.js LTS (khuyến nghị 20 trở lên)
- npm
- PostgreSQL đang chạy trên máy (khuyến nghị PostgreSQL 15 trở lên)

Kiểm tra nhanh:

```bash
node -v
npm -v
psql --version
```

### 2. Clone và cài dependencies

```bash
git clone <REPOSITORY_URL>
cd KITS-CLT-SmartStock
cd backend
npm ci
```

> Dùng `npm ci` để cài đúng phiên bản đã được khóa trong `package-lock.json`. Nếu đang phát triển frontend, mở terminal khác rồi chạy `cd frontend` và `npm ci`.

### 3. Tạo database PostgreSQL

Đăng nhập PostgreSQL bằng tài khoản có quyền tạo database, rồi chạy:

```sql
CREATE DATABASE smartstock;
```

Sau khi team thêm migration có nội dung SQL, áp dụng lần lượt từng file trong `backend/db/migration/` vào database `smartstock`. 

### 4. Cấu hình biến môi trường backend


Mở `.env` và điền thông tin database trên máy của bạn:

```env
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/smartstock
FRONTEND_URL=http://localhost:5173
```

Ý nghĩa các biến:

| Biến | Ý nghĩa | Giá trị local mặc định |
| --- | --- | --- |
| `PORT` | Cổng chạy API Express | `4000` |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL | database `smartstock` ở máy local |
| `FRONTEND_URL` | Origin được backend cho phép qua CORS | `http://localhost:5173` |


### 5. Chạy backend

```bash
npm run dev
```


## Lưu ý cho skeleton hiện tại
- Các file TypeScript và migration hiện mới là khung trống; cần bổ sung implementation trước khi API hoạt động hoàn chỉnh.
- Khi thêm endpoint mới, tạo theo luồng route → controller → service → repository để code dễ kiểm thử và bảo trì.
