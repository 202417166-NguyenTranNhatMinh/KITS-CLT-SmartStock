/**
 * Bơm dữ liệu mẫu cho demo. XÓA SẠCH dữ liệu cũ rồi tạo lại, chạy bao nhiêu lần cũng ra cùng kết quả.
 *
 *   npm run seed
 *
 * Tài khoản: admin@freshmart.vn / Admin@123 · staff1@freshmart.vn / Staff@123 · staff2@freshmart.vn / Staff@123
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';

const ADMIN_PASSWORD = 'Admin@123';
const STAFF_PASSWORD = 'Staff@123';

// ── Danh mục (5) ──────────────────────────────────────────────
const CATEGORIES = ['Rau củ', 'Trái cây', 'Thịt cá', 'Sữa và trứng', 'Đồ khô và gia vị'];

// ── Nhà cung cấp (3) ──────────────────────────────────────────
const SUPPLIERS = [
  { name: 'Nông trại Đà Lạt Xanh', phone: '0263 3821 456', address: '12 Trần Hưng Đạo, Phường 10, Đà Lạt, Lâm Đồng' },
  { name: 'Công ty Thực phẩm Sạch Sài Gòn', phone: '028 3925 7788', address: '45 Nguyễn Văn Linh, Quận 7, TP.HCM' },
  { name: 'Đại lý Tạp hóa Minh Phát', phone: '0908 112 233', address: '88 Lê Văn Sỹ, Quận 3, TP.HCM' },
];

// ── Sản phẩm (30): [sku, tên, danh mục (1-5), đơn vị, giá, tồn tối thiểu] ──
const PRODUCTS: [string, string, number, string, number, number][] = [
  ['RAU-001', 'Cà chua', 1, 'kg', 25000, 20],
  ['RAU-002', 'Cải thìa', 1, 'kg', 30000, 15],
  ['RAU-003', 'Cà rốt Đà Lạt', 1, 'kg', 22000, 20],
  ['RAU-004', 'Khoai tây', 1, 'kg', 28000, 20],
  ['RAU-005', 'Bắp cải', 1, 'kg', 18000, 15],
  ['RAU-006', 'Hành tây', 1, 'kg', 26000, 10],
  ['TRC-001', 'Chuối già', 2, 'nải', 35000, 10],
  ['TRC-002', 'Cam sành', 2, 'kg', 45000, 15],
  ['TRC-003', 'Táo Envy', 2, 'kg', 120000, 10],
  ['TRC-004', 'Dưa hấu', 2, 'quả', 60000, 8],
  ['TRC-005', 'Xoài cát Hòa Lộc', 2, 'kg', 80000, 10],
  ['TRC-006', 'Thanh long ruột đỏ', 2, 'kg', 40000, 10],
  ['THC-001', 'Thịt heo ba rọi', 3, 'kg', 160000, 10],
  ['THC-002', 'Thịt bò thăn', 3, 'kg', 320000, 5],
  ['THC-003', 'Ức gà phi lê', 3, 'kg', 95000, 10],
  ['THC-004', 'Cá basa phi lê', 3, 'kg', 85000, 8],
  ['THC-005', 'Tôm thẻ', 3, 'kg', 220000, 5],
  ['THC-006', 'Mực ống', 3, 'kg', 250000, 5],
  ['SUA-001', 'Sữa tươi Vinamilk 1L', 4, 'hộp', 36000, 24],
  ['SUA-002', 'Sữa chua Vinamilk', 4, 'lốc', 32000, 20],
  ['SUA-003', 'Trứng gà ta', 4, 'vỉ', 42000, 20],
  ['SUA-004', 'Trứng vịt', 4, 'vỉ', 38000, 15],
  ['SUA-005', 'Phô mai Con Bò Cười', 4, 'hộp', 45000, 10],
  ['SUA-006', 'Sữa đậu nành Fami', 4, 'thùng', 150000, 5],
  ['DKH-001', 'Gạo ST25', 5, 'bao 5kg', 185000, 10],
  ['DKH-002', 'Nước mắm Nam Ngư', 5, 'chai', 42000, 20],
  ['DKH-003', 'Dầu ăn Neptune 1L', 5, 'chai', 55000, 15],
  ['DKH-004', 'Đường cát trắng', 5, 'kg', 24000, 15],
  ['DKH-005', 'Mì Hảo Hảo', 5, 'thùng', 115000, 10],
  ['DKH-006', 'Bột ngọt Ajinomoto', 5, 'gói', 32000, 10],
];

// ── Chứng từ (10). Thời gian ghi theo giờ VN (+07). ────────────
// user: 1 = admin, 2 = staff1, 3 = staff2. Dòng hàng: [sku, số lượng, đơn giá (chỉ phiếu nhập)]
type Line = [string, number, number?];
interface Doc {
  code: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  createdBy: number;
  createdAt: string;
  finalizedBy?: number;
  finalizedAt?: string;
  note?: string;
  lines: Line[];
}
interface ReceiptDoc extends Doc { supplier: number }
interface IssueDoc extends Doc { reason: 'SALE' | 'DAMAGED' | 'INTERNAL' }

const RECEIPTS: ReceiptDoc[] = [
  {
    code: 'PN-20261120-001', supplier: 1, status: 'CONFIRMED', createdBy: 1,
    createdAt: '2026-11-20 08:00+07', finalizedBy: 1, finalizedAt: '2026-11-20 08:30+07',
    note: 'Nhập đầu kỳ rau củ, trái cây',
    lines: [
      ['RAU-001', 60, 20000], ['RAU-002', 40, 24000], ['RAU-003', 50, 17000], ['RAU-004', 50, 22000],
      ['RAU-005', 40, 14000], ['RAU-006', 30, 20000], ['TRC-001', 30, 28000], ['TRC-002', 40, 36000],
      ['TRC-003', 25, 100000], ['TRC-004', 20, 48000], ['TRC-005', 30, 65000], ['TRC-006', 30, 32000],
    ],
  },
  {
    code: 'PN-20261120-002', supplier: 2, status: 'CONFIRMED', createdBy: 1,
    createdAt: '2026-11-20 09:00+07', finalizedBy: 1, finalizedAt: '2026-11-20 09:20+07',
    note: 'Nhập đầu kỳ thịt cá, sữa trứng',
    lines: [
      ['THC-001', 30, 135000], ['THC-002', 15, 280000], ['THC-003', 30, 80000], ['THC-004', 25, 70000],
      ['THC-005', 15, 190000], ['THC-006', 12, 215000], ['SUA-001', 80, 30000], ['SUA-002', 60, 26000],
      ['SUA-003', 60, 35000], ['SUA-004', 40, 31000], ['SUA-005', 30, 38000], ['SUA-006', 15, 128000],
    ],
  },
  {
    code: 'PN-20261121-001', supplier: 3, status: 'CONFIRMED', createdBy: 1,
    createdAt: '2026-11-21 08:30+07', finalizedBy: 1, finalizedAt: '2026-11-21 09:00+07',
    note: 'Nhập đầu kỳ đồ khô',
    lines: [
      ['DKH-001', 30, 160000], ['DKH-002', 50, 35000], ['DKH-003', 40, 47000],
      ['DKH-004', 40, 19000], ['DKH-005', 25, 98000], ['DKH-006', 30, 26000],
    ],
  },
  {
    code: 'PN-20261123-001', supplier: 1, status: 'CONFIRMED', createdBy: 2,
    createdAt: '2026-11-23 07:30+07', finalizedBy: 1, finalizedAt: '2026-11-23 08:00+07',
    note: 'Bổ sung rau, STAFF tạo, ADMIN xác nhận',
    lines: [['RAU-001', 30, 20000], ['RAU-002', 20, 24000]],
  },
  {
    code: 'PN-20261124-001', supplier: 2, status: 'DRAFT', createdBy: 2,
    createdAt: '2026-11-24 09:00+07', note: 'Phiếu nháp của staff1',
    lines: [['THC-002', 10, 280000], ['THC-005', 10, 190000]],
  },
  {
    code: 'PN-20261124-002', supplier: 3, status: 'DRAFT', createdBy: 3,
    createdAt: '2026-11-24 10:00+07', note: 'Phiếu nháp của staff2',
    lines: [['DKH-005', 10, 98000]],
  },
];

const ISSUES: IssueDoc[] = [
  {
    code: 'PX-20261122-001', reason: 'SALE', status: 'CONFIRMED', createdBy: 2,
    createdAt: '2026-11-22 17:00+07', finalizedBy: 2, finalizedAt: '2026-11-22 17:15+07',
    note: 'Bán lẻ cuối ngày 22/11',
    lines: [['RAU-001', 35], ['TRC-002', 20], ['SUA-001', 50], ['SUA-003', 42], ['THC-001', 15]],
  },
  {
    code: 'PX-20261123-001', reason: 'SALE', status: 'CONFIRMED', createdBy: 3,
    createdAt: '2026-11-23 17:30+07', finalizedBy: 3, finalizedAt: '2026-11-23 17:45+07',
    note: 'Bán lẻ cuối ngày 23/11',
    lines: [['THC-002', 12], ['DKH-002', 35], ['TRC-005', 22], ['SUA-002', 30], ['RAU-002', 20]],
  },
  {
    code: 'PX-20261123-002', reason: 'DAMAGED', status: 'CONFIRMED', createdBy: 2,
    createdAt: '2026-11-23 18:00+07', finalizedBy: 1, finalizedAt: '2026-11-23 18:30+07',
    note: 'Hàng dập hỏng, STAFF tạo, ADMIN xác nhận',
    lines: [['TRC-004', 4], ['RAU-005', 30]],
  },
  {
    code: 'PX-20261124-001', reason: 'INTERNAL', status: 'CANCELLED', createdBy: 3,
    createdAt: '2026-11-24 11:00+07', finalizedBy: 3, finalizedAt: '2026-11-24 11:10+07',
    note: 'Xuất dùng nội bộ, đã hủy',
    lines: [['DKH-003', 5]],
  },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Không chạy seed trên production: seed xóa sạch dữ liệu.');
  }
  if (!process.env.DATABASE_URL) throw new Error('Thiếu DATABASE_URL trong file .env');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      TRUNCATE stock_issue_details, stock_issues, stock_receipt_details, stock_receipts,
               products, categories, suppliers, users, document_counters
      RESTART IDENTITY CASCADE
    `);

    const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    const staffHash = bcrypt.hashSync(STAFF_PASSWORD, 10);
    await client.query(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES
         ('Quản trị viên', 'admin@freshmart.vn', $1, 'ADMIN'),
         ('Nguyễn Văn An', 'staff1@freshmart.vn', $2, 'STAFF'),
         ('Trần Thị Bình', 'staff2@freshmart.vn', $2, 'STAFF')`,
      [adminHash, staffHash],
    );

    for (const name of CATEGORIES) {
      await client.query('INSERT INTO categories (name) VALUES ($1)', [name]);
    }
    for (const s of SUPPLIERS) {
      await client.query('INSERT INTO suppliers (name, phone, address) VALUES ($1, $2, $3)', [s.name, s.phone, s.address]);
    }

    const productId = new Map<string, number>();
    for (const [sku, name, categoryId, unit, price, minStock] of PRODUCTS) {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO products (sku, name, category_id, unit, price, min_stock)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [sku, name, categoryId, unit, price, minStock],
      );
      productId.set(sku, rows[0].id);
    }
    const pid = (sku: string): number => {
      const id = productId.get(sku);
      if (!id) throw new Error(`Seed sai: không có SKU ${sku}`);
      return id;
    };

    for (const r of RECEIPTS) {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO stock_receipts (code, supplier_id, status, note, created_by, created_at, finalized_by, finalized_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [r.code, r.supplier, r.status, r.note ?? null, r.createdBy, r.createdAt, r.finalizedBy ?? null, r.finalizedAt ?? null],
      );
      for (const [sku, qty, price] of r.lines) {
        await client.query(
          'INSERT INTO stock_receipt_details (receipt_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
          [rows[0].id, pid(sku), qty, price ?? 0],
        );
      }
    }
    for (const i of ISSUES) {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO stock_issues (code, reason, status, note, created_by, created_at, finalized_by, finalized_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [i.code, i.reason, i.status, i.note ?? null, i.createdBy, i.createdAt, i.finalizedBy ?? null, i.finalizedAt ?? null],
      );
      for (const [sku, qty] of i.lines) {
        await client.query(
          'INSERT INTO stock_issue_details (issue_id, product_id, quantity) VALUES ($1, $2, $3)',
          [rows[0].id, pid(sku), qty],
        );
      }
    }

    // Tồn kho = tổng nhập đã CONFIRMED - tổng xuất đã CONFIRMED (CHECK >= 0 trong DB tự chặn nếu seed sai)
    await client.query(`
      UPDATE products p SET quantity_in_stock =
          COALESCE((SELECT SUM(d.quantity) FROM stock_receipt_details d
                    JOIN stock_receipts r ON r.id = d.receipt_id
                    WHERE d.product_id = p.id AND r.status = 'CONFIRMED'), 0)
        - COALESCE((SELECT SUM(d.quantity) FROM stock_issue_details d
                    JOIN stock_issues i ON i.id = d.issue_id
                    WHERE d.product_id = p.id AND i.status = 'CONFIRMED'), 0)
    `);

    // Bộ đếm mã phải bằng số lớn nhất đã dùng, nếu không phiếu tạo mới sẽ trùng mã seed
    await client.query(`
      INSERT INTO document_counters (prefix, day, last_no)
      SELECT LEFT(code, 2), TO_DATE(SUBSTRING(code FROM 4 FOR 8), 'YYYYMMDD'), MAX(RIGHT(code, 3)::int)
      FROM (SELECT code FROM stock_receipts UNION ALL SELECT code FROM stock_issues) c
      GROUP BY 1, 2
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  const count = async (table: string) =>
    Number((await client.query<{ n: string }>(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);
  const lowStock = await client.query<{ sku: string; name: string; quantity_in_stock: number; min_stock: number }>(
    'SELECT sku, name, quantity_in_stock, min_stock FROM products WHERE quantity_in_stock <= min_stock ORDER BY sku',
  );
  console.log('Seed xong:');
  console.log(`  users ${await count('users')} · categories ${await count('categories')} · suppliers ${await count('suppliers')} · products ${await count('products')}`);
  console.log(`  phiếu nhập ${await count('stock_receipts')} · phiếu xuất ${await count('stock_issues')}`);
  console.log(`  sản phẩm tồn thấp: ${lowStock.rows.map((p) => `${p.sku} (${p.quantity_in_stock}/${p.min_stock})`).join(', ')}`);
  console.log('Tài khoản: admin@freshmart.vn / Admin@123 · staff1@freshmart.vn / Staff@123 · staff2@freshmart.vn / Staff@123');
  await client.end();
}

main().catch((err: unknown) => {
  console.error('Seed thất bại:', err instanceof Error ? err.message : err);
  process.exit(1);
});
