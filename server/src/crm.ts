import type { PoolConnection, ResultSetHeader } from "mysql2/promise";

/**
 * Логика CRM (C++ бэкенд, backend/main.cpp), которую маркет повторяет на общей базе.
 * Держим 1:1 с бэкендом: CRM должна видеть веб-заказы так же, как свои.
 */

/** Пайплайн CRM: new → warehouse → ready → completed. Легаси-статусы нормализуем (order_status_sql). */
export const ORDER_STATUS_SQL = `CASE
  WHEN o.status IN ('canceled','cancelled') THEN 'canceled'
  WHEN o.status IN ('completed','shipped','debt') THEN 'completed'
  WHEN o.status IN ('new','warehouse','ready','partially_returned','returned') THEN o.status
  WHEN o.status IN ('draft','pending','awaiting_confirmation') THEN 'new'
  WHEN o.status IN ('reserved','assembling','paid','partially_paid') AND EXISTS (
    SELECT 1 FROM reservations r JOIN order_items oi ON oi.id=r.order_item_id WHERE oi.order_id=o.id
  ) THEN 'warehouse'
  WHEN o.status IN ('paid','partially_paid','unpaid') AND NOT EXISTS (
    SELECT 1 FROM reservations r JOIN order_items oi ON oi.id=r.order_item_id WHERE oi.order_id=o.id
  ) THEN 'completed'
  WHEN o.status IN ('reserved','assembling') THEN 'new'
  ELSE o.status END`;

/** Продажа — отгруженный заказ (в т.ч. с возвратом), как sales_total в ИИ-контексте CRM. */
export const SOLD_STATUS_FILTER = `(${ORDER_STATUS_SQL}) IN ('completed','partially_returned','returned')`;

/** Сальдо заказа по журналу: начисление при отгрузке − оплаты − возвраты (order_ledger_sql). */
export const ORDER_LEDGER_SQL = `(SELECT COALESCE(SUM(CASE
  WHEN ol.entry_type IN ('charge','adjustment_debit') THEN ol.amount
  WHEN ol.entry_type IN ('payment','refund','adjustment_credit') THEN -ol.amount
  ELSE 0 END),0) FROM customer_ledger ol WHERE ol.order_id=o.id)`;

/** Долг заказа: появляется только после отгрузки (order_debt_sql). */
export const ORDER_DEBT_SQL = `GREATEST(${ORDER_LEDGER_SQL},0)`;

/** Категория товара: справочник product_categories, старая текстовая колонка — запасной вариант. */
export const CATEGORY_SQL = "COALESCE(pc.title, p.category)";
export const CATEGORY_JOIN = "LEFT JOIN product_categories pc ON pc.id = p.category_id";

export const CLOSED_STATUSES = ["completed", "canceled", "cancelled", "shipped", "partially_returned", "returned"];

async function cq<T = any>(conn: PoolConnection, sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await conn.query(sql, params);
  return rows as T[];
}

async function insertId(conn: PoolConnection, sql: string, params: unknown[]) {
  const [result] = await conn.query(sql, params);
  return (result as ResultSetHeader).insertId;
}

