import { pool } from "../src/db.js";
import { applyMarketSchema } from "./apply-market-schema.js";

async function main() {
  await applyMarketSchema();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
