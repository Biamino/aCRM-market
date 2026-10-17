/**
 * Смоук-тест против запущенного API (localhost:4000) на общей базе crm_v1.
 * Учётные записи — из server/db/seed.ts.
 */
const BASE = "http://localhost:4000/api";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function req(path: string, opts: RequestInit = {}, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function login(email: string, password: string) {
  const { data } = await req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  return data.token as string | undefined;
}

async function main() {
  // V2-W04/W01: гость не видит цены и остатки
  const guest = await req("/catalog/products");
  check("Гость: каталог доступен", guest.status === 200 && guest.data.total > 0, `total=${guest.data.total}`);
  check(
    "Гость: цены и остатки скрыты",
    guest.data.products.every((p: any) => p.price === null && p.stockPacks === null),
  );

  // V2-W02: логин клиента
  const clientToken = await login("client@shop.ru", "client123");
  check("Клиент: авторизация", Boolean(clientToken));

  const authed = await req("/catalog/products", {}, clientToken);
  check(
    "Клиент: цены и остатки видны",
    authed.data.products.every((p: any) => p.price !== null && p.stockPacks !== null),
  );
  check(
    "Каталог: у товаров есть цвета",
    authed.data.products.every((p: any) => Array.isArray(p.colors) && p.colors.length >= 1),
  );
  check(
    "Каталог: поштучно нельзя",
    authed.data.products.every((p: any) => p.allowUnits === false),
  );

  // Ценовые группы: у VIP цена ниже (ищем товар с ненулевой ценой)
  const vipToken = await login("vip@trend.ru", "client123");
  const vip = await req("/catalog/products", {}, vipToken);
  const priced = authed.data.products.find((p: any) => p.price > 0);
  const vipPriced = vip.data.products.find((p: any) => p.id === priced?.id);
  check(
    "Ценовые группы: VIP-цена ниже стандартной",
    Boolean(priced && vipPriced && vipPriced.price < priced.price),
  );

  // V2-W01: неодобренный клиент не может войти
  const pendingLogin = await req("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "new@client.ru", password: "client123" }),
  });
  check("Неодобренный клиент: вход запрещён", pendingLogin.status === 403);

  // товар с наличием пачек
  const product =
    authed.data.products.find((p: any) => p.stockPacks > 0) ?? authed.data.products[0];

  // V2-W05: нельзя заказать больше доступного
  const tooMuch = await req(
    "/orders",
    {
      method: "POST",
      body: JSON.stringify({ items: [{ productId: product.id, color: product.color, packs: (product.stockPacks ?? 0) + 5 }] }),
    },
    clientToken,
  );
  check("Корзина: заказ сверх остатка отклонён", tooMuch.status === 400);

  const unitOrder = await req(
    "/orders",
    {
      method: "POST",
      body: JSON.stringify({ items: [{ productId: product.id, packs: 0, units: 1, size: "M" }] }),
    },
    clientToken,
  );
  check("Корзина: поштучный заказ отклонён", unitOrder.status === 400);

  // V2-W06: заявка → заказ CRM в статусе new, цвет сохраняется в позиции
  const order = await req(
    "/orders",
    { method: "POST", body: JSON.stringify({ items: [{ productId: product.id, color: product.color, packs: 1 }] }) },
    clientToken,
  );
  check(
    "Заявка: создана как новый заказ CRM",
    order.status === 201 && order.data.order?.status === "new",
    order.data.error ?? order.data.order?.status,
  );
  check(
    "Заявка: цвет позиции сохранён",
    order.data.order?.items?.[0]?.product?.color === product.color,
    order.data.order?.items?.[0]?.product?.color,
  );

  // V2-W07: чужие заказы недоступны
  if (order.data.order?.id) {
    const foreign = await req(`/orders/${order.data.order.id}`, {}, vipToken);
    check("История: чужой заказ недоступен", foreign.status === 404);

    const own = await req(`/orders/${order.data.order.id}`, {}, clientToken);
    check("История: свой заказ доступен", own.status === 200);
  }

  // Админ: аналитика закрыта для клиента
  const forbidden = await req("/analytics/top", {}, clientToken);
  check("Аналитика: закрыта для клиента", forbidden.status === 403);

  const adminToken = await login("admin@market.ru", "admin123");
  check("Админ: авторизация", Boolean(adminToken));

  if (order.data.order?.id) {
    const confirm = await req(
      `/admin/orders/${order.data.order.id}/status`,
      { method: "POST", body: JSON.stringify({ status: "warehouse" }) },
      adminToken,
    );
    check("Админ: заказ передан на склад (резерв)", confirm.status === 200, confirm.data.error);
    const early = await req(
      `/admin/orders/${order.data.order.id}/status`,
      { method: "POST", body: JSON.stringify({ status: "completed" }) },
      adminToken,
    );
    check("Админ: несобранный заказ не отгружается", early.status === 400);
    const cancel = await req(
      `/admin/orders/${order.data.order.id}/status`,
      { method: "POST", body: JSON.stringify({ status: "canceled" }) },
      adminToken,
    );
    check("Админ: отмена снимает резерв", cancel.status === 200, cancel.data.error);
    const after = await req("/catalog/products", {}, clientToken);
    const same = after.data.products.find((p: any) => p.id === product.id);
    check("Остаток вернулся после отмены", same?.stockPacks === product.stockPacks, `${same?.stockPacks} vs ${product.stockPacks}`);
  }

  // V2-AN01..AN07
  const endpoints = [
    ["top", "Лучшие товары"],
    ["stale?days=30", "Залежавшиеся"],
    ["dynamics?granularity=week", "Динамика"],
    ["categories", "Категории"],
    ["suppliers", "Поставщики"],
    ["debts", "Долги"],
    ["consignment", "Реализация"],
  ] as const;
  for (const [path, name] of endpoints) {
    const r = await req(`/analytics/${path}`, {}, adminToken);
    check(`Аналитика: ${name}`, r.status === 200, r.data.error);
  }

  // 6.3: текстовые выводы (на реальных данных набор может отличаться)
  const ins = await req("/insights", {}, adminToken);
  check("Выводы: эндпоинт отвечает", ins.status === 200 && Array.isArray(ins.data.insights));

  // Одобрение регистрации (если есть PENDING)
  const regs = await req("/admin/registrations", {}, adminToken);
  const groups = await req("/admin/price-groups", {}, adminToken);
  const pending = regs.data.users?.find((u: any) => u.status === "PENDING");
  if (pending) {
    const appr = await req(
      `/admin/registrations/${pending.id}/approve`,
      { method: "POST", body: JSON.stringify({ priceGroupId: groups.data.groups[0].id }) },
      adminToken,
    );
    check("Регистрация: одобрение админом", appr.status === 200);
    const nowLogin = await login("new@client.ru", "client123");
    check("Регистрация: после одобрения вход работает", Boolean(nowLogin));
  } else {
    check("Регистрация: нет PENDING (уже одобрено ранее)", true);
  }

  console.log(`\nИтого: ${passed} passed, ${failed} failed`);
  console.log(`Каталог CRM: ${guest.data.total} моделей`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
