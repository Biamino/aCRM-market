import mysql from "mysql2/promise";

/**
 * Общая база с CRM (crm_v1, MariaDB).
 * Настройки совпадают с docker-compose.yml в корне репозитория.
 */
export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3307),
  user: process.env.DB_USER ?? "crm",
  password: process.env.DB_PASSWORD ?? "crm_pass",
  database: process.env.DB_NAME ?? "crm_v1",
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: false,
  decimalNumbers: false,
});

/** SELECT, возвращающий массив строк. */
export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

/** SELECT одной строки. */
export async function one<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

/** INSERT/UPDATE/DELETE, возвращает insertId. */
export async function exec(sql: string, params: unknown[] = []): Promise<number> {
  const [result] = await pool.query(sql, params);
  return (result as mysql.ResultSetHeader).insertId;
}

/** Транзакция с выделенным соединением. */
export async function tx<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
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

/** DECIMAL приходит из MySQL строкой. */
export const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
