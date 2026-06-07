import { beforeEach, describe, expect, it, vi } from "vitest";

type HandlerFn = (req: any, res: any, next?: any) => any;

const captured = vi.hoisted(() => ({
  handlers: {} as Record<string, HandlerFn>,
  router: null as any,
}));

vi.mock("express", () => {
  captured.router = {
    use: vi.fn(),
    get: vi.fn((path: string, ...args: any[]) => {
      captured.handlers[`GET ${path}`] = args[args.length - 1];
    }),
    post: vi.fn((path: string, ...args: any[]) => {
      captured.handlers[`POST ${path}`] = args[args.length - 1];
    }),
    patch: vi.fn((path: string, ...args: any[]) => {
      captured.handlers[`PATCH ${path}`] = args[args.length - 1];
    }),
    delete: vi.fn((path: string, ...args: any[]) => {
      captured.handlers[`DELETE ${path}`] = args[args.length - 1];
    }),
  };
  return { Router: () => captured.router };
});

vi.mock("express-rate-limit", () => ({ default: vi.fn(() => vi.fn()) }));

vi.mock("../../server/src/utils/asyncRoute.js", () => ({
  asyncRoute: (fn: HandlerFn) => fn,
}));

vi.mock("../../server/src/middleware/authMiddleware.js", () => ({
  attachUser: vi.fn(),
  requireAdmin: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  getOverview: vi.fn(),
  listChampions: vi.fn(),
  updateChampion: vi.fn(),
  deleteChampion: vi.fn(),
  listItems: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  listPuzzles: vi.fn(),
  listAiGeneratedPuzzles: vi.fn(),
  getPuzzleDetail: vi.fn(),
  updatePuzzle: vi.fn(),
  publishPuzzle: vi.fn(),
  deletePuzzle: vi.fn(),
  getPatchStatus: vi.fn(),
  syncPatch: vi.fn(),
}));

vi.mock("../../server/src/services/adminService.js", () => ({
  adminService: {
    getOverview: mocks.getOverview,
    listChampions: mocks.listChampions,
    updateChampion: mocks.updateChampion,
    deleteChampion: mocks.deleteChampion,
    listItems: mocks.listItems,
    updateItem: mocks.updateItem,
    deleteItem: mocks.deleteItem,
    listPuzzles: mocks.listPuzzles,
    listAiGeneratedPuzzles: mocks.listAiGeneratedPuzzles,
    getPuzzleDetail: mocks.getPuzzleDetail,
    updatePuzzle: mocks.updatePuzzle,
    publishPuzzle: mocks.publishPuzzle,
    deletePuzzle: mocks.deletePuzzle,
    getPatchStatus: mocks.getPatchStatus,
    syncPatch: mocks.syncPatch,
  },
}));

vi.mock("../../server/src/lib/admin/adminPayloadSchemas.js", () => ({
  adminChampionUpdateSchema: { parse: (body: any) => body },
  adminItemUpdateSchema: { parse: (body: any) => body },
  adminPuzzleUpdateSchema: { parse: (body: any) => body },
}));

import "../../server/src/routes/adminRoutes.js";

