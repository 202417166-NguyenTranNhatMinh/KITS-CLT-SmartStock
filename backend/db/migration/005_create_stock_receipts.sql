CREATE TABLE stock_receipts (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code         VARCHAR(20)  NOT NULL,              -- PN-yyyyMMdd-xxx
    supplier_id  INTEGER      NOT NULL,
    status       VARCHAR(10)  NOT NULL DEFAULT 'DRAFT',
    note         VARCHAR(500),
    created_by   INTEGER      NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finalized_by INTEGER,                            -- người xác nhận HOẶC hủy, có thể khác người tạo
    finalized_at TIMESTAMPTZ,                        -- thời điểm xác nhận hoặc hủy

    CONSTRAINT uq_stock_receipts_code      UNIQUE (code),
    CONSTRAINT fk_stock_receipts_supplier  FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
    CONSTRAINT fk_stock_receipts_creator   FOREIGN KEY (created_by)  REFERENCES users (id)     ON DELETE RESTRICT,
    CONSTRAINT fk_stock_receipts_finalizer FOREIGN KEY (finalized_by) REFERENCES users (id)     ON DELETE RESTRICT,
    CONSTRAINT ck_stock_receipts_status    CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
    -- DRAFT: chưa ai chốt. CONFIRMED/CANCELLED: bắt buộc có người chốt + thời điểm
    CONSTRAINT ck_stock_receipts_finalized CHECK (
        (status = 'DRAFT') = (finalized_by IS NULL) AND
        (status = 'DRAFT') = (finalized_at IS NULL)
    )
);

CREATE TABLE stock_receipt_details (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    receipt_id INTEGER       NOT NULL,
    product_id INTEGER       NOT NULL,
    quantity   INTEGER       NOT NULL,
    unit_price NUMERIC(18,2) NOT NULL,

    CONSTRAINT fk_receipt_details_receipt  FOREIGN KEY (receipt_id) REFERENCES stock_receipts (id) ON DELETE CASCADE,
    CONSTRAINT fk_receipt_details_product  FOREIGN KEY (product_id) REFERENCES products (id)       ON DELETE RESTRICT,
    -- 1 sản phẩm chỉ xuất hiện 1 lần trong 1 phiếu
    CONSTRAINT uq_receipt_details_line     UNIQUE (receipt_id, product_id),
    CONSTRAINT ck_receipt_details_qty      CHECK (quantity > 0),
    CONSTRAINT ck_receipt_details_price    CHECK (unit_price >= 0)
);

-- Lịch sử tồn kho + báo cáo lọc theo sản phẩm và theo ngày
CREATE INDEX idx_receipt_details_product_id ON stock_receipt_details (product_id);
CREATE INDEX idx_stock_receipts_created_at  ON stock_receipts (created_at);
CREATE INDEX idx_stock_receipts_finalized_at ON stock_receipts (finalized_at);
