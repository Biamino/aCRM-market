import { Router } from "express";
import { exec, num, one, q, tx } from "../db.js";
import { cancelOrder, completeOrder, ORDER_STATUS_SQL, sendToWarehouse } from "../crm.js";
import { requireAdmin } from "../auth.js";
import { loadItems, serializeOrder, webServiceUserId } from "./orders.js";
import { adminProductsRouter } from "./admin-products.js";

export const adminRouter = Router();

adminRouter.use(requireAdmin);
adminRouter.use(adminProductsRouter);

// заявки на регистрацию (web_accounts поверх customers)
adminRouter.get("/registrations", async (_req, res) => {
  const users = await q(
    `SELECT a.id, a.email, a.name, a.company, a.phone, a.status, a.created_at, g.name AS price_group
     FROM web_accounts a
     LEFT JOIN web_price_groups g ON g.id = a.price_group_id
     WHERE a.role = 'CLIENT'
     ORDER BY (a.status = 'PENDING') DESC, a.created_at DESC`,
  );
  res.json({
    users: users.map((u) => ({
      id: Number(u.id),
      email: u.email,
      name: u.name,
      company: u.company,
      phone: u.phone,
      status: u.status,
      priceGroup: u.price_group,
      createdAt: u.created_at,
    })),
  });
});

// одобрение: создаёт карточку клиента в общей CRM-базе и привязывает аккаунт
adminRouter.post("/registrations/:id/approve", async (req, res) => {
  try {
    const { priceGroupId } = req.body ?? {};
    const account = await one("SELECT * FROM web_accounts WHERE id = ?", [Number(req.params.id)]);
    if (!account) return res.status(404).json({ error: "Заявка не найдена" });
    if (priceGroupId) {
      const group = await one("SELECT id FROM web_price_groups WHERE id = ?", [Number(priceGroupId)]);
      if (!group) return res.status(400).json({ error: "Ценовая группа не найдена" });
    }

    await tx(async (conn) => {
      let customerId = account.customer_id ? Number(account.customer_id) : null;
      if (!customerId) {
        const [result] = await conn.query(
          "INSERT INTO customers (name, company, note) VALUES (?, ?, 'создан из заявки B2B-сайта')",
          [account.name, account.company ?? null],
        );
        customerId = (result as any).insertId as number;
        if (account.phone) {
          await conn.query(
            "INSERT IGNORE INTO customer_contacts (customer_id, contact_type, value, is_primary) VALUES (?, 'phone', ?, 1)",
            [customerId, account.phone],
          );
        }
        await conn.query(
          "INSERT IGNORE INTO customer_contacts (customer_id, contact_type, value, is_primary) VALUES (?, 'email', ?, 0)",
          [customerId, account.email],
        );
      }
      await conn.query(
        "UPDATE web_accounts SET status = 'APPROVED', customer_id = ?, price_group_id = COALESCE(?, price_group_id, 1) WHERE id = ?",
        [customerId, priceGroupId ? Number(priceGroupId) : null, account.id],
      );
    });
    res.json({ message: `Клиент ${account.name} одобрен` });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? "Не удалось одобрить заявку" });
  }
});

adminRouter.post("/registrations/:id/reject", async (req, res) => {
  const account = await one("SELECT name FROM web_accounts WHERE id = ?", [Number(req.params.id)]);
  if (!account) return res.status(404).json({ error: "Заявка не найдена" });
  await exec("UPDATE web_accounts SET status = 'REJECTED' WHERE id = ?", [Number(req.params.id)]);
  res.json({ message: `Заявка ${account.name} отклонена` });
});

adminRouter.get("/price-groups", async (_req, res) => {
  const groups = await q("SELECT id, name, multiplier FROM web_price_groups ORDER BY id");
  res.json({
    groups: groups.map((g) => ({ id: Number(g.id), name: g.name, multiplier: num(g.multiplier) })),
  });
});

// заказы всех клиентов из общей базы
adminRouter.get("/orders", async (_req, res) => {
  const orders = await q(
    `SELECT o.id, ${ORDER_STATUS_SQL} AS status, o.total_sum, o.discount_sum, o.paid_sum, o.comment, o.created_at,
            c.name AS customer_name, c.company AS customer_company
     FROM orders o JOIN customers c ON c.id = o.customer_id
     ORDER BY o.created_at DESC, o.id DESC LIMIT 100`,
  );
  const items = await loadItems(orders.map((o) => Number(o.id)));
  res.json({
    orders: orders.map((o) =>
      serializeOrder(o, items.get(Number(o.id)) ?? [], {
        name: o.customer_name,
        company: o.customer_company,
      }),
    ),
  });
});

// V2-W06: те же переходы, что в CRM. warehouse — подтвердить и зарезервировать пачки,
// completed — отгрузить собранный заказ (сборку отмечает склад в CRM), canceled — отменить.
adminRouter.post("/orders/:id/status", async (req, res) => {
  const { status, reason } = req.body ?? {};
  if (!["warehouse", "completed", "canceled"].includes(status))
    return res.status(400).json({ error: "Недопустимый статус" });

  const orderId = Number(req.params.id);
  const order = await one("SELECT id FROM orders WHERE id = ?", [orderId]);
  if (!order) return res.status(404).json({ error: "Заказ не найден" });
  const userId = await webServiceUserId();

  try {
    await tx(async (conn) => {
      if (status === "warehouse") await sendToWarehouse(conn, orderId, userId);
      if (status === "completed") await completeOrder(conn, orderId, userId);
      if (status === "canceled")
        await cancelOrder(conn, orderId, String(reason || "отменён в админке маркета"), userId);
    });
    res.json({ message: "Статус обновлён" });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? "Не удалось обновить статус" });
  }
});

// настройки маркета
adminRouter.get("/settings", async (_req, res) => {
  const settings = await q("SELECT k, v FROM web_settings");
  res.json({ settings: Object.fromEntries(settings.map((s) => [s.k, s.v])) });
});

adminRouter.put("/settings/:key", async (req, res) => {
  const { value } = req.body ?? {};
  await exec("INSERT INTO web_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [
    req.params.key,
    String(value),
  ]);
  res.json({ message: "Сохранено" });
});
