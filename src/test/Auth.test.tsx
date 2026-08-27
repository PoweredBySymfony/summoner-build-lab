import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useLogin: vi.fn(),
  useRegister: vi.fn(),
  useGoogleAuthUrl: vi.fn(),
  useNavigate: vi.fn(),
}));

vi.mock("../api/hooks", () => ({
  useLogin: mocks.useLogin,
  useRegister: mocks.useRegister,
  useGoogleAuthUrl: mocks.useGoogleAuthUrl,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: mocks.useNavigate,
    Link: vi.fn(({ children, to }: { children: React.ReactNode; to: string }) =>
      React.createElement("a", { href: String(to) }, children)),
  };
});

vi.mock("../i18n/useLanguage", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const keys: Record<string, string> = {
        "auth.loginTab": "Login",
        "auth.registerTab": "Register",
        "auth.emailLabel": "Email",
        "auth.passwordLabel": "Mot de passe",
        "auth.usernameLabel": "Nom utilisateur",
        "auth.continueWithGoogle": "Continue with Google",
        "auth.loginWithEmail": "Submit Login",
        "auth.createAccount": "Create Account",
        "auth.passwordHint": "Min 8 chars",
        "auth.recommended": "Recommended",
        "auth.orUseEmail": "or use email",
        "auth.footerPrefix": "By continuing,",
        "auth.backToLanding": "Back",
        "auth.googlePanelDescription": "Sign in fast with Google.",
        "auth.googleFirstTitle": "Google first",
        "auth.googleFirstDesc": "Quick sign-in.",
        "auth.passwordAuthTitle": "Auth securite",
        "auth.passwordAuthDesc": "Also supported.",
        "auth.persistentSessionsTitle": "Sessions",
        "auth.persistentSessionsDesc": "Stay logged in.",
        "auth.eyebrow": "Auth",
        "auth.title": "Authentication",
        "auth.description": "Log in to save progress.",
      };
      return keys[key] ?? key;
    },
  }),
}));

import Auth from "../pages/Auth";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useNavigate.mockReturnValue(vi.fn());
  mocks.useLogin.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false, error: null });
  mocks.useRegister.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false, error: null });
  mocks.useGoogleAuthUrl.mockReturnValue({ data: "https://google.com/auth", isLoading: false, error: null });
});

describe("Auth", () => {
  it("renders email and password fields by default (login mode)", () => {
    const { container } = render(React.createElement(Auth));
    expect(container.querySelector('input[type="email"]')).toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Mot de passe")).toBeInTheDocument();
  });

  it("does not show username field in login mode", () => {
    render(React.createElement(Auth));
    expect(screen.queryByText("Nom utilisateur")).not.toBeInTheDocument();
  });

  it("shows username field and password hint when signup tab is clicked", () => {
    render(React.createElement(Auth));
    fireEvent.click(screen.getByText("Register"));
    expect(screen.getByText("Nom utilisateur")).toBeInTheDocument();
    expect(screen.getByText("Min 8 chars")).toBeInTheDocument();
  });

  it("shows 'Create Account' submit button after switching to signup mode", () => {
    render(React.createElement(Auth));
    fireEvent.click(screen.getByText("Register"));
    expect(screen.getByText("Create Account")).toBeInTheDocument();
  });

  it("shows Google auth button enabled when URL data is available", () => {
    render(React.createElement(Auth));
    const btns = screen.getAllByRole("button");
    const googleBtn = btns.find((b) => b.textContent?.includes("Continue with Google"));
    expect(googleBtn).toBeDefined();
    expect(googleBtn).not.toBeDisabled();
  });

  it("disables Google auth button while URL is loading", () => {
    mocks.useGoogleAuthUrl.mockReturnValue({ data: null, isLoading: true, error: null });
    render(React.createElement(Auth));
    const btns = screen.getAllByRole("button");
    const googleBtn = btns.find((b) => b.textContent?.includes("Continue with Google"));
    expect(googleBtn).toBeDisabled();
  });

  it("disables Google auth button when URL data is null", () => {
    mocks.useGoogleAuthUrl.mockReturnValue({ data: null, isLoading: false, error: null });
    render(React.createElement(Auth));
    const btns = screen.getAllByRole("button");
    const googleBtn = btns.find((b) => b.textContent?.includes("Continue with Google"));
    expect(googleBtn).toBeDisabled();
  });

  it("shows error message from login.error", () => {
    mocks.useLogin.mockReturnValue({ mutateAsync: vi.fn(), isPending: false, error: new Error("Identifiants invalides") });
    render(React.createElement(Auth));
    expect(screen.getByText("Identifiants invalides")).toBeInTheDocument();
  });

  it("shows error message from register.error", () => {
    mocks.useRegister.mockReturnValue({ mutateAsync: vi.fn(), isPending: false, error: new Error("Email deja pris") });
    render(React.createElement(Auth));
    expect(screen.getByText("Email deja pris")).toBeInTheDocument();
  });

  it("disables submit button while login is pending", () => {
    mocks.useLogin.mockReturnValue({ mutateAsync: vi.fn(), isPending: true, error: null });
    render(React.createElement(Auth));
    const submitBtn = screen.getByText("Submit Login").closest("button");
    expect(submitBtn).toBeDisabled();
  });

  it("calls login.mutateAsync with email and password on form submit", async () => {
    const loginMutate = vi.fn().mockResolvedValue({});
    mocks.useLogin.mockReturnValue({ mutateAsync: loginMutate, isPending: false, error: null });
    const { container } = render(React.createElement(Auth));
    const emailInput = container.querySelector('input[type="email"]')!;
    const passwordInput = container.querySelector('input[type="password"]')!;
    fireEvent.change(emailInput, { target: { value: "user@test.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(loginMutate).toHaveBeenCalledWith({ email: "user@test.com", password: "password123" }));
  });

  it("calls register.mutateAsync with email, username and password in signup mode", async () => {
    const registerMutate = vi.fn().mockResolvedValue({});
    mocks.useRegister.mockReturnValue({ mutateAsync: registerMutate, isPending: false, error: null });
    const { container } = render(React.createElement(Auth));
    fireEvent.click(screen.getByText("Register"));
    const emailInput = container.querySelector('input[type="email"]')!;
    const passwordInput = container.querySelector('input[type="password"]')!;
    const usernameInput = container.querySelector('input:not([type="email"]):not([type="password"])')!;
    fireEvent.change(emailInput, { target: { value: "new@test.com" } });
    fireEvent.change(usernameInput, { target: { value: "newuser" } });
    fireEvent.change(passwordInput, { target: { value: "secret123" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() =>
      expect(registerMutate).toHaveBeenCalledWith({
        email: "new@test.com",
        username: "newuser",
        password: "secret123",
      }),
    );
  });

  it("navigates to /dashboard after successful login", async () => {
    const navigate = vi.fn();
    mocks.useNavigate.mockReturnValue(navigate);
    mocks.useLogin.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false, error: null });
    const { container } = render(React.createElement(Auth));
    const emailInput = container.querySelector('input[type="email"]')!;
    const passwordInput = container.querySelector('input[type="password"]')!;
    fireEvent.change(emailInput, { target: { value: "user@test.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/dashboard"));
  });
});
