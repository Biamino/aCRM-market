import express from "express";
import cors from "cors";
import compression from "compression";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { ordersRouter } from "./routes/orders.js";
import { adminRouter } from "./routes/admin.js";
import { analyticsRouter } from "./routes/analytics.js";
import { insightsRouter } from "./routes/insights.js";
import { CRM_PHOTO_WIDTHS, crmPhotoVariant, safeCrmPhotoName, UPLOAD_DIR } from "./product-media.js";
import { BRANCHES, DEFAULT_BRANCH, findBranch, runInBranch } from "./db.js";
import { clientDist, seoRouter, spaRouter } from "./seo.js";

mkdirSync(UPLOAD_DIR, { recursive: true });

export const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());
// имена загруженных фото — UUID, файл по адресу не меняется: кэшируем надолго
app.use("/uploads", express.static(UPLOAD_DIR, { fallthrough: true, index: false, immutable: true, maxAge: "30d" }));
app.use(seoRouter);

// Фото товаров из CRM филиала (product_photos): с диска, если он общий, иначе через бэкенд CRM.
// ?w=320 и т.п. — сжатое WebP-превью (только с диска; оригинал CRM тяжёлый для сетки каталога).
app.get("/api/crm-photos/:branch/:file", async (req, res) => {
  const b = findBranch(req.params.branch);
  const file = req.params.file;
  if (!b || !safeCrmPhotoName(file)) return res.status(404).end();
  const local = b.crmUploadDir ? join(b.crmUploadDir, "products", file) : "";
  if (local && existsSync(local)) {
    const width = Number(req.query.w);
    if (!(CRM_PHOTO_WIDTHS as readonly number[]).includes(width)) return res.sendFile(local, { maxAge: "7d" });
    try {
      const variant = await crmPhotoVariant(local, b.id, file, width);
      // превью лежат в UPLOAD_DIR/.cache — без dotfiles: "allow" send отвечает 404 на скрытую папку
      return res.sendFile(variant, { maxAge: "30d", immutable: true, dotfiles: "allow" });
    } catch (e) {
      console.error("crm photo variant:", e);
      return res.sendFile(local, { maxAge: "7d" });
    }
  }
  res.redirect(302, `${b.crmApiOrigin}/api/v1/uploads/products/${encodeURIComponent(file)}`);
});

// Филиал запроса: заголовок X-Branch (или ?branch=). Все запросы к CRM дальше идут в его базу.
app.use("/api", (req, res, next) => {
  const id = req.header("x-branch") ?? req.query.branch;
  const b = id ? findBranch(id) : DEFAULT_BRANCH;
  if (!b) return res.status(400).json({ error: "Неизвестный филиал" });
  runInBranch(b, next);
});

app.get("/api/branches", (_req, res) => {
  res.json({ branches: BRANCHES.map((b) => ({ id: b.id, name: b.name })), default: DEFAULT_BRANCH.id });
});

app.use("/api/auth", authRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/insights", insightsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Не найдено" });
});

// в проде сервер может сам раздавать собранный клиент (с OG-тегами моделей); в dev это делает Vite
const dist = clientDist();
if (dist) app.use(spaRouter(dist));

// Express 5 передаёт сюда и отклонённые промисы async-обработчиков
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (!res.headersSent) res.status(500).json({ error: "Внутренняя ошибка сервера" });
});
