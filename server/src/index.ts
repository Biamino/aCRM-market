import express from "express";
import cors from "cors";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { ordersRouter } from "./routes/orders.js";
import { adminRouter } from "./routes/admin.js";
import { analyticsRouter } from "./routes/analytics.js";
import { insightsRouter } from "./routes/insights.js";
import { CRM_API_ORIGIN, CRM_PHOTO_DIR, safeCrmPhotoName, UPLOAD_DIR } from "./product-media.js";

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR, { fallthrough: true, index: false }));

// Фото товаров из CRM (product_photos): с диска, если он общий, иначе через бэкенд CRM.
app.get("/api/crm-photos/:file", (req, res) => {
  const file = req.params.file;
  if (!safeCrmPhotoName(file)) return res.status(404).end();
  const local = CRM_PHOTO_DIR ? join(CRM_PHOTO_DIR, file) : "";
  if (local && existsSync(local)) return res.sendFile(local, { maxAge: "7d" });
  res.redirect(302, `${CRM_API_ORIGIN}/api/v1/uploads/products/${encodeURIComponent(file)}`);
});

app.use("/api/auth", authRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/insights", insightsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`);
});
