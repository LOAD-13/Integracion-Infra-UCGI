import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("devuelve el valor inicial sin demora", () => {
    const { result } = renderHook(() => useDebouncedValue("hola", 300));
    expect(result.current).toBe("hola");
  });

  it("difiere el cambio hasta que pasa el delay completo", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } },
    );
    rerender({ value: "ab" });
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(150));
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(150));
    expect(result.current).toBe("ab");
  });

  it("reinicia el temporizador con cada cambio antes del delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "" } },
    );
    rerender({ value: "a" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: "ab" });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("");
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("ab");
  });
});
