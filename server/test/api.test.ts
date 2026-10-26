/**
 * Интеграционные тесты API на двух филиалах (crm_v1 и crm_dordoi).
 * Нужна локальная MariaDB из docker-compose с CRM-схемой в обеих базах;
 * перед тестами база заново заполняется сидом (db/seed.ts).
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { app } from "../src/app.js";
import { accounts, BRANCHES, closePools, pool, runInBranch, q } from "../src/db.js";
import { diskPathFromUrl, thumbPath } from "../src/product-media.js";
import { injectMeta, SITE_URL } from "../src/seo.js";
import sharp from "sharp";

const [B1, B2] = BRANCHES.map((b) => b.id);

let server: Server;
let base = "";

interface Res {
  status: number;
  data: any;
  headers: Headers;
}

async function req(path: string, opts: { token?: string; branch?: string; method?: string; body?: unknown } = {}): Promise<Res> {
  const res = await fetch(`${base}/api${path}`, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.branch ? { "X-Branch": opts.branch } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})), headers: res.headers };
}

async function login(email: string, password: string): Promise<string> {
  const r = await req("/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, r.data.error);
  return r.data.token;
}

const inBranch = <T>(id: string, fn: () => Promise<T>) => runInBranch(BRANCHES.find((b) => b.id === id)!, fn);

let client = "";
let vip = "";
let admin = "";

before(async () => {
  const seed = spawnSync(process.execPath, ["--import", "tsx", "db/seed.ts"], { encoding: "utf8" });
  assert.equal(seed.status, 0, seed.stderr || seed.stdout);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  [client, vip, admin] = await Promise.all([
    login("client@shop.ru", "client123"),
    login("vip@trend.ru", "client123"),
    login("admin@market.ru", "admin123"),
  ]);
});

after(async () => {
  await new Promise((r) => server.close(r));
  await closePools();
});

/** Товар филиала с наличием, видимый клиенту. */
async function stockedProduct(branch: string, token = client) {
  const r = await req("/catalog/products", { branch, token });
  assert.equal(r.status, 200);
  const p = r.data.products.find((x: any) => x.stockPacks > 0);
  assert.ok(p, "нет товара с остатком");
  return p;
}

describe("филиалы", () => {
  it("/branches отдаёт оба филиала и филиал по умолчанию", async () => {
    const r = await req("/branches");
    assert.equal(r.status, 200);
    assert.deepEqual(
      r.data.branches.map((b: any) => b.id),
      [B1, B2],
    );
    assert.equal(r.data.default, B1);
  });

  it("неизвестный филиал — 400", async () => {
    const r = await req("/catalog/products", { branch: "nope" });
    assert.equal(r.status, 400);
  });

  it("без заголовка работает первый филиал, ?branch= тоже принимается", async () => {
    const [noHeader, first, viaQuery] = await Promise.all([
      req("/catalog/products", { token: client }),
      req("/catalog/products", { token: client, branch: B1 }),
      req(`/catalog/products?branch=${B2}`, { token: client }),
    ]);
    assert.deepEqual(noHeader.data.products, first.data.products);
    const second = await req("/catalog/products", { token: client, branch: B2 });
    assert.deepEqual(viaQuery.data.products, second.data.products);
  });

  it("остатки берутся из базы своего филиала", async () => {
    const [a, b] = await Promise.all([
      req("/catalog/products", { token: client, branch: B1 }),
      req("/catalog/products", { token: client, branch: B2 }),
    ]);
    const bySku = new Map(b.data.products.map((p: any) => [p.model, p]));
    const pa = a.data.products.find((p: any) => bySku.has(p.model));
    const pb: any = bySku.get(pa.model);
    // сид кладёт во второй филиал на 3 пачки больше
    assert.equal(pb.stockPacks - pa.stockPacks, 3);
  });

  it("фото CRM ведут в бэкенд своего филиала", async () => {
    const r = await req(`/crm-photos/${B2}/a.jpg`);
    assert.equal(r.status, 302);
    assert.match(r.headers.get("location") ?? "", /\/api\/v1\/uploads\/products\/a\.jpg$/);
    assert.equal((await req("/crm-photos/nope/a.jpg")).status, 404);
    assert.equal((await req(`/crm-photos/${B1}/..%2Fx`)).status, 404);
  });
});

