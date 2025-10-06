import type { LogLevel } from "@/types";
import { styleText } from "node:util";

export type LoggerOptions = {
	/** The minimum level of messages to log. Defaults to "info". */
	minLevel?: LogLevel;
	/** An optional prefix to include in every log message. */
	prefix?: string;
};

export type Logger = {
	debug: (message: string, error?: unknown) => void;
	info: (message: string, error?: unknown) => void;
	warn: (message: string, error?: unknown) => void;
	error: (message: string, error?: unknown) => void;
};

type LogLevelInfo = {
	value: number;
	color: Parameters<typeof styleText>[0];
	method: "log" | "warn" | "error";
};

const LOG_LEVEL_CONFIG: Record<LogLevel, LogLevelInfo> = {
	debug: { value: 0, color: "dim", method: "log" },
	info: { value: 1, color: "blue", method: "log" },
	warn: { value: 2, color: "yellow", method: "warn" },
	error: { value: 3, color: "red", method: "error" },
	silent: { value: 4, color: "dim", method: "log" },
};

const getFormattedTime = (): string => {
	const now = new Date();

	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	const seconds = String(now.getSeconds()).padStart(2, "0");
	const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

	return `${hours}:${minutes}:${seconds}:${milliseconds}`;
};

/**
 * Creates a configured logger instance.
 * @param options The configuration options for the logger.
 * @returns A logger object with methods for each log level.
 */
export const createLogger = (options: LoggerOptions = {}): Logger => {
	const { prefix } = options;
	const minLevel = options.minLevel ?? "info";
	const minLevelValue = LOG_LEVEL_CONFIG[minLevel].value;

	const log = (level: Exclude<LogLevel, "silent">, message: string, error?: unknown) => {
		const levelInfo = LOG_LEVEL_CONFIG[level];

		if (levelInfo.value < minLevelValue) {
			return;
		}

		const time = `[${getFormattedTime()}]`;
		const levelStr = `[${level.toUpperCase()}]`;
		const prefixStr = prefix ? `[${prefix}]` : "";

		const finalMessage = styleText(
			levelInfo.color,
			[time, levelStr, prefixStr, message].filter(Boolean).join(" "),
		);

		console[levelInfo.method](finalMessage);

		if (error !== undefined) {
			console.error(error);
		}
	};

	return {
		debug: (message, error) => log("debug", message, error),
		info: (message, error) => log("info", message, error),
		warn: (message, error) => log("warn", message, error),
		error: (message, error) => log("error", message, error),
	};
};
