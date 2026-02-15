import { lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { processedWebhooks } from "@/lib/db/schema";

export async function reserveWebhookEvent(provider: string, webhookId: string): Promise<boolean> {
  const inserted = await db
    .insert(processedWebhooks)
    .values({ provider, webhookId })
    .onConflictDoNothing({ target: [processedWebhooks.provider, processedWebhooks.webhookId] })
    .returning({ id: processedWebhooks.id });

  return inserted.length > 0;
}

export async function pruneProcessedWebhooksOlderThan(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const deleted = await db
    .delete(processedWebhooks)
    .where(lt(processedWebhooks.processedAt, cutoff))
    .returning({ id: processedWebhooks.id });

  return deleted.length;
}