describe("каталог", () => {
  it("гость видит каталог без цен и остатков", async () => {
    const r = await req("/catalog/products", { branch: B2 });
    assert.equal(r.status, 200);
    assert.ok(r.data.total > 0);
    assert.equal(r.data.pricesVisible, false);
    assert.ok(r.data.products.every((p: any) => p.price === null && p.stockPacks === null));
  });

  it("клиент видит цены, цвета и только пачки", async () => {
    const r = await req("/catalog/products", { branch: B2, token: client });
    assert.ok(r.data.products.every((p: any) => p.price !== null && p.stockPacks !== null));
    assert.ok(r.data.products.every((p: any) => p.colors.length >= 1 && p.allowUnits === false));
  });

  it("цена в каталоге одна для всех, скидка VIP — в заказе", async () => {
    const [std, v] = await Promise.all([
      req("/catalog/products", { branch: B2, token: client }),
      req("/catalog/products", { branch: B2, token: vip }),
    ]);
    const p = std.data.products.find((x: any) => x.price > 0);
    const pv = v.data.products.find((x: any) => x.id === p.id);
    assert.equal(pv.price, p.price);
    assert.equal((await req("/auth/me", { token: vip })).data.user.discountPercent, 10);
  });

  it("поиск, категория и карточка товара в выбранном цвете", async () => {
    const cats = await req("/catalog/categories", { branch: B2 });
    assert.ok(cats.data.categories.length > 0);
    assert.ok(cats.data.categories.every((c: any) => c.count > 0 && c.imageUrl), "у категорий есть число моделей и обложка");
    const all = await req("/catalog/products", { branch: B2 });
    assert.equal(cats.data.categories.reduce((s: number, c: any) => s + c.count, 0), all.data.total);
    const cat = cats.data.categories[0].name;
    const byCat = await req(`/catalog/products?category=${encodeURIComponent(cat)}`, { branch: B2 });
    assert.ok(byCat.data.products.every((p: any) => p.category === cat));

    const found = await req(`/catalog/products?q=${encodeURIComponent("Мята")}`, { branch: B2 });
    assert.ok(found.data.products.length > 0);
    assert.ok(found.data.products.every((p: any) => p.colors.some((c: any) => c.color === "Мята")));
    assert.equal(found.data.products[0].color, "Мята");

    const p = found.data.products[0];
    const card = await req(`/catalog/products/${p.id}?color=${encodeURIComponent("Мята")}`, { branch: B2 });
    assert.equal(card.status, 200);
    assert.equal(card.data.product.color, "Мята");
    assert.ok("fabric" in card.data.product);
    assert.equal((await req("/catalog/products/999999", { branch: B2 })).status, 404);
  });
});

describe("авторизация", () => {
  it("неверный пароль и неодобренный аккаунт не входят", async () => {
    assert.equal((await req("/auth/login", { body: { email: "client@shop.ru", password: "x" } })).status, 401);
    assert.equal((await req("/auth/login", { body: { email: "new@client.ru", password: "client123" } })).status, 403);
  });

  it("регистрация: валидация и дубликат e-mail", async () => {
    assert.equal((await req("/auth/register", { body: { email: "a@b.c" } })).status, 400);
    assert.equal(
      (await req("/auth/register", { body: { email: "a@b.c", password: "123", name: "A" } })).status,
      400,
    );
    assert.equal(
      (await req("/auth/register", { body: { email: "client@shop.ru", password: "123456", name: "A" } })).status,
      409,
    );
  });

  it("/auth/me одинаков во всех филиалах", async () => {
    const [a, b] = await Promise.all([
      req("/auth/me", { token: client, branch: B1 }),
      req("/auth/me", { token: client, branch: B2 }),
    ]);
    assert.equal(a.data.user.email, "client@shop.ru");
    assert.deepEqual(a.data.user, b.data.user);
    assert.equal((await req("/auth/me")).data.user, null);
  });
});

