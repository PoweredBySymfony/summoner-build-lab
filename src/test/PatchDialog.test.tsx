import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ItemIcon: vi.fn(),
}));

vi.mock("../components/ItemIcon", () => ({
  ItemIcon: mocks.ItemIcon,
}));

vi.mock("../components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? React.createElement("div", { "data-testid": "dialog" }, children) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) => React.createElement("h2", null, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) => React.createElement("p", null, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
}));

vi.mock("../components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  TabsList: ({ children }: { children: React.ReactNode }) => React.createElement("div", { role: "tablist" }, children),
  TabsTrigger: ({ value, children }: { value: string; children: React.ReactNode }) =>
    React.createElement("button", { role: "tab", "data-value": value }, children),
  TabsContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
}));

import { PatchDialog } from "../pages/admin/PatchDialog";
import type { AdminPatchChampionEntry, AdminPatchItemEntry, AdminPatchStatusPayload } from "../types/domain";

mocks.ItemIcon.mockImplementation(() =>
  React.createElement("div", { "data-testid": "item-icon" }),
);

const champion: AdminPatchChampionEntry = {
  id: "c1",
  databaseId: "c1",
  name: "Jinx",
  slug: "jinx",
  icon: "/jinx.png",
  image: "/jinx.png",
  roles: ["ADC"],
  tags: ["Marksman"],
  stats: {},
  patch: "16.6",
  isActive: true,
  patchStatus: "changed",
  changeSummary: ["Name updated", "Stats changed"],
  changes: [
    { field: "name", label: "Nom", before: "Jinx Old", after: "Jinx New" },
    { field: "stats.hp", label: "PV de base", before: "620", after: "640" },
  ],
};

const item: AdminPatchItemEntry = {
  id: "i1",
  databaseId: "i1",
  riotItemId: 3031,
  name: "Infinity Edge",
  slug: "infinity-edge",
  icon: "/ie.png",
  image: "/ie.png",
  cost: 3400,
  baseCost: 1000,
  sellPrice: 2380,
  category: "damage",
  tags: ["Damage"],
  itemGroups: [],
  stats: {},
  shortDescription: "Crit item",
  fullDescription: null,
  activeEffect: null,
  passiveEffect: null,
  buildsFrom: [],
  buildsInto: [],
  isBoots: false,
  isLegendary: true,
  isConsumable: false,
  isTrinket: false,
  isStarter: false,
  isActive: true,
  patch: "16.6",
  patchStatus: "new",
  changeSummary: ["New item in patch"],
  changes: [],
};

const patchStatus: AdminPatchStatusPayload = {
  remoteLatestPatch: "16.7",
  hasUpdate: true,
  summary: {
    championCount: 1,
    itemCount: 1,
    changedChampionCount: 1,
    changedItemCount: 0,
    newChampionCount: 0,
    newItemCount: 1,
    unchangedChampionCount: 0,
    unchangedItemCount: 0,
    removedChampionCount: 0,
    removedItemCount: 0,
  },
  champions: [champion],
  items: [item],
};

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  loading: false,
  status: patchStatus,
  syncing: false,
  onSync: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  vi.clearAllMocks();
  defaultProps.onSync = vi.fn().mockResolvedValue(undefined);
  defaultProps.onOpenChange = vi.fn();
  mocks.ItemIcon.mockImplementation(() =>
    React.createElement("div", { "data-testid": "item-icon" }),
  );
});

