import { styleText, type InspectColor } from "node:util";

export type LogIconOption = "ok" | "fail" | "started";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogOptions {
  level?: LogLevel;
  icon?: LogIconOption;
}

const LogIconEmoji: Record<LogIconOption, string> = {
  ok: "✅",
  fail: "❌",
  started: "🚀",
};

const LogLevelColors: Record<LogLevel, InspectColor> = {
  debug: "gray",
  info: "blue",
  warn: "yellow",
  error: "red",
};

function padStr(str: string, width: number): string {
  return str.length >= width ? str.slice(0, width) : str.padEnd(width, " ");
}

export function log(message: string, options?: LogOptions): void {
  const level = options?.level || "info";
  const icon = options?.icon ? LogIconEmoji[options.icon] + " " : "";
  const levelStr = styleText(
    LogLevelColors[level],
    padStr(level.toUpperCase(), 7),
  );

  console.log(`${levelStr} ${icon}${message}`);
}

export function logDebug(message: string): void {
  log(message, { level: "debug" });
}

export function logInfo(message: string): void {
  log(message, { level: "info" });
}

export function logWarn(message: string): void {
  log(message, { level: "warn" });
}

export function logError(message: string): void {
  log(message, { level: "error" });
}

export function logSuccess(message: string): void {
  log(message, { level: "info", icon: "ok" });
}

export function logFailure(message: string): void {
  log(message, { level: "error", icon: "fail" });
}
