import { app } from "./app.js";

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

const PORT = Number(process.env.PORT ?? 4000);
// на проде HOST=127.0.0.1 — наружу только через nginx; локально без HOST слушаем все интерфейсы
const HOST = process.env.HOST;
const onListen = () => console.log(`API on http://${HOST ?? "localhost"}:${PORT}`);
if (HOST) app.listen(PORT, HOST, onListen);
else app.listen(PORT, onListen);
