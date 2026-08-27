import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useLocation: vi.fn(() => ({ pathname: "/not-found" })),
    Link: vi.fn(({ children, to }: { children: React.ReactNode; to: string }) =>
      React.createElement("a", { href: String(to) }, children)),
  };
});

import NotFound from "../pages/NotFound";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NotFound", () => {
  it("renders 404 heading", () => {
    render(React.createElement(NotFound));
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("renders page not found message", () => {
    render(React.createElement(NotFound));
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
  });

  it("renders a link to the home page", () => {
    render(React.createElement(NotFound));
    const homeLink = screen.getByRole("link");
    expect(homeLink).toHaveAttribute("href", "/");
  });
});
