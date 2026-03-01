export type LogLevel = "info" | "warn" | "error";

type LogRecord = {
  ts: string;
  level: LogLevel;
  subsystem: string;
  event: string;
} & Record<string, unknown>;

function normalizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  return value;
}

function normalizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    normalized[key] = normalizeValue(value);
  }

  return normalized;
}

function shouldForwardAdminErrors(): boolean {
  const enabled = process.env.ADMIN_ALERTS_ENABLED?.trim().toLowerCase();
  if (enabled === "false" || enabled === "0" || enabled === "no") {
    return false;
  }

  return Boolean(process.env.ADMIN_ALERT_EMAIL?.trim());
}

export function logEvent(args: {
  level: LogLevel;
  subsystem: string;
  event: string;
  details?: Record<string, unknown>;
}): void {
  const payload: LogRecord = {
    ts: new Date().toISOString(),
    level: args.level,
    subsystem: args.subsystem,
    event: args.event,
    ...(args.details ? normalizeDetails(args.details) : {})
  };

  const serialized = JSON.stringify(payload);
  if (args.level === "error") {
    console.error(serialized);
    return;
  }

  if (args.level === "warn") {
    console.warn(serialized);
    return;
  }

  console.info(serialized);
}

export function logInfo(subsystem: string, event: string, details?: Record<string, unknown>): void {
  logEvent({ level: "info", subsystem, event, details });
}

export function logWarn(subsystem: string, event: string, details?: Record<string, unknown>): void {
  logEvent({ level: "warn", subsystem, event, details });
}

export function logError(subsystem: string, event: string, details?: Record<string, unknown>): void {
  logEvent({ level: "error", subsystem, event, details });
  if (!shouldForwardAdminErrors()) {
    return;
  }

  void import("@/lib/admin/alerts")
    .then(({ notifyAdminOfError }) => notifyAdminOfError({ subsystem, event, details }))
    .catch((error) => {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        subsystem: "admin_alert",
        event: "notify_failed",
        source_subsystem: subsystem,
        source_event: event,
        error: normalizeValue(error)
      })
    );
    });
}
