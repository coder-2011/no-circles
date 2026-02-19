import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const LOG_ROOT = path.join(process.cwd(), "logs", "hyper");
const PST_OFFSET_MS = 8 * 60 * 60 * 1000;

export type HyperLogGroup = "pipeline-seam" | "full-system" | "reply-evolution";

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
  const pstDate = new Date(Date.now() - PST_OFFSET_MS);
  const year = pstDate.getUTCFullYear();
  const month = String(pstDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(pstDate.getUTCDate()).padStart(2, "0");
  const hours = String(pstDate.getUTCHours()).padStart(2, "0");
  const minutes = String(pstDate.getUTCMinutes()).padStart(2, "0");
  const seconds = String(pstDate.getUTCSeconds()).padStart(2, "0");
  const millis = String(pstDate.getUTCMilliseconds()).padStart(3, "0");
  return `${prefix}-${year}-${month}-${day}T${hours}-${minutes}-${seconds}-${millis}PST`;
}

export function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
