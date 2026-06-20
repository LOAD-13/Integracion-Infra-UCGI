import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "@/hooks/useAutosave";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useAutosave", () => {
  it("no guarda en el primer render (registra baseline)", () => {
    const onSave = vi.fn(async () => {});
    renderHook(() =>
      useAutosave({ value: "hola", onSave, delayMs: 1000 }),
    );
    act(() => vi.advanceTimersByTime(2000));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("dispara onSave tras delayMs cuando el valor cambia", async () => {
    const onSave = vi.fn(async () => {});
    const { result, rerender } = renderHook(
      ({ value }) => useAutosave({ value, onSave, delayMs: 1000 }),
      { initialProps: { value: "a" } },
    );
    rerender({ value: "ab" });
    expect(result.current.status).toBe("idle");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(onSave).toHaveBeenCalledWith("ab");
    expect(result.current.status).toBe("saved");
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });

  it("reinicia el timer con cada cambio (debounce)", async () => {
    const onSave = vi.fn(async () => {});
    const { rerender } = renderHook(
      ({ value }) => useAutosave({ value, onSave, delayMs: 1000 }),
      { initialProps: { value: "a" } },
    );
    rerender({ value: "ab" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    rerender({ value: "abc" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith("abc");
  });

  it("expone status=error cuando onSave rechaza", async () => {
    const onSave = vi.fn(async () => {
      throw new Error("backend caído");
    });
    const { result, rerender } = renderHook(
      ({ value }) => useAutosave({ value, onSave, delayMs: 500 }),
      { initialProps: { value: "x" } },
    );
    rerender({ value: "xy" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("backend caído");
  });

  it("respeta disabled (no dispara saves)", async () => {
    const onSave = vi.fn(async () => {});
    const { rerender } = renderHook(
      ({ value, disabled }) =>
        useAutosave({ value, onSave, delayMs: 500, disabled }),
      { initialProps: { value: "a", disabled: true } },
    );
    rerender({ value: "ab", disabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(onSave).not.toHaveBeenCalled();
  });
});
