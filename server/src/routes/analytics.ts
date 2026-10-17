import { Router } from "express";
import { num, one, q } from "../db.js";
import { requireAdmin } from "../auth.js";
import { CATEGORY_JOIN, CATEGORY_SQL, ORDER_DEBT_SQL, SOLD_STATUS_FILTER } from "../crm.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAdmin);

// продажей считается отгруженный заказ (статусы CRM: completed и возвраты по нему)
export const SOLD_FILTER = SOLD_STATUS_FILTER;

export const UNITS_EXPR = `CASE WHEN oi.sale_type = 'pack'
  THEN oi.qty * (SELECT COALESCE(SUM(pt.qty), 0) FROM pack_templates pt WHERE pt.variant_id = v.id)
  ELSE oi.qty END`;

export const SOLD_JOIN = `
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id AND ${SOLD_FILTER}
  JOIN product_variants v ON v.id = oi.variant_id
  JOIN products p ON p.id = v.product_id
  ${CATEGORY_JOIN}`;

/** Остаток модели по всем складским вариантам: единицы и полные пачки. */
export const PRODUCT_STOCK_JOIN = `LEFT JOIN (
    SELECT v.product_id,
           SUM(pi.available_qty) AS units,
           COUNT(DISTINCT CASE WHEN pk.status = 'full' THEN pk.id END) AS packs
    FROM packs pk
    JOIN pack_items pi ON pi.pack_id = pk.id
    JOIN product_variants v ON v.id = pk.variant_id
    GROUP BY v.product_id
  ) stock ON stock.product_id = p.id`;

/** Последняя продажа модели. */
export const PRODUCT_LAST_SALE_JOIN = `LEFT JOIN (
    SELECT v.product_id, MAX(o.created_at) AS last_at
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id AND ${SOLD_FILTER}
    JOIN product_variants v ON v.id = oi.variant_id
    GROUP BY v.product_id
  ) last_sale ON last_sale.product_id = p.id`;

function parseRange(query: any): { from: Date; to: Date } {
  const to = query.to ? new Date(String(query.to)) : new Date();
  const from = query.from
    ? new Date(String(query.from))
    : new Date(to.getTime() - 30 * 24 * 3600 * 1000);
  return { from, to };
}

// V2-AN01: лучшие товары по количеству и выручке за период
analyticsRouter.get("/top", async (req, res) => {
  const { from, to } = parseRange(req.query);
  const rows = await q(
    `SELECT p.id AS product_id, p.title, p.sku, ${CATEGORY_SQL} AS category, d.image_url,
            SUM(${UNITS_EXPR}) AS quantity,
            SUM(oi.qty * oi.price - oi.discount) AS revenue
     ${SOLD_JOIN}
     LEFT JOIN web_product_details d ON d.product_id = p.id
     WHERE o.created_at BETWEEN ? AND ?
     GROUP BY p.id, p.title, p.sku, category, d.image_url
     ORDER BY revenue DESC
     LIMIT 20`,
    [from, to],
  );
  res.json({
    from,
    to,
    products: rows.map((r) => ({
      productId: Number(r.product_id),
      name: r.title,
      model: r.sku,
      category: r.category,
      imageUrl: r.image_url,
      quantity: Number(r.quantity),
      revenue: num(r.revenue),
    })),
  });
});

// V2-AN02: залежавшиеся — нет продаж N дней (порог настраивается)
analyticsRouter.get("/stale", async (req, res) => {
  const setting = await one("SELECT v FROM web_settings WHERE k = 'staleDays'");
  const days = Number(req.query.days ?? setting?.v ?? 30);

  const rows = await q(
    `SELECT p.id AS product_id, p.title, p.sku, ${CATEGORY_SQL} AS category, s.title AS supplier,
            COALESCE(stock.units, 0) AS stock_units,
            COALESCE(stock.units, 0) * p.purchase_price AS stock_value,
            COALESCE(stock.packs, 0) AS stock_packs,
            last_sale.last_at AS last_sale
     FROM products p
     ${CATEGORY_JOIN}
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     ${PRODUCT_STOCK_JOIN}
     ${PRODUCT_LAST_SALE_JOIN}
     WHERE p.is_archived = 0 AND COALESCE(stock.units, 0) > 0
       AND (last_sale.last_at IS NULL OR last_sale.last_at < DATE_SUB(NOW(), INTERVAL ? DAY))
     ORDER BY last_sale.last_at IS NOT NULL, last_sale.last_at ASC
     LIMIT 100`,
    [days],
  );

  res.json({
    days,
    products: rows.map((r) => ({
      productId: Number(r.product_id),
      name: r.title,
      model: r.sku,
      category: r.category,
      supplier: r.supplier ?? "—",
      stockPacks: Number(r.stock_packs),
      stockUnits: Number(r.stock_units),
      stockValue: Math.round(num(r.stock_value)),
      lastSale: r.last_sale,
      daysWithoutSales: r.last_sale
        ? Math.floor((Date.now() - new Date(r.last_sale).getTime()) / (24 * 3600 * 1000))
        : null,
    })),
  });
});

