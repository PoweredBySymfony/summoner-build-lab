import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import StatCard from "../components/StatCard";

const TestIcon = () => React.createElement("svg", { "data-testid": "test-icon" });

describe("StatCard", () => {
  it("renders the label and value", () => {
    render(React.createElement(StatCard, { icon: TestIcon, label: "Puzzles", value: 42 }));
    expect(screen.getByText("Puzzles")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders sub text when provided", () => {
    render(
      React.createElement(StatCard, { icon: TestIcon, label: "Score", value: "75%", sub: "Top 10%" }),
    );
    expect(screen.getByText("Top 10%")).toBeInTheDocument();
  });

  it("does not render sub element when sub is not provided", () => {
    render(React.createElement(StatCard, { icon: TestIcon, label: "Score", value: 0 }));
    expect(screen.queryByText("Top 10%")).not.toBeInTheDocument();
  });

  it("renders the icon component", () => {
    render(React.createElement(StatCard, { icon: TestIcon, label: "L", value: "V" }));
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("applies gold accent border class", () => {
    const { container } = render(
      React.createElement(StatCard, { icon: TestIcon, label: "L", value: "V", accent: "gold" }),
    );
    expect(container.querySelector(".border-primary\\/20")).toBeInTheDocument();
  });

  it("applies cyan accent border class", () => {
    const { container } = render(
      React.createElement(StatCard, { icon: TestIcon, label: "L", value: "V", accent: "cyan" }),
    );
    expect(container.querySelector(".border-accent\\/20")).toBeInTheDocument();
  });

  it("applies success accent border class", () => {
    const { container } = render(
      React.createElement(StatCard, { icon: TestIcon, label: "L", value: "V", accent: "success" }),
    );
    expect(container.querySelector(".border-success\\/20")).toBeInTheDocument();
  });

  it("applies default border class when accent is not specified", () => {
    const { container } = render(
      React.createElement(StatCard, { icon: TestIcon, label: "L", value: "V" }),
    );
    expect(container.querySelector(".border-border\\/40")).toBeInTheDocument();
  });
});
