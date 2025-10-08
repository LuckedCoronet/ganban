export const getRequiredEnv = (key: string, customErrorMsg?: string): string => {
	const value = process.env[key];
	if (typeof value !== "string")
		throw new Error(customErrorMsg ?? `The environment variable '${key}' is required but not set.`);
	return value;
};

export const getRequiredEnvWithFallback = (key: string, fallback: string): string => {
	const value = process.env[key];
	return value ?? fallback;
};
