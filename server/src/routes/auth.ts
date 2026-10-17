import { Router } from "express";
import bcrypt from "bcryptjs";
import { exec, one } from "../db.js";
import { optionalAuth, signToken } from "../auth.js";

export const authRouter = Router();

// V2-W01: закрытая регистрация — заявка, ждёт одобрения администратором
authRouter.post("/register", async (req, res) => {
  const { email, password, name, company, phone } = req.body ?? {};
  if (!email || !password || !name)
    return res.status(400).json({ error: "Укажите имя, e-mail и пароль" });
  if (String(password).length < 6)
    return res.status(400).json({ error: "Пароль должен быть не короче 6 символов" });

  const existing = await one("SELECT id FROM web_accounts WHERE email = ?", [email]);
  if (existing) return res.status(409).json({ error: "Пользователь с таким e-mail уже существует" });

  await exec(
    `INSERT INTO web_accounts (email, password_hash, name, company, phone, role, status)
     VALUES (?, ?, ?, ?, ?, 'CLIENT', 'PENDING')`,
    [email, await bcrypt.hash(password, 10), name, company || null, phone || null],
  );
  res.status(201).json({ message: "Заявка отправлена. Доступ откроется после одобрения администратором." });
});

// V2-W02: авторизация по логину/паролю
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const account = await one("SELECT * FROM web_accounts WHERE email = ?", [email ?? ""]);
  if (!account || !(await bcrypt.compare(password ?? "", account.password_hash)))
    return res.status(401).json({ error: "Неверный e-mail или пароль" });
  if (account.status === "PENDING")
    return res.status(403).json({ error: "Заявка на рассмотрении. Дождитесь одобрения администратора." });
  if (account.status === "REJECTED")
    return res.status(403).json({ error: "Заявка отклонена. Свяжитесь с менеджером." });

  res.json({
    token: signToken(Number(account.id)),
    user: { id: Number(account.id), email: account.email, name: account.name, role: account.role },
  });
});

authRouter.get("/me", optionalAuth, (req, res) => {
  if (!req.user) return res.json({ user: null });
  const { id, email, name, role, status } = req.user;
  res.json({ user: { id, email, name, role, status } });
});
