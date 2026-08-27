import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "../hooks/use-mobile";

const makeMql = () => ({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

describe("useIsMobile", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(makeMql()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when innerWidth is 1024 (desktop)", () => {
    vi.stubGlobal("innerWidth", 1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true when innerWidth is 375 (mobile)", () => {
    vi.stubGlobal("innerWidth", 375);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("returns false exactly at the breakpoint (768)", () => {
    vi.stubGlobal("innerWidth", 768);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true one pixel below the breakpoint (767)", () => {
    vi.stubGlobal("innerWidth", 767);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("attaches a change event listener on mount", () => {
    vi.stubGlobal("innerWidth", 1024);
    const mql = makeMql();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mql));
    renderHook(() => useIsMobile());
    expect(mql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("removes the change event listener on unmount", () => {
    vi.stubGlobal("innerWidth", 1024);
    const mql = makeMql();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mql));
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
