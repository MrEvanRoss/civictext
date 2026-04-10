type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  return JSON.stringify(entry);
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    console.info(formatEntry("info", message, meta));
  },
  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(formatEntry("warn", message, meta));
  },
  error(message: string, meta?: Record<string, unknown>) {
    console.error(formatEntry("error", message, meta));
  },
  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV === "development") {
      console.debug(formatEntry("debug", message, meta));
    }
  },
};
