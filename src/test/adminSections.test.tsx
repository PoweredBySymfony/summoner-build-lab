import { fireEvent, render, screen } from "@testing-library/react";
import { BookOpenCheck } from "lucide-react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ChampionAdminSection } from "../pages/admin/ChampionAdminSection";
import { ItemAdminSection } from "../pages/admin/ItemAdminSection";
import { OverviewAdminSection } from "../pages/admin/OverviewAdminSection";
import { PuzzleAdminSection } from "../pages/admin/PuzzleAdminSection";
import {
  AdminSearchField,
  ChampionThumb,
  InputField,
  ItemThumb,
  SectionHeader,
  StatTile,
  TextareaField,
  ToggleField,
} from "../pages/admin/shared";

// ---------- shared.tsx ----------

describe("ChampionThumb", () => {
  it("renders an image with the given src and alt", () => {
    render(React.createElement(ChampionThumb, { src: "/jinx.png", alt: "Jinx" }));
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/jinx.png");
    expect(img).toHaveAttribute("alt", "Jinx");
  });
});

describe("ItemThumb", () => {
  it("renders an image with the given src and alt", () => {
    render(React.createElement(ItemThumb, { src: "/tri.png", alt: "Trinity Force" }));
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/tri.png");
    expect(img).toHaveAttribute("alt", "Trinity Force");
  });
});

