import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useCurrentUser: vi.fn(),
  useAdminOverview: vi.fn(),
  useAdminChampions: vi.fn(),
  useAdminItems: vi.fn(),
  useAdminPuzzles: vi.fn(),
  useAdminAiGeneratedPuzzles: vi.fn(),
  useAdminPuzzleDetail: vi.fn(),
  useAdminPatchStatus: vi.fn(),
  useAdminUpdateChampion: vi.fn(),
  useAdminUpdateItem: vi.fn(),
  useAdminUpdatePuzzle: vi.fn(),
  useAdminPublishPuzzle: vi.fn(),
  useAdminDeleteChampion: vi.fn(),
  useAdminDeleteItem: vi.fn(),
  useAdminDeletePuzzle: vi.fn(),
  useAdminSyncPatch: vi.fn(),
  Navigate: vi.fn(),
  ChampionAdminSection: vi.fn(),
  ItemAdminSection: vi.fn(),
  OverviewAdminSection: vi.fn(),
  PuzzleAdminSection: vi.fn(),
  ChampionEditDialog: vi.fn(),
  ItemEditDialog: vi.fn(),
  PuzzleEditDialog: vi.fn(),
  PatchDialog: vi.fn(),
  ThemeToggle: vi.fn(),
  UserMenu: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../api/hooks", () => ({
  useCurrentUser: mocks.useCurrentUser,
  useAdminOverview: mocks.useAdminOverview,
  useAdminChampions: mocks.useAdminChampions,
  useAdminItems: mocks.useAdminItems,
  useAdminPuzzles: mocks.useAdminPuzzles,
  useAdminAiGeneratedPuzzles: mocks.useAdminAiGeneratedPuzzles,
  useAdminPuzzleDetail: mocks.useAdminPuzzleDetail,
  useAdminPatchStatus: mocks.useAdminPatchStatus,
  useAdminUpdateChampion: mocks.useAdminUpdateChampion,
  useAdminUpdateItem: mocks.useAdminUpdateItem,
  useAdminUpdatePuzzle: mocks.useAdminUpdatePuzzle,
  useAdminPublishPuzzle: mocks.useAdminPublishPuzzle,
  useAdminDeleteChampion: mocks.useAdminDeleteChampion,
  useAdminDeleteItem: mocks.useAdminDeleteItem,
  useAdminDeletePuzzle: mocks.useAdminDeletePuzzle,
  useAdminSyncPatch: mocks.useAdminSyncPatch,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    Navigate: mocks.Navigate,
    Link: vi.fn(({ children, to }: { children: React.ReactNode; to: string }) =>
      React.createElement("a", { href: String(to) }, children)),
  };
});

vi.mock("../components/ThemeToggle", () => ({ default: mocks.ThemeToggle }));
vi.mock("../components/UserMenu", () => ({ default: mocks.UserMenu }));

vi.mock("../components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  Sidebar: ({ children }: { children: React.ReactNode }) => React.createElement("div", { "data-testid": "sidebar" }, children),
  SidebarContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  SidebarHeader: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  SidebarFooter: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  SidebarGroup: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  SidebarMenuButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
    React.createElement("button", { onClick }, children),
  SidebarInset: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  SidebarTrigger: () => React.createElement("button", { "data-testid": "sidebar-trigger" }, "Toggle"),
}));

vi.mock("../components/ui/alert-dialog", () => ({
  AlertDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? React.createElement("div", { "data-testid": "alert-dialog" }, children) : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => React.createElement("h2", null, children),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => React.createElement("p", null, children),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) =>
    React.createElement("button", { "data-testid": "dialog-cancel" }, children),
  AlertDialogAction: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
    React.createElement("button", { "data-testid": "dialog-confirm", onClick }, children),
}));

