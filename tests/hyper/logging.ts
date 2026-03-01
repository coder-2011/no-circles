import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const LOG_ROOT = path.join(process.cwd(), "logs", "hyper");

export type HyperLogGroup =
  | "pipeline-seam"
  | "full-system"
  | "reply-evolution"
  | "query-system"
  | "serendipity"
  | "reflection-live";

export async function writeHyperLog(args: {
  group: HyperLogGroup;
  runId: string;
  fileName: string;
  content: string;
}): Promise<string> {
  const dir = path.join(LOG_ROOT, args.group, args.runId);
  await mkdir(dir, { recursive: true });

  const filePath = path.join(dir, args.fileName);
  await writeFile(filePath, args.content, "utf8");
  return filePath;
}

export function buildRunId(prefix: string): string {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${now}`;
}

export function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