// V2-AN03: динамика по дням/неделям/месяцам + сравнение с прошлым периодом
analyticsRouter.get("/dynamics", async (req, res) => {
  const granularity = String(req.query.granularity ?? "day");
  const { from, to } = parseRange(req.query);
  const fmt = granularity === "month" ? "%Y-%m" : granularity === "week" ? "%x-W%v" : "%Y-%m-%d";

  const spanMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - spanMs);

  const [series, current, previous] = await Promise.all([
    q(
      `SELECT DATE_FORMAT(o.created_at, ?) AS period,
              SUM(oi.qty * oi.price - oi.discount) AS revenue,
              SUM(${UNITS_EXPR}) AS quantity
       ${SOLD_JOIN}
       WHERE o.created_at BETWEEN ? AND ?
       GROUP BY period ORDER BY period`,
      [fmt, from, to],
    ),
    one(
      `SELECT COALESCE(SUM(oi.qty * oi.price - oi.discount), 0) AS revenue ${SOLD_JOIN}
       WHERE o.created_at BETWEEN ? AND ?`,
      [from, to],
    ),
    one(
      `SELECT COALESCE(SUM(oi.qty * oi.price - oi.discount), 0) AS revenue ${SOLD_JOIN}
       WHERE o.created_at BETWEEN ? AND ?`,
      [prevFrom, from],
    ),
  ]);

  const currentRevenue = num(current?.revenue);
  const previousRevenue = num(previous?.revenue);
  res.json({
    granularity,
    from,
    to,
    series: series.map((s) => ({
      period: s.period,
      revenue: num(s.revenue),
      quantity: Number(s.quantity),
    })),
    comparison: {
      currentRevenue: Math.round(currentRevenue),
      previousRevenue: Math.round(previousRevenue),
      changePct:
        previousRevenue > 0
          ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
          : null,
    },
  });
});

// V2-AN04: категории — количество и сумма, с переходом к моделям
analyticsRouter.get("/categories", async (req, res) => {
  const { from, to } = parseRange(req.query);
  const category = req.query.category ? String(req.query.category) : null;

  if (category) {
    const rows = await q(
      `SELECT p.id AS product_id, p.title, p.sku,
              SUM(${UNITS_EXPR}) AS quantity,
              SUM(oi.qty * oi.price - oi.discount) AS revenue
       ${SOLD_JOIN}
       WHERE o.created_at BETWEEN ? AND ? AND ${CATEGORY_SQL} = ?
       GROUP BY p.id, p.title, p.sku
       ORDER BY revenue DESC LIMIT 50`,
      [from, to, category],
    );
    return res.json({
      models: rows.map((r) => ({
        productId: Number(r.product_id),
        name: r.title,
        model: r.sku,
        quantity: Number(r.quantity),
        revenue: num(r.revenue),
      })),
    });
  }

  const rows = await q(
    `SELECT ${CATEGORY_SQL} AS category,
            SUM(${UNITS_EXPR}) AS quantity,
            SUM(oi.qty * oi.price - oi.discount) AS revenue
     ${SOLD_JOIN}
     WHERE o.created_at BETWEEN ? AND ?
     GROUP BY category ORDER BY revenue DESC`,
    [from, to],
  );
  res.json({
    categories: rows.map((r) => ({
      category: r.category,
      quantity: Number(r.quantity),
      revenue: num(r.revenue),
    })),
  });
});