describe("заказы", () => {
  it("заказ уходит в CRM выбранного филиала и не виден в другом", async () => {
    const countOrders = (b: string) => inBranch(b, () => q("SELECT COUNT(*) AS n FROM orders")).then((r) => Number(r[0].n));
    const [before1, before2] = [await countOrders(B1), await countOrders(B2)];
    const p = await stockedProduct(B2);
    const r = await req("/orders", { branch: B2, token: client, body: { items: [{ productId: p.id, color: p.color, packs: 1 }] } });
    assert.equal(r.status, 201, r.data.error);
    assert.equal(r.data.order.status, "new");
    assert.equal(r.data.order.items[0].product.color, p.color);
    const id = r.data.order.id;

    const mine2 = await req("/orders", { branch: B2, token: client });
    assert.ok(mine2.data.orders.some((o: any) => o.id === id));
    assert.equal(await countOrders(B1), before1);
    assert.equal(await countOrders(B2), before2 + 1);
  });

  it("сверх остатка и поштучно — отказ; пустая корзина — отказ", async () => {
    const p = await stockedProduct(B1);
    const tooMuch = await req("/orders", { branch: B1, token: client, body: { items: [{ productId: p.id, color: p.color, packs: p.stockPacks + 5 }] } });
    assert.equal(tooMuch.status, 400);
    const units = await req("/orders", { branch: B1, token: client, body: { items: [{ productId: p.id, units: 1 }] } });
    assert.equal(units.status, 400);
    const empty = await req("/orders", { branch: B1, token: client, body: { items: [] } });
    assert.equal(empty.status, 400);
    const badColor = await req("/orders", { branch: B1, token: client, body: { items: [{ productId: p.id, color: "Нет такого", packs: 1 }] } });
    assert.equal(badColor.status, 400);
  });

  it("гость не может заказать, чужой заказ недоступен", async () => {
    assert.equal((await req("/orders", { branch: B1, body: { items: [] } })).status, 401);
    const p = await stockedProduct(B1);
    const r = await req("/orders", { branch: B1, token: client, body: { items: [{ productId: p.id, color: p.color, packs: 1 }] } });
    assert.equal((await req(`/orders/${r.data.order.id}`, { branch: B1, token: vip })).status, 404);
    assert.equal((await req(`/orders/${r.data.order.id}`, { branch: B1, token: client })).status, 200);
    // тот же номер в другом филиале — другой заказ
    const other = await req(`/orders/${r.data.order.id}`, { branch: B2, token: client });
    if (other.status === 200) assert.notEqual(other.data.order.createdAt, r.data.order.createdAt);
  });

  it("новый клиент получает карточку CRM в филиале при первом заказе", async () => {
    // свежий e-mail: контакты в CRM уникальны на всю базу, а клиенты из прошлых прогонов остаются
    const email = `new-${Date.now()}@client.ru`;
    const phone = `+996 5${String(Date.now()).slice(-8)}`; // в CRM такого номера ещё нет
    const reg = await req("/auth/register", { body: { email, password: "client123", name: "Дмитрий Орлов", phone } });
    assert.equal(reg.status, 201, reg.data.error);
    const regs = await req("/admin/registrations", { token: admin });
    const pending = regs.data.users.find((u: any) => u.email === email);
    assert.equal(pending.status, "PENDING");
    assert.deepEqual(pending.crmMatches, [], "в CRM такого клиента нет");
    const appr = await req(`/admin/registrations/${pending.id}/approve`, { token: admin, body: { discountPercent: 5 } });
    assert.equal(appr.status, 200, appr.data.error);
    const token = await login(email, "client123");

    // до первого заказа карточек клиента нет ни в одном филиале
    assert.deepEqual((await req("/orders", { branch: B2, token })).data.orders, []);
    const links = () =>
      accounts.q("SELECT branch, customer_id FROM web_account_customers WHERE account_id = ? ORDER BY branch", [pending.id]);
    assert.deepEqual(await links(), []);

    const p = await stockedProduct(B2, token);
    const r = await req("/orders", { branch: B2, token, body: { items: [{ productId: p.id, color: p.color, packs: 1 }] } });
    assert.equal(r.status, 201, r.data.error);

    const linked = await links();
    assert.deepEqual(linked.map((l) => l.branch), [B2]);
    const customerId = Number(linked[0].customer_id);
    const [customer] = await inBranch(B2, () =>
      q(
        `SELECT c.name, (SELECT value FROM customer_contacts WHERE customer_id = c.id AND contact_type = 'email') AS email
         FROM customers c WHERE c.id = ?`,
        [customerId],
      ),
    );
    assert.equal(customer.name, "Дмитрий Орлов");
    assert.equal(customer.email, email);

    // второй заказ — та же карточка; в первом филиале заказов нет
    await req("/orders", { branch: B2, token, body: { items: [{ productId: p.id, color: p.color, packs: 1 }] } });
    assert.equal((await links()).length, 1);
    assert.equal((await req("/orders", { branch: B2, token })).data.orders.length, 2);
    assert.deepEqual((await req("/orders", { branch: B1, token })).data.orders, []);

    // скидка 5% пишется в заказ: позиции по базовой цене, total_sum — к оплате
    const std = (await req(`/catalog/products/${p.id}`, { branch: B2, token: client })).data.product;
    assert.equal(p.price, std.price);
    const order = r.data.order;
    assert.equal(order.items[0].unitPrice, p.price);
    assert.equal(order.discountPercent, 5);
    assert.equal(order.discount, Math.round(order.subtotal * 0.05));
    assert.equal(order.total, order.subtotal - order.discount);
    const [row] = await inBranch(B2, () => q("SELECT total_sum, discount_sum FROM orders WHERE id = ?", [order.id]));
    assert.equal(Number(row.total_sum), order.total);
    assert.equal(Number(row.discount_sum), order.discount);

    // админ меняет скидку — действует на следующие заказы
    const set = await req(`/admin/registrations/${pending.id}/discount`, {
      token: admin,
      method: "PUT",
      body: { discountPercent: 12.5 },
    });
    assert.equal(set.status, 200, set.data.error);
    const r2 = await req("/orders", { branch: B2, token, body: { items: [{ productId: p.id, color: p.color, packs: 1 }] } });
    assert.equal(r2.data.order.discount, Math.round(r2.data.order.subtotal * 0.125));
    assert.equal(
      (await req(`/admin/registrations/${pending.id}/discount`, { token: admin, method: "PUT", body: { discountPercent: 150 } })).status,
      400,
    );
  });
});

