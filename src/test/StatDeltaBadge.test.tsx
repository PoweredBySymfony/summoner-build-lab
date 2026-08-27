import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import StatDeltaBadge from "../components/lab/StatDeltaBadge";

describe("StatDeltaBadge", () => {
  it("renders 'Stable' when value is near zero (positive)", () => {
    render(React.createElement(StatDeltaBadge, { value: 0.005, formatted: "+0.5%" }));
    expect(screen.getByText("Stable")).toBeInTheDocument();
  });

  it("renders 'Stable' when value is near zero (negative)", () => {
    render(React.createElement(StatDeltaBadge, { value: -0.005, formatted: "-0.5%" }));
    expect(screen.getByText("Stable")).toBeInTheDocument();
  });

  it("renders 'Stable' when value is exactly 0", () => {
    render(React.createElement(StatDeltaBadge, { value: 0, formatted: "0" }));
    expect(screen.getByText("Stable")).toBeInTheDocument();
  });

  it("renders formatted value for positive delta", () => {
    render(React.createElement(StatDeltaBadge, { value: 30, formatted: "+30 AD" }));
    expect(screen.getByText("+30 AD")).toBeInTheDocument();
  });

  it("applies success styling for positive delta", () => {
    const { container } = render(
      React.createElement(StatDeltaBadge, { value: 15, formatted: "+15" }),
    );
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("text-emerald-300");
  });

  it("renders formatted value for negative delta", () => {
    render(React.createElement(StatDeltaBadge, { value: -50, formatted: "-50 HP" }));
    expect(screen.getByText("-50 HP")).toBeInTheDocument();
  });

  it("applies destructive styling for negative delta", () => {
    const { container } = render(
      React.createElement(StatDeltaBadge, { value: -20, formatted: "-20" }),
    );
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("text-rose-300");
  });

  it("does not render 'Stable' for values outside the threshold", () => {
    render(React.createElement(StatDeltaBadge, { value: 0.01, formatted: "+0.01" }));
    expect(screen.queryByText("Stable")).not.toBeInTheDocument();
  });
});