const req = (overrides: Record<string, any> = {}) => ({
  params: {},
  body: {},
  query: {},
  ...overrides,
});
const res = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adminRoutes", () => {
  describe("GET /admin/overview", () => {
    it("returns overview from adminService", async () => {
      mocks.getOverview.mockResolvedValue({ total: 42 });
      const response = res();
      await captured.handlers["GET /admin/overview"](req(), response);
      expect(response.json).toHaveBeenCalledWith({ total: 42 });
    });
  });

  describe("GET /admin/champions", () => {
    it("returns champion list", async () => {
      mocks.listChampions.mockResolvedValue([{ id: "1" }]);
      const response = res();
      await captured.handlers["GET /admin/champions"](req(), response);
      expect(response.json).toHaveBeenCalledWith([{ id: "1" }]);
    });
  });

  describe("PATCH /admin/champions/:id", () => {
    it("parses body and updates champion", async () => {
      mocks.updateChampion.mockResolvedValue({ id: "champ-1", name: "Jinx" });
      const response = res();
      await captured.handlers["PATCH /admin/champions/:id"](
        req({ params: { id: "champ-1" }, body: { isActive: true } }),
        response,
      );
      expect(mocks.updateChampion).toHaveBeenCalledWith("champ-1", { isActive: true });
      expect(response.json).toHaveBeenCalled();
    });
  });

  describe("DELETE /admin/champions/:id", () => {
    it("deletes champion and returns result", async () => {
      mocks.deleteChampion.mockResolvedValue({ deleted: true });
      const response = res();
      await captured.handlers["DELETE /admin/champions/:id"](
        req({ params: { id: "champ-1" } }),
        response,
      );
      expect(mocks.deleteChampion).toHaveBeenCalledWith("champ-1");
      expect(response.json).toHaveBeenCalledWith({ deleted: true });
    });
  });

  describe("GET /admin/items", () => {
    it("returns item list", async () => {
      mocks.listItems.mockResolvedValue([{ id: "item-1" }]);
      const response = res();
      await captured.handlers["GET /admin/items"](req(), response);
      expect(response.json).toHaveBeenCalledWith([{ id: "item-1" }]);
    });
  });

  describe("PATCH /admin/items/:id", () => {
    it("updates item", async () => {
      mocks.updateItem.mockResolvedValue({ id: "item-1" });
      const response = res();
      await captured.handlers["PATCH /admin/items/:id"](
        req({ params: { id: "item-1" }, body: { isActive: false } }),
        response,
      );
      expect(mocks.updateItem).toHaveBeenCalledWith("item-1", { isActive: false });
    });
  });

  describe("DELETE /admin/items/:id", () => {
    it("deletes item", async () => {
      mocks.deleteItem.mockResolvedValue({ deleted: true });
      const response = res();
      await captured.handlers["DELETE /admin/items/:id"](
        req({ params: { id: "item-1" } }),
        response,
      );
      expect(mocks.deleteItem).toHaveBeenCalledWith("item-1");
    });
  });

  describe("GET /admin/puzzles", () => {
    it("returns puzzle list", async () => {
      mocks.listPuzzles.mockResolvedValue([{ slug: "test" }]);
      const response = res();
      await captured.handlers["GET /admin/puzzles"](req(), response);
      expect(response.json).toHaveBeenCalledWith([{ slug: "test" }]);
    });
  });

  describe("GET /admin/puzzles/ai-generated", () => {
    it("returns ai-generated puzzles", async () => {
      mocks.listAiGeneratedPuzzles.mockResolvedValue([]);
      const response = res();
      await captured.handlers["GET /admin/puzzles/ai-generated"](req(), response);
      expect(response.json).toHaveBeenCalledWith([]);
    });
  });

  describe("GET /admin/puzzles/:id", () => {
    it("returns puzzle detail", async () => {
      mocks.getPuzzleDetail.mockResolvedValue({ slug: "test", detail: true });
      const response = res();
      await captured.handlers["GET /admin/puzzles/:id"](
        req({ params: { id: "test-puzzle" } }),
        response,
      );
      expect(mocks.getPuzzleDetail).toHaveBeenCalledWith("test-puzzle");
    });
  });

  describe("PATCH /admin/puzzles/:id", () => {
    it("updates puzzle", async () => {
      mocks.updatePuzzle.mockResolvedValue({ id: "puzzle-1" });
      const response = res();
      await captured.handlers["PATCH /admin/puzzles/:id"](
        req({ params: { id: "puzzle-1" }, body: { isPublished: true } }),
        response,
      );
      expect(mocks.updatePuzzle).toHaveBeenCalledWith("puzzle-1", { isPublished: true });
    });
  });

  describe("POST /admin/puzzles/:id/publish", () => {
    it("publishes puzzle", async () => {
      mocks.publishPuzzle.mockResolvedValue({ published: true });
      const response = res();
      await captured.handlers["POST /admin/puzzles/:id/publish"](
        req({ params: { id: "puzzle-1" } }),
        response,
      );
      expect(mocks.publishPuzzle).toHaveBeenCalledWith("puzzle-1");
    });
  });

  describe("DELETE /admin/puzzles/:id", () => {
    it("deletes puzzle", async () => {
      mocks.deletePuzzle.mockResolvedValue({ deleted: true });
      const response = res();
      await captured.handlers["DELETE /admin/puzzles/:id"](
        req({ params: { id: "puzzle-1" } }),
        response,
      );
      expect(mocks.deletePuzzle).toHaveBeenCalledWith("puzzle-1");
    });
  });

  describe("GET /admin/patch-status", () => {
    it("returns patch status", async () => {
      mocks.getPatchStatus.mockResolvedValue({ version: "16.7" });
      const response = res();
      await captured.handlers["GET /admin/patch-status"](req(), response);
      expect(response.json).toHaveBeenCalledWith({ version: "16.7" });
    });
  });

  describe("POST /admin/patch-sync", () => {
    it("syncs patch without version", async () => {
      mocks.syncPatch.mockResolvedValue({ synced: true });
      const response = res();
      await captured.handlers["POST /admin/patch-sync"](req({ body: {} }), response);
      expect(mocks.syncPatch).toHaveBeenCalledWith(undefined);
    });

    it("syncs patch with specific version", async () => {
      mocks.syncPatch.mockResolvedValue({ synced: true });
      const response = res();
      await captured.handlers["POST /admin/patch-sync"](
        req({ body: { version: "16.8" } }),
        response,
      );
      expect(mocks.syncPatch).toHaveBeenCalledWith("16.8");
    });
  });
});
