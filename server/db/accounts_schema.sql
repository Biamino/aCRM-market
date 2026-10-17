-- Аккаунты B2B-маркета, общие для всех филиалов (база ACCOUNTS_DB_NAME,
-- по умолчанию — база первого филиала).

CREATE TABLE IF NOT EXISTS web_price_groups (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(80) NOT NULL UNIQUE,
    multiplier DECIMAL(6,3) NOT NULL DEFAULT 1.0
);

-- Аккаунты закрытого B2B-сайта. customer_id — наследие одного филиала,
-- связь с клиентами CRM теперь в web_account_customers.
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
    FOREIGN KEY (price_group_id) REFERENCES web_price_groups(id)
);

-- Карточка клиента (customers.id) аккаунта в CRM каждого филиала.
-- Появляется при первом заказе в филиале.
CREATE TABLE IF NOT EXISTS web_account_customers (
    account_id BIGINT NOT NULL,
    branch VARCHAR(40) NOT NULL,
    customer_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (account_id, branch),
    UNIQUE KEY uq_branch_customer (branch, customer_id),
    FOREIGN KEY (account_id) REFERENCES web_accounts(id) ON DELETE CASCADE
);

INSERT IGNORE INTO web_price_groups (id, name, multiplier) VALUES
    (1, 'Стандарт', 1.000),
    (2, 'Опт+', 0.950),
    (3, 'VIP', 0.900);