vi.mock("../pages/admin/ChampionAdminSection", () => ({ ChampionAdminSection: mocks.ChampionAdminSection }));
vi.mock("../pages/admin/ItemAdminSection", () => ({ ItemAdminSection: mocks.ItemAdminSection }));
vi.mock("../pages/admin/OverviewAdminSection", () => ({ OverviewAdminSection: mocks.OverviewAdminSection }));
vi.mock("../pages/admin/PuzzleAdminSection", () => ({ PuzzleAdminSection: mocks.PuzzleAdminSection }));
vi.mock("../pages/admin/ChampionEditDialog", () => ({ ChampionEditDialog: mocks.ChampionEditDialog }));
vi.mock("../pages/admin/ItemEditDialog", () => ({ ItemEditDialog: mocks.ItemEditDialog }));
vi.mock("../pages/admin/PuzzleEditDialog", () => ({ PuzzleEditDialog: mocks.PuzzleEditDialog }));
vi.mock("../pages/admin/PatchDialog", () => ({ PatchDialog: mocks.PatchDialog }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import Admin from "../pages/Admin";

const adminUser = { id: "u1", username: "admin", isAdmin: true };

function defaultMutation() {
  return { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
}
function defaultQuery(data: unknown = undefined) {
  return { data, isLoading: false, error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.Navigate.mockReturnValue(null);
  mocks.useCurrentUser.mockReturnValue({ data: adminUser, isLoading: false });
  mocks.useAdminOverview.mockReturnValue(defaultQuery());
  mocks.useAdminChampions.mockReturnValue(defaultQuery([]));
  mocks.useAdminItems.mockReturnValue(defaultQuery([]));
  mocks.useAdminPuzzles.mockReturnValue(defaultQuery([]));
  mocks.useAdminAiGeneratedPuzzles.mockReturnValue(defaultQuery([]));
  mocks.useAdminPuzzleDetail.mockReturnValue(defaultQuery());
  mocks.useAdminPatchStatus.mockReturnValue(defaultQuery());
  mocks.useAdminUpdateChampion.mockReturnValue(defaultMutation());
  mocks.useAdminUpdateItem.mockReturnValue(defaultMutation());
  mocks.useAdminUpdatePuzzle.mockReturnValue(defaultMutation());
  mocks.useAdminPublishPuzzle.mockReturnValue(defaultMutation());
  mocks.useAdminDeleteChampion.mockReturnValue(defaultMutation());
  mocks.useAdminDeleteItem.mockReturnValue(defaultMutation());
  mocks.useAdminDeletePuzzle.mockReturnValue(defaultMutation());
  mocks.useAdminSyncPatch.mockReturnValue(defaultMutation());
  mocks.ThemeToggle.mockImplementation(() => React.createElement("button", { "data-testid": "theme-toggle" }));
  mocks.UserMenu.mockImplementation(() => React.createElement("div", { "data-testid": "user-menu" }));
  mocks.OverviewAdminSection.mockImplementation(() => React.createElement("div", { "data-testid": "overview-section" }));
  mocks.ChampionAdminSection.mockImplementation(() => React.createElement("div", { "data-testid": "champion-section" }));
  mocks.ItemAdminSection.mockImplementation(() => React.createElement("div", { "data-testid": "item-section" }));
  mocks.PuzzleAdminSection.mockImplementation(() => React.createElement("div", { "data-testid": "puzzle-section" }));
  mocks.ChampionEditDialog.mockImplementation(() => null);
  mocks.ItemEditDialog.mockImplementation(() => null);
  mocks.PuzzleEditDialog.mockImplementation(() => null);
  mocks.PatchDialog.mockImplementation(
    ({ open, onOpenChange, onSync }: { open: boolean; onOpenChange: (v: boolean) => void; onSync: () => void }) =>
      open
        ? React.createElement(
            "div",
            { "data-testid": "patch-dialog" },
            React.createElement("button", { "data-testid": "sync-btn", onClick: onSync }, "Sync"),
            React.createElement("button", { onClick: () => onOpenChange(false) }, "Close patch"),
          )
        : null,
  );
});

describe("Admin", () => {
  it("redirects to /auth when user is not logged in", () => {
    mocks.useCurrentUser.mockReturnValue({ data: null, isLoading: false });
    render(React.createElement(Admin));
    expect(mocks.Navigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/auth" }), {});
  });

  it("redirects to /dashboard when logged-in user is not admin", () => {
    mocks.useCurrentUser.mockReturnValue({ data: { id: "u1", username: "user", isAdmin: false }, isLoading: false });
    render(React.createElement(Admin));
    expect(mocks.Navigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/dashboard" }), {});
  });

  it("does not redirect while user is still loading", () => {
    mocks.useCurrentUser.mockReturnValue({ data: null, isLoading: true });
    render(React.createElement(Admin));
    expect(mocks.Navigate).not.toHaveBeenCalled();
  });

  it("renders the overview section by default", () => {
    render(React.createElement(Admin));
    expect(screen.getByTestId("overview-section")).toBeInTheDocument();
  });

  it("renders sidebar with Console admin heading", () => {
    render(React.createElement(Admin));
    expect(screen.getByText("Console admin")).toBeInTheDocument();
  });

  it("renders navigation items in the sidebar", () => {
    render(React.createElement(Admin));
    expect(screen.getByText("Vue d'ensemble")).toBeInTheDocument();
    expect(screen.getByText("Champions")).toBeInTheDocument();
    expect(screen.getByText("Items")).toBeInTheDocument();
    expect(screen.getByText("Puzzles")).toBeInTheDocument();
  });

  it("renders UserMenu when admin user is present", () => {
    render(React.createElement(Admin));
    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
  });

  it("switches to champions section when Champions nav button is clicked", () => {
    render(React.createElement(Admin));
    const champBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("Champions"));
    fireEvent.click(champBtn!);
    expect(screen.getByTestId("champion-section")).toBeInTheDocument();
  });

  it("switches to items section when Items nav button is clicked", () => {
    render(React.createElement(Admin));
    const itemsBtn = screen.getAllByRole("button").find((b) => b.textContent?.trim() === "Items");
    fireEvent.click(itemsBtn!);
    expect(screen.getByTestId("item-section")).toBeInTheDocument();
  });

  it("switches to puzzles section when Puzzles nav button is clicked", () => {
    render(React.createElement(Admin));
    const puzzlesBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("Puzzles"));
    fireEvent.click(puzzlesBtn!);
    expect(screen.getByTestId("puzzle-section")).toBeInTheDocument();
  });

  it("opens PatchDialog when Nouveau patch button is clicked", () => {
    render(React.createElement(Admin));
    fireEvent.click(screen.getByText("Nouveau patch"));
    expect(screen.getByTestId("patch-dialog")).toBeInTheDocument();
  });

  it("closes PatchDialog when onOpenChange(false) is called", () => {
    render(React.createElement(Admin));
    fireEvent.click(screen.getByText("Nouveau patch"));
    expect(screen.getByTestId("patch-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Close patch"));
    expect(screen.queryByTestId("patch-dialog")).not.toBeInTheDocument();
  });

  it("calls syncPatch.mutateAsync and shows success toast on Sync click", async () => {
    const syncMutateAsync = vi.fn().mockResolvedValue({});
    mocks.useAdminSyncPatch.mockReturnValue({ mutateAsync: syncMutateAsync, isPending: false });
    render(React.createElement(Admin));
    fireEvent.click(screen.getByText("Nouveau patch"));
    fireEvent.click(screen.getByTestId("sync-btn"));
    await waitFor(() => expect(syncMutateAsync).toHaveBeenCalled());
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Synchronisation terminee.");
  });

  it("shows toast.error when syncPatch.mutateAsync rejects", async () => {
    mocks.useAdminSyncPatch.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error("Sync failed")),
      isPending: false,
    });
    render(React.createElement(Admin));
    fireEvent.click(screen.getByText("Nouveau patch"));
    fireEvent.click(screen.getByTestId("sync-btn"));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Sync failed"));
  });

  it("shows delete confirmation dialog when onDeleteChampion is triggered from ChampionAdminSection", () => {
    mocks.ChampionAdminSection.mockImplementation(
      ({ onDelete }: { onDelete: (entry: { databaseId: string; name: string }) => void }) =>
        React.createElement(
          "button",
          { "data-testid": "trigger-delete", onClick: () => onDelete({ databaseId: "c1", name: "Jinx" }) },
          "Delete",
        ),
    );
    render(React.createElement(Admin));
    const champBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("Champions"));
    fireEvent.click(champBtn!);
    fireEvent.click(screen.getByTestId("trigger-delete"));
    expect(screen.getByTestId("alert-dialog")).toBeInTheDocument();
    expect(screen.getByText(/supprimer le champion "Jinx"/i)).toBeInTheDocument();
  });

  it("calls deleteChampion.mutateAsync and shows success toast on confirm", async () => {
    const deleteMutateAsync = vi.fn().mockResolvedValue({});
    mocks.useAdminDeleteChampion.mockReturnValue({ mutateAsync: deleteMutateAsync, isPending: false });
    mocks.ChampionAdminSection.mockImplementation(
      ({ onDelete }: { onDelete: (entry: { databaseId: string; name: string }) => void }) =>
        React.createElement(
          "button",
          { "data-testid": "trigger-delete", onClick: () => onDelete({ databaseId: "c1", name: "Jinx" }) },
          "Delete",
        ),
    );
    render(React.createElement(Admin));
    const champBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("Champions"));
    fireEvent.click(champBtn!);
    fireEvent.click(screen.getByTestId("trigger-delete"));
    fireEvent.click(screen.getByTestId("dialog-confirm"));
    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith("c1"));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Suppression terminee.");
  });

  it("shows toast.error when delete rejects", async () => {
    mocks.useAdminDeleteItem.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error("Delete failed")),
      isPending: false,
    });
    mocks.ItemAdminSection.mockImplementation(
      ({ onDelete }: { onDelete: (entry: { databaseId: string; name: string }) => void }) =>
        React.createElement(
          "button",
          { "data-testid": "trigger-delete-item", onClick: () => onDelete({ databaseId: "i1", name: "IE" }) },
          "Delete",
        ),
    );
    render(React.createElement(Admin));
    const itemsBtn = screen.getAllByRole("button").find((b) => b.textContent?.trim() === "Items");
    fireEvent.click(itemsBtn!);
    fireEvent.click(screen.getByTestId("trigger-delete-item"));
    fireEvent.click(screen.getByTestId("dialog-confirm"));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Delete failed"));
  });

  it("calls publishPuzzle.mutateAsync when onPublishPuzzle is triggered from PuzzleAdminSection", async () => {
    const publishMutateAsync = vi.fn().mockResolvedValue({});
    mocks.useAdminPublishPuzzle.mockReturnValue({ mutateAsync: publishMutateAsync, isPending: false });
    mocks.PuzzleAdminSection.mockImplementation(
      ({ onPublish }: { onPublish: (id: string) => void }) =>
        React.createElement(
          "button",
          { "data-testid": "trigger-publish", onClick: () => onPublish("p1") },
          "Publish",
        ),
    );
    render(React.createElement(Admin));
    const puzzlesBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("Puzzles"));
    fireEvent.click(puzzlesBtn!);
    fireEvent.click(screen.getByTestId("trigger-publish"));
    await waitFor(() => expect(publishMutateAsync).toHaveBeenCalledWith("p1"));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Puzzle AI publie.");
  });

  it("calls updateChampion.mutateAsync when ChampionEditDialog onSave is invoked", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue({});
    mocks.useAdminUpdateChampion.mockReturnValue({ mutateAsync: updateMutateAsync, isPending: false });
    const mockChampion = { databaseId: "c1", name: "Jinx" };
    mocks.ChampionAdminSection.mockImplementation(
      ({ onEdit }: { onEdit: (c: typeof mockChampion) => void }) =>
        React.createElement("button", { "data-testid": "edit-champ", onClick: () => onEdit(mockChampion) }, "Edit"),
    );
    mocks.ChampionEditDialog.mockImplementation(
      ({ open, onSave }: { open: boolean; onSave: (p: Record<string, unknown>) => Promise<void> }) =>
        open
          ? React.createElement(
              "button",
              { "data-testid": "save-champ", onClick: () => void onSave({ name: "Jinx Updated" }) },
              "Save",
            )
          : null,
    );
    render(React.createElement(Admin));
    const champBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("Champions"));
    fireEvent.click(champBtn!);
    fireEvent.click(screen.getByTestId("edit-champ"));
    fireEvent.click(screen.getByTestId("save-champ"));
    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({ id: "c1", data: { name: "Jinx Updated" } }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Champion mis a jour.");
  });

  it("calls updateItem.mutateAsync when ItemEditDialog onSave is invoked", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue({});
    mocks.useAdminUpdateItem.mockReturnValue({ mutateAsync: updateMutateAsync, isPending: false });
    const mockItem = { databaseId: "i1", name: "IE" };
    mocks.ItemAdminSection.mockImplementation(
      ({ onEdit }: { onEdit: (i: typeof mockItem) => void }) =>
        React.createElement("button", { "data-testid": "edit-item", onClick: () => onEdit(mockItem) }, "Edit"),
    );
    mocks.ItemEditDialog.mockImplementation(
      ({ open, onSave }: { open: boolean; onSave: (p: Record<string, unknown>) => Promise<void> }) =>
        open
          ? React.createElement(
              "button",
              { "data-testid": "save-item", onClick: () => void onSave({ name: "IE Updated" }) },
              "Save",
            )
          : null,
    );
    render(React.createElement(Admin));
    const itemsBtn = screen.getAllByRole("button").find((b) => b.textContent?.trim() === "Items");
    fireEvent.click(itemsBtn!);
    fireEvent.click(screen.getByTestId("edit-item"));
    fireEvent.click(screen.getByTestId("save-item"));
    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({ id: "i1", data: { name: "IE Updated" } }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Item mis a jour.");
  });

  it("calls updatePuzzle.mutateAsync when PuzzleEditDialog onSave is invoked", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue({});
    mocks.useAdminUpdatePuzzle.mockReturnValue({ mutateAsync: updateMutateAsync, isPending: false });
    mocks.PuzzleAdminSection.mockImplementation(
      ({ onEdit }: { onEdit: (id: string) => void }) =>
        React.createElement(
          "button",
          { "data-testid": "edit-puzzle", onClick: () => onEdit("p1") },
          "Edit",
        ),
    );
    mocks.PuzzleEditDialog.mockImplementation(
      ({ open, onSave }: { open: boolean; onSave: (p: Record<string, unknown>) => Promise<void> }) =>
        open
          ? React.createElement(
              "button",
              { "data-testid": "save-puzzle", onClick: () => void onSave({ title: "Updated" }) },
              "Save",
            )
          : null,
    );
    render(React.createElement(Admin));
    const puzzlesBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("Puzzles"));
    fireEvent.click(puzzlesBtn!);
    fireEvent.click(screen.getByTestId("edit-puzzle"));
    fireEvent.click(screen.getByTestId("save-puzzle"));
    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({ id: "p1", data: { title: "Updated" } }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Puzzle mis a jour.");
  });
});
