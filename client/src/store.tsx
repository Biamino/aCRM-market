import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, getBranch, getToken, setBranch as storeBranch, setDefaultBranch, setToken } from "./api";
import type { Branch, CartItem, User } from "./types";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

interface BranchState {
  branches: Branch[];
  /** id выбранного филиала ("" — пока список не загружен, сервер берёт первый) */
  branch: string;
  branchName: string;
  setBranch: (id: string) => void;
  /**
   * Ключ для перемонтирования страниц: меняется, только когда данные филиала действительно
   * другие (выбор пользователя), а не когда новому посетителю проставляется филиал по умолчанию —
   * его запросы и так шли в первый филиал, перерисовка дала бы лишний скачок вёрстки.
   */
  pageKey: number;
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
const BranchContext = createContext<BranchState>(null!);

/** Корзины по филиалам: id товаров в базах филиалов пересекаются, заказ уходит в один филиал. */
const CARTS_KEY = "acrm_carts";
type Carts = Record<string, CartItem[]>;

function sanitize(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((i: CartItem) => ({
      ...i,
      packs: Math.max(0, Math.floor(Number(i.packs) || 0)),
      units: 0,
      size: undefined,
      allowUnits: false,
    }))
    // старые корзины (до перехода на модель + цвет) хранили variantId — их отбрасываем
    .filter((i: CartItem) => i.productId && i.packs > 0);
}

function loadCarts(): Carts {
  // корзина до разделения на филиалы — не знаем, чьи в ней товары
  localStorage.removeItem("acrm_cart");
  try {
    const raw = JSON.parse(localStorage.getItem(CARTS_KEY) ?? "{}");
    if (!raw || typeof raw !== "object") return {};
    return Object.fromEntries(Object.entries(raw).map(([b, items]) => [b, sanitize(items)]));
  } catch {
    return {};
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branch, setBranchState] = useState(() => {
    // ссылка с ?branch= (поделились товаром филиала) важнее сохранённого выбора
    const fromUrl = new URLSearchParams(window.location.search).get("branch");
    if (fromUrl) storeBranch(fromUrl);
    return fromUrl ?? getBranch() ?? "";
  });
  const [carts, setCarts] = useState<Carts>(loadCarts);
  const items = useMemo(() => carts[branch] ?? [], [carts, branch]);

  const [pageKey, setPageKey] = useState(0);

  const branchRef = useRef(branch);
  branchRef.current = branch;

  const setBranch = useCallback((id: string) => {
    storeBranch(id);
    if (branchRef.current !== id) setPageKey((k) => k + 1);
    setBranchState(id);
  }, []);

  useEffect(() => {
    api<{ branches: Branch[]; default: string }>("/branches")
      .then((d) => {
        setDefaultBranch(d.default);
        setBranches(d.branches);
        const saved = getBranch();
        if (!saved) {
          // новый посетитель: запросы без X-Branch уже ушли в первый филиал — страницу не трогаем
          storeBranch(d.default);
          setBranchState(d.default);
        } else if (!d.branches.some((b) => b.id === saved)) {
          // сохранённый филиал исчез из настроек сервера — его запросы падали, перезагружаем страницу
          setBranch(d.default);
        }
      })
      .catch(() => {});
  }, [setBranch]);

  /** Изменить корзину выбранного филиала. */
  const setItems = useCallback(
    (fn: (prev: CartItem[]) => CartItem[]) => setCarts((all) => ({ ...all, [branch]: fn(all[branch] ?? []) })),
    [branch],
  );

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
    localStorage.setItem(CARTS_KEY, JSON.stringify(carts));
  }, [carts]);

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
    setCarts({});
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
  }, [setItems]);

  const update = useCallback((index: number, patch: Partial<CartItem>) => {
    setItems((prev) => prev.map((i, idx) => (idx === index ? { ...i, ...patch } : i)));
  }, [setItems]);

  const remove = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }, [setItems]);

  const clear = useCallback(() => setItems(() => []), [setItems]);

  const cart = useMemo<CartState>(() => {
    const count = items.reduce((s, i) => s + i.packs, 0);
    const total = items.reduce((s, i) => s + i.price * i.packs * i.packSize, 0);
    return { items, add, update, remove, clear, count, total };
  }, [items, add, update, remove, clear]);

  const auth = useMemo<AuthState>(() => ({ user, ready, login, logout }), [user, ready, login, logout]);

  const branchState = useMemo<BranchState>(
    () => ({
      branches,
      branch,
      branchName: branches.find((b) => b.id === branch)?.name ?? "",
      setBranch,
      pageKey,
    }),
    [branches, branch, setBranch, pageKey],
  );

  return (
    <AuthContext.Provider value={auth}>
      <BranchContext.Provider value={branchState}>
        <CartContext.Provider value={cart}>{children}</CartContext.Provider>
      </BranchContext.Provider>
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export const useCart = () => useContext(CartContext);
export const useBranch = () => useContext(BranchContext);
