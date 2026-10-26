import { Router } from "express";
import type { PoolConnection } from "mysql2/promise";
import { accounts, branch, num, one, pool, q, tx } from "../db.js";
import { requireAuth, type AuthUser } from "../auth.js";
import { ORDER_STATUS_SQL, timeline } from "../crm.js";
import { findCrmCustomer, samePhone } from "../customer-match.js";
import { galleryUrls, mediaByProduct } from "../product-media.js";

export const ordersRouter = Router();

interface CartItem {
  productId?: number;
  color?: string;
  packs?: number;
  units?: number;
}

async function cq<T = any>(conn: PoolConnection, sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await conn.query(sql, params);
  return rows as T[];
}

/** Служебный пользователь CRM, от имени которого журналируются веб-заказы. */
export async function webServiceUserId(): Promise<number> {
  const row = await one("SELECT id FROM users WHERE login = 'b2b-web'");
  if (row) return Number(row.id);
  const fallback = await one("SELECT id FROM users ORDER BY id LIMIT 1");
  return Number(fallback?.id ?? 1);
}

/**
 * Контакты аккаунта в карточку клиента CRM. Занятые другим клиентом CRM пропустит (они уникальны),
 * а телефон, который у клиента уже записан в другом формате, не дублируем.
 */
async function addContacts(
  conn: { query: (sql: string, params: unknown[]) => Promise<unknown> },
  customerId: number,
  account: { email: string; phone: string | null },
  primaryPhone: boolean,
) {
  const [phones] = (await conn.query(
    "SELECT value FROM customer_contacts WHERE customer_id = ? AND contact_type IN ('phone', 'whatsapp')",
    [customerId],
  )) as [{ value: string }[]];
  if (account.phone && !phones.some((p) => samePhone(p.value, account.phone))) {
    await conn.query(
      "INSERT IGNORE INTO customer_contacts (customer_id, contact_type, value, is_primary) VALUES (?, 'phone', ?, ?)",
      [customerId, account.phone, primaryPhone ? 1 : 0],
    );
  }
  await conn.query(
    "INSERT IGNORE INTO customer_contacts (customer_id, contact_type, value, is_primary) VALUES (?, 'email', ?, 0)",
    [customerId, account.email],
  );
}

/** Связь аккаунта с клиентом CRM филиала. Базы разные — пишем после коммита; при гонке побеждает первая. */
async function linkCustomer(accountId: number, customerId: number): Promise<number> {
  await accounts.exec(
    "INSERT IGNORE INTO web_account_customers (account_id, branch, customer_id) VALUES (?, ?, ?)",
    [accountId, branch().id, customerId],
  );
  const link = await accounts.one(
    "SELECT customer_id FROM web_account_customers WHERE account_id = ? AND branch = ?",
    [accountId, branch().id],
  );
  return Number(link?.customer_id ?? customerId);
}

const loadAccount = (id: number) =>
  accounts.one<{ name: string; company: string | null; phone: string | null; email: string }>(
    "SELECT name, company, phone, email FROM web_accounts WHERE id = ?",
    [id],
  );

/**
 * Клиент CRM филиала, уже связанный с аккаунтом или найденный по e-mail/телефону. Найденного
 * сразу привязываем и дописываем ему контакты с сайта — покупатель видит свою историю заказов
 * из CRM ещё до первого заказа на сайте. Кого одобрять, решает администратор: совпадения
 * видны в заявках (/admin/registrations). Новую карточку здесь не создаём.
 */
async function existingCustomer(user: AuthUser): Promise<number | null> {
  if (user.customerId) return user.customerId;
  const account = await loadAccount(user.id);
  const found = account ? await findCrmCustomer(account) : null;
  if (!account || !found) return null;
  await addContacts(pool(), found.id, account, false);
  return linkCustomer(user.id, found.id);
}

/** Клиент CRM для заказа: существующий (см. existingCustomer) или новая карточка из данных заявки. */
async function customerForBranch(user: AuthUser): Promise<number> {
  const existing = await existingCustomer(user);
  if (existing) return existing;
  const account = await loadAccount(user.id);
  if (!account) throw new Error("Аккаунт не найден");
  const created = await tx(async (conn) => {
    const [result] = await conn.query(
      "INSERT INTO customers (name, company, note) VALUES (?, ?, 'создан из заявки B2B-сайта')",
      [account.name, account.company ?? null],
    );
    const customerId = (result as { insertId: number }).insertId;
    await addContacts(conn, customerId, account, true);
    return customerId;
  });
  return linkCustomer(user.id, created);
}

