import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeEnvString(value: string | undefined): string {
  let current = value?.trim() ?? "";
  while (current.length >= 2) {
    const first = current[0];
    const last = current[current.length - 1];
    const wrappedByDoubleQuotes = first === "\"" && last === "\"";
    const wrappedBySingleQuotes = first === "'" && last === "'";
    if (!wrappedByDoubleQuotes && !wrappedBySingleQuotes) {
      break;
    }
    current = current.slice(1, -1).trim();
  }
  return current;
}