describe("клиент, который уже есть в CRM", () => {
  it("по телефону привязывается к его карточке и видит заказы из CRM", async () => {
    // номер без ведущего нуля — иначе phoneKey срежет его и останется меньше 9 цифр
    const digits = `7${String(Date.now()).slice(-8)}`;
    const crmPhone = `+996 (${digits.slice(0, 3)}) ${digits.slice(3, 5)}-${digits.slice(5, 7)}-${digits.slice(7)}`;
    // клиент магазина, заведённый в CRM второго филиала, с заказом через менеджера
    const { customerId, orderId } = await inBranch(B2, async () => {
      const [cr]: any = await pool().query(
        "INSERT INTO customers (name, company, note) VALUES ('Айгуль Магазин', 'ИП Айгуль', 'клиент CRM')",
      );
      await pool().query(
        "INSERT INTO customer_contacts (customer_id, contact_type, value, is_primary) VALUES (?, 'phone', ?, 1)",
        [cr.insertId, crmPhone],
      );
      // менеджер CRM (не служебный b2b-web) — по нему заказ помечается «Из CRM»
      await pool().query(
        `INSERT IGNORE INTO users (role_id, full_name, login, password_salt, password_hash, is_blocked)
         SELECT id, 'Менеджер CRM', 'test-manager', 's', 'h', 0 FROM roles WHERE code = 'employee'`,
      );
      const user = await q<any>("SELECT id FROM users WHERE login = 'test-manager'");
      const [or]: any = await pool().query(
        "INSERT INTO orders (customer_id, status, total_sum, paid_sum, comment, created_by) VALUES (?, 'completed', 5000, 5000, 'заказ через менеджера', ?)",
        [cr.insertId, user[0].id],
      );
      return { customerId: Number(cr.insertId), orderId: Number(or.insertId) };
    });

    // регистрируется с тем же номером в другой записи
    const email = `crm-${digits}@shop.kg`;
    await req("/auth/register", { body: { email, password: "client123", name: "Айгуль", phone: `0${digits}` } });
    const regs = await req("/admin/registrations", { token: admin });
    const pending = regs.data.users.find((u: any) => u.email === email);
    assert.deepEqual(
      pending.crmMatches.map((m: any) => [m.branch, m.customerId, m.by]),
      [[B2, customerId, "phone"]],
      "админ видит совпадение до одобрения",
    );
    await req(`/admin/registrations/${pending.id}/approve`, { token: admin, body: {} });
    const token = await login(email, "client123");

    // история из CRM видна сразу, ещё до заказа на сайте; в другом филиале — пусто
    const mine = await req("/orders", { branch: B2, token });
    assert.deepEqual(mine.data.orders.map((o: any) => o.id), [orderId]);
    assert.equal(mine.data.orders[0].source, "crm");
    assert.equal((await req(`/orders/${orderId}`, { branch: B2, token })).status, 200);
    assert.deepEqual((await req("/orders", { branch: B1, token })).data.orders, []);

    // заказ с сайта — на ту же карточку, новый клиент не создаётся, e-mail дописан в карточку
    const p = await stockedProduct(B2, token);
    const before = await inBranch(B2, () => q<any>("SELECT COUNT(*) AS n FROM customers")).then((r) => Number(r[0].n));
    const r = await req("/orders", { branch: B2, token, body: { items: [{ productId: p.id, color: p.color, packs: 1 }] } });
    assert.equal(r.status, 201, r.data.error);
    assert.equal(r.data.order.source, "web");
    const sources = (await req("/admin/orders", { branch: B2, token: admin })).data.orders
      .filter((o: any) => [orderId, r.data.order.id].includes(o.id))
      .map((o: any) => [o.id, o.source]);
    assert.deepEqual(sources, [
      [r.data.order.id, "web"],
      [orderId, "crm"],
    ]);
    const [row] = await inBranch(B2, () => q<any>("SELECT customer_id FROM orders WHERE id = ?", [r.data.order.id]));
    assert.equal(Number(row.customer_id), customerId);
    assert.equal(await inBranch(B2, () => q<any>("SELECT COUNT(*) AS n FROM customers")).then((x) => Number(x[0].n)), before);
    const contacts = await inBranch(B2, () =>
      q<any>("SELECT contact_type, value FROM customer_contacts WHERE customer_id = ? ORDER BY contact_type", [customerId]),
    );
    assert.deepEqual(contacts.map((c: any) => c.contact_type), ["email", "phone"]);
    assert.equal(contacts.find((c: any) => c.contact_type === "phone").value, crmPhone, "телефон в CRM не перезаписан");
  });
});

