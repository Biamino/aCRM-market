-- Расширение общей базы crm_v1 для B2B-маркета.
-- Таблицы CRM (products, orders, packs, ...) маркет не меняет — только добавляет web_*.

-- Совместимость со свежей CRM: те же колонки и таблицы, что C++ бэкенд создаёт
-- сам при первом обращении (ensure_* в main.cpp, database_update_*.sql).
-- Всё идемпотентно — на базе, где CRM уже запускалась, ничего не меняется.
CREATE TABLE IF NOT EXISTS product_categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(120) NOT NULL UNIQUE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS category_id BIGINT NULL AFTER sku,
    ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 0 AFTER wholesale_price;
CREATE TABLE IF NOT EXISTS product_colors (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id BIGINT NOT NULL,
    color VARCHAR(80) NOT NULL,
    color_hex VARCHAR(7) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_product_color (product_id, color)
);
ALTER TABLE product_colors
    ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7) NULL AFTER color;
CREATE TABLE IF NOT EXISTS product_photos (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id BIGINT NOT NULL,
    filename VARCHAR(180) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    UNIQUE KEY uq_product_photo_file (filename)
);
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS picked TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS color VARCHAR(80) NULL;
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS discount_sum DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER total_sum;
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
INSERT IGNORE INTO product_categories (title) VALUES ('other');
INSERT IGNORE INTO sizes (title, sort_order) VALUES
    ('XXS', 1), ('XS', 5), ('S', 10), ('M', 20), ('L', 30), ('XL', 40), ('XXL', 50), ('XXXL', 60), ('ONE', 70);

CREATE TABLE IF NOT EXISTS web_price_groups (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(80) NOT NULL UNIQUE,
    multiplier DECIMAL(6,3) NOT NULL DEFAULT 1.0
);

-- Аккаунты закрытого B2B-сайта. Связаны с клиентами CRM (customers).
CREATE TABLE IF NOT EXISTS web_accounts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(160) NOT NULL,
    company VARCHAR(180),
    phone VARCHAR(80),
    role VARCHAR(16) NOT NULL DEFAULT 'CLIENT', -- CLIENT | ADMIN
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED
    price_group_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (price_group_id) REFERENCES web_price_groups(id)
);

-- Расширенная карточка товара (ТЗ 6.4) поверх products.
-- is_visible — витрина маркета (opt-in). Таблицы CRM не меняются.
CREATE TABLE IF NOT EXISTS web_product_details (
    product_id BIGINT PRIMARY KEY,
    image_url VARCHAR(512),
    fabric VARCHAR(160),
    composition VARCHAR(255),
    season VARCHAR(80),
    country VARCHAR(80),
    fit_notes VARCHAR(255),
    staff_comment TEXT,
    web_description TEXT,
    is_visible BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Фото витрины: файлы на диске маркета, в БД только путь.
-- В CRM остаток общий на модель, а цвет живёт в product_colors, поэтому фото
-- привязаны к (product_id, color). variant_id — наследие старой схемы «цвет = вариант».
CREATE TABLE IF NOT EXISTS web_product_images (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id BIGINT NULL,
    color VARCHAR(80) NULL,
    variant_id BIGINT NULL,
    file_path VARCHAR(512) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    INDEX idx_web_product_images_variant (variant_id, sort_order)
);
ALTER TABLE web_product_images
    ADD COLUMN IF NOT EXISTS product_id BIGINT NULL AFTER id,
    ADD COLUMN IF NOT EXISTS color VARCHAR(80) NULL AFTER product_id;
ALTER TABLE web_product_images
    MODIFY variant_id BIGINT NULL;
UPDATE web_product_images i
    JOIN product_variants v ON v.id = i.variant_id
    SET i.product_id = v.product_id, i.color = v.color
    WHERE i.product_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_web_product_images_product
    ON web_product_images (product_id, color, sort_order);

-- Миграции для уже существующей web_product_details (CREATE IF NOT EXISTS колонку не добавит).
ALTER TABLE web_product_details
    ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE web_product_details
    MODIFY image_url VARCHAR(512);

CREATE TABLE IF NOT EXISTS web_settings (
    k VARCHAR(80) PRIMARY KEY,
    v VARCHAR(255) NOT NULL
);

-- Позиции реализации: в CRM-схеме есть только заголовок consignments.
CREATE TABLE IF NOT EXISTS web_consignment_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    consignment_id BIGINT NOT NULL,
    variant_id BIGINT NOT NULL,
    qty INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (consignment_id) REFERENCES consignments(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id)
);

INSERT IGNORE INTO web_price_groups (id, name, multiplier) VALUES
    (1, 'Стандарт', 1.000),
    (2, 'Опт+', 0.950),
    (3, 'VIP', 0.900);

INSERT IGNORE INTO web_settings (k, v) VALUES ('staleDays', '30');
