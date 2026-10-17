const TOKEN_KEY = "acrm_token";
const BRANCH_KEY = "acrm_branch";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Выбранный филиал: сервер берёт товары, остатки и заказы из его базы CRM. */
export function getBranch(): string | null {
  return localStorage.getItem(BRANCH_KEY);
}

export function setBranch(branch: string) {
  localStorage.setItem(BRANCH_KEY, branch);
}

/** Первый филиал сервера: его товары открываются без ?branch= в адресе. */
let defaultBranch = "";
export function setDefaultBranch(branch: string) {
  defaultBranch = branch;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const branch = getBranch();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(branch ? { "X-Branch": branch } : {}),
  };
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Ошибка запроса (${res.status})`);
  return data as T;
}

export async function apiUpload<T = any>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Ошибка запроса (${res.status})`);
  return data as T;
}

export const fmtMoney = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;

// Статусы заказов CRM (пайплайн new → warehouse → ready → completed), сервер отдаёт их нормализованными
export const ORDER_STATUS: Record<string, string> = {
  new: "На проверке",
  warehouse: "Собирается на складе",
  ready: "К отгрузке",
  completed: "Отгружен",
  canceled: "Отменён",
  returned: "Возвращён",
  partially_returned: "Частичный возврат",
};

/**
 * Ссылка на карточку товара в выбранном цвете. id товаров в филиалах совпадают, поэтому
 * для не первого филиала он попадает в адрес — ссылкой можно делиться.
 */
export function productHref(productId: number, color?: string | null) {
  const params = new URLSearchParams();
  if (color) params.set("color", color);
  const branch = getBranch();
  if (branch && defaultBranch && branch !== defaultBranch) params.set("branch", branch);
  const qs = params.toString();
  return `/product/${productId}${qs ? `?${qs}` : ""}`;
}
