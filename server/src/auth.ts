import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { num, one } from "./db.js";

export const JWT_SECRET = process.env.JWT_SECRET ?? "acrm-market-dev-secret";

export interface AuthUser {
  id: number;
  customerId: number | null;
  email: string;
  name: string;
  role: string;
  status: string;
  priceMultiplier: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(accountId: number): string {
  return jwt.sign({ sub: accountId }, JWT_SECRET, { expiresIn: "7d" });
}

async function loadUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as unknown as { sub: number };
    const row = await one(
      `SELECT a.id, a.customer_id, a.email, a.name, a.role, a.status, g.multiplier
       FROM web_accounts a
       LEFT JOIN web_price_groups g ON g.id = a.price_group_id
       WHERE a.id = ?`,
      [Number(payload.sub)],
    );
    if (!row) return null;
    return {
      id: Number(row.id),
      customerId: row.customer_id === null ? null : Number(row.customer_id),
      email: row.email,
      name: row.name,
      role: row.role,
      status: row.status,
      priceMultiplier: row.multiplier === null ? 1 : num(row.multiplier),
    };
  } catch {
    return null;
  }
}

/** Прикрепляет пользователя, если токен валиден; не отклоняет запрос. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await loadUser(req);
  if (user) req.user = user;
  next();
}

/** Требуется одобренный аккаунт. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await loadUser(req);
  if (!user) return res.status(401).json({ error: "Требуется авторизация" });
  if (user.status !== "APPROVED")
    return res.status(403).json({ error: "Аккаунт ещё не одобрен администратором" });
  req.user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await loadUser(req);
  if (!user) return res.status(401).json({ error: "Требуется авторизация" });
  if (user.role !== "ADMIN") return res.status(403).json({ error: "Доступ только для администратора" });
  req.user = user;
  next();
}