// V2-W05 + V2-W06: корзина → новый заказ в общих таблицах CRM.
// Как в CRM (create_order): заказ «new», позиции без резерва; резерв пачек
// делается, когда сотрудник передаёт заказ на склад.
ordersRouter.post("/", requireAuth, async (req, res) => {
  const user = req.user!;
  const items: CartItem[] = req.body?.items ?? [];
  const comment: string | undefined = req.body?.comment;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "Корзина пуста" });

  try {
    const customerId = await customerForBranch(user);
    const createdBy = await webServiceUserId();
    const orderId = await tx(async (conn) => {
      const [orderResult] = await conn.query(
        `INSERT INTO orders (customer_id, status, total_sum, discount_sum, paid_sum, comment, created_by)
         VALUES (?, 'new', 0, 0, 0, ?, ?)`,
        [customerId, comment || "", createdBy],
      );
      const orderId = (orderResult as { insertId: number }).insertId;
      let total = 0;

      for (const item of items) {
        const packsWanted = Math.max(0, Math.floor(item.packs ?? 0));
        if (Math.max(0, Math.floor(item.units ?? 0)) > 0)
          throw new Error("Поштучная продажа недоступна. Заказывайте полными пачками.");
        if (packsWanted === 0) continue;

        const product = (
          await cq(
            conn,
            `SELECT p.id, p.title, p.wholesale_price, COALESCE(d.is_visible, 0) AS is_visible
             FROM products p LEFT JOIN web_product_details d ON d.product_id = p.id
             WHERE p.id = ? AND p.is_archived = 0`,
            [Number(item.productId)],
          )
        )[0];
        if (!product) throw new Error(`Товар #${item.productId} не найден`);
        if (!Number(product.is_visible)) throw new Error(`${product.title} снят с витрины`);

        const color = item.color?.trim() || null;
        if (color) {
          const known = await cq(
            conn,
            `SELECT 1 FROM product_colors WHERE product_id = ? AND color = ?
             UNION SELECT 1 FROM product_variants WHERE product_id = ? AND color = ?`,
            [product.id, color, product.id, color],
          );
          if (!known.length) throw new Error(`«${product.title}»: цвет «${color}» не найден`);
        }
        const unitPrice = Math.round(num(product.wholesale_price));

        // Остаток общий на модель: полные пачки ищем по всем складским вариантам модели,
        // сначала вариант того же цвета (старые товары), затем основной.
        const variants = await cq(
          conn,
          `SELECT v.id,
                  (SELECT COUNT(*) FROM packs pk WHERE pk.variant_id = v.id AND pk.status = 'full') AS full_packs,
                  (SELECT COALESCE(SUM(pt.qty), 0) FROM pack_templates pt WHERE pt.variant_id = v.id) AS pack_size
           FROM product_variants v
           WHERE v.product_id = ?
           ORDER BY (v.color = ?) DESC, v.id`,
          [product.id, color ?? ""],
        );
        const available = variants.reduce((s, v) => s + Number(v.full_packs), 0);
        if (available < packsWanted)
          throw new Error(`«${product.title}»: доступно ${available} пачек, запрошено ${packsWanted}`);

        let left = packsWanted;
        for (const v of variants) {
          const take = Math.min(left, Number(v.full_packs));
          if (take === 0) continue;
          // цена позиции — за пачку, как в CRM
          const packPrice = unitPrice * Number(v.pack_size);
          await conn.query(
            `INSERT INTO order_items (order_id, variant_id, sale_type, qty, price, picked, color)
             VALUES (?, ?, 'pack', ?, ?, 0, ?)`,
            [orderId, v.id, take, packPrice, color],
          );
          total += packPrice * take;
          left -= take;
          if (left === 0) break;
        }
      }

      if (total === 0) throw new Error("Корзина пуста");
      // персональная скидка клиента: total_sum — к оплате (его CRM начисляет в долг), discount_sum — сколько скинули
      const discount = Math.round((total * user.discountPercent) / 100);
      await conn.query("UPDATE orders SET total_sum = ?, discount_sum = ? WHERE id = ?", [
        total - discount,
        discount,
        orderId,
      ]);
      const note = discount > 0 ? `, скидка ${user.discountPercent}% (−${discount})` : "";
      await timeline(conn, orderId, "created", `Заказ создан через B2B-сайт${note}`, createdBy, {
        source: "web",
        discountPercent: user.discountPercent,
      });
      return orderId;
    });

    const order = await loadOrder(orderId);
    res.status(201).json({ order, message: "Заявка создана и передана менеджеру на проверку" });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? "Не удалось создать заявку" });
  }
});

/**
 * 1 — заказ оформлен на сайте: его создаёт служебный пользователь b2b-web и пишет в историю
 * «created» с metadata.source = 'web'; остальные заказы заведены сотрудниками в CRM.
 */
export const ORDER_FROM_WEB_SQL = `(o.created_by = (SELECT id FROM users WHERE login = 'b2b-web')
  OR EXISTS (SELECT 1 FROM order_timeline t WHERE t.order_id = o.id AND t.event_type = 'created'
             AND JSON_VALUE(t.metadata, '$.source') = 'web'))`;

