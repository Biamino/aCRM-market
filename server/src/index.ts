import { app } from "./app.js";

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`);
});
