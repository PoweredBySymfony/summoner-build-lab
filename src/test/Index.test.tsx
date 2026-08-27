import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import Index from "../pages/Index";

describe("Index", () => {
  it("renders the welcome heading", () => {
    render(React.createElement(Index));
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("renders the blank app welcome text", () => {
    render(React.createElement(Index));
    expect(screen.getByText(/welcome/i)).toBeInTheDocument();
  });
});
