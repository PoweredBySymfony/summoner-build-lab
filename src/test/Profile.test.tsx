import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useCurrentUser: vi.fn(),
  useProgress: vi.fn(),
  Navigate: vi.fn(),
}));

vi.mock("../api/hooks", () => ({
  useCurrentUser: mocks.useCurrentUser,
  useProgress: mocks.useProgress,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, Navigate: mocks.Navigate };
});

import Profile from "../pages/Profile";

const loggedInUser = {
  id: "u1",
  username: "JinxMain",
  email: "jinx@test.com",
  authProvider: "google",
  linkedGoogle: true,
  hasPassword: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.Navigate.mockReturnValue(null);
  mocks.useCurrentUser.mockReturnValue({ data: loggedInUser, isLoading: false });
  mocks.useProgress.mockReturnValue({ data: { global: { totalAttempts: 42 } } });
});

describe("Profile", () => {
  it("redirects to /auth when user is not logged in", () => {
    mocks.useCurrentUser.mockReturnValue({ data: null, isLoading: false });
    render(React.createElement(Profile));
    expect(mocks.Navigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/auth" }), {});
  });

  it("does not redirect while user is loading", () => {
    mocks.useCurrentUser.mockReturnValue({ data: null, isLoading: true });
    render(React.createElement(Profile));
    expect(mocks.Navigate).not.toHaveBeenCalled();
  });

  it("renders the username", () => {
    render(React.createElement(Profile));
    expect(screen.getByText("JinxMain")).toBeInTheDocument();
  });

  it("renders the email", () => {
    render(React.createElement(Profile));
    expect(screen.getByText("jinx@test.com")).toBeInTheDocument();
  });

  it("renders the authProvider badge", () => {
    render(React.createElement(Profile));
    expect(screen.getByText("google")).toBeInTheDocument();
  });

  it("shows 'Google lie' badge when linkedGoogle is true", () => {
    render(React.createElement(Profile));
    expect(screen.getByText((t) => t === "Google lié")).toBeInTheDocument();
  });

  it("does not show 'Mot de passe actif' badge when hasPassword is false", () => {
    render(React.createElement(Profile));
    expect(screen.queryByText("Mot de passe actif")).not.toBeInTheDocument();
  });

  it("shows 'Mot de passe actif' badge when hasPassword is true", () => {
    mocks.useCurrentUser.mockReturnValue({
      data: { ...loggedInUser, hasPassword: true },
      isLoading: false,
    });
    render(React.createElement(Profile));
    expect(screen.getByText("Mot de passe actif")).toBeInTheDocument();
  });

  it("renders total attempts from progress data", () => {
    render(React.createElement(Profile));
    expect(screen.getByText((t) => t.includes("42"))).toBeInTheDocument();
  });

  it("renders 0 attempts when progress is null", () => {
    mocks.useProgress.mockReturnValue({ data: null });
    render(React.createElement(Profile));
    expect(screen.getByText((t) => t.includes("0"))).toBeInTheDocument();
  });
});
