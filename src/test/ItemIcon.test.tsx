import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getItemStatLines: vi.fn(),
  getItemEffectBlocks: vi.fn(),
  itemStatBadgeTintClass: vi.fn(),
  itemStatIconTintClass: vi.fn(),
  itemTooltipArrowClass: vi.fn(),
  itemTooltipClassNames: vi.fn(),
}));

vi.mock("../lib/itemPresentation", () => ({
  getItemStatLines: mocks.getItemStatLines,
  getItemEffectBlocks: mocks.getItemEffectBlocks,
}));

vi.mock("../lib/itemStatVisuals", () => ({
  itemStatBadgeTintClass: mocks.itemStatBadgeTintClass,
  itemStatIconTintClass: mocks.itemStatIconTintClass,
  itemTooltipArrowClass: mocks.itemTooltipArrowClass,
  itemTooltipClassNames: mocks.itemTooltipClassNames,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: { children: React.ReactNode; [key: string]: unknown }) =>
      React.createElement("div", rest as React.HTMLAttributes<HTMLDivElement>, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

import { ItemIcon } from "../components/ItemIcon";

const fakeItem = {
  id: "i1",
  databaseId: "db-i1",
  slug: "trinity-force",
  name: "Trinity Force",
  icon: "/trinity-force.png",
  image: "/trinity-force-full.png",
  shortDescription: "Attack speed item",
  fullDescription: "Full description",
  category: "Offensive",
  cost: 3200,
  baseCost: 1200,
  sellPrice: 2240,
  patch: "16.7",
  isActive: true,
  isBoots: false,
  isLegendary: true,
  isConsumable: false,
  isTrinket: false,
  isStarter: false,
  activeEffect: null,
  passiveEffect: "Rage",
  tags: ["Fighter"],
  stats: { attackDamage: 30 },
  buildsFrom: [],
  buildsInto: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getItemStatLines.mockReturnValue([
    { label: "Attack Damage", value: "+30", icon: "attackDamage" },
  ]);
  mocks.getItemEffectBlocks.mockReturnValue([{ title: "Rage", body: "Gain movement speed" }]);
  mocks.itemStatBadgeTintClass.mockReturnValue("text-orange-400");
  mocks.itemStatIconTintClass.mockReturnValue("text-orange-500");
  mocks.itemTooltipArrowClass.mockReturnValue("border-orange-500/30");
  mocks.itemTooltipClassNames.mockReturnValue({
    container: "bg-card",
    header: "border-b",
    headerGradient: "from-card",
    footerBorder: "border-t",
    tagBg: "bg-primary/10",
    tagText: "text-primary",
    tagBorder: "border-primary/20",
  });
});

const getTrigger = (container: HTMLElement) =>
  container.querySelector('[data-item-icon="trinity-force"]') as HTMLElement;

describe("ItemIcon", () => {
  it("renders as div with role=img when interactive is false", () => {
    const { container } = render(
      React.createElement(ItemIcon, { item: fakeItem, interactive: false, showTooltip: false }),
    );
    const trigger = getTrigger(container);
    expect(trigger.tagName).toBe("DIV");
    expect(trigger.getAttribute("role")).toBe("img");
  });

  it("renders as button when interactive is true and showTooltip is true", () => {
    const { container } = render(
      React.createElement(ItemIcon, { item: fakeItem, interactive: true, showTooltip: true }),
    );
    const trigger = getTrigger(container);
    expect(trigger.tagName).toBe("BUTTON");
  });

  it("renders the item image with correct src and alt", () => {
    const { container } = render(
      React.createElement(ItemIcon, { item: fakeItem, interactive: false, showTooltip: false }),
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/trinity-force.png");
    expect(img).toHaveAttribute("alt", "Trinity Force");
  });

  it("has aria-label set to item name on the trigger element", () => {
    const { container } = render(
      React.createElement(ItemIcon, { item: fakeItem, interactive: false, showTooltip: false }),
    );
    expect(getTrigger(container)).toHaveAttribute("aria-label", "Trinity Force");
  });

  it("renders the fallback text when the image fails to load", () => {
    const { container } = render(
      React.createElement(ItemIcon, { item: fakeItem, interactive: false, showTooltip: false }),
    );
    const img = container.querySelector("img");
    if (img) fireEvent.error(img);
    expect(screen.getByText("TRI")).toBeInTheDocument();
  });

  it("applies sm size class to the icon container", () => {
    const { container } = render(
      React.createElement(ItemIcon, { item: fakeItem, size: "sm", interactive: false, showTooltip: false }),
    );
    expect(container.querySelector(".h-10.w-10")).toBeInTheDocument();
  });

  it("applies lg size class to the icon container", () => {
    const { container } = render(
      React.createElement(ItemIcon, { item: fakeItem, size: "lg", interactive: false, showTooltip: false }),
    );
    expect(container.querySelector(".h-16.w-16")).toBeInTheDocument();
  });

  it("calls onInspect with the item when mouse enters", () => {
    const onInspect = vi.fn();
    const { container } = render(
      React.createElement(ItemIcon, {
        item: fakeItem,
        interactive: false,
        showTooltip: false,
        onInspect,
      }),
    );
    fireEvent.mouseEnter(getTrigger(container));
    expect(onInspect).toHaveBeenCalledWith(fakeItem);
  });

  it("calls onOpenDetail with the item when clicked in interactive mode", () => {
    const onOpenDetail = vi.fn();
    const { container } = render(
      React.createElement(ItemIcon, {
        item: fakeItem,
        interactive: true,
        showTooltip: true,
        onOpenDetail,
      }),
    );
    fireEvent.click(getTrigger(container));
    expect(onOpenDetail).toHaveBeenCalledWith(fakeItem);
  });

  it("shows tooltip item name after mouse enter and 120ms delay", async () => {
    vi.useFakeTimers();
    const { container } = render(
      React.createElement(ItemIcon, { item: fakeItem, interactive: false, showTooltip: true }),
    );

    fireEvent.mouseEnter(getTrigger(container));

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getAllByText("Trinity Force").length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it("hides tooltip after mouse leave", async () => {
    vi.useFakeTimers();
    const { container } = render(
      React.createElement(ItemIcon, { item: fakeItem, interactive: false, showTooltip: true }),
    );

    const trigger = getTrigger(container);
    fireEvent.mouseEnter(trigger);
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    fireEvent.mouseLeave(trigger);
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText("Trinity Force")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("renders with md size by default", () => {
    const { container } = render(
      React.createElement(ItemIcon, { item: fakeItem, interactive: false, showTooltip: false }),
    );
    expect(container.querySelector(".h-12.w-12")).toBeInTheDocument();
  });
});