// V2-AN05: поставщики — продажи, остаток, закупочная сумма, маржа
analyticsRouter.get("/suppliers", async (req, res) => {
  const { from, to } = parseRange(req.query);
  const rows = await q(
    `SELECT s.id, s.title AS supplier,
            COALESCE(sales.revenue, 0) AS revenue,
            COALESCE(sales.sold_units, 0) AS sold_units,
            COALESCE(sales.cost, 0) AS cost,
            COALESCE(stock.units, 0) AS stock_units,
            COALESCE(stock.value, 0) AS stock_value
     FROM suppliers s
     LEFT JOIN (
       SELECT p.supplier_id,
              SUM(oi.qty * oi.price - oi.discount) AS revenue,
              SUM(${UNITS_EXPR}) AS sold_units,
              SUM((${UNITS_EXPR}) * p.purchase_price) AS cost
       ${SOLD_JOIN}
       WHERE o.created_at BETWEEN ? AND ?
       GROUP BY p.supplier_id
     ) sales ON sales.supplier_id = s.id
     LEFT JOIN (
       SELECT p.supplier_id,
              SUM(pi.available_qty) AS units,
              SUM(pi.available_qty * p.purchase_price) AS value
       FROM pack_items pi
       JOIN packs pk ON pk.id = pi.pack_id
       JOIN product_variants v ON v.id = pk.variant_id
       JOIN products p ON p.id = v.product_id
       GROUP BY p.supplier_id
     ) stock ON stock.supplier_id = s.id
     WHERE COALESCE(sales.revenue, 0) > 0 OR COALESCE(stock.units, 0) > 0
     ORDER BY revenue DESC
     LIMIT 30`,
    [from, to],
  );
  res.json({
    suppliers: rows.map((r) => {
      const revenue = num(r.revenue);
      const cost = num(r.cost);
      return {
        supplierId: Number(r.id),
        supplier: r.supplier,
        revenue: Math.round(revenue),
        soldUnits: Number(r.sold_units),
        cost: Math.round(cost),
        stockUnits: Number(r.stock_units),
        stockValue: Math.round(num(r.stock_value)),
        margin: Math.round(revenue - cost),
        marginPct: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : 0,
      };
    }),
  });
});

// V2-AN06: долги — как в CRM: сальдо заказа по customer_ledger (начисление при отгрузке),
// просрочка по debt_due
analyticsRouter.get("/debts", async (_req, res) => {
  const rows = await q(
    `SELECT c.id, c.name, c.company,
            SUM(od.debt) AS debt,
            SUM(CASE WHEN od.debt_due IS NOT NULL AND od.debt_due < CURDATE() THEN od.debt ELSE 0 END) AS overdue,
            MAX(CASE WHEN od.debt_due IS NOT NULL AND od.debt_due < CURDATE()
                THEN DATEDIFF(CURDATE(), od.debt_due) ELSE 0 END) AS max_overdue_days
     FROM (SELECT o.customer_id, o.debt_due, ${ORDER_DEBT_SQL} AS debt FROM orders o) od
     JOIN customers c ON c.id = od.customer_id
     WHERE od.debt > 0
     GROUP BY c.id, c.name, c.company
     ORDER BY debt DESC LIMIT 50`,
  );
  const debtors = rows.map((r) => ({
    userId: Number(r.id),
    name: r.name,
    company: r.company,
    total: Math.round(num(r.debt)),
    overdue: Math.round(num(r.overdue)),
    maxOverdueDays: Number(r.max_overdue_days),
  }));
  res.json({
    total: debtors.reduce((s, d) => s + d.total, 0),
    overdueTotal: debtors.reduce((s, d) => s + d.overdue, 0),
    debtors,
  });
});

// V2-AN07: реализация — consignments (общая база) + web_consignment_items
analyticsRouter.get("/consignment", async (_req, res) => {
  const heads = await q(
    `SELECT cg.id, cg.status, cg.issued_at, c.name, c.company
     FROM consignments cg JOIN customers c ON c.id = cg.customer_id
     ORDER BY cg.issued_at ASC LIMIT 50`,
  );
  const ids = heads.map((h) => Number(h.id));
  const items = ids.length
    ? await q(
        `SELECT wi.consignment_id, wi.qty, wi.amount, p.title, p.sku
         FROM web_consignment_items wi
         JOIN product_variants v ON v.id = wi.variant_id
         JOIN products p ON p.id = v.product_id
         WHERE wi.consignment_id IN (${ids.map(() => "?").join(",")})`,
        ids,
      )
    : [];

  res.json({
    consignments: heads.map((h) => {
      const list = items.filter((i) => Number(i.consignment_id) === Number(h.id));
      return {
        id: Number(h.id),
        client: h.name,
        company: h.company,
        createdAt: h.issued_at,
        ageDays: Math.floor((Date.now() - new Date(h.issued_at).getTime()) / (24 * 3600 * 1000)),
        amount: Math.round(list.reduce((s, i) => s + num(i.amount), 0)),
        items: list.map((i) => ({
          product: i.title,
          model: i.sku,
          quantity: Number(i.qty),
          amount: Math.round(num(i.amount)),
        })),
      };
    }),
  });
});
