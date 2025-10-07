import { debounce } from "@/utils/debounce";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("debounce()", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should debounce multiple calls into a single execution", async () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 1000);

		// Call multiple times within the 1000ms delay
		debouncedFn();
		debouncedFn();
		debouncedFn();

		// The function should not have been called after 999ms
		vi.advanceTimersByTime(999);
		expect(mockFn).not.toHaveBeenCalled();

		// Advance an additional 1ms, and the function should be called once
		vi.advanceTimersByTime(1);
		expect(mockFn).toHaveBeenCalledTimes(1);
	});

	it("should correctly pass arguments to the debounced function", async () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 1000);

		// Call with different arguments
		debouncedFn("apple");
		debouncedFn("apple pie");

		// Advance timers by 1000ms
		vi.advanceTimersByTime(1000);

		// Verify that the function was called with the arguments from the last invocation
		expect(mockFn).toHaveBeenCalledWith("apple pie");
	});

	it("should cancel the execution when AbortSignal is aborted", async () => {
		const mockFn = vi.fn();
		const controller = new AbortController();
		const { signal } = controller;
		const debouncedFn = debounce(mockFn, 1000, signal);

		// Call the debounced function
		debouncedFn("api call");

		// Advance timers by 500ms
		vi.advanceTimersByTime(500);

		// The function should not have been called yet
		expect(mockFn).not.toHaveBeenCalled();

		// Abort the signal to cancel the pending timer
		controller.abort();

		// Advance timers for the remaining 500ms; the function should not be called
		vi.advanceTimersByTime(500);
		expect(mockFn).not.toHaveBeenCalled();
	});
});
