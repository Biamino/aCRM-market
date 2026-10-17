/**
 * Демо-сид маркета поверх базы CRM первого филиала (или BRANCHES[0]).
 * Реальные данные CRM (импорт из Microinvest) не трогает:
 * добавляет/пересоздаёт только собственные записи (артикулы WEB-*,
 * заказы служебного пользователя b2b-web, web_* таблицы).
 */
import bcrypt from "bcryptjs";
import { accounts, branch, BRANCHES, closePools, exec, one, pool, q, runInBranch } from "../src/db.js";
import { applyAccountsSchema, applyMarketSchema } from "./apply-market-schema.js";

const DAY = 24 * 3600 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const img = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/800?grayscale`;

/** Справочники пустой CRM (свежая схема без дампа): роли и поставщики демо-товаров. */
async function ensureReferenceData(supplierTitles: string[]) {
  await exec(
    `INSERT IGNORE INTO roles (code, title) VALUES
       ('admin', 'Администратор'), ('manager', 'Менеджер'), ('employee', 'Сотрудник')`,
  );
  for (const title of supplierTitles) {
    if (!(await one("SELECT id FROM suppliers WHERE title = ?", [title])))
      await exec("INSERT INTO suppliers (title) VALUES (?)", [title]);
  }
}

async function ensureServiceUser(): Promise<number> {
  const existing = await one("SELECT id FROM users WHERE login = 'b2b-web'");
  if (existing) return Number(existing.id);
  const role = await one("SELECT id FROM roles WHERE code = 'employee'");
  return exec(
    `INSERT INTO users (role_id, full_name, login, password_salt, password_hash, is_blocked)
     VALUES (?, 'B2B Web Service', 'b2b-web', 'web', 'not-used-for-login', 0)`,
    [Number(role?.id ?? 3)],
  );
}

async function cleanup(serviceUserId: number) {
  // 1. Заказы, созданные маркетом/сидом
  const orderIds = (await q("SELECT id FROM orders WHERE created_by = ?", [serviceUserId])).map((r) =>
    Number(r.id),
  );
  if (orderIds.length) {
    const ph = orderIds.map(() => "?").join(",");
    await pool().query(
      `DELETE r FROM reservations r JOIN order_items oi ON oi.id = r.order_item_id WHERE oi.order_id IN (${ph})`,
      orderIds,
    );
    await pool().query(`DELETE FROM order_timeline WHERE order_id IN (${ph})`, orderIds);
    await pool().query(`DELETE FROM customer_ledger WHERE order_id IN (${ph})`, orderIds);
    await pool().query(`DELETE FROM payments WHERE order_id IN (${ph})`, orderIds);
    await pool().query(`DELETE FROM order_items WHERE order_id IN (${ph})`, orderIds);
    await pool().query(`DELETE FROM orders WHERE id IN (${ph})`, orderIds);
  }

  // 2. Реализация сида
  const consIds = (await q("SELECT id FROM consignments WHERE created_by = ?", [serviceUserId])).map(
    (r) => Number(r.id),
  );
  if (consIds.length) {
    const ph = consIds.map(() => "?").join(",");
    await pool().query(`DELETE FROM web_consignment_items WHERE consignment_id IN (${ph})`, consIds);
    await pool().query(`DELETE FROM consignments WHERE id IN (${ph})`, consIds);
  }

  // 3. Демо-товары WEB-*
  const variantIds = (
    await q(
      `SELECT v.id FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.sku LIKE 'WEB-%'`,
    )
  ).map((r) => Number(r.id));
  if (variantIds.length) {
    const ph = variantIds.map(() => "?").join(",");
    await pool().query(
      `DELETE sm FROM stock_movements sm
       JOIN pack_items pi ON pi.id = sm.pack_item_id
       JOIN packs pk ON pk.id = pi.pack_id
       WHERE pk.variant_id IN (${ph})`,
      variantIds,
    );
    await pool().query(
      `DELETE pi FROM pack_items pi JOIN packs pk ON pk.id = pi.pack_id WHERE pk.variant_id IN (${ph})`,
      variantIds,
    );
    await pool().query(`DELETE FROM packs WHERE variant_id IN (${ph})`, variantIds);
    await pool().query(`DELETE FROM pack_templates WHERE variant_id IN (${ph})`, variantIds);
  }
  await pool().query("DELETE FROM receipts WHERE created_by = ?", [serviceUserId]);
  await pool().query(
    "DELETE i FROM web_product_images i JOIN products p ON p.id = i.product_id WHERE p.sku LIKE 'WEB-%'",
  );
  await pool().query(
    "DELETE c FROM product_colors c JOIN products p ON p.id = c.product_id WHERE p.sku LIKE 'WEB-%'",
  );
  await pool().query(
    "DELETE d FROM web_product_details d JOIN products p ON p.id = d.product_id WHERE p.sku LIKE 'WEB-%'",
  );
  await pool().query("DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'WEB-%')");
  await pool().query("DELETE FROM products WHERE sku LIKE 'WEB-%'");

  // 5. Демо-клиенты
  const demoCustomers = (await q("SELECT id FROM customers WHERE note = 'b2b demo seed'")).map((r) =>
    Number(r.id),
  );
  if (demoCustomers.length) {
    const ph = demoCustomers.map(() => "?").join(",");
    await pool().query(`DELETE FROM customer_contacts WHERE customer_id IN (${ph})`, demoCustomers);
    await pool().query(`DELETE FROM customer_ledger WHERE customer_id IN (${ph})`, demoCustomers);
    await pool().query(`DELETE FROM customers WHERE id IN (${ph})`, demoCustomers);
  }
}

const demoClients = [
  { email: "client@shop.ru", name: "Ирина Соколова", company: "Бутик «Лана»", group: 1 },
  { email: "opt@moda.ru", name: "Сергей Ковалёв", company: "ООО «Мода-Опт»", group: 2 },
  { email: "vip@trend.ru", name: "Анна Мельник", company: "Сеть «Тренд»", group: 3 },
];
const multipliers = [1.0, 0.95, 0.9];

/** Аккаунты маркета — одни на все филиалы. Возвращает id аккаунтов demoClients. */
async function seedAccounts(): Promise<number[]> {
  await accounts.exec("DELETE FROM web_accounts");
  const adminPass = await bcrypt.hash("admin123", 10);
  const clientPass = await bcrypt.hash("client123", 10);

  await accounts.exec(
    `INSERT INTO web_accounts (email, password_hash, name, role, status)
     VALUES ('admin@market.ru', ?, 'Администратор', 'ADMIN', 'APPROVED')`,
    [adminPass],
  );
  const ids: number[] = [];
  for (const c of demoClients) {
    ids.push(
      await accounts.exec(
        `INSERT INTO web_accounts (email, password_hash, name, company, role, status, price_group_id)
         VALUES (?, ?, ?, ?, 'CLIENT', 'APPROVED', ?)`,
        [c.email, clientPass, c.name, c.company, c.group],
      ),
    );
  }
  await accounts.exec(
    `INSERT INTO web_accounts (email, password_hash, name, company, phone, role, status)
     VALUES ('new@client.ru', ?, 'Дмитрий Орлов', 'ИП Орлов', '+996 700 44-55-66', 'CLIENT', 'PENDING')`,
    [clientPass],
  );
  return ids;
}

/** Демо-данные в CRM текущего филиала; stockBonus — лишние пачки, чтобы остатки филиалов различались. */
async function seedBranch(accountIds: number[], stockBonus: number) {
  await applyMarketSchema();
  const serviceUserId = await ensureServiceUser();
  await cleanup(serviceUserId);

  const sizeRows = await q("SELECT id, title FROM sizes");
  const sizeId = Object.fromEntries(sizeRows.map((s) => [s.title, Number(s.id)]));

  // --- Демо-товары в таблицах CRM -------------------------------------------------
  const S4 = { S: 1, M: 2, L: 2, XL: 1 };
  const S3 = { M: 2, L: 2, XL: 2 };

  const catalog = [
    { sku: "WEB-SR-1021", cat: "Сорочки", title: "Сорочка шёлковая миди", color: "Чёрный", extraColors: ["Белый", "Пудра"], pack: S4, buy: 450, price: 890, sup: "Силуна SeaLuna", fullPacks: 14, openUnits: { M: 3, L: 2, XL: 1 }, fabric: "Искусственный шёлк", comp: "95% полиэстер, 5% эластан", season: "Всесезон", country: "Китай", fit: "Свободный крой, регулируемые бретели", staff: "Хит — перезаказ каждые 2 недели", desc: "Струящаяся сорочка миди с кружевной отделкой по лифу." },
    { sku: "WEB-PJ-2044", cat: "Пижамы", title: "Пижама с шортами из хлопка", color: "Пудра", extraColors: ["Графит", "Мята"], pack: S4, buy: 520, price: 990, sup: "Лили без шов", fullPacks: 20, openUnits: { S: 2, M: 4, XL: 2 }, fabric: "Кулирка", comp: "100% хлопок", season: "Лето", country: "Кыргызстан", fit: "Размер в размер", staff: "", desc: "Пижамный комплект: футболка и шорты из мягкой кулирки." },
    { sku: "WEB-PJ-2067", cat: "Пижамы", title: "Пижама тёплая с брюками", color: "Графит", extraColors: ["Молочный"], pack: S3, buy: 780, price: 1450, sup: "Лили без шов", fullPacks: 12, openUnits: {}, fabric: "Футер с начёсом", comp: "80% хлопок, 20% полиэстер", season: "Зима", country: "Кыргызстан", fit: "Свободная, манжеты на брюках", staff: "Только пачками", desc: "Тёплая пижама из футера трёхнитки с начёсом." },
    { sku: "WEB-HL-3012", cat: "Халаты", title: "Халат вафельный на запах", color: "Молочный", extraColors: ["Лаванда"], pack: S3, buy: 690, price: 1290, sup: "Ориетта", fullPacks: 10, openUnits: { L: 3, XL: 4 }, fabric: "Вафельное полотно", comp: "100% хлопок", season: "Всесезон", country: "Турция", fit: "На запах с поясом", staff: "", desc: "Лёгкий вафельный халат с двумя карманами и поясом." },
    { sku: "WEB-HL-3056", cat: "Халаты", title: "Халат махровый длинный", color: "Лаванда", pack: S3, buy: 1150, price: 1990, sup: "Ориетта", fullPacks: 8, openUnits: {}, fabric: "Махра", comp: "85% хлопок, 15% полиэстер", season: "Зима", country: "Турция", fit: "Длина миди, капюшон", staff: "", desc: "Плотный махровый халат с капюшоном и поясом." },
    { sku: "WEB-KM-4023", cat: "Комплекты", title: "Комплект кружевной (бра + слипы)", color: "Бордо", extraColors: ["Чёрный", "Телесный"], pack: S4, buy: 380, price: 750, sup: "Копа Copa", fullPacks: 24, openUnits: { S: 4, M: 6, XL: 5 }, fabric: "Кружево стрейч", comp: "90% полиамид, 10% эластан", season: "Всесезон", country: "Китай", fit: "Мягкая чашка без косточек", staff: "Ходовой размер XL — заканчивается первым", desc: "Комплект белья из эластичного кружева, мягкая чашка." },
    { sku: "WEB-KM-4051", cat: "Комплекты", title: "Комплект бесшовный базовый", color: "Телесный", extraColors: ["Чёрный"], pack: S4, buy: 320, price: 650, sup: "Лили без шов", fullPacks: 30, openUnits: { M: 5, L: 3 }, fabric: "Бесшовный трикотаж", comp: "92% полиамид, 8% эластан", season: "Всесезон", country: "Кыргызстан", fit: "Анатомическая посадка", staff: "", desc: "Базовый бесшовный комплект под облегающую одежду." },
    { sku: "WEB-DM-5008", cat: "Домашняя одежда", title: "Костюм домашний с лампасами", color: "Серый меланж", extraColors: ["Чёрный"], pack: S3, buy: 850, price: 1590, sup: "Мисс Уу", fullPacks: 9, openUnits: { XL: 3 }, fabric: "Двунитка", comp: "75% хлопок, 25% полиэстер", season: "Деми", country: "Китай", fit: "Свободный, унисекс-крой", staff: "Премиум-сегмент, скидку ниже VIP не давать", desc: "Домашний костюм: свитшот и джоггеры с лампасами." },
    { sku: "WEB-DM-5019", cat: "Домашняя одежда", title: "Туника домашняя с принтом", color: "Мята", pack: S4, buy: 410, price: 790, sup: "Мисс Уу", fullPacks: 16, openUnits: {}, fabric: "Интерлок", comp: "100% хлопок", season: "Лето", country: "Узбекистан", fit: "Свободная, длина до колена", staff: "", desc: "Мягкая домашняя туника с коротким рукавом." },
    { sku: "WEB-SR-1088", cat: "Сорочки", title: "Сорочка хлопковая с кружевом", color: "Белый", extraColors: ["Пудра"], pack: S4, buy: 390, price: 740, sup: "Силуна SeaLuna", fullPacks: 11, openUnits: { S: 2, L: 2 }, fabric: "Батист", comp: "100% хлопок", season: "Лето", country: "Узбекистан", fit: "Маломерит — советовать размер больше", staff: "Маломерит!", desc: "Лёгкая батистовая сорочка с кружевной кокеткой." },
    { sku: "WEB-PJ-2099", cat: "Пижамы", title: "Пижама атласная с рубашкой", color: "Изумруд", extraColors: ["Чёрный"], pack: S4, buy: 720, price: 1350, sup: "Соня 2А30", fullPacks: 7, openUnits: {}, fabric: "Атлас", comp: "97% полиэстер, 3% эластан", season: "Всесезон", country: "Китай", fit: "Свободная рубашка, брюки на резинке", staff: "Залежи с прошлого завоза", desc: "Атласная пижама: рубашка и брюки, отделка кантом." },
    { sku: "WEB-KM-4099", cat: "Комплекты", title: "Комплект пуш-ап классический", color: "Чёрный", pack: S3, buy: 430, price: 820, sup: "Копа Copa", fullPacks: 6, openUnits: {}, fabric: "Микрофибра", comp: "88% полиамид, 12% эластан", season: "Всесезон", country: "Китай", fit: "Чашка пуш-ап на косточках", staff: "Залежи — не продавался давно", desc: "Классический комплект с чашкой пуш-ап." },
  ];

  // поставщики из дампа CRM; в пустой базе создаются
  const supplierTitles = [...new Set(catalog.map((c) => c.sup))];
  await ensureReferenceData(supplierTitles);
  const suppliers = await q(
    `SELECT id, title FROM suppliers WHERE title IN (${supplierTitles.map(() => "?").join(",")})`,
    supplierTitles,
  );
  const supplierByTitle = (t: string) => Number(suppliers.find((s) => s.title === t)!.id);

  const variantBySku: Record<string, number> = {};
  const priceBySku: Record<string, number> = {};
  const packSizeBySku: Record<string, number> = {};
  const colorsBySku: Record<string, string[]> = {};

  const colorHex: Record<string, string> = {
    Чёрный: "#1c1c1c", Белый: "#f4f1ea", Пудра: "#e4c4c0", Графит: "#4a4a4a", Мята: "#9dccc0",
    Молочный: "#f3ead8", Лаванда: "#b0a0c8", Бордо: "#6b1c2a", Телесный: "#e0c4ae",
    "Серый меланж": "#9a9a9a", Изумруд: "#2d6a4f",
  };

  for (const item of catalog) {
    // как create_product в CRM: категория из справочника, цвета в product_colors,
    // один складской вариант (остаток общий на модель), состав пачки на нём
    const colors = [item.color, ...((item as { extraColors?: string[] }).extraColors ?? [])];
    const packSize = Object.values(item.pack).reduce((s, n) => s + n, 0);
    const totalPacks = item.fullPacks + stockBonus + (colors.length - 1) * Math.max(4, Math.floor(item.fullPacks / 2));

    await exec("INSERT IGNORE INTO product_categories (title) VALUES (?)", [item.cat]);
    const category = await one("SELECT id FROM product_categories WHERE title = ?", [item.cat]);
    const productId = await exec(
      `INSERT INTO products (sku, category_id, category, title, description, supplier_id, purchase_price, wholesale_price, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.sku, Number(category?.id), item.cat, item.title, item.desc, supplierByTitle(item.sup), item.buy, item.price, daysAgo(120)],
    );
    priceBySku[item.sku] = item.price;
    packSizeBySku[item.sku] = packSize;
    colorsBySku[item.sku] = colors;

    for (const [i, color] of colors.entries()) {
      await exec("INSERT INTO product_colors (product_id, color, color_hex) VALUES (?, ?, ?)", [
        productId,
        color,
        colorHex[color] ?? null,
      ]);
      await exec("INSERT INTO web_product_images (product_id, color, file_path, sort_order) VALUES (?, ?, ?, ?)", [
        productId,
        color,
        img(`${item.sku}-${color}`),
        i,
      ]);
    }

    await exec(
      `INSERT INTO web_product_details
        (product_id, image_url, fabric, composition, season, country, fit_notes, staff_comment, web_description, is_visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [productId, img(item.sku), item.fabric, item.comp, item.season, item.country, item.fit, item.staff || null, item.desc],
    );

    const receiptId = await exec(
      "INSERT INTO receipts (supplier_id, status, total_sum, created_by, created_at) VALUES (?, 'confirmed', ?, ?, ?)",
      [supplierByTitle(item.sup), item.buy * packSize * totalPacks, serviceUserId, daysAgo(110)],
    );

    const packSet = Object.entries(item.pack)
      .map(([s, n]) => `${s}${n}`)
      .join("/");
    const variantId = await exec(
      "INSERT INTO product_variants (product_id, color, package_set, created_at) VALUES (?, ?, ?, ?)",
      [productId, item.color, packSet, daysAgo(120)],
    );
    variantBySku[item.sku] = variantId;
    for (const [size, qty] of Object.entries(item.pack)) {
      await exec("INSERT INTO pack_templates (variant_id, size_id, qty) VALUES (?, ?, ?)", [variantId, sizeId[size], qty]);
    }
    for (let i = 0; i < totalPacks; i++) {
      const packId = await exec(
        "INSERT INTO packs (variant_id, receipt_id, status, created_at) VALUES (?, ?, 'full', ?)",
        [variantId, receiptId, daysAgo(110)],
      );
      for (const [size, qty] of Object.entries(item.pack)) {
        const packItemId = await exec(
          "INSERT INTO pack_items (pack_id, size_id, initial_qty, available_qty, reserved_qty) VALUES (?, ?, ?, ?, 0)",
          [packId, sizeId[size], qty, qty],
        );
        await exec(
          `INSERT INTO stock_movements (movement_type, pack_item_id, qty, document_type, document_id, created_by, created_at)
           VALUES ('receipt', ?, ?, 'receipt', ?, ?, ?)`,
          [packItemId, qty, receiptId, serviceUserId, daysAgo(110)],
        );
      }
    }
  }

  // --- Клиенты CRM, привязанные к аккаунтам маркета -------------------------------
  const customerIds: number[] = [];
  for (const [i, c] of demoClients.entries()) {
    const customerId = await exec(
      "INSERT INTO customers (name, company, country, city, note) VALUES (?, ?, 'KG', 'Бишкек', 'b2b demo seed')",
      [c.name, c.company],
    );
    customerIds.push(customerId);
    await accounts.exec("INSERT INTO web_account_customers (account_id, branch, customer_id) VALUES (?, ?, ?)", [
      accountIds[i],
      branch().id,
      customerId,
    ]);
  }

  // --- История продаж (~90 дней) в общих таблицах orders --------------------------
  type SeedOrder = {
    client: number;
    ago: number;
    debtDueAgo?: number; // дней назад наступил срок оплаты (для долгов)
    paidShare?: number;
    items: { sku: string; packs?: number; units?: number; size?: string }[];
  };
  const history: SeedOrder[] = [];
  const rng = (seed: number) => () => ((seed = (seed * 9301 + 49297) % 233280), seed / 233280);
  const rand = rng(42);
  const sellable = [
    "WEB-PJ-2044", "WEB-PJ-2067", "WEB-HL-3012", "WEB-HL-3056", "WEB-KM-4023",
    "WEB-KM-4051", "WEB-DM-5008", "WEB-DM-5019", "WEB-SR-1088",
  ];

  for (let day = 88; day >= 1; day--) {
    if (rand() < 0.55) continue;
    const sku = sellable[Math.floor(rand() * sellable.length)];
    history.push({
      client: Math.floor(rand() * 3),
      ago: day,
      paidShare: rand() < 0.7 ? 1 : 0.5,
      items: [{ sku, packs: 1 + Math.floor(rand() * 2) }],
    });
    if (rand() < 0.4) {
      const sizes = ["XL", "XL", "XL", "M", "L", "S"];
      history.push({
        client: Math.floor(rand() * 3),
        ago: day,
        paidShare: 1,
        items: [{ sku: "WEB-KM-4023", units: 1 + Math.floor(rand() * 3), size: sizes[Math.floor(rand() * sizes.length)] }],
      });
    }
  }
  // рост продаж сорочки WEB-SR-1021 три недели подряд
  history.push(
    { client: 0, ago: 20, paidShare: 1, items: [{ sku: "WEB-SR-1021", packs: 1 }] },
    { client: 1, ago: 12, paidShare: 1, items: [{ sku: "WEB-SR-1021", packs: 1 }] },
    { client: 2, ago: 10, paidShare: 1, items: [{ sku: "WEB-SR-1021", packs: 1 }] },
    { client: 0, ago: 5, paidShare: 1, items: [{ sku: "WEB-SR-1021", packs: 2 }] },
    { client: 1, ago: 3, paidShare: 1, items: [{ sku: "WEB-SR-1021", packs: 1 }] },
    { client: 2, ago: 1, paidShare: 1, items: [{ sku: "WEB-SR-1021", packs: 1, units: 2, size: "M" }] },
  );
  // просроченные долги (>30 дней)
  history.push(
    { client: 0, ago: 80, debtDueAgo: 45, paidShare: 0.3, items: [{ sku: "WEB-HL-3056", packs: 6 }] },
    { client: 1, ago: 75, debtDueAgo: 38, paidShare: 0, items: [{ sku: "WEB-DM-5008", packs: 8 }] },
    { client: 2, ago: 20, debtDueAgo: -10, paidShare: 0.5, items: [{ sku: "WEB-PJ-2067", packs: 4 }] },
  );

  for (const h of history) {
    const mult = multipliers[h.client];
    let total = 0;
    const rows: {
      variantId: number;
      saleType: string;
      sizeId: number | null;
      qty: number;
      price: number;
      color: string;
    }[] = [];
    for (const it of h.items) {
      const unitPrice = Math.round(priceBySku[it.sku] * mult);
      const skuColors = colorsBySku[it.sku];
      const color = skuColors[Math.floor(rand() * skuColors.length)];
      if (it.packs) {
        rows.push({
          variantId: variantBySku[it.sku],
          saleType: "pack",
          sizeId: null,
          qty: it.packs,
          price: unitPrice * packSizeBySku[it.sku],
          color,
        });
        total += it.packs * unitPrice * packSizeBySku[it.sku];
      }
      if (it.units) {
        rows.push({
          variantId: variantBySku[it.sku],
          saleType: "unit",
          sizeId: sizeId[it.size ?? "M"],
          qty: it.units,
          price: unitPrice,
          color,
        });
        total += it.units * unitPrice;
      }
    }
    const paid = Math.round(total * (h.paidShare ?? 1));
    const orderId = await exec(
      `INSERT INTO orders (customer_id, status, total_sum, paid_sum, debt_due, comment, created_by, created_at)
       VALUES (?, 'completed', ?, ?, ?, '', ?, ?)`,
      [
        customerIds[h.client],
        total,
        paid,
        h.debtDueAgo !== undefined ? daysAgo(h.debtDueAgo) : paid < total ? daysAgo(-14) : null,
        serviceUserId,
        daysAgo(h.ago),
      ],
    );
    for (const r of rows) {
      await exec(
        "INSERT INTO order_items (order_id, variant_id, size_id, sale_type, qty, price, picked, color) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
        [orderId, r.variantId, r.sizeId, r.saleType, r.qty, r.price, r.color],
      );
    }
    // журнал клиента как в CRM: начисление при отгрузке, оплаты — отдельными записями
    await exec(
      `INSERT INTO customer_ledger (customer_id, order_id, entry_type, amount, created_by, created_at)
       VALUES (?, ?, 'charge', ?, ?, ?)`,
      [customerIds[h.client], orderId, total, serviceUserId, daysAgo(h.ago)],
    );
    if (paid > 0) {
      await exec(
        "INSERT INTO payments (order_id, amount, method, created_by, created_at) VALUES (?, ?, 'cash', ?, ?)",
        [orderId, paid, serviceUserId, daysAgo(h.ago)],
      );
      await exec(
        `INSERT INTO customer_ledger (customer_id, order_id, entry_type, amount, created_by, created_at)
         VALUES (?, ?, 'payment', ?, ?, ?)`,
        [customerIds[h.client], orderId, paid, serviceUserId, daysAgo(h.ago)],
      );
    }
  }

  // свежая заявка с сайта (статус CRM «new») для демо админки
  const pendingTotal = 2 * priceBySku["WEB-PJ-2044"] * packSizeBySku["WEB-PJ-2044"];
  const pendingOrder = await exec(
    `INSERT INTO orders (customer_id, status, total_sum, paid_sum, comment, created_by, created_at)
     VALUES (?, 'new', ?, 0, 'Прошу собрать к пятнице', ?, NOW())`,
    [customerIds[0], pendingTotal, serviceUserId],
  );
  await exec(
    "INSERT INTO order_items (order_id, variant_id, sale_type, qty, price, picked, color) VALUES (?, ?, 'pack', 2, ?, 0, 'Мята')",
    [pendingOrder, variantBySku["WEB-PJ-2044"], priceBySku["WEB-PJ-2044"] * packSizeBySku["WEB-PJ-2044"]],
  );

  // --- Реализация ------------------------------------------------------------------
  const cons1 = await exec(
    "INSERT INTO consignments (customer_id, status, issued_at, created_by) VALUES (?, 'issued', ?, ?)",
    [customerIds[2], daysAgo(120), serviceUserId],
  );
  await exec("INSERT INTO web_consignment_items (consignment_id, variant_id, qty, amount) VALUES (?, ?, ?, ?)", [
    cons1, variantBySku["WEB-HL-3056"], 12, 12 * priceBySku["WEB-HL-3056"],
  ]);
  await exec("INSERT INTO web_consignment_items (consignment_id, variant_id, qty, amount) VALUES (?, ?, ?, ?)", [
    cons1, variantBySku["WEB-KM-4099"], 18, 18 * priceBySku["WEB-KM-4099"],
  ]);
  const cons2 = await exec(
    "INSERT INTO consignments (customer_id, status, issued_at, created_by) VALUES (?, 'issued', ?, ?)",
    [customerIds[0], daysAgo(25), serviceUserId],
  );
  await exec("INSERT INTO web_consignment_items (consignment_id, variant_id, qty, amount) VALUES (?, ?, ?, ?)", [
    cons2, variantBySku["WEB-PJ-2099"], 24, 24 * priceBySku["WEB-PJ-2099"],
  ]);

  console.log(`${branch().name} (${branch().db}): демо-данные готовы, CRM-данные не тронуты.`);
}

async function main() {
  // сид пересоздаёт web_accounts и пишет демо-товары в CRM каждого филиала — только для разработки
  const host = process.env.DB_HOST ?? "127.0.0.1";
  if (!["127.0.0.1", "localhost"].includes(host) && process.env.SEED_FORCE !== "1")
    throw new Error(`Сид запускается только на локальной базе (DB_HOST=${host}). Принудительно: SEED_FORCE=1`);

  await applyAccountsSchema();
  const accountIds = await seedAccounts();
  for (const [i, b] of BRANCHES.entries()) await runInBranch(b, () => seedBranch(accountIds, i * 3));

  console.log("Админ: admin@market.ru / admin123");
  console.log("Клиент: client@shop.ru / client123 (одобрен)");
  console.log("Клиент: new@client.ru / client123 (ожидает одобрения)");
  await closePools();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
