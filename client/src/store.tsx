import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getToken, setToken } from "./api";
import type { CartItem, User } from "./types";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

interface CartState {
  items: CartItem[];
  add: (item: CartItem) => void;
  update: (index: number, patch: Partial<CartItem>) => void;
  remove: (index: number) => void;
  clear: () => void;
  count: number;
  total: number;
}

const AuthContext = createContext<AuthState>(null!);
const CartContext = createContext<CartState>(null!);

const CART_KEY = "acrm_cart";

function loadCart(): CartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((i: CartItem) => ({
        ...i,
        packs: Math.max(0, Math.floor(Number(i.packs) || 0)),
        units: 0,
        size: undefined,
        allowUnits: false,
      }))
      // старые корзины (до перехода на модель + цвет) хранили variantId — их отбрасываем
      .filter((i: CartItem) => i.productId && i.packs > 0);
  } catch {
    return [];
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api<{ user: User | null }>("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const login = useCallback(async (email: string, password: string) => {
    const d = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setItems([]);
  }, []);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === item.productId && (i.color ?? "") === (item.color ?? ""));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          ...item,
          packs: next[idx].packs + item.packs,
          units: 0,
          size: undefined,
          allowUnits: false,
        };
        return next;
      }
      return [...prev, { ...item, units: 0, size: undefined, allowUnits: false }];
    });
  }, []);

  const update = useCallback((index: number, patch: Partial<CartItem>) => {
    setItems((prev) => prev.map((i, idx) => (idx === index ? { ...i, ...patch } : i)));
  }, []);

  const remove = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const cart = useMemo<CartState>(() => {
    const count = items.reduce((s, i) => s + i.packs, 0);
    const total = items.reduce((s, i) => s + i.price * i.packs * i.packSize, 0);
    return { items, add, update, remove, clear, count, total };
  }, [items, add, update, remove, clear]);

  const auth = useMemo<AuthState>(() => ({ user, ready, login, logout }), [user, ready, login, logout]);

  return (
    <AuthContext.Provider value={auth}>
      <CartContext.Provider value={cart}>{children}</CartContext.Provider>
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export const useCart = () => useContext(CartContext);
