import { Router } from "express";
import { accounts, BRANCHES, exec, num, one, q, runInBranch, tx } from "../db.js";
import { findCrmCustomer } from "../customer-match.js";
import { cancelOrder, completeOrder, ORDER_STATUS_SQL, sendToWarehouse } from "../crm.js";
import { requireAdmin } from "../auth.js";
import { loadItems, ORDER_FROM_WEB_SQL, serializeOrder, webServiceUserId } from "./orders.js";
import { adminProductsRouter } from "./admin-products.js";

export const adminRouter = Router();

adminRouter.use(requireAdmin);
adminRouter.use(adminProductsRouter);

// заявки на регистрацию (web_accounts — общие для всех филиалов). Для заявок на рассмотрении —
// клиенты CRM с тем же e-mail/телефоном: к ним аккаунт привяжется при первом заказе в филиале
adminRouter.get("/registrations", async (_req, res) => {
  const users = await accounts.q(
    `SELECT a.id, a.email, a.name, a.company, a.phone, a.status, a.created_at, a.discount_percent
     FROM web_accounts a
     WHERE a.role = 'CLIENT'
     ORDER BY (a.status = 'PENDING') DESC, a.created_at DESC`,
  );
  const matches = new Map<number, { branch: string; branchName: string; customerId: number; name: string; by: string }[]>();
  for (const u of users.filter((x) => x.status === "PENDING")) {
    const found = [];
    for (const b of BRANCHES) {
      const m = await runInBranch(b, () => findCrmCustomer({ email: u.email, phone: u.phone }));
      if (m) found.push({ branch: b.id, branchName: b.name, customerId: m.id, name: m.name, by: m.by });
    }
    matches.set(Number(u.id), found);
  }
  res.json({
    users: users.map((u) => ({
      id: Number(u.id),
      email: u.email,
      name: u.name,
      company: u.company,
      phone: u.phone,
      status: u.status,
      discountPercent: num(u.discount_percent),
      crmMatches: matches.get(Number(u.id)) ?? [],
      createdAt: u.created_at,
    })),
  });
});

// одобрение открывает доступ ко всем филиалам; карточка клиента в CRM филиала
// создаётся при первом заказе в нём (orders.ts, customerForBranch)
/** Скидка клиента в % из тела запроса: undefined — не передана, null — некорректная. */
function parseDiscount(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const pct = Number(value);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
  return Math.round(pct * 100) / 100;
}

adminRouter.post("/registrations/:id/approve", async (req, res) => {
  const pct = parseDiscount(req.body?.discountPercent);
  if (pct === null) return res.status(400).json({ error: "Скидка должна быть от 0 до 100%" });
  const account = await accounts.one("SELECT id, name FROM web_accounts WHERE id = ?", [Number(req.params.id)]);
  if (!account) return res.status(404).json({ error: "Заявка не найдена" });
  await accounts.exec(
    "UPDATE web_accounts SET status = 'APPROVED', discount_percent = COALESCE(?, discount_percent) WHERE id = ?",
    [pct ?? null, account.id],
  );
  res.json({ message: `Клиент ${account.name} одобрен` });
});

// персональная скидка клиента — действует на новые заказы во всех филиалах
adminRouter.put("/registrations/:id/discount", async (req, res) => {
  const pct = parseDiscount(req.body?.discountPercent);
  if (pct === null || pct === undefined) return res.status(400).json({ error: "Скидка должна быть от 0 до 100%" });
  const account = await accounts.one("SELECT id, name FROM web_accounts WHERE id = ? AND role = 'CLIENT'", [
    Number(req.params.id),
  ]);
  if (!account) return res.status(404).json({ error: "Клиент не найден" });
  await accounts.exec("UPDATE web_accounts SET discount_percent = ? WHERE id = ?", [pct, account.id]);
  res.json({ message: `Скидка ${account.name}: ${pct}%`, discountPercent: pct });
});

adminRouter.post("/registrations/:id/reject", async (req, res) => {
  const account = await accounts.one("SELECT name FROM web_accounts WHERE id = ?", [Number(req.params.id)]);
  if (!account) return res.status(404).json({ error: "Заявка не найдена" });
  await accounts.exec("UPDATE web_accounts SET status = 'REJECTED' WHERE id = ?", [Number(req.params.id)]);
  res.json({ message: `Заявка ${account.name} отклонена` });
});

// заказы всех клиентов из базы CRM текущего филиала
adminRouter.get("/orders", async (_req, res) => {
  const orders = await q(
    `SELECT o.id, ${ORDER_STATUS_SQL} AS status, o.total_sum, o.discount_sum, o.paid_sum, o.comment, o.created_at,
            ${ORDER_FROM_WEB_SQL} AS from_web, c.name AS customer_name, c.company AS customer_company
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