export const ORDER_SELECT = `SELECT o.id, o.customer_id, ${ORDER_STATUS_SQL} AS status, o.total_sum,
  o.discount_sum, o.paid_sum, o.comment, o.created_at, ${ORDER_FROM_WEB_SQL} AS from_web FROM orders o`;

export async function loadOrder(orderId: number) {
  const order = await one(`${ORDER_SELECT} WHERE o.id = ?`, [orderId]);
  if (!order) return null;
  const items = await loadItems([orderId]);
  return serializeOrder(order, items.get(orderId) ?? []);
}

export async function loadItems(orderIds: number[]) {
  const map = new Map<number, any[]>();
  if (orderIds.length === 0) return map;
  const ph = orderIds.map(() => "?").join(",");
  const rows = await q(
    `SELECT oi.order_id, oi.id, oi.sale_type, oi.qty, oi.price, oi.discount,
            p.id AS product_id, COALESCE(NULLIF(oi.color, ''), v.color) AS color, p.sku, p.title,
            s.title AS size, d.image_url,
            (SELECT COALESCE(SUM(pt.qty), 0) FROM pack_templates pt WHERE pt.variant_id = v.id) AS pack_size
     FROM order_items oi
     JOIN product_variants v ON v.id = oi.variant_id
     JOIN products p ON p.id = v.product_id
     LEFT JOIN sizes s ON s.id = oi.size_id
     LEFT JOIN web_product_details d ON d.product_id = p.id
     WHERE oi.order_id IN (${ph})
     ORDER BY oi.id`,
    orderIds,
  );

  const media = await mediaByProduct([...new Set(rows.map((r) => Number(r.product_id)))]);

  for (const r of rows) {
    const orderId = Number(r.order_id);
    const list = map.get(orderId) ?? [];
    const isPack = r.sale_type === "pack";
    const packSize = Number(r.pack_size) || 1;
    const productId = Number(r.product_id);
    const color = r.color && r.color !== "default" ? String(r.color) : "";
    const lineTotal = num(r.price) * Number(r.qty) - num(r.discount);
    // после резерва CRM пишет каждую пачку отдельной строкой — для показа объединяем
    const existing = isPack
      ? list.find((i) => i.productId === productId && i.product.color === color && i.packs > 0)
      : null;
    if (existing) {
      existing.packs += Number(r.qty);
      existing.lineTotal += lineTotal;
    } else {
      list.push({
        id: Number(r.id),
        productId,
        packs: isPack ? Number(r.qty) : 0,
        units: isPack ? 0 : Number(r.qty),
        size: r.size ?? null,
        unitPrice: isPack ? Math.round(num(r.price) / packSize) : num(r.price),
        lineTotal,
        product: {
          name: r.title,
          model: r.sku,
          color,
          packSize,
          imageUrl: galleryUrls(media.get(productId), color, r.image_url)[0] ?? "",
        },
      });
    }
    map.set(orderId, list);
  }
  return map;
}

export function serializeOrder(order: any, items: any[], customer?: any) {
  const total = num(order.total_sum);
  const discount = num(order.discount_sum);
  const subtotal = total + discount;
  return {
    id: Number(order.id),
    status: order.status,
    /** где оформлен: на сайте или сотрудником в CRM */
    source: Number(order.from_web) ? "web" : "crm",
    /** к оплате, со скидкой */
    total,
    /** сумма без скидки */
    subtotal,
    discount,
    discountPercent: discount > 0 && subtotal > 0 ? Math.round((discount / subtotal) * 1000) / 10 : 0,
    paid: num(order.paid_sum),
    comment: order.comment || null,
    createdAt: order.created_at,
    ...(customer ? { user: customer } : {}),
    items,
  };
}

// V2-W07: клиент видит только свои заказы (по customer_id общей базы)
ordersRouter.get("/", requireAuth, async (req, res) => {
  const customerId = await existingCustomer(req.user!);
  if (!customerId) return res.json({ orders: [] });
  const orders = await q(
    `${ORDER_SELECT} WHERE o.customer_id = ? ORDER BY o.created_at DESC, o.id DESC LIMIT 100`,
    [customerId],
  );
  const items = await loadItems(orders.map((o) => Number(o.id)));
  res.json({ orders: orders.map((o) => serializeOrder(o, items.get(Number(o.id)) ?? [])) });
});

ordersRouter.get("/:id", requireAuth, async (req, res) => {
  const order = await one(`${ORDER_SELECT} WHERE o.id = ?`, [Number(req.params.id)]);
  // чужие заказы недоступны
  if (!order || Number(order.customer_id) !== (await existingCustomer(req.user!)))
    return res.status(404).json({ error: "Заказ не найден" });
  const items = await loadItems([Number(order.id)]);
  res.json({ order: serializeOrder(order, items.get(Number(order.id)) ?? []) });
});