describe("админка", () => {
  it("закрыта для клиента и гостя", async () => {
    assert.equal((await req("/admin/orders", { token: client })).status, 403);
    assert.equal((await req("/analytics/top")).status, 401);
    assert.equal((await req("/insights", { token: client })).status, 403);
  });

  it("заказы админки — по филиалу; склад → отмена возвращает остаток", async () => {
    const p = await stockedProduct(B2);
    const r = await req("/orders", { branch: B2, token: client, body: { items: [{ productId: p.id, color: p.color, packs: 1 }] } });
    const id = r.data.order.id;

    const list2 = await req("/admin/orders", { branch: B2, token: admin });
    assert.ok(list2.data.orders.some((o: any) => o.id === id && o.user.name === "Ирина Соколова"));

    const status = (s: string, branch = B2) => req(`/admin/orders/${id}/status`, { branch, token: admin, body: { status: s } });
    assert.equal((await status("bogus")).status, 400);
    assert.equal((await status("warehouse")).status, 200);
    const reserved = (await req(`/catalog/products/${p.id}`, { branch: B2, token: client })).data.product;
    assert.equal(reserved.stockPacks, p.stockPacks - 1);
    assert.equal((await status("completed")).status, 400, "несобранный заказ не отгружается");
    assert.equal((await status("canceled")).status, 200);
    const back = (await req(`/catalog/products/${p.id}`, { branch: B2, token: client })).data.product;
    assert.equal(back.stockPacks, p.stockPacks);
    assert.equal((await status("canceled")).status, 400, "закрытый заказ не меняется");
  });

  it("полный цикл: склад → собран в CRM → отгрузка начисляет долг", async () => {
    const p = await stockedProduct(B2);
    const r = await req("/orders", { branch: B2, token: client, body: { items: [{ productId: p.id, color: p.color, packs: 1 }] } });
    const id = r.data.order.id;
    await req(`/admin/orders/${id}/status`, { branch: B2, token: admin, body: { status: "warehouse" } });
    // сборку отмечает склад в CRM
    await inBranch(B2, () => q("UPDATE orders SET status = 'ready' WHERE id = ?", [id]));
    const done = await req(`/admin/orders/${id}/status`, { branch: B2, token: admin, body: { status: "completed" } });
    assert.equal(done.status, 200, done.data.error);
    const [ledger] = await inBranch(B2, () =>
      q("SELECT entry_type, amount FROM customer_ledger WHERE order_id = ?", [id]),
    );
    assert.equal(ledger.entry_type, "charge");
    assert.equal(Number(ledger.amount), r.data.order.total);
    const after = (await req(`/catalog/products/${p.id}`, { branch: B2, token: client })).data.product;
    assert.equal(after.stockPacks, p.stockPacks - 1);
  });

  it("видимость товара переключается только в своём филиале", async () => {
    const list = await req("/admin/products?visibility=visible", { branch: B2, token: admin });
    assert.equal(list.status, 200);
    const target = list.data.products[0];
    const hide = await req(`/admin/products/${target.id}/visibility`, { branch: B2, token: admin, method: "PATCH", body: { isVisible: false } });
    assert.equal(hide.status, 200);
    assert.equal((await req(`/catalog/products/${target.id}`, { branch: B2 })).status, 404);
    // в первом филиале товар с тем же id не тронут
    const [vis1] = await inBranch(B1, () =>
      q("SELECT is_visible FROM web_product_details WHERE product_id = ?", [target.id]),
    );
    assert.equal(Number(vis1?.is_visible ?? 1), 1);
    const bulk = await req("/admin/products/visibility/bulk", { branch: B2, token: admin, body: { productIds: [target.id], isVisible: true } });
    assert.equal(bulk.data.updated, 1);
    assert.equal((await req(`/catalog/products/${target.id}`, { branch: B2 })).status, 200);
  });

  it("фото маркета сжимаются в WebP с превью и лежат в папке филиала", async () => {
    const list = await req("/admin/products", { branch: B2, token: admin });
    const target = list.data.products[0];
    // «фото с телефона»: 3000×4000
    const png = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: "#b0a3cd" } }).png().toBuffer();
    const form = new FormData();
    form.append("photos", new Blob([new Uint8Array(png)], { type: "image/png" }), "a.png");
    const up = await fetch(`${base}/api/admin/products/${target.id}/images?color=`, {
      method: "POST",
      headers: { Authorization: `Bearer ${admin}`, "X-Branch": B2 },
      body: form,
    });
    const data = await up.json();
    assert.equal(up.status, 200, data.error);
    const url: string = data.images[0].url;
    assert.ok(url.startsWith(`/uploads/${B2}/products/${target.id}/`), url);
    assert.match(url, /\.opt\.webp$/);
    const full = await sharp(readFileSync(diskPathFromUrl(url))).metadata();
    assert.equal(full.format, "webp");
    assert.equal(Math.max(full.width!, full.height!), 1600);
    const thumb = diskPathFromUrl(thumbPath(url)!);
    assert.equal((await sharp(readFileSync(thumb)).metadata()).width, 640);

    const bad = new FormData();
    bad.append("photos", new Blob([new TextEncoder().encode("not an image")], { type: "image/png" }), "x.png");
    const badUp = await fetch(`${base}/api/admin/products/${target.id}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${admin}`, "X-Branch": B2 },
      body: bad,
    });
    assert.equal(badUp.status, 400, "битый файл отклоняется");

    const del = await req(`/admin/products/${target.id}/images/${data.images[0].id}`, { branch: B2, token: admin, method: "DELETE" });
    assert.equal(del.status, 200);
    assert.ok(!existsSync(diskPathFromUrl(url)));
    assert.ok(!existsSync(thumb), "превью удаляется вместе с фото");
  });

  it("настройки (порог залежей) у каждого филиала свои", async () => {
    await req("/admin/settings/staleDays", { branch: B2, token: admin, method: "PUT", body: { value: 45 } });
    const [s1, s2] = await Promise.all([
      req("/admin/settings", { branch: B1, token: admin }),
      req("/admin/settings", { branch: B2, token: admin }),
    ]);
    assert.equal(s1.data.settings.staleDays, "30");
    assert.equal(s2.data.settings.staleDays, "45");
    assert.equal((await req("/analytics/stale", { branch: B2, token: admin })).data.days, 45);
  });

  it("скидки клиентов и заявки — общие", async () => {
    const [r1, r2] = await Promise.all([
      req("/admin/registrations", { branch: B1, token: admin }),
      req("/admin/registrations", { branch: B2, token: admin }),
    ]);
    const vipIn = (r: any) => r.data.users.find((u: any) => u.email === "vip@trend.ru").discountPercent;
    assert.equal(vipIn(r1), 10);
    assert.equal(vipIn(r2), 10);
    const reg = await req("/auth/register", { body: { email: "reject@me.ru", password: "123456", name: "R" } });
    assert.equal(reg.status, 201);
    const regs = await req("/admin/registrations", { branch: B2, token: admin });
    const u = regs.data.users.find((x: any) => x.email === "reject@me.ru");
    assert.equal((await req(`/admin/registrations/${u.id}/reject`, { token: admin, body: {} })).status, 200);
    assert.equal((await req("/auth/login", { body: { email: "reject@me.ru", password: "123456" } })).status, 403);
    assert.equal((await req("/admin/registrations/999999/approve", { token: admin, body: {} })).status, 404);
  });

  for (const branch of [B1, B2]) {
    it(`аналитика и выводы отвечают (${branch})`, async () => {
      for (const path of ["top", "stale?days=30", "dynamics?granularity=week", "categories", "suppliers", "debts", "consignment"]) {
        const r = await req(`/analytics/${path}`, { branch, token: admin });
        assert.equal(r.status, 200, `${path}: ${r.data.error}`);
      }
      const top = await req("/analytics/top?from=2000-01-01", { branch, token: admin });
      assert.ok(top.data.products.length > 0);
      const debts = await req("/analytics/debts", { branch, token: admin });
      assert.ok(debts.data.total > 0);
      const ins = await req("/insights", { branch, token: admin });
      assert.equal(ins.status, 200);
      assert.ok(ins.data.insights.length > 0);
    });
  }

  it("неизвестный API-путь — JSON 404", async () => {
    const r = await req("/nope");
    assert.equal(r.status, 404);
    assert.ok(r.data.error);
  });
});

