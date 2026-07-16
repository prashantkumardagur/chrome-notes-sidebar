import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce } from "../../src/lib/util/debounce";

describe("debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs once, after the wait, following the last call", () => {
    const fn = vi.fn();
    const d = debounce(fn, 3000);

    d("a");
    d("b");
    d("c");
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2999);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("cancel() prevents a pending call", () => {
    const fn = vi.fn();
    const d = debounce(fn, 1000);
    d("x");
    d.cancel();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    expect(d.pending()).toBe(false);
  });

  it("flush() runs a pending call immediately", () => {
    const fn = vi.fn();
    const d = debounce(fn, 1000);
    d("now");
    expect(d.pending()).toBe(true);
    d.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("now");
    expect(d.pending()).toBe(false);
  });

  it("flush() with nothing pending is a no-op", () => {
    const fn = vi.fn();
    const d = debounce(fn, 1000);
    d.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it("reports pending state", () => {
    const d = debounce(() => {}, 1000);
    expect(d.pending()).toBe(false);
    d();
    expect(d.pending()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(d.pending()).toBe(false);
  });
});
