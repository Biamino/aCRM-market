-- Разделение аккаунтов маркета: crm_v1 (asdem.shop) → crm_dordoi (asdem-pijamy.shop).
-- Запускать ПОСЛЕ `npm run db:schema` с pijamy.env (он создаёт web_accounts и т.п. в crm_dordoi)
-- и при остановленных обоих экземплярах маркета. Бэкап crm_v1.web_* — до запуска.
-- id аккаунтов сохраняем: JWT и привязки ссылаются на них.

START TRANSACTION;

INSERT INTO crm_dordoi.web_price_groups (id, name, multiplier)
SELECT id, name, multiplier FROM crm_v1.web_price_groups
ON DUPLICATE KEY UPDATE name = VALUES(name), multiplier = VALUES(multiplier);

-- Все аккаунты (админы и клиенты) получают доступ ко второму сайту с тем же паролем.
-- Если клиентов надо пускать только туда, где у них есть привязка CRM, добавить:
--   WHERE role = 'ADMIN' OR id IN (SELECT account_id FROM crm_v1.web_account_customers WHERE branch = 'asdem2')
-- discount_percent — персональная скидка клиента, переносим как есть
INSERT INTO crm_dordoi.web_accounts
    (id, customer_id, email, password_hash, name, company, phone, role, status, price_group_id, discount_percent, created_at)
SELECT id, NULL, email, password_hash, name, company, phone, role, status, price_group_id, discount_percent, created_at
FROM crm_v1.web_accounts;

INSERT INTO crm_dordoi.web_account_customers (account_id, branch, customer_id, created_at)
SELECT account_id, branch, customer_id, created_at
FROM crm_v1.web_account_customers WHERE branch = 'asdem2';

DELETE FROM crm_v1.web_account_customers WHERE branch = 'asdem2';

COMMIT;

-- Проверка
SELECT 'crm_v1' AS db, COUNT(*) FROM crm_v1.web_accounts
UNION ALL SELECT 'crm_dordoi', COUNT(*) FROM crm_dordoi.web_accounts;
SELECT * FROM crm_dordoi.web_account_customers;
