export const debounce = <T extends (...args: any[]) => any | Promise<any>>(
	fn: T,
	delay: number,
	signal?: AbortSignal,
): ((...args: Parameters<T>) => void) => {
	signal?.throwIfAborted();

	let timeoutId: NodeJS.Timeout | undefined;

	return (...args: Parameters<T>): void => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		if (signal?.aborted) return;

		timeoutId = setTimeout(() => {
			fn(...args);
		}, delay);

		if (signal) {
			const abortListener = () => {
				clearTimeout(timeoutId);
			};
			signal.addEventListener("abort", abortListener, { once: true });
		}
	};
};
