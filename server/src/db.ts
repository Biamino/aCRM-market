import { AsyncLocalStorage } from "node:async_hooks";
import mysql from "mysql2/promise";

/**
 * Филиалы маркета: у каждого своя база CRM (своя C++ CRM) — товары, остатки,
 * клиенты и заказы филиала живут только в ней. Аккаунты маркета общие (ACCOUNTS_DB_NAME).
 *
 * Настройка: BRANCHES='[{"id":"asdem1","name":"Asdem 1","db":"crm_v1",
 *   "crmUploadDir":"/var/crm1/uploads","crmApiOrigin":"http://localhost:8080"}, …]'
 * Хост/логин/пароль MariaDB общие (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD).
 */
export interface Branch {
  id: string;
  name: string;
  db: string;
  /** CRM_UPLOAD_DIR бэкенда филиала; пусто — фото CRM отдаём редиректом на crmApiOrigin */
  crmUploadDir: string;
  crmApiOrigin: string;
  pool: mysql.Pool;
}

interface BranchConfig {
  id: string;
  name: string;
  db: string;
  crmUploadDir?: string;
  crmApiOrigin?: string;
}

const DEFAULT_BRANCHES: BranchConfig[] = [
  { id: "asdem1", name: "Asdem 1", db: process.env.DB_NAME ?? "crm_v1" },
  { id: "asdem2", name: "Asdem 2", db: "crm_dordoi" },
];

const pools = new Map<string, mysql.Pool>();

function poolFor(database: string): mysql.Pool {
  let p = pools.get(database);
  if (!p) {
    p = mysql.createPool({
      host: process.env.DB_HOST ?? "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3307),
      user: process.env.DB_USER ?? "crm",
      password: process.env.DB_PASSWORD ?? "crm_pass",
      database,
      waitForConnections: true,
      connectionLimit: 10,
      dateStrings: false,
      decimalNumbers: false,
    });
    pools.set(database, p);
  }
  return p;
}

const configs: BranchConfig[] = process.env.BRANCHES ? JSON.parse(process.env.BRANCHES) : DEFAULT_BRANCHES;

export const BRANCHES: Branch[] = configs.map((c) => ({
  id: c.id,
  name: c.name,
  db: c.db,
  crmUploadDir: c.crmUploadDir ?? process.env.CRM_UPLOAD_DIR ?? "",
  crmApiOrigin: (c.crmApiOrigin ?? process.env.CRM_API_ORIGIN ?? "http://localhost:8080").replace(/\/+$/, ""),
  pool: poolFor(c.db),
}));

if (BRANCHES.length === 0) throw new Error("BRANCHES: не задано ни одного филиала");

export const DEFAULT_BRANCH = BRANCHES[0];

export const findBranch = (id: unknown) => BRANCHES.find((b) => b.id === id) ?? null;

/** Филиал текущего запроса (заголовок X-Branch), вне запроса — первый. */
const current = new AsyncLocalStorage<Branch>();

export const branch = (): Branch => current.getStore() ?? DEFAULT_BRANCH;

export function runInBranch<T>(b: Branch, fn: () => T): T {
  return current.run(b, fn);
}

/** Пул текущего филиала — для скриптов (сид, схема). */
export const pool = (): mysql.Pool => branch().pool;

/** База аккаунтов маркета (web_accounts, web_price_groups, web_account_customers). */
export const accountsPool = poolFor(process.env.ACCOUNTS_DB_NAME ?? DEFAULT_BRANCH.db);

export async function closePools() {
  await Promise.all([...pools.values()].map((p) => p.end()));
}

function helpers(getPool: () => mysql.Pool) {
  /** SELECT, возвращающий массив строк. */
  async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await getPool().query(sql, params);
    return rows as T[];
  }

  /** SELECT одной строки. */
  async function one<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await q<T>(sql, params);
    return rows[0] ?? null;
  }

  /** INSERT/UPDATE/DELETE, возвращает insertId. */
  async function exec(sql: string, params: unknown[] = []): Promise<number> {
    const [result] = await getPool().query(sql, params);
    return (result as mysql.ResultSetHeader).insertId;
  }

  /** Транзакция с выделенным соединением. */
  async function tx<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  return { q, one, exec, tx };
}

/** Запросы к базе CRM текущего филиала. */
export const { q, one, exec, tx } = helpers(pool);

/** Запросы к базе аккаунтов маркета. */
export const accounts = helpers(() => accountsPool);

/** DECIMAL приходит из MySQL строкой. */
export const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
