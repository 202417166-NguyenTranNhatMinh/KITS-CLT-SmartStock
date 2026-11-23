CREATE TABLE products (
    id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku               VARCHAR(50)   NOT NULL,
    name              VARCHAR(200)  NOT NULL,
    category_id       INTEGER       NOT NULL,
    unit              VARCHAR(20)   NOT NULL,
    price             NUMERIC(18,2) NOT NULL,
    quantity_in_stock INTEGER       NOT NULL DEFAULT 0,
    min_stock         INTEGER       NOT NULL DEFAULT 0,
    is_active         BOOLEAN       NOT NULL DEFAULT TRUE,

    CONSTRAINT uq_products_sku         UNIQUE (sku),
    CONSTRAINT fk_products_category    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
    CONSTRAINT ck_products_price       CHECK (price >= 0),
    CONSTRAINT ck_products_min_stock   CHECK (min_stock >= 0),
    -- Lưới an toàn cuối cùng: code có bug thì DB vẫn không cho tồn âm
    CONSTRAINT ck_products_stock       CHECK (quantity_in_stock >= 0)
);

CREATE INDEX idx_products_category_id ON products (category_id);
