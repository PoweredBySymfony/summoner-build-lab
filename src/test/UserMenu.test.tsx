import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useLogout: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock("../api/hooks", () => ({ useLogout: mocks.useLogout }));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to }, children),
}));

vi.mock("../components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "dropdown" }, children),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "dropdown-content" }, children),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => React.createElement("div", { onClick, role: "menuitem" }, children),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "dropdown-label" }, children),
  DropdownMenuSeparator: () => React.createElement("hr"),
}));

import UserMenu from "../components/UserMenu";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useLogout.mockReturnValue({ mutate: mocks.mutate });
});

describe("UserMenu", () => {
  it("renders the username in the trigger button", () => {
    render(React.createElement(UserMenu, { username: "johndoe" }));
    expect(screen.getByRole("button")).toHaveTextContent("johndoe");
  });

  it("renders username in the dropdown label", () => {
    render(React.createElement(UserMenu, { username: "johndoe" }));
    expect(screen.getByTestId("dropdown-label")).toHaveTextContent("johndoe");
  });

  it("renders 'Ma progression' and 'Mon profil' links", () => {
    render(React.createElement(UserMenu, { username: "user" }));
    expect(screen.getByText("Ma progression")).toBeInTheDocument();
    expect(screen.getByText("Mon profil")).toBeInTheDocument();
  });

  it("shows 'Backoffice' link when isAdmin is true", () => {
    render(React.createElement(UserMenu, { username: "admin", isAdmin: true }));
    expect(screen.getByText("Backoffice")).toBeInTheDocument();
  });

  it("hides 'Backoffice' link when isAdmin is false", () => {
    render(React.createElement(UserMenu, { username: "user", isAdmin: false }));
    expect(screen.queryByText("Backoffice")).not.toBeInTheDocument();
  });

  it("shows 'Retour au site' link when showReturnToSite is true", () => {
    render(React.createElement(UserMenu, { username: "admin", showReturnToSite: true }));
    expect(screen.getByText("Retour au site")).toBeInTheDocument();
  });

  it("hides 'Retour au site' link by default", () => {
    render(React.createElement(UserMenu, { username: "user" }));
    expect(screen.queryByText("Retour au site")).not.toBeInTheDocument();
  });

  it("calls logout.mutate when 'Se deconnecter' is clicked", () => {
    render(React.createElement(UserMenu, { username: "user" }));
    fireEvent.click(screen.getByText("Se deconnecter"));
    expect(mocks.mutate).toHaveBeenCalled();
  });

  it("Ma progression link points to /dashboard", () => {
    render(React.createElement(UserMenu, { username: "user" }));
    expect(screen.getByText("Ma progression").closest("a")).toHaveAttribute("href", "/dashboard");
  });

  it("Backoffice link points to /admin", () => {
    render(React.createElement(UserMenu, { username: "admin", isAdmin: true }));
    expect(screen.getByText("Backoffice").closest("a")).toHaveAttribute("href", "/admin");
  });

  it("showBackoffice prop overrides isAdmin for Backoffice visibility", () => {
    render(
      React.createElement(UserMenu, { username: "user", isAdmin: false, showBackoffice: true }),
    );
    expect(screen.getByText("Backoffice")).toBeInTheDocument();
  });
});
