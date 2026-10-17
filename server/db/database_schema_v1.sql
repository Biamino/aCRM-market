CREATE TABLE IF NOT EXISTS roles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(32) NOT NULL UNIQUE,
    title VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_id BIGINT NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    login VARCHAR(80) NOT NULL UNIQUE,
    password_salt VARCHAR(64) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS permissions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_id BIGINT NOT NULL,
    module VARCHAR(80) NOT NULL,
    action VARCHAR(80) NOT NULL,
    is_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    UNIQUE KEY uq_permission (role_id, module, action)
);

CREATE TABLE IF NOT EXISTS sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    token VARCHAR(80) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS suppliers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(180) NOT NULL,
    phone VARCHAR(80),
    country VARCHAR(80),
    city VARCHAR(80),
    comment TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(120) NOT NULL UNIQUE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    sku VARCHAR(80) NOT NULL UNIQUE,
    category_id BIGINT,
    category VARCHAR(80) NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT,
    supplier_id BIGINT,
    purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    wholesale_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    quantity INT NOT NULL DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES product_categories(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS product_colors (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id BIGINT NOT NULL,
    color VARCHAR(80) NOT NULL,
    color_hex VARCHAR(7) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    UNIQUE KEY uq_product_color (product_id, color)
);

CREATE TABLE IF NOT EXISTS product_variants (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id BIGINT NOT NULL,
    color VARCHAR(80) NOT NULL,
    package_set VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS product_photos (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id BIGINT NOT NULL,
    filename VARCHAR(180) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    UNIQUE KEY uq_product_photo_file (filename)
);

CREATE TABLE IF NOT EXISTS sizes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(40) NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pack_templates (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    variant_id BIGINT NOT NULL,
    size_id BIGINT NOT NULL,
    qty INT NOT NULL,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (size_id) REFERENCES sizes(id),
    UNIQUE KEY uq_pack_template (variant_id, size_id)
);

CREATE TABLE IF NOT EXISTS receipts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    supplier_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'confirmed',
    total_sum DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS packs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    variant_id BIGINT NOT NULL,
    receipt_id BIGINT,
    status VARCHAR(32) NOT NULL DEFAULT 'full',
    barcode VARCHAR(80) UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (receipt_id) REFERENCES receipts(id)
);

CREATE TABLE IF NOT EXISTS pack_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    pack_id BIGINT NOT NULL,
    size_id BIGINT NOT NULL,
    initial_qty INT NOT NULL,
    available_qty INT NOT NULL,
    reserved_qty INT NOT NULL DEFAULT 0,
    FOREIGN KEY (pack_id) REFERENCES packs(id),
    FOREIGN KEY (size_id) REFERENCES sizes(id),
    UNIQUE KEY uq_pack_size (pack_id, size_id)
);

CREATE TABLE IF NOT EXISTS customers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(180) NOT NULL,
    company VARCHAR(180),
    country VARCHAR(80),
    city VARCHAR(80),
    address TEXT,
    note TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_contacts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,
    contact_type VARCHAR(40) NOT NULL,
    value VARCHAR(160) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    UNIQUE KEY uq_customer_contact (contact_type, value)
);

CREATE TABLE IF NOT EXISTS orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'new',
    total_sum DECIMAL(12,2) NOT NULL DEFAULT 0,
    paid_sum DECIMAL(12,2) NOT NULL DEFAULT 0,
    debt_due DATE NULL,
    comment TEXT,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    variant_id BIGINT NOT NULL,
    pack_id BIGINT,
    size_id BIGINT,
    sale_type VARCHAR(16) NOT NULL,
    qty INT NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0,
    picked TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (pack_id) REFERENCES packs(id),
    FOREIGN KEY (size_id) REFERENCES sizes(id)
);