describe("PatchDialog", () => {
  it("renders the dialog title and action buttons when open", () => {
    render(React.createElement(PatchDialog, defaultProps));
    expect(screen.getByText(/nouveau patch sorti/i)).toBeInTheDocument();
    expect(screen.getByText(/Lancer la mise a jour/i)).toBeInTheDocument();
    expect(screen.getByText(/Fermer/i)).toBeInTheDocument();
  });

  it("does not render when dialog is closed", () => {
    render(React.createElement(PatchDialog, { ...defaultProps, open: false }));
    expect(screen.queryByText(/nouveau patch sorti/i)).not.toBeInTheDocument();
  });

  it("shows loading placeholder when loading=true", () => {
    render(React.createElement(PatchDialog, { ...defaultProps, status: undefined, loading: true }));
    expect(screen.getByText(/analyse du patch en cours/i)).toBeInTheDocument();
  });

  it("shows nothing in the status area when no status and not loading", () => {
    render(React.createElement(PatchDialog, { ...defaultProps, status: undefined, loading: false }));
    expect(screen.queryByText(/analyse du patch/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Fermer/i)).toBeInTheDocument();
  });

  it("renders patch status summary with remote patch and counts", () => {
    render(React.createElement(PatchDialog, defaultProps));
    expect(screen.getByText("16.7")).toBeInTheDocument();
    expect(screen.getByText(/champions modifies/i)).toBeInTheDocument();
    expect(screen.getByText(/items modifies/i)).toBeInTheDocument();
  });

  it("shows Jinx champion entry in the entity grid", () => {
    render(React.createElement(PatchDialog, defaultProps));
    expect(screen.getByText("Jinx")).toBeInTheDocument();
    expect(screen.getByText(/patch stocke.*16.6/i)).toBeInTheDocument();
    expect(screen.getByText(/name updated.*stats changed/i)).toBeInTheDocument();
  });

  it("shows Infinity Edge item entry when patchStatus matches filter", () => {
    const statusWithChangedItem: AdminPatchStatusPayload = {
      ...patchStatus,
      items: [{ ...item, patchStatus: "changed", changeSummary: ["Gold changed"] }],
    };
    render(React.createElement(PatchDialog, { ...defaultProps, status: statusWithChangedItem }));
    expect(screen.getByText("Infinity Edge")).toBeInTheDocument();
    expect(screen.getByText("Gold changed")).toBeInTheDocument();
  });

  it("renders status filter buttons for champion entries", () => {
    render(React.createElement(PatchDialog, defaultProps));
    const buttons = screen.getAllByRole("button");
    const labels = buttons.map((b) => b.textContent ?? "");
    expect(labels.some((l) => /modifies/i.test(l))).toBe(true);
    expect(labels.some((l) => /tous/i.test(l))).toBe(true);
  });

  it("shows empty state when filter matches no entries", () => {
    render(React.createElement(PatchDialog, defaultProps));
    const removedBtn = screen.getAllByRole("button").find((b) => /retires/i.exec(b.textContent ?? ""));
    fireEvent.click(removedBtn!);
    expect(screen.getAllByText(/aucune entree/i).length).toBeGreaterThan(0);
  });

  it("shows all champions when 'tous' filter is selected", () => {
    const statusWithAll: AdminPatchStatusPayload = {
      ...patchStatus,
      champions: [
        champion,
        { ...champion, id: "c2", name: "Lux", slug: "lux", patchStatus: "new" },
        { ...champion, id: "c3", name: "Thresh", slug: "thresh", patchStatus: "unchanged" },
      ],
    };
    render(React.createElement(PatchDialog, { ...defaultProps, status: statusWithAll }));
    fireEvent.click(screen.getAllByText(/^Tous/i)[0]);
    expect(screen.getByText("Jinx")).toBeInTheDocument();
    expect(screen.getByText("Lux")).toBeInTheDocument();
    expect(screen.getByText("Thresh")).toBeInTheDocument();
  });

  it("shows change details for an item with no changes after Details click", () => {
    const statusNoChanges: AdminPatchStatusPayload = {
      ...patchStatus,
      champions: [],
      items: [{ ...item, patchStatus: "changed", changes: [], changeSummary: ["Patch alignment"] }],
    };
    render(React.createElement(PatchDialog, { ...defaultProps, status: statusNoChanges }));
    expect(screen.getByText("Infinity Edge")).toBeInTheDocument();
    const detailBtn = screen.getByRole("button", { name: /details/i });
    fireEvent.click(detailBtn);
    expect(screen.getByText(/aucun changement de fiche detecte/i)).toBeInTheDocument();
  });

  it("shows change details panel for champion with changes after Details click", () => {
    render(React.createElement(PatchDialog, defaultProps));
    expect(screen.getByText("Jinx")).toBeInTheDocument();
    const detailBtn = screen.getByRole("button", { name: /details/i });
    fireEvent.click(detailBtn);
    expect(screen.getByText("Nom")).toBeInTheDocument();
    expect(screen.getByText("Jinx Old")).toBeInTheDocument();
    expect(screen.getByText("Jinx New")).toBeInTheDocument();
  });

  it("disables sync button while syncing", () => {
    render(React.createElement(PatchDialog, { ...defaultProps, syncing: true }));
    const syncButton = screen.getByText(/Lancer la mise a jour/i).closest("button");
    expect(syncButton).toBeDisabled();
  });

  it("calls onSync when sync button is clicked", () => {
    render(React.createElement(PatchDialog, defaultProps));
    fireEvent.click(screen.getByText(/Lancer la mise a jour/i));
    expect(defaultProps.onSync).toHaveBeenCalled();
  });

  it("calls onOpenChange(false) when Fermer is clicked", () => {
    render(React.createElement(PatchDialog, defaultProps));
    fireEvent.click(screen.getByText(/Fermer/i));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders champion entries with removed patchStatus", () => {
    const removedChampion = { ...champion, id: "c5", name: "Vi", slug: "vi", patchStatus: "removed" as const };
    const statusWithRemoved: AdminPatchStatusPayload = {
      ...patchStatus,
      champions: [champion, removedChampion],
    };
    render(React.createElement(PatchDialog, { ...defaultProps, status: statusWithRemoved }));
    const removedBtn = screen.getAllByRole("button").find((b) => /retires/i.exec(b.textContent ?? ""));
    fireEvent.click(removedBtn ?? screen.getByText(/retires/i));
    expect(screen.getByText("Vi")).toBeInTheDocument();
  });

  it("renders ChampionPreviewPanel with blurb and abilities when champion has patchPreview", () => {
    const championWithPreview: AdminPatchChampionEntry = {
      ...champion,
      patchStatus: "changed",
      changes: [],
      changeSummary: ["Ability changed"],
      patchPreview: {
        name: "Jinx",
        title: "The Loose Cannon",
        blurb: "A menace to order.",
        passive: {
          id: "JinxP",
          key: "P",
          name: "Excited!",
          description: "Gains <b>bonus</b> movement speed.",
          icon: "/passive.png",
        },
        spells: [
          {
            id: "JinxQ",
            key: "Q",
            name: "Switcheroo!",
            description: "Swaps <i>weapon</i>.",
            icon: "/q.png",
          },
        ],
      },
    };
    const statusWithPreview: AdminPatchStatusPayload = {
      ...patchStatus,
      champions: [championWithPreview],
      items: [],
    };
    render(React.createElement(PatchDialog, { ...defaultProps, status: statusWithPreview }));
    const detailBtn = screen.getByRole("button", { name: /details/i });
    fireEvent.click(detailBtn);
    expect(screen.getByText("The Loose Cannon")).toBeInTheDocument();
    expect(screen.getByText("A menace to order.")).toBeInTheDocument();
    expect(screen.getByText(/Excited!/)).toBeInTheDocument();
    expect(screen.getByText(/Switcheroo!/)).toBeInTheDocument();
    expect(screen.getByText(/Gains.*movement speed/)).toBeInTheDocument();
  });

  it("renders PatchLongTextLines for changes with field=abilities", () => {
    const championWithAbilities: AdminPatchChampionEntry = {
      ...champion,
      patchStatus: "changed",
      changes: [
        {
          field: "abilities",
          label: "Capacites",
          before: "Ancienne version",
          after: "Nouvelle version",
          beforeLines: [{ key: "passive", label: "Passif", value: "Ancienne description" }],
          afterLines: [{ key: "passive", label: "Passif", value: "Nouvelle description" }],
        },
      ],
    };
    const statusWithAbilities: AdminPatchStatusPayload = {
      ...patchStatus,
      champions: [championWithAbilities],
      items: [],
    };
    render(React.createElement(PatchDialog, { ...defaultProps, status: statusWithAbilities }));
    const detailBtn = screen.getByRole("button", { name: /details/i });
    fireEvent.click(detailBtn);
    expect(screen.getAllByText("Passif").length).toBeGreaterThan(0);
    expect(screen.getByText("Ancienne description")).toBeInTheDocument();
    expect(screen.getByText("Nouvelle description")).toBeInTheDocument();
  });

  it("shows fallback text when PatchLongTextLines has no lines", () => {
    const championWithEmptyAbilities: AdminPatchChampionEntry = {
      ...champion,
      patchStatus: "changed",
      changes: [
        {
          field: "abilities",
          label: "Capacites",
          before: "Aucune info avant",
          after: "Aucune info apres",
          beforeLines: [],
          afterLines: [],
        },
      ],
    };
    const statusWithEmpty: AdminPatchStatusPayload = {
      ...patchStatus,
      champions: [championWithEmptyAbilities],
      items: [],
    };
    render(React.createElement(PatchDialog, { ...defaultProps, status: statusWithEmpty }));
    const detailBtn = screen.getByRole("button", { name: /details/i });
    fireEvent.click(detailBtn);
    expect(screen.getByText("Aucune info avant")).toBeInTheDocument();
    expect(screen.getByText("Aucune info apres")).toBeInTheDocument();
  });

  it("renders PatchValueLines with added/removed changeType and delta for buildsFrom", () => {
    const itemWithBuildChange: AdminPatchItemEntry = {
      ...item,
      patchStatus: "changed",
      changes: [
        {
          field: "buildsFrom",
          label: "Composants",
          before: "old",
          after: "new",
          beforeLines: [
            {
              key: "sword",
              label: "Long Sword",
              value: "350g",
              changeType: "removed",
              delta: "-350",
            },
          ],
          afterLines: [
            {
              key: "dagger",
              label: "Dagger",
              value: "300g",
              changeType: "added",
              delta: "+300",
            },
          ],
        },
      ],
    };
    const statusWithBuild: AdminPatchStatusPayload = {
      ...patchStatus,
      champions: [],
      items: [itemWithBuildChange],
    };
    render(React.createElement(PatchDialog, { ...defaultProps, status: statusWithBuild }));
    const detailBtn = screen.getByRole("button", { name: /details/i });
    fireEvent.click(detailBtn);
    expect(screen.getByText("Long Sword")).toBeInTheDocument();
    expect(screen.getByText("Retire")).toBeInTheDocument();
    expect(screen.getByText("-350")).toBeInTheDocument();
    expect(screen.getByText("Dagger")).toBeInTheDocument();
    expect(screen.getByText("Ajoute")).toBeInTheDocument();
    expect(screen.getByText("+300")).toBeInTheDocument();
    expect(screen.getByText(/Ce composant quitte le chemin/)).toBeInTheDocument();
    expect(screen.getByText(/Desormais.*Dagger.*fait partie du chemin/)).toBeInTheDocument();
  });

  it("renders PatchValueLines with buildsInto explanations", () => {
    const itemWithBuildsInto: AdminPatchItemEntry = {
      ...item,
      patchStatus: "changed",
      changes: [
        {
          field: "buildsInto",
          label: "Evolution",
          before: "old",
          after: "new",
          beforeLines: [{ key: "r1", label: "Rabadon's", value: "x", changeType: "removed" }],
          afterLines: [{ key: "ia", label: "Infinity Ankh", value: "x", changeType: "added" }],
        },
      ],
    };
    const statusBuildsInto: AdminPatchStatusPayload = {
      ...patchStatus,
      champions: [],
      items: [itemWithBuildsInto],
    };
    render(React.createElement(PatchDialog, { ...defaultProps, status: statusBuildsInto }));
    const detailBtn = screen.getByRole("button", { name: /details/i });
    fireEvent.click(detailBtn);
    expect(screen.getByText(/cette evolution quitte l'arborescence/i)).toBeInTheDocument();
    expect(screen.getByText(/Desormais.*Infinity Ankh/i)).toBeInTheDocument();
  });

  it("renders PatchValueLines fallback text when no lines", () => {
    const itemWithNoLines: AdminPatchItemEntry = {
      ...item,
      patchStatus: "changed",
      changes: [
        {
          field: "stats",
          label: "Statistiques",
          before: "old stats",
          after: "new stats",
          beforeLines: [],
          afterLines: [],
        },
      ],
    };
    const statusNoLines: AdminPatchStatusPayload = {
      ...patchStatus,
      champions: [],
      items: [itemWithNoLines],
    };
    render(React.createElement(PatchDialog, { ...defaultProps, status: statusNoLines }));
    const detailBtn = screen.getByRole("button", { name: /details/i });
    fireEvent.click(detailBtn);
    expect(screen.getByText("old stats")).toBeInTheDocument();
    expect(screen.getByText("new stats")).toBeInTheDocument();
  });

  it("renders PatchValueLines with item icon in a line", () => {
    const subItem = { ...item, id: "sub1", riotItemId: 1001, name: "Long Sword", slug: "long-sword" };
    const itemWithItemLine: AdminPatchItemEntry = {
      ...item,
      patchStatus: "changed",
      changes: [
        {
          field: "buildsFrom",
          label: "Composants",
          before: "old",
          after: "new",
          beforeLines: [
            { key: "s1", label: "Long Sword", value: "350g", changeType: "removed", item: subItem },
          ],
          afterLines: [],
        },
      ],
    };
    const statusItemLine: AdminPatchStatusPayload = {
      ...patchStatus,
      champions: [],
      items: [itemWithItemLine],
    };
    render(React.createElement(PatchDialog, { ...defaultProps, status: statusItemLine }));
    const detailBtn = screen.getByRole("button", { name: /details/i });
    fireEvent.click(detailBtn);
    expect(screen.getAllByTestId("item-icon").length).toBeGreaterThan(0);
  });
});
