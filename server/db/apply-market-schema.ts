import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { one, pool } from "../src/db.js";

const dir = dirname(fileURLToPath(import.meta.url));

/** Применяет market_schema.sql и одноразовый бэкафилл витрины. Пул не закрывает. */
export async function applyMarketSchema() {
  const sql = readFileSync(join(dir, "market_schema.sql"), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    await pool.query(statement);
  }

  // Карточки, которые уже были в web_product_details, оставляем на витрине,
  // чтобы демо/сид не пропал после одного только db:schema.
  const flag = await one("SELECT v FROM web_settings WHERE k = 'visibility_migrated'");
  if (!flag) {
    await pool.query("UPDATE web_product_details SET is_visible = 1");
    await pool.query(
      "INSERT INTO web_settings (k, v) VALUES ('visibility_migrated', '1') ON DUPLICATE KEY UPDATE v = VALUES(v)",
    );
  }

  // CRM перешла на пайплайн new → warehouse → ready → completed и долг считает по
  // customer_ledger ('charge' при отгрузке). Переводим старые веб-заказы в её термины.
  const pipeline = await one("SELECT v FROM web_settings WHERE k = 'crm_pipeline_migrated'");
  if (!pipeline) {
    const hasReservation = `EXISTS (SELECT 1 FROM reservations r JOIN order_items oi ON oi.id = r.order_item_id
                                    WHERE oi.order_id = orders.id)`;
    await pool.query(`UPDATE orders SET status = 'warehouse' WHERE status = 'awaiting_confirmation' AND ${hasReservation}`);
    await pool.query("UPDATE orders SET status = 'new' WHERE status = 'awaiting_confirmation'");
    // отгрузка из старой админки маркета писала 'debt' на остаток долга — в CRM это 'charge' на сумму заказа
    await pool.query(
      `UPDATE customer_ledger l JOIN orders o ON o.id = l.order_id
       SET l.entry_type = 'charge', l.amount = o.total_sum
       WHERE l.entry_type = 'debt' AND l.comment = 'Отгрузка веб-заказа'`,
    );
    await pool.query(
      "INSERT INTO web_settings (k, v) VALUES ('crm_pipeline_migrated', '1') ON DUPLICATE KEY UPDATE v = VALUES(v)",
    );
  }

  console.log(`Применено ${statements.length} SQL-выражений (web_* таблицы).`);
}
