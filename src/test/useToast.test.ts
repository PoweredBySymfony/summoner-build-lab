import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";

import { reducer, useToast, toast } from "../hooks/use-toast";

type ToasterToast = Parameters<typeof reducer>[1] extends { toast: infer T } ? T : never;

const makeToast = (id: string, open = true) => ({
  id,
  title: `Toast ${id}`,
  open,
});

describe("use-toast reducer", () => {
  const emptyState = { toasts: [] };

  it("ADD_TOAST adds a toast to the state", () => {
    const toast1 = makeToast("t1");
    const state = reducer(emptyState, { type: "ADD_TOAST", toast: toast1 });
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0]).toMatchObject({ id: "t1", title: "Toast t1" });
  });

  it("ADD_TOAST respects TOAST_LIMIT=1 by keeping only the newest toast", () => {
    const s1 = reducer(emptyState, { type: "ADD_TOAST", toast: makeToast("t1") });
    const s2 = reducer(s1, { type: "ADD_TOAST", toast: makeToast("t2") });
    expect(s2.toasts).toHaveLength(1);
    expect(s2.toasts[0].id).toBe("t2");
  });

  it("UPDATE_TOAST updates a toast matching the given id", () => {
    const initial = { toasts: [makeToast("t1")] };
    const state = reducer(initial, {
      type: "UPDATE_TOAST",
      toast: { id: "t1", title: "Updated" } as ToasterToast,
    });
    expect(state.toasts[0].title).toBe("Updated");
  });

  it("UPDATE_TOAST leaves other toasts unchanged", () => {
    const initial = { toasts: [makeToast("t1")] };
    const state = reducer(initial, {
      type: "UPDATE_TOAST",
      toast: { id: "unknown", title: "X" } as ToasterToast,
    });
    expect(state.toasts[0].title).toBe("Toast t1");
  });

  it("DISMISS_TOAST with id sets the matching toast to open=false", () => {
    const initial = { toasts: [makeToast("t1")] };
    const state = reducer(initial, { type: "DISMISS_TOAST", toastId: "t1" });
    expect(state.toasts[0].open).toBe(false);
  });

  it("DISMISS_TOAST without id sets all toasts to open=false", () => {
    const initial = { toasts: [makeToast("t1"), makeToast("t2")] };
    const state = reducer(initial, { type: "DISMISS_TOAST" });
    state.toasts.forEach((t) => expect(t.open).toBe(false));
  });

  it("DISMISS_TOAST with unknown id leaves open state unchanged", () => {
    const initial = { toasts: [makeToast("t1")] };
    const state = reducer(initial, { type: "DISMISS_TOAST", toastId: "nope" });
    expect(state.toasts[0].open).toBe(true);
  });

  it("REMOVE_TOAST with id removes only the matching toast", () => {
    const initial = { toasts: [makeToast("t1"), makeToast("t2")] };
    const state = reducer(initial, { type: "REMOVE_TOAST", toastId: "t1" });
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].id).toBe("t2");
  });

  it("REMOVE_TOAST without id removes all toasts", () => {
    const initial = { toasts: [makeToast("t1")] };
    const state = reducer(initial, { type: "REMOVE_TOAST" });
    expect(state.toasts).toHaveLength(0);
  });
});

describe("useToast hook", () => {
  it("returns toasts array, toast function and dismiss function", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current).toHaveProperty("toasts");
    expect(result.current).toHaveProperty("toast");
    expect(result.current).toHaveProperty("dismiss");
  });

  it("dismiss function with an id does not throw", () => {
    const { result } = renderHook(() => useToast());
    expect(() => act(() => result.current.dismiss("some-id"))).not.toThrow();
  });

  it("dismiss function without id does not throw", () => {
    const { result } = renderHook(() => useToast());
    expect(() => act(() => result.current.dismiss())).not.toThrow();
  });
});

describe("toast function", () => {
  it("returns an object with id, dismiss and update", () => {
    const result = toast({ title: "Hello" });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("dismiss");
    expect(result).toHaveProperty("update");
    result.dismiss();
  });

  it("dismiss on the returned handle does not throw", () => {
    const result = toast({ title: "World" });
    expect(() => result.dismiss()).not.toThrow();
  });

  it("update on the returned handle does not throw", () => {
    const result = toast({ title: "Updateable" });
    expect(() => result.update({ id: result.id, title: "New", open: true })).not.toThrow();
    result.dismiss();
  });
});