CREATE TABLE IF NOT EXISTS reservations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_item_id BIGINT NOT NULL,
    pack_item_id BIGINT,
    qty INT NOT NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_item_id) REFERENCES order_items(id),
    FOREIGN KEY (pack_item_id) REFERENCES pack_items(id)
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    method VARCHAR(40) NOT NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS customer_ledger (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,
    order_id BIGINT,
    entry_type VARCHAR(40) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    comment TEXT,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_timeline (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    description TEXT,
    metadata JSON,
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_order_timeline_order (order_id, created_at)
);

CREATE TABLE IF NOT EXISTS consignments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'issued',
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    created_by BIGINT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS returns (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT,
    reason TEXT NOT NULL,
    refund_sum DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS return_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    return_id BIGINT NOT NULL,
    order_item_id BIGINT NOT NULL,
    pack_id BIGINT,
    size_id BIGINT,
    qty INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    is_good BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (return_id) REFERENCES returns(id),
    FOREIGN KEY (order_item_id) REFERENCES order_items(id),
    FOREIGN KEY (pack_id) REFERENCES packs(id),
    FOREIGN KEY (size_id) REFERENCES sizes(id)
);

CREATE TABLE IF NOT EXISTS inventory_counts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    reason TEXT,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inventory_count_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    inventory_count_id BIGINT NOT NULL,
    pack_item_id BIGINT NOT NULL,
    expected_available_qty INT NOT NULL,
    actual_available_qty INT NOT NULL,
    adjustment_qty INT NOT NULL,
    FOREIGN KEY (inventory_count_id) REFERENCES inventory_counts(id),
    FOREIGN KEY (pack_item_id) REFERENCES pack_items(id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    movement_type VARCHAR(40) NOT NULL,
    pack_item_id BIGINT,
    qty INT NOT NULL,
    document_type VARCHAR(40) NOT NULL,
    document_id BIGINT NOT NULL,
    reason TEXT,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pack_item_id) REFERENCES pack_items(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    KEY idx_stock_movements_pack_item (pack_item_id),
    KEY idx_stock_movements_document (document_type, document_id),
    KEY idx_stock_movements_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT,
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id BIGINT,
    old_value JSON,
    new_value JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS attachments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    entity_type VARCHAR(80) NOT NULL,
    entity_id BIGINT NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    uploaded_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

INSERT IGNORE INTO roles (id, code, title) VALUES
    (1, 'owner', 'Владелец'),
    (2, 'admin', 'Администратор'),
    (3, 'employee', 'Сотрудник');

INSERT IGNORE INTO sizes (title, sort_order) VALUES
    ('XXS', 1),
    ('XS', 5),
    ('S', 10),
    ('M', 20),
    ('L', 30),
    ('XL', 40),
    ('XXL', 50),
    ('XXXL', 60),
    ('ONE', 70);

INSERT IGNORE INTO product_categories (title) VALUES
    ('other');

-- Ниже — таблицы и колонки, которые C++ бэкенд использует, но в его schema-файле их нет
-- (импорт из Microinvest, история заказов). Синхронизировано с aCRM/backend.

CREATE TABLE IF NOT EXISTS import_batches (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(180) NOT NULL,
    source_dir VARCHAR(255) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'loaded',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_raw_rows (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_id BIGINT NOT NULL,
    source_file VARCHAR(255) NOT NULL,
    sheet_name VARCHAR(180) NOT NULL,
    row_number INT NOT NULL,
    detected_header_row INT NOT NULL,
    raw_json LONGTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES import_batches(id),
    INDEX idx_import_raw_batch (batch_id),
    INDEX idx_import_raw_source (source_file, sheet_name, row_number)
);

CREATE TABLE IF NOT EXISTS import_errors (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_id BIGINT NOT NULL,
    source_file VARCHAR(255),
    sheet_name VARCHAR(180),
    row_number INT,
    error_type VARCHAR(80) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES import_batches(id),
    INDEX idx_import_errors_batch (batch_id)
);

CREATE TABLE IF NOT EXISTS legacy_documents (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_id BIGINT NOT NULL,
    doc_type VARCHAR(40) NOT NULL,
    source_file VARCHAR(255) NOT NULL,
    sheet_name VARCHAR(180) NOT NULL,
    source_document_no VARCHAR(80) NOT NULL,
    source_date DATE,
    partner_name VARCHAR(180),
    partner_kind VARCHAR(40),
    customer_id BIGINT,
    supplier_id BIGINT,
    operation VARCHAR(80),
    total_sum DECIMAL(12,2) NOT NULL DEFAULT 0,
    rows_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES import_batches(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    UNIQUE KEY uq_legacy_document (batch_id, doc_type, source_document_no, source_date, partner_name),
    INDEX idx_legacy_documents_batch (batch_id),
    INDEX idx_legacy_documents_type (doc_type)
);

CREATE TABLE IF NOT EXISTS legacy_document_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    legacy_document_id BIGINT NOT NULL,
    row_number INT NOT NULL,
    sku VARCHAR(80),
    product_id BIGINT,
    title VARCHAR(180),
    category VARCHAR(80),
    qty DECIMAL(12,3) NOT NULL DEFAULT 0,
    unit VARCHAR(40),
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_sum DECIMAL(12,2) NOT NULL DEFAULT 0,
    raw_json LONGTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (legacy_document_id) REFERENCES legacy_documents(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_legacy_items_document (legacy_document_id),
    INDEX idx_legacy_items_sku (sku)
);

INSERT IGNORE INTO roles (id, code, title) VALUES
    (1, 'owner', 'Владелец'),
    (2, 'admin', 'Администратор'),
    (3, 'employee', 'Сотрудник');

ALTER TABLE receipts
    ADD COLUMN IF NOT EXISTS source_document_no VARCHAR(80),
    ADD COLUMN IF NOT EXISTS source_date DATE,
    ADD COLUMN IF NOT EXISTS source_batch_id BIGINT;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS source_document_no VARCHAR(80),
    ADD COLUMN IF NOT EXISTS source_date DATE,
    ADD COLUMN IF NOT EXISTS source_batch_id BIGINT;

ALTER TABLE receipts
    ADD UNIQUE INDEX IF NOT EXISTS uq_receipt_source (source_batch_id, source_document_no);

ALTER TABLE orders
    ADD UNIQUE INDEX IF NOT EXISTS uq_order_source (source_batch_id, source_document_no);
