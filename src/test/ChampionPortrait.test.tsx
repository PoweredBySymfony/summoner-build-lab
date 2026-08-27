import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import ChampionPortrait from "../components/ChampionPortrait";

const champion = {
  id: "c1",
  databaseId: "db-c1",
  slug: "jinx",
  name: "Jinx",
  icon: "/jinx.png",
  roles: ["ADC"],
  tags: [],
  patch: "16.7",
  isActive: true,
};

describe("ChampionPortrait", () => {
  it("renders the champion image with correct src and alt", () => {
    render(React.createElement(ChampionPortrait, { champion }));
    const img = screen.getByRole("img", { name: "Jinx" });
    expect(img).toHaveAttribute("src", "/jinx.png");
    expect(img).toHaveAttribute("alt", "Jinx");
  });

  it("renders fallback initials when icon is empty string", () => {
    render(React.createElement(ChampionPortrait, { champion: { ...champion, icon: "" } }));
    expect(screen.getByText("JI")).toBeInTheDocument();
  });

  it("renders fallback initials when image fails to load", () => {
    render(React.createElement(ChampionPortrait, { champion }));
    const img = screen.getByRole("img", { name: "Jinx" });
    fireEvent.error(img);
    expect(screen.getByText("JI")).toBeInTheDocument();
  });

  it("shows champion name and first role when showInfo is true", () => {
    render(React.createElement(ChampionPortrait, { champion, showInfo: true }));
    expect(screen.getByText("Jinx")).toBeInTheDocument();
    expect(screen.getByText("ADC")).toBeInTheDocument();
  });

  it("does not show name or role when showInfo is false (default)", () => {
    render(React.createElement(ChampionPortrait, { champion }));
    expect(screen.queryByText("Jinx")).not.toBeInTheDocument();
  });

  it("applies sm size class", () => {
    const { container } = render(
      React.createElement(ChampionPortrait, { champion, size: "sm" }),
    );
    expect(container.querySelector(".w-9.h-9")).toBeInTheDocument();
  });

  it("applies lg size class", () => {
    const { container } = render(
      React.createElement(ChampionPortrait, { champion, size: "lg" }),
    );
    expect(container.querySelector(".w-14.h-14")).toBeInTheDocument();
  });

  it("applies default md size class when size is not specified", () => {
    const { container } = render(React.createElement(ChampionPortrait, { champion }));
    expect(container.querySelector(".w-10.h-10")).toBeInTheDocument();
  });

  it("uses title attribute equal to champion name", () => {
    const { container } = render(React.createElement(ChampionPortrait, { champion }));
    expect(container.querySelector("[title='Jinx']")).toBeInTheDocument();
  });
});