describe("SEO и отдача", () => {
  it("robots.txt закрывает служебные разделы и ведёт на sitemap", async () => {
    const r = await fetch(`${base}/robots.txt`);
    const text = await r.text();
    assert.equal(r.status, 200);
    assert.match(text, /Disallow: \/admin/);
    assert.ok(text.includes(`Sitemap: ${SITE_URL}/sitemap.xml`));
  });

  it("sitemap.xml: только публичные страницы — каталог и модели закрыты до входа", async () => {
    const text = await (await fetch(`${base}/sitemap.xml`)).text();
    assert.match(text, /^<\?xml/);
    assert.ok(text.includes(`${SITE_URL}/register</loc>`));
    assert.ok(text.includes(`${SITE_URL}/legal/returns`));
    assert.ok(!text.includes("/product/"), "модели доступны только после входа");
    assert.ok(!text.includes("?category="));
  });

  it("ответы API сжимаются", async () => {
    const r = await fetch(`${base}/api/catalog/products`, { headers: { "Accept-Encoding": "gzip" } });
    assert.equal(r.headers.get("content-encoding"), "gzip");
  });

  it("injectMeta подставляет title, description и OG модели", () => {
    const html = `<title>x</title><meta name="description" content="d" /><link rel="canonical" href="c" />
<meta property="og:url" content="u" /><meta property="og:type" content="website" /><meta property="og:title" content="t" />
<meta property="og:description" content="d" /><meta property="og:image" content="i" /><meta property="og:image:width" content="1200" />`;
    const out = injectMeta(html, { title: "Пижама <A> & B", description: "Опт", url: "https://s/p/1", image: "https://s/1.jpg", type: "product" });
    assert.ok(out.includes("<title>Пижама &lt;A> &amp; B</title>"));
    assert.ok(out.includes('og:image" content="https://s/1.jpg"'));
    assert.ok(out.includes('og:type" content="product"'));
    assert.ok(!out.includes("og:image:width"));
  });
});
