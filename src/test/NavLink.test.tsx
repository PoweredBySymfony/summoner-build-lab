import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { NavLink } from "../components/NavLink";

const wrap = (path: string, element: React.ReactElement) =>
  React.createElement(MemoryRouter, { initialEntries: [path] }, element);

describe("NavLink", () => {
  it("renders an anchor tag linking to the given path", () => {
    render(wrap("/", React.createElement(NavLink, { to: "/about" }, "About")));
    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
  });

  it("applies base className to the link", () => {
    render(
      wrap("/", React.createElement(NavLink, { to: "/about", className: "base-class" }, "About")),
    );
    expect(screen.getByRole("link", { name: "About" })).toHaveClass("base-class");
  });

  it("applies activeClassName when the link is active", () => {
    render(
      wrap(
        "/about",
        React.createElement(NavLink, { to: "/about", className: "base", activeClassName: "active" }, "About"),
      ),
    );
    const link = screen.getByRole("link", { name: "About" });
    expect(link).toHaveClass("base");
    expect(link).toHaveClass("active");
  });

  it("does not apply activeClassName when the link is not active", () => {
    render(
      wrap(
        "/home",
        React.createElement(NavLink, { to: "/about", className: "base", activeClassName: "active" }, "About"),
      ),
    );
    const link = screen.getByRole("link", { name: "About" });
    expect(link).toHaveClass("base");
    expect(link).not.toHaveClass("active");
  });

  it("renders children correctly", () => {
    render(wrap("/", React.createElement(NavLink, { to: "/" }, "Home Page")));
    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });

  it("has correct href attribute", () => {
    render(wrap("/", React.createElement(NavLink, { to: "/profile" }, "Profile")));
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
  });
});
