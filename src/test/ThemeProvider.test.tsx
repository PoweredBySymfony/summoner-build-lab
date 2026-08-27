import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  NextThemesProvider: vi.fn(),
}));

vi.mock("next-themes", () => ({ ThemeProvider: mocks.NextThemesProvider }));

import { ThemeProvider } from "../components/theme-provider";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.NextThemesProvider.mockImplementation(
    ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "next-themes-provider" }, children),
  );
});

describe("ThemeProvider", () => {
  it("renders its children", () => {
    render(
      React.createElement(ThemeProvider, {}, React.createElement("span", null, "child content")),
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("wraps children with the underlying NextThemesProvider", () => {
    render(
      React.createElement(ThemeProvider, {}, React.createElement("span", null, "wrapped")),
    );
    expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
  });

  it("forwards extra props to NextThemesProvider", () => {
    render(
      React.createElement(
        ThemeProvider,
        { defaultTheme: "dark" } as never,
        React.createElement("span", null, "child"),
      ),
    );
    expect(mocks.NextThemesProvider).toHaveBeenCalledWith(
      expect.objectContaining({ defaultTheme: "dark" }),
      expect.anything(),
    );
  });
});
