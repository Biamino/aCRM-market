import { Router } from "express";
import { num, one, q } from "../db.js";
import { requireAdmin } from "../auth.js";
import { ORDER_DEBT_SQL } from "../crm.js";
import { PRODUCT_LAST_SALE_JOIN, PRODUCT_STOCK_JOIN, SOLD_FILTER, SOLD_JOIN, UNITS_EXPR } from "./analytics.js";

export const insightsRouter = Router();

insightsRouter.use(requireAdmin);

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

// 6.3: текстовые выводы — правила и простая статистика по общей базе CRM.
// Модуль только объясняет данные и ничего не изменяет.
insightsRouter.get("/", async (_req, res) => {
  const insights: { type: string; severity: "info" | "warning" | "positive"; text: string }[] = [];

  const staleSetting = await one("SELECT v FROM web_settings WHERE k = 'staleDays'");
  const staleDays = Number(staleSetting?.v ?? 30);

  // 1. Рост продаж модели несколько недель подряд (последние 5 недель)
  const weekly = await q(
    `SELECT p.id AS product_id, p.title, p.sku,
            FLOOR(DATEDIFF(NOW(), o.created_at) / 7) AS weeks_ago,
            SUM(${UNITS_EXPR}) AS units
     ${SOLD_JOIN}
     WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 35 DAY)
     GROUP BY p.id, p.title, p.sku, weeks_ago`,
  );
  const byProduct = new Map<number, { title: string; sku: string; weeks: number[] }>();
  for (const r of weekly) {
    const id = Number(r.product_id);
    const entry = byProduct.get(id) ?? { title: r.title, sku: r.sku, weeks: [0, 0, 0, 0, 0] };
    const idx = Number(r.weeks_ago);
    if (idx <= 4) entry.weeks[idx] += Number(r.units);
    byProduct.set(id, entry);
  }
  for (const { title, sku, weeks } of byProduct.values()) {
    let streak = 0;
    for (let w = 0; w < weeks.length - 1; w++) {
      if (weeks[w] > weeks[w + 1] && weeks[w + 1] > 0) streak++;
      else break;
    }
    if (streak >= 2) {
      insights.push({
        type: "growth",
        severity: "positive",
        text: `Продажи модели «${title}» (${sku}) растут ${streak + 1}-ю неделю подряд: ${weeks
          .slice(0, streak + 1)
          .reverse()
          .join(" → ")} ед. по неделям.`,
      });
    }
  }

  // 2. Залежавшиеся товары с остатком
  const stale = await q(
    `SELECT p.title, p.sku,
            COALESCE(stock.units, 0) AS units,
            COALESCE(stock.packs, 0) AS packs,
            COALESCE(stock.units, 0) * p.purchase_price AS stock_value,
            DATEDIFF(NOW(), COALESCE(last_sale.last_at, p.created_at)) AS days_idle
     FROM products p
     ${PRODUCT_STOCK_JOIN}
     ${PRODUCT_LAST_SALE_JOIN}
     WHERE p.is_archived = 0 AND COALESCE(stock.units, 0) > 0
       AND DATEDIFF(NOW(), COALESCE(last_sale.last_at, p.created_at)) >= ?
     ORDER BY days_idle DESC
     LIMIT 3`,
    [staleDays],
  );
  for (const r of stale) {
    const packsPart = Number(r.packs) > 0 ? `${r.packs} пачек` : `${r.units} ед.`;
    insights.push({
      type: "stale",
      severity: "warning",
      text: `Товар «${r.title}» (${r.sku}) не продавался ${r.days_idle} дн., на складе осталось ${packsPart}${num(r.stock_value) > 0 ? ` на сумму ${fmt(num(r.stock_value))} по закупке` : ""}.`,
    });
  }

  // 3. Какой размер заканчивается быстрее (по поштучным продажам за 90 дней)
  const sizes = await q(
    `SELECT s.title AS size, SUM(oi.qty) AS units
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id AND ${SOLD_FILTER}
     JOIN sizes s ON s.id = oi.size_id
     WHERE oi.sale_type = 'unit' AND o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
     GROUP BY s.title ORDER BY units DESC`,
  );
  if (sizes.length >= 2) {
    const total = sizes.reduce((s, r) => s + Number(r.units), 0);
    const top = sizes[0];
    if (Number(top.units) > (total / sizes.length) * 1.3) {
      insights.push({
        type: "size",
        severity: "info",
        text: `Размер ${top.size} заканчивается быстрее остальных: ${top.units} ед. поштучных продаж за 90 дней (${Math.round((Number(top.units) / total) * 100)}% всех штучных продаж).`,
      });
    }
  }

  // 4. Поставщик с высокими продажами, но большими залежами
  const suppliers = await q(
    `SELECT s.title AS supplier,
            COALESCE(sales.revenue, 0) AS revenue,
            COALESCE(stale_stock.value, 0) AS stale_value
     FROM suppliers s
     LEFT JOIN (
       SELECT p.supplier_id, SUM(oi.qty * oi.price - oi.discount) AS revenue
       ${SOLD_JOIN}
       WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
       GROUP BY p.supplier_id
     ) sales ON sales.supplier_id = s.id
     LEFT JOIN (
       SELECT p.supplier_id, SUM(pi.available_qty * p.purchase_price) AS value
       FROM pack_items pi
       JOIN packs pk ON pk.id = pi.pack_id
       JOIN product_variants v ON v.id = pk.variant_id
       JOIN products p ON p.id = v.product_id
       ${PRODUCT_LAST_SALE_JOIN}
       WHERE pi.available_qty > 0
         AND DATEDIFF(NOW(), COALESCE(last_sale.last_at, p.created_at)) >= ?
       GROUP BY p.supplier_id
     ) stale_stock ON stale_stock.supplier_id = s.id
     WHERE COALESCE(sales.revenue, 0) > 0 OR COALESCE(stale_stock.value, 0) > 0`,
    [staleDays],
  );
  if (suppliers.length >= 2) {
    const topRevenue = [...suppliers].sort((a, b) => num(b.revenue) - num(a.revenue))[0];
    const topStale = [...suppliers].sort((a, b) => num(b.stale_value) - num(a.stale_value))[0];
    if (num(topStale.stale_value) > 0) {
      insights.push({
        type: "supplier",
        severity: "info",
        text:
          topRevenue.supplier === topStale.supplier
            ? `У поставщика «${topRevenue.supplier}» больше всех продаж (${fmt(num(topRevenue.revenue))} за 90 дней), но и самые большие залежи — ${fmt(num(topStale.stale_value))} по закупке.`
            : `Лидер продаж — поставщик «${topRevenue.supplier}» (${fmt(num(topRevenue.revenue))}), а самые большие залежи у «${topStale.supplier}» — ${fmt(num(topStale.stale_value))} по закупке.`,
      });
    }
  }

  // 5. Клиенты с просроченным долгом более 30 дней
  const overdue = await q(
    `SELECT c.name, SUM(od.debt) AS amount, MAX(DATEDIFF(CURDATE(), od.debt_due)) AS days
     FROM (SELECT o.customer_id, o.debt_due, ${ORDER_DEBT_SQL} AS debt FROM orders o) od
     JOIN customers c ON c.id = od.customer_id
     WHERE od.debt > 0 AND od.debt_due IS NOT NULL AND od.debt_due < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY c.id, c.name ORDER BY amount DESC`,
  );
  if (overdue.length > 0) {
    const totalOverdue = overdue.reduce((s, r) => s + num(r.amount), 0);
    insights.push({
      type: "debt",
      severity: "warning",
      text: `У ${overdue.length} клиент(ов) просрочен долг более 30 дней на общую сумму ${fmt(totalOverdue)}. Крупнейший должник — ${overdue[0].name} (${fmt(num(overdue[0].amount))}, просрочка ${overdue[0].days} дн.).`,
    });
  }

  res.json({ insights, generatedAt: new Date() });
});
