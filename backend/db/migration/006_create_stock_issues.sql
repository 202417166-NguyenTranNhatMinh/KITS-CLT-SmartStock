CREATE TABLE stock_issues (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code         VARCHAR(20)  NOT NULL,              -- PX-yyyyMMdd-xxx
    reason       VARCHAR(10)  NOT NULL,
    status       VARCHAR(10)  NOT NULL DEFAULT 'DRAFT',
    note         VARCHAR(500),
    created_by   INTEGER      NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finalized_by INTEGER,                            -- người xác nhận HOẶC hủy, có thể khác người tạo
    finalized_at TIMESTAMPTZ,                        -- thời điểm xác nhận hoặc hủy

    CONSTRAINT uq_stock_issues_code      UNIQUE (code),
    CONSTRAINT fk_stock_issues_creator   FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_stock_issues_finalizer FOREIGN KEY (finalized_by) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT ck_stock_issues_reason    CHECK (reason IN ('SALE', 'DAMAGED', 'INTERNAL')),
    CONSTRAINT ck_stock_issues_status    CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
    -- DRAFT: chưa ai chốt. CONFIRMED/CANCELLED: bắt buộc có người chốt + thời điểm
    CONSTRAINT ck_stock_issues_finalized CHECK (
        (status = 'DRAFT') = (finalized_by IS NULL) AND
        (status = 'DRAFT') = (finalized_at IS NULL)
    )
);

CREATE TABLE stock_issue_details (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    issue_id   INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity   INTEGER NOT NULL,

    CONSTRAINT fk_issue_details_issue    FOREIGN KEY (issue_id)   REFERENCES stock_issues (id) ON DELETE CASCADE,
    CONSTRAINT fk_issue_details_product  FOREIGN KEY (product_id) REFERENCES products (id)     ON DELETE RESTRICT,
    CONSTRAINT uq_issue_details_line     UNIQUE (issue_id, product_id),
    CONSTRAINT ck_issue_details_qty      CHECK (quantity > 0)
);

CREATE INDEX idx_issue_details_product_id   ON stock_issue_details (product_id);
CREATE INDEX idx_stock_issues_created_at    ON stock_issues (created_at);
CREATE INDEX idx_stock_issues_finalized_at  ON stock_issues (finalized_at);