export async function timeline(
  conn: PoolConnection,
  orderId: number,
  eventType: string,
  description: string,
  userId: number,
  metadata: unknown = {},
) {
  await conn.query(
    `INSERT INTO order_timeline (order_id, event_type, description, metadata, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [orderId, eventType, description, JSON.stringify(metadata), userId],
  );
}

/** Статус заказа под блокировкой; закрытые заказы менять нельзя (lock_order_for_change). */
async function lockOrder(conn: PoolConnection, orderId: number): Promise<string> {
  const rows = await cq(conn, "SELECT status FROM orders WHERE id = ? FOR UPDATE", [orderId]);
  if (!rows.length) throw new Error("Заказ не найден");
  const status = String(rows[0].status);
  if (CLOSED_STATUSES.includes(status)) throw new Error("Заказ уже закрыт");
  return status;
}

/** Пересчёт статуса пачки после снятия резерва или списания (refresh_pack_status). */
async function refreshPackStatus(conn: PoolConnection, packId: number) {
  const [row] = await cq(
    conn,
    `SELECT COALESCE(SUM(available_qty + reserved_qty), 0) AS total_left,
            SUM(available_qty <> initial_qty OR reserved_qty <> 0) AS changed,
            SUM(reserved_qty > 0) AS reserved_items
     FROM pack_items WHERE pack_id = ?`,
    [packId],
  );
  const [pack] = await cq(conn, "SELECT status FROM packs WHERE id = ?", [packId]);
  // пачка целиком под заказом, резерв ещё не снят — статус ведёт заказ
  if (pack?.status === "reserved" && Number(row.reserved_items) > 0) return;
  const status = Number(row.total_left) === 0 ? "sold" : Number(row.changed) === 0 ? "full" : "open";
  await conn.query("UPDATE packs SET status = ? WHERE id = ?", [status, packId]);
}

interface ItemSpec {
  variant_id: number;
  sale_type: string;
  qty: number;
  price: number;
  size_id: number | null;
  color: string | null;
}

/** Резерв одной полной пачки под позицию (reserve_pack). */
async function reservePack(conn: PoolConnection, orderId: number, spec: ItemSpec, userId: number) {
  const packs = await cq(
    conn,
    "SELECT id FROM packs WHERE variant_id = ? AND status = 'full' ORDER BY id LIMIT 1 FOR UPDATE",
    [spec.variant_id],
  );
  if (!packs.length) throw new Error("Нет свободной полной пачки");
  const packId = Number(packs[0].id);
  const itemId = await insertId(
    conn,
    `INSERT INTO order_items (order_id, variant_id, pack_id, sale_type, qty, price, color)
     VALUES (?, ?, ?, 'pack', 1, ?, ?)`,
    [orderId, spec.variant_id, packId, spec.price, spec.color],
  );
  await conn.query("UPDATE packs SET status = 'reserved' WHERE id = ?", [packId]);
  const packItems = await cq(conn, "SELECT id, available_qty FROM pack_items WHERE pack_id = ? FOR UPDATE", [packId]);
  for (const pi of packItems) {
    const qty = Number(pi.available_qty);
    await conn.query("UPDATE pack_items SET reserved_qty = reserved_qty + ? WHERE id = ?", [qty, pi.id]);
    await conn.query("INSERT INTO reservations (order_item_id, pack_item_id, qty) VALUES (?, ?, ?)", [itemId, pi.id, qty]);
    await conn.query(
      `INSERT INTO stock_movements (movement_type, pack_item_id, qty, document_type, document_id, created_by)
       VALUES ('reserve', ?, ?, 'order', ?, ?)`,
      [pi.id, qty, orderId, userId],
    );
  }
}

/** Поштучный резерв из открытых пачек (reserve_units). */
async function reserveUnits(conn: PoolConnection, orderId: number, spec: ItemSpec, userId: number) {
  let remaining = spec.qty;
  while (remaining > 0) {
    const rows = await cq(
      conn,
      `SELECT pi.id AS pack_item_id, pi.pack_id, (pi.available_qty - pi.reserved_qty) AS can_take
       FROM pack_items pi JOIN packs pk ON pk.id = pi.pack_id
       WHERE pk.variant_id = ? AND pi.size_id = ? AND pk.status IN ('open','full')
         AND (pi.available_qty - pi.reserved_qty) > 0
       ORDER BY CASE WHEN pk.status = 'open' THEN 0 ELSE 1 END, pk.id LIMIT 1 FOR UPDATE`,
      [spec.variant_id, spec.size_id],
    );
    if (!rows.length) throw new Error("Недостаточно единиц на складе");
    const take = Math.min(remaining, Number(rows[0].can_take));
    const itemId = await insertId(
      conn,
      `INSERT INTO order_items (order_id, variant_id, pack_id, size_id, sale_type, qty, price, color)
       VALUES (?, ?, ?, ?, 'unit', ?, ?, ?)`,
      [orderId, spec.variant_id, rows[0].pack_id, spec.size_id, take, spec.price, spec.color],
    );
    await conn.query("UPDATE packs SET status = 'open' WHERE id = ? AND status = 'full'", [rows[0].pack_id]);
    await conn.query("UPDATE pack_items SET reserved_qty = reserved_qty + ? WHERE id = ?", [take, rows[0].pack_item_id]);
    await conn.query("INSERT INTO reservations (order_item_id, pack_item_id, qty) VALUES (?, ?, ?)", [
      itemId,
      rows[0].pack_item_id,
      take,
    ]);
    await conn.query(
      `INSERT INTO stock_movements (movement_type, pack_item_id, qty, document_type, document_id, created_by)
       VALUES ('reserve', ?, ?, 'order', ?, ?)`,
      [rows[0].pack_item_id, take, orderId, userId],
    );
    remaining -= take;
  }
}

/** Передать новый заказ на склад: позиции-черновики превращаются в резервы (send_order_to_warehouse). */
export async function sendToWarehouse(conn: PoolConnection, orderId: number, userId: number) {
  const status = await lockOrder(conn, orderId);
  if (status === "warehouse" || status === "ready") return;
  const [{ reserved }] = await cq(
    conn,
    `SELECT COUNT(*) AS reserved FROM reservations r
     JOIN order_items oi ON oi.id = r.order_item_id WHERE oi.order_id = ?`,
    [orderId],
  );
  if (Number(reserved) > 0) {
    await conn.query("UPDATE orders SET status = 'warehouse' WHERE id = ?", [orderId]);
    await conn.query("UPDATE order_items SET picked = 0 WHERE order_id = ?", [orderId]);
  } else {
    const specs = await cq<ItemSpec>(
      conn,
      "SELECT variant_id, sale_type, qty, price, size_id, color FROM order_items WHERE order_id = ? ORDER BY id",
      [orderId],
    );
    if (!specs.length) throw new Error("В заказе нет позиций");
    await conn.query("DELETE FROM order_items WHERE order_id = ?", [orderId]);
    for (const spec of specs) {
      if (spec.sale_type === "pack") {
        for (let i = 0; i < Number(spec.qty); i++) await reservePack(conn, orderId, spec, userId);
      } else {
        await reserveUnits(conn, orderId, spec, userId);
      }
    }
    await conn.query("UPDATE orders SET status = 'warehouse' WHERE id = ?", [orderId]);
  }
  await timeline(conn, orderId, "status_changed", "Заказ передан на склад", userId);
}

async function orderReservations(conn: PoolConnection, orderId: number) {
  return cq(
    conn,
    `SELECT r.pack_item_id, r.qty, pi.pack_id
     FROM reservations r
     JOIN order_items oi ON oi.id = r.order_item_id
     JOIN pack_items pi ON pi.id = r.pack_item_id
     WHERE oi.order_id = ? FOR UPDATE`,
    [orderId],
  );
}

/** Отмена: резерв возвращается в доступный остаток (cancel_order). */
export async function cancelOrder(conn: PoolConnection, orderId: number, reason: string, userId: number) {
  await lockOrder(conn, orderId);
  const packIds = new Set<number>();
  for (const r of await orderReservations(conn, orderId)) {
    const [res] = await conn.query(
      "UPDATE pack_items SET reserved_qty = reserved_qty - ? WHERE id = ? AND reserved_qty >= ?",
      [r.qty, r.pack_item_id, r.qty],
    );
    if ((res as ResultSetHeader).affectedRows !== 1) throw new Error("Резерв изменился, обновите заказ");
    await conn.query(
      `INSERT INTO stock_movements (movement_type, pack_item_id, qty, document_type, document_id, reason, created_by)
       VALUES ('cancel_reserve', ?, ?, 'order', ?, ?, ?)`,
      [r.pack_item_id, -Number(r.qty), orderId, reason, userId],
    );
    packIds.add(Number(r.pack_id));
  }
  await conn.query(
    "DELETE r FROM reservations r JOIN order_items oi ON oi.id = r.order_item_id WHERE oi.order_id = ?",
    [orderId],
  );
  for (const packId of packIds) await refreshPackStatus(conn, packId);
  await conn.query("UPDATE orders SET status = 'canceled' WHERE id = ?", [orderId]);
  await timeline(conn, orderId, "canceled", `Заказ отменен: ${reason}`, userId);
}

/** Отгрузка собранного заказа: списание резерва и начисление долга (complete_order). */
export async function completeOrder(conn: PoolConnection, orderId: number, userId: number) {
  const status = await lockOrder(conn, orderId);
  if (status !== "ready") throw new Error("Отгрузить можно только собранный заказ (статус «К отгрузке»)");
  const rows = await orderReservations(conn, orderId);
  if (!rows.length) throw new Error("В заказе нет зарезервированных позиций");
  const packIds = new Set<number>();
  for (const r of rows) {
    const [res] = await conn.query(
      `UPDATE pack_items SET available_qty = available_qty - ?, reserved_qty = reserved_qty - ?
       WHERE id = ? AND available_qty >= ? AND reserved_qty >= ?`,
      [r.qty, r.qty, r.pack_item_id, r.qty, r.qty],
    );
    if ((res as ResultSetHeader).affectedRows !== 1) throw new Error("Резерв изменился, обновите заказ");
    await conn.query(
      `INSERT INTO stock_movements (movement_type, pack_item_id, qty, document_type, document_id, created_by)
       VALUES ('sale', ?, ?, 'order', ?, ?)`,
      [r.pack_item_id, -Number(r.qty), orderId, userId],
    );
    packIds.add(Number(r.pack_id));
  }
  await conn.query(
    "DELETE r FROM reservations r JOIN order_items oi ON oi.id = r.order_item_id WHERE oi.order_id = ?",
    [orderId],
  );
  for (const packId of packIds) await refreshPackStatus(conn, packId);
  await conn.query(
    `INSERT INTO customer_ledger (customer_id, order_id, entry_type, amount, created_by)
     SELECT customer_id, id, 'charge', total_sum, ? FROM orders WHERE id = ?`,
    [userId, orderId],
  );
  await conn.query("UPDATE orders SET status = 'completed' WHERE id = ?", [orderId]);
  await timeline(conn, orderId, "completed", "Заказ завершен, товар списан со склада", userId);
}