describe("StatTile", () => {
  it("renders value, label and hint", () => {
    render(
      React.createElement(StatTile, {
        icon: BookOpenCheck,
        label: "Puzzles",
        value: 42,
        hint: "Inclut brouillons",
      }),
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Puzzles")).toBeInTheDocument();
    expect(screen.getByText("Inclut brouillons")).toBeInTheDocument();
  });
});

describe("SectionHeader", () => {
  it("renders title and description", () => {
    render(
      React.createElement(SectionHeader, { title: "Mon titre", description: "Ma description" }),
    );
    expect(screen.getByText("Mon titre")).toBeInTheDocument();
    expect(screen.getByText("Ma description")).toBeInTheDocument();
  });

  it("renders optional action when provided", () => {
    render(
      React.createElement(SectionHeader, {
        title: "T",
        description: "D",
        action: React.createElement("button", null, "Action"),
      }),
    );
    expect(screen.getByText("Action")).toBeInTheDocument();
  });
});

describe("AdminSearchField", () => {
  it("renders an input with the given placeholder and value", () => {
    render(
      React.createElement(AdminSearchField, {
        value: "jinx",
        onChange: vi.fn(),
        placeholder: "Filtrer...",
      }),
    );
    expect(screen.getByPlaceholderText("Filtrer...")).toHaveValue("jinx");
  });

  it("calls onChange with the new value when user types", () => {
    const onChange = vi.fn();
    render(
      React.createElement(AdminSearchField, { value: "", onChange, placeholder: "Filtrer..." }),
    );
    fireEvent.change(screen.getByPlaceholderText("Filtrer..."), { target: { value: "lux" } });
    expect(onChange).toHaveBeenCalledWith("lux");
  });
});

describe("InputField", () => {
  it("renders the label and an input with the given value", () => {
    render(
      React.createElement(InputField, { label: "Nom", value: "Jinx", onChange: vi.fn() }),
    );
    expect(screen.getByText("Nom")).toBeInTheDocument();
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Jinx");
  });

  it("calls onChange with new value on input change", () => {
    const onChange = vi.fn();
    render(React.createElement(InputField, { label: "Nom", value: "", onChange }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Lux" } });
    expect(onChange).toHaveBeenCalledWith("Lux");
  });
});

describe("TextareaField", () => {
  it("renders the label and textarea with value", () => {
    render(
      React.createElement(TextareaField, {
        label: "Description",
        value: "some text",
        onChange: vi.fn(),
        rows: 4,
      }),
    );
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("some text");
  });

  it("calls onChange when textarea content changes", () => {
    const onChange = vi.fn();
    render(
      React.createElement(TextareaField, { label: "D", value: "", onChange, rows: 3 }),
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "new content" } });
    expect(onChange).toHaveBeenCalledWith("new content");
  });
});

describe("ToggleField", () => {
  it("renders the label and a checkbox", () => {
    render(
      React.createElement(ToggleField, {
        label: "Actif",
        checked: true,
        onCheckedChange: vi.fn(),
      }),
    );
    expect(screen.getByText("Actif")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("renders unchecked state", () => {
    render(
      React.createElement(ToggleField, {
        label: "Actif",
        checked: false,
        onCheckedChange: vi.fn(),
      }),
    );
    expect(screen.getByRole("checkbox")).toHaveAttribute("data-state", "unchecked");
  });
});

// ---------- OverviewAdminSection ----------

describe("OverviewAdminSection", () => {
  it("shows '...' placeholders when overview is undefined", () => {
    render(
      React.createElement(OverviewAdminSection, {
        overview: undefined,
        onOpenPatchDialog: vi.fn(),
      }),
    );
    expect(screen.getAllByText("...")).toHaveLength(3);
  });

  it("shows actual counts when overview has data", () => {
    const overview = {
      stats: { championCount: 165, itemCount: 200, puzzleCount: 42 },
      patch: { localLatestPatch: "16.7", remoteLatestPatch: "16.8" },
    };
    render(
      React.createElement(OverviewAdminSection, {
        overview,
        onOpenPatchDialog: vi.fn(),
      }),
    );
    expect(screen.getByText("165")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("16.7")).toBeInTheDocument();
  });

  it("calls onOpenPatchDialog when the patch button is clicked", () => {
    const onOpenPatchDialog = vi.fn();
    render(
      React.createElement(OverviewAdminSection, {
        overview: undefined,
        onOpenPatchDialog,
      }),
    );
    fireEvent.click(screen.getByText((t) => t.includes("Nouveau patch")));
    expect(onOpenPatchDialog).toHaveBeenCalled();
  });
});

// ---------- ChampionAdminSection ----------

const sampleChampion = {
  id: "c1",
  slug: "jinx",
  name: "Jinx",
  title: "The Loose Cannon",
  icon: "/jinx.png",
  roles: ["ADC"],
  tags: ["Marksman"],
  patch: "16.7",
  isActive: true,
  databaseId: "db-c1",
};

describe("ChampionAdminSection", () => {
  it("renders champion name, title, roles and patch", () => {
    render(
      React.createElement(ChampionAdminSection, {
        champions: [sampleChampion],
        query: "",
        onQueryChange: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );
    expect(screen.getByText("Jinx")).toBeInTheDocument();
    expect(screen.getByText("The Loose Cannon")).toBeInTheDocument();
    expect(screen.getByText("ADC")).toBeInTheDocument();
    expect(screen.getByText("16.7")).toBeInTheDocument();
    expect(screen.getByText("Actif")).toBeInTheDocument();
  });

  it("shows 'Archive' for inactive champions", () => {
    render(
      React.createElement(ChampionAdminSection, {
        champions: [{ ...sampleChampion, isActive: false }],
        query: "",
        onQueryChange: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );
    expect(screen.getByText("Archive")).toBeInTheDocument();
  });

  it("calls onEdit when Modifier is clicked", () => {
    const onEdit = vi.fn();
    render(
      React.createElement(ChampionAdminSection, {
        champions: [sampleChampion],
        query: "",
        onQueryChange: vi.fn(),
        onEdit,
        onDelete: vi.fn(),
      }),
    );
    fireEvent.click(screen.getByText("Modifier"));
    expect(onEdit).toHaveBeenCalledWith(sampleChampion);
  });

  it("calls onDelete when Supprimer is clicked", () => {
    const onDelete = vi.fn();
    render(
      React.createElement(ChampionAdminSection, {
        champions: [sampleChampion],
        query: "",
        onQueryChange: vi.fn(),
        onEdit: vi.fn(),
        onDelete,
      }),
    );
    fireEvent.click(screen.getByText("Supprimer"));
    expect(onDelete).toHaveBeenCalledWith(sampleChampion);
  });

  it("calls onQueryChange when the search field changes", () => {
    const onQueryChange = vi.fn();
    render(
      React.createElement(ChampionAdminSection, {
        champions: [],
        query: "",
        onQueryChange,
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );
    fireEvent.change(screen.getByPlaceholderText(/Filtrer/i), { target: { value: "jinx" } });
    expect(onQueryChange).toHaveBeenCalledWith("jinx");
  });
});

// ---------- ItemAdminSection ----------

const sampleItem = {
  id: "i1",
  name: "Trinity Force",
  icon: "/tri.png",
  shortDescription: "Attack + speed item",
  category: "Offensive",
  cost: 3200,
  patch: "16.7",
  isActive: true,
  databaseId: "db-i1",
};

describe("ItemAdminSection", () => {
  it("renders item name, category, cost and patch", () => {
    render(
      React.createElement(ItemAdminSection, {
        items: [sampleItem],
        query: "",
        onQueryChange: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );
    expect(screen.getByText("Trinity Force")).toBeInTheDocument();
    expect(screen.getByText("Offensive")).toBeInTheDocument();
    expect(screen.getByText("3200")).toBeInTheDocument();
    expect(screen.getByText("16.7")).toBeInTheDocument();
  });

  it("calls onEdit when Modifier is clicked", () => {
    const onEdit = vi.fn();
    render(
      React.createElement(ItemAdminSection, {
        items: [sampleItem],
        query: "",
        onQueryChange: vi.fn(),
        onEdit,
        onDelete: vi.fn(),
      }),
    );
    fireEvent.click(screen.getByText("Modifier"));
    expect(onEdit).toHaveBeenCalledWith(sampleItem);
  });

  it("calls onDelete when Supprimer is clicked", () => {
    const onDelete = vi.fn();
    render(
      React.createElement(ItemAdminSection, {
        items: [sampleItem],
        query: "",
        onQueryChange: vi.fn(),
        onEdit: vi.fn(),
        onDelete,
      }),
    );
    fireEvent.click(screen.getByText("Supprimer"));
    expect(onDelete).toHaveBeenCalledWith(sampleItem);
  });

  it("shows 'Sans description courte' when shortDescription is empty", () => {
    render(
      React.createElement(ItemAdminSection, {
        items: [{ ...sampleItem, shortDescription: "" }],
        query: "",
        onQueryChange: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );
    expect(screen.getByText("Sans description courte")).toBeInTheDocument();
  });
});

// ---------- PuzzleAdminSection ----------

const samplePuzzle = {
  id: "p1",
  slug: "jinx-puzzle-1",
  title: "Jinx Item Choice",
  mode: "OTP",
  difficulty: "INTERMEDIATE",
  patch: "16.7",
  choiceCount: 4,
  sourceType: "AI_GENERATED",
  champion: { id: "c1", slug: "jinx", name: "Jinx", icon: "/jinx.png" },
  isPublished: false,
};

describe("PuzzleAdminSection", () => {
  it("renders puzzle title, mode, difficulty and patch in the table", () => {
    render(
      React.createElement(PuzzleAdminSection, {
        puzzles: [samplePuzzle],
        aiGeneratedPuzzles: [],
        query: "",
        publishing: false,
        onQueryChange: vi.fn(),
        onEdit: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
      }),
    );
    expect(screen.getByText("Jinx Item Choice")).toBeInTheDocument();
    expect(screen.getByText("OTP")).toBeInTheDocument();
    expect(screen.getByText("INTERMEDIATE")).toBeInTheDocument();
    expect(screen.getByText("16.7")).toBeInTheDocument();
  });

  it("shows AI queue with pending count", () => {
    render(
      React.createElement(PuzzleAdminSection, {
        puzzles: [],
        aiGeneratedPuzzles: [samplePuzzle],
        query: "",
        publishing: false,
        onQueryChange: vi.fn(),
        onEdit: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
      }),
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Publier")).toBeInTheDocument();
  });

  it("shows empty AI queue message when list is empty", () => {
    render(
      React.createElement(PuzzleAdminSection, {
        puzzles: [],
        aiGeneratedPuzzles: [],
        query: "",
        publishing: false,
        onQueryChange: vi.fn(),
        onEdit: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
      }),
    );
    expect(screen.getByText((t) => t.includes("Aucun puzzle"))).toBeInTheDocument();
  });

  it("calls onPublish when Publier is clicked in AI queue", () => {
    const onPublish = vi.fn();
    render(
      React.createElement(PuzzleAdminSection, {
        puzzles: [],
        aiGeneratedPuzzles: [samplePuzzle],
        query: "",
        publishing: false,
        onQueryChange: vi.fn(),
        onEdit: vi.fn(),
        onPublish,
        onDelete: vi.fn(),
      }),
    );
    fireEvent.click(screen.getByText("Publier"));
    expect(onPublish).toHaveBeenCalledWith("p1");
  });

  it("disables Publier button while publishing", () => {
    render(
      React.createElement(PuzzleAdminSection, {
        puzzles: [],
        aiGeneratedPuzzles: [samplePuzzle],
        query: "",
        publishing: true,
        onQueryChange: vi.fn(),
        onEdit: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
      }),
    );
    expect(screen.getByText("Publier").closest("button")).toBeDisabled();
  });

  it("calls onDelete when Supprimer is clicked in main table", () => {
    const onDelete = vi.fn();
    render(
      React.createElement(PuzzleAdminSection, {
        puzzles: [samplePuzzle],
        aiGeneratedPuzzles: [],
        query: "",
        publishing: false,
        onQueryChange: vi.fn(),
        onEdit: vi.fn(),
        onPublish: vi.fn(),
        onDelete,
      }),
    );
    fireEvent.click(screen.getByText("Supprimer"));
    expect(onDelete).toHaveBeenCalledWith(samplePuzzle);
  });

  it("shows puzzle fallback thumb when champion is null", () => {
    const { container } = render(
      React.createElement(PuzzleAdminSection, {
        puzzles: [{ ...samplePuzzle, champion: null }],
        aiGeneratedPuzzles: [],
        query: "",
        publishing: false,
        onQueryChange: vi.fn(),
        onEdit: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
      }),
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
