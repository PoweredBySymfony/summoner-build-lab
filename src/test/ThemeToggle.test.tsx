import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({ useTheme: mocks.useTheme }));

import ThemeToggle from "../components/ThemeToggle";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useTheme.mockReturnValue({ resolvedTheme: "dark", setTheme: mocks.setTheme });
});

describe("ThemeToggle", () => {
  it("renders a button", () => {
    render(React.createElement(ThemeToggle));
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("shows 'Activer le theme clair' aria-label when theme is dark", () => {
    render(React.createElement(ThemeToggle));
    expect(screen.getByRole("button", { name: "Activer le theme clair" })).toBeInTheDocument();
  });

  it("shows 'Activer le theme sombre' aria-label when theme is light", () => {
    mocks.useTheme.mockReturnValue({ resolvedTheme: "light", setTheme: mocks.setTheme });
    render(React.createElement(ThemeToggle));
    expect(screen.getByRole("button", { name: "Activer le theme sombre" })).toBeInTheDocument();
  });

  it("calls setTheme with 'light' when dark theme is active and button is clicked", () => {
    render(React.createElement(ThemeToggle));
    fireEvent.click(screen.getByRole("button"));
    expect(mocks.setTheme).toHaveBeenCalledWith("light");
  });

  it("calls setTheme with 'dark' when light theme is active and button is clicked", () => {
    mocks.useTheme.mockReturnValue({ resolvedTheme: "light", setTheme: mocks.setTheme });
    render(React.createElement(ThemeToggle));
    fireEvent.click(screen.getByRole("button"));
    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
  });
});
