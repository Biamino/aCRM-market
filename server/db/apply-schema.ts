import { BRANCHES, closePools, runInBranch } from "../src/db.js";
import { applyAccountsSchema, applyMarketSchema } from "./apply-market-schema.js";

async function main() {
  // web_* витрины — в базе CRM каждого филиала, аккаунты — одни на всех
  for (const b of BRANCHES) await runInBranch(b, applyMarketSchema);
  await applyAccountsSchema();
  await closePools();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
