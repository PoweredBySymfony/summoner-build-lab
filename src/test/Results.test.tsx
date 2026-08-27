import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useLanguage: vi.fn(),
}));

vi.mock("../i18n/useLanguage", () => ({ useLanguage: mocks.useLanguage }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    Link: vi.fn(({ children, to }: { children: React.ReactNode; to: string }) =>
      React.createElement("a", { href: String(to) }, children)),
  };
});

import Results from "../pages/Results";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useLanguage.mockReturnValue({
    t: (key: string) => (key === "results.sessionComplete" ? "Session complete" : key),
  });
});

describe("Results", () => {
  it("renders the session complete label", () => {
    render(React.createElement(Results));
    expect(screen.getByText("Session complete")).toBeInTheDocument();
  });

  it("renders the main heading", () => {
    render(React.createElement(Results));
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders description paragraph about history", () => {
    render(React.createElement(Results));
    expect(screen.getByText((t) => t.includes("enregistre"))).toBeInTheDocument();
  });

  it("has a link to /dashboard", () => {
    const { container } = render(React.createElement(Results));
    expect(container.querySelector('a[href="/dashboard"]')).toBeInTheDocument();
  });

  it("has a link to /training", () => {
    const { container } = render(React.createElement(Results));
    expect(container.querySelector('a[href="/training"]')).toBeInTheDocument();
  });
});
