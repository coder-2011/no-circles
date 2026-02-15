import { pool } from "@/lib/db/client";
import { pruneProcessedWebhooksOlderThan } from "@/lib/webhooks/inbound-idempotency";

async function main() {
  const deletedCount = await pruneProcessedWebhooksOlderThan(30);
  // eslint-disable-next-line no-console
  console.log(`Pruned ${deletedCount} processed webhook rows older than 30 days.`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to prune processed webhook rows.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
