const TOKEN_KEY = "acrm_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Ошибка запроса (${res.status})`);
  return data as T;
}

export async function apiUpload<T = any>(path: string, form: FormData): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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

/** Ссылка на карточку товара в выбранном цвете. */
export const productHref = (productId: number, color?: string | null) =>
  color ? `/product/${productId}?color=${encodeURIComponent(color)}` : `/product/${productId}`;
