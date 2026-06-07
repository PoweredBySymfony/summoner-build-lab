import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useCurrentUser: vi.fn(),
  useLocation: vi.fn(),
  UserMenu: vi.fn(),
  ThemeToggle: vi.fn(),
}));

vi.mock("../api/hooks", () => ({ useCurrentUser: mocks.useCurrentUser }));
vi.mock("../components/UserMenu", () => ({ default: mocks.UserMenu }));
vi.mock("../components/ThemeToggle", () => ({ default: mocks.ThemeToggle }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useLocation: mocks.useLocation,
    Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) =>
      React.createElement("a", { href: to, className }, children),
  };
});

import Navbar from "../components/Navbar";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useLocation.mockReturnValue({ pathname: "/" });
  mocks.useCurrentUser.mockReturnValue({ data: null });
  mocks.UserMenu.mockReturnValue(React.createElement("div", { "data-testid": "user-menu" }));
  mocks.ThemeToggle.mockReturnValue(React.createElement("div", { "data-testid": "theme-toggle" }));
});

describe("Navbar", () => {
  it("renders the Summoner Build Lab brand name", () => {
    render(React.createElement(Navbar));
    expect(screen.getByText("Summoner Build Lab")).toBeInTheDocument();
  });

  it("renders all 4 navigation items", () => {
    render(React.createElement(Navbar));
    expect(screen.getByText("Accueil")).toBeInTheDocument();
    expect(screen.getByText("Entrainement")).toBeInTheDocument();
    expect(screen.getByText("Quotidien")).toBeInTheDocument();
    expect(screen.getByText("Lab")).toBeInTheDocument();
  });

  it("shows 'Connexion' link when user is not authenticated", () => {
    render(React.createElement(Navbar));
    expect(screen.getByText("Connexion")).toBeInTheDocument();
  });

  it("renders UserMenu when user is authenticated", () => {
    mocks.useCurrentUser.mockReturnValue({ data: { username: "johndoe", isAdmin: false } });
    render(React.createElement(Navbar));
    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
    expect(screen.queryByText("Connexion")).not.toBeInTheDocument();
  });

  it("renders the ThemeToggle component", () => {
    render(React.createElement(Navbar));
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("home link points to /", () => {
    render(React.createElement(Navbar));
    const homeLinks = screen.getAllByRole("link").filter((l) => l.getAttribute("href") === "/");
    expect(homeLinks.length).toBeGreaterThan(0);
  });

  it("applies active style to the nav item matching the current path", () => {
    mocks.useLocation.mockReturnValue({ pathname: "/lab" });
    render(React.createElement(Navbar));
    const labLink = screen.getByText("Lab").closest("a");
    expect(labLink?.className).toContain("bg-primary/10");
  });

  it("does not apply active style to non-matching nav items", () => {
    mocks.useLocation.mockReturnValue({ pathname: "/lab" });
    render(React.createElement(Navbar));
    const homeLink = screen.getByText("Accueil").closest("a");
    expect(homeLink?.className).not.toContain("bg-primary/10");
  });
});
