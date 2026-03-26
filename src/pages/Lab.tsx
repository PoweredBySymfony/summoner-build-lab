import { useEffect, useMemo, useState } from "react";
import { Download, FlaskConical, Save, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useCatalog } from "@/api/hooks";
import ComparisonSummary from "@/components/lab/ComparisonSummary";
import SetupColumn from "@/components/lab/SetupColumn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { analyzeSetup } from "@/lib/item-lab/calculations";
import { buildComparisonExport, deleteSavedExperiment, getSavedExperiments, persistExperiment } from "@/lib/item-lab/storage";
import { buildRoleAwareItemIds, getDefaultChampionRole, getRoleConfig, normalizeSetupForRole } from "@/lib/item-lab/roleConfig";
import type { ItemLabSetup, LabMode, LabRoleKey, SavedLabExperiment } from "@/lib/item-lab/types";

const createEmptySetup = (championId = "", role: LabRoleKey = "MID"): ItemLabSetup => {
  const config = getRoleConfig(role);
  return {
    championId,
    role,
    level: Math.min(11, config.maxLevel),
    itemIds: buildRoleAwareItemIds(config.maxItems),
  };
};

const areSetupsEqual = (left: ItemLabSetup, right: ItemLabSetup) =>
  left.championId === right.championId &&
  left.role === right.role &&
  left.level === right.level &&
  left.itemIds.length === right.itemIds.length &&
  left.itemIds.every((entry, index) => entry === right.itemIds[index]);

const archetypePills = ["Frontline lourde", "Squishy", "Sustain", "Poke", "Engage fort", "Combat long", "Burst rapide"];

const Lab = () => {
  const { data: catalog, isLoading } = useCatalog();
  const [mode, setMode] = useState<LabMode>("mirror");
  const [experimentName, setExperimentName] = useState("Comparaison sans titre");
  const [setupA, setSetupA] = useState<ItemLabSetup>(createEmptySetup());
  const [setupB, setSetupB] = useState<ItemLabSetup>(createEmptySetup());
  const [previousA, setPreviousA] = useState<ItemLabSetup | null>(null);
  const [previousB, setPreviousB] = useState<ItemLabSetup | null>(null);
  const [savedExperiments, setSavedExperiments] = useState<SavedLabExperiment[]>([]);

  const championIndex = useMemo(
    () => new Map((catalog?.champions ?? []).map((champion) => [champion.id, champion])),
    [catalog?.champions],
  );
  const itemIndex = useMemo(
    () => new Map((catalog?.items ?? []).map((item) => [item.id, item])),
    [catalog?.items],
  );

  useEffect(() => {
    setSavedExperiments(getSavedExperiments());
  }, []);

  useEffect(() => {
    if (!catalog || catalog.champions.length === 0) {
      return;
    }

    const defaultChampion = catalog.champions[0];
    const defaultRole = getDefaultChampionRole(defaultChampion);
    setSetupA((current) => (current.championId ? normalizeSetupForRole({ setup: current, champion: championIndex.get(current.championId) ?? defaultChampion }) : createEmptySetup(defaultChampion.id, defaultRole)));
    setSetupB((current) => (current.championId ? normalizeSetupForRole({ setup: current, champion: championIndex.get(current.championId) ?? defaultChampion }) : createEmptySetup(defaultChampion.id, defaultRole)));
  }, [catalog, championIndex]);

  const championA = championIndex.get(setupA.championId) ?? catalog?.champions[0];
  const championB = championIndex.get(setupB.championId) ?? championIndex.get(setupA.championId) ?? catalog?.champions[0];
  const resolvedSetupA = normalizeSetupForRole({ setup: setupA, champion: championA });
  const resolvedSetupB = normalizeSetupForRole({ setup: setupB, champion: championB });
  const previousResolvedA = previousA ? normalizeSetupForRole({ setup: previousA, champion: previousA.championId ? championIndex.get(previousA.championId) ?? null : null }) : null;
  const previousResolvedB = previousB ? normalizeSetupForRole({ setup: previousB, champion: previousB.championId ? championIndex.get(previousB.championId) ?? null : null }) : null;
  const previousChampionA = previousResolvedA?.championId ? championIndex.get(previousResolvedA.championId) ?? null : null;
  const previousChampionB = previousResolvedB?.championId ? championIndex.get(previousResolvedB.championId) ?? null : null;

  useEffect(() => {
    if (!areSetupsEqual(resolvedSetupA, setupA)) {
      setSetupA(resolvedSetupA);
    }
  }, [resolvedSetupA, setupA]);

  useEffect(() => {
    if (!areSetupsEqual(resolvedSetupB, setupB)) {
      setSetupB(resolvedSetupB);
    }
  }, [resolvedSetupB, setupB]);

  const itemsA = resolvedSetupA.itemIds.map((itemId) => (itemId ? itemIndex.get(itemId) ?? null : null)).filter(Boolean);
  const itemsB = resolvedSetupB.itemIds.map((itemId) => (itemId ? itemIndex.get(itemId) ?? null : null)).filter(Boolean);
  const previousItemsA = previousResolvedA ? previousResolvedA.itemIds.map((itemId) => (itemId ? itemIndex.get(itemId) ?? null : null)).filter(Boolean) : [];
  const previousItemsB = previousResolvedB ? previousResolvedB.itemIds.map((itemId) => (itemId ? itemIndex.get(itemId) ?? null : null)).filter(Boolean) : [];

  const analysisA = championA
    ? analyzeSetup({
        setup: resolvedSetupA,
        champion: championA,
        items: itemsA,
        previousStats: previousResolvedA && previousChampionA ? analyzeSetup({ setup: previousResolvedA, champion: previousChampionA, items: previousItemsA }).stats : null,
      })
    : null;
  const analysisB = championB
    ? analyzeSetup({
        setup: resolvedSetupB,
        champion: championB,
        items: itemsB,
        previousStats: previousResolvedB && previousChampionB ? analyzeSetup({ setup: previousResolvedB, champion: previousChampionB, items: previousItemsB }).stats : null,
      })
    : null;

  const normalizeNextSetup = (next: ItemLabSetup) => normalizeSetupForRole({ setup: next, champion: next.championId ? championIndex.get(next.championId) ?? null : null });

  const updateSetupA = (updater: (current: ItemLabSetup) => ItemLabSetup) => {
    setPreviousA(resolvedSetupA);
    const next = normalizeNextSetup(updater(resolvedSetupA));
    setSetupA(next);

    if (mode === "mirror") {
      setPreviousB(resolvedSetupB);
      setSetupB(
        normalizeNextSetup({
          ...resolvedSetupB,
          championId: next.championId,
          role: next.role,
        }),
      );
    }
  };

  const updateSetupB = (updater: (current: ItemLabSetup) => ItemLabSetup) => {
    setPreviousB(resolvedSetupB);
    setSetupB(normalizeNextSetup(updater(resolvedSetupB)));
  };

  const handleReset = () => {
    if (!catalog || catalog.champions.length === 0) {
      return;
    }

    const championAReset = catalog.champions[0];
    const roleAReset = getDefaultChampionRole(championAReset);
    const championBReset = mode === "mirror" ? championAReset : catalog.champions[1] ?? championAReset;
    const roleBReset = getDefaultChampionRole(championBReset);

    setPreviousA(resolvedSetupA);
    setPreviousB(resolvedSetupB);
    setSetupA(createEmptySetup(championAReset.id, roleAReset));
    setSetupB(createEmptySetup(championBReset.id, mode === "mirror" ? roleAReset : roleBReset));
    setExperimentName("Comparaison sans titre");
    toast.success("Le Lab a été réinitialisé.");
  };

  const handleSave = () => {
    if (!analysisA || !analysisB) {
      return;
    }

    const payload: SavedLabExperiment = {
      id: crypto.randomUUID(),
      name: experimentName.trim() || "Comparaison sans titre",
      mode,
      setupA: resolvedSetupA,
      setupB: resolvedSetupB,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    persistExperiment(payload);
    setSavedExperiments(getSavedExperiments());
    toast.success("Comparaison sauvegardée.");
  };

  const handleExport = async () => {
    if (!analysisA || !analysisB) {
      return;
    }

    const output = buildComparisonExport({
      name: experimentName.trim() || "Comparaison sans titre",
      mode,
      analysisA,
      analysisB,
    });

    try {
      await navigator.clipboard.writeText(output);
      toast.success("Export copié dans le presse-papiers.");
    } catch {
      const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "item-lab-export.txt";
      anchor.click();
      URL.revokeObjectURL(href);
      toast.success("Export téléchargé.");
    }
  };

  const loadExperiment = (experiment: SavedLabExperiment) => {
    setMode(experiment.mode);
    setExperimentName(experiment.name);
    setPreviousA(resolvedSetupA);
    setPreviousB(resolvedSetupB);
    setSetupA(normalizeNextSetup(experiment.setupA.role ? experiment.setupA : { ...experiment.setupA, role: getDefaultChampionRole(championIndex.get(experiment.setupA.championId) ?? null) }));
    setSetupB(normalizeNextSetup(experiment.setupB.role ? experiment.setupB : { ...experiment.setupB, role: getDefaultChampionRole(championIndex.get(experiment.setupB.championId) ?? null) }));
  };

  if (isLoading || !catalog || !analysisA || !analysisB) {
    return (
      <div className="min-h-screen bg-background pb-12 pt-24">
        <div className="container mx-auto px-6">
          <div className="glass-surface rounded-[28px] p-8 text-muted-foreground">Chargement du Lab d'Items...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-14 pt-24">
      <div className="container mx-auto space-y-6 overflow-visible px-4 sm:px-6">
        <section className="glass-surface relative z-[1] overflow-visible rounded-[32px] p-6">
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-yellow-500 text-primary-foreground shadow-lg shadow-primary/20">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Lab d'Items</p>
                  <h1 className="font-heading text-4xl font-bold text-foreground">Comparer deux setups côte à côte.</h1>
                </div>
              </div>
              <p className="max-w-3xl text-muted-foreground">
                Les overlays du Lab sont maintenant portalisés et priorisés au-dessus des colonnes. Les règles de niveau et d'inventaire suivent aussi le rôle sélectionné pour chaque setup.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {archetypePills.map((pill) => (
                  <span key={pill} className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-foreground">
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            <div className="surface-elevated rounded-[28px] p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${mode === "mirror" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                  onClick={() => {
                    setMode("mirror");
                    setPreviousB(resolvedSetupB);
                    setSetupB(
                      normalizeNextSetup({
                        ...resolvedSetupB,
                        championId: resolvedSetupA.championId,
                        role: resolvedSetupA.role,
                      }),
                    );
                  }}
                >
                  Mode miroir
                </button>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${mode === "duel" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                  onClick={() => setMode("duel")}
                >
                  Mode duel
                </button>
              </div>

              <Input value={experimentName} onChange={(event) => setExperimentName(event.target.value)} placeholder="Nom de l'expérience" className="mb-4" />

              <div className="flex flex-wrap gap-2">
                <Button variant="gold" onClick={handleSave}>
                  <Save className="h-4 w-4" />
                  Sauvegarder
                </Button>
                <Button variant="secondary" onClick={handleExport}>
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button variant="ghost" onClick={handleReset}>
                  <Trash2 className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-6 overflow-visible xl:grid-cols-2">
          <SetupColumn
            side="A"
            accent="gold"
            title="Colonne A"
            setup={resolvedSetupA}
            analysis={analysisA}
            champions={catalog.champions}
            items={catalog.items}
            onChampionChange={(championId) => updateSetupA((current) => ({ ...current, championId }))}
            onRoleChange={(role) => updateSetupA((current) => ({ ...current, role }))}
            onLevelChange={(level) => updateSetupA((current) => ({ ...current, level }))}
            onItemChange={(slotIndex, itemId) =>
              updateSetupA((current) => ({
                ...current,
                itemIds: current.itemIds.map((entry, index) => (index === slotIndex ? itemId : entry)),
              }))
            }
            onItemRemove={(slotIndex) =>
              updateSetupA((current) => ({
                ...current,
                itemIds: current.itemIds.map((entry, index) => (index === slotIndex ? null : entry)),
              }))
            }
          />

          <SetupColumn
            side="B"
            accent="cyan"
            title="Colonne B"
            setup={resolvedSetupB}
            analysis={analysisB}
            champions={catalog.champions}
            items={catalog.items}
            disableChampionSelection={mode === "mirror"}
            onChampionChange={(championId) => updateSetupB((current) => ({ ...current, championId }))}
            onRoleChange={(role) => updateSetupB((current) => ({ ...current, role }))}
            onLevelChange={(level) => updateSetupB((current) => ({ ...current, level }))}
            onItemChange={(slotIndex, itemId) =>
              updateSetupB((current) => ({
                ...current,
                itemIds: current.itemIds.map((entry, index) => (index === slotIndex ? itemId : entry)),
              }))
            }
            onItemRemove={(slotIndex) =>
              updateSetupB((current) => ({
                ...current,
                itemIds: current.itemIds.map((entry, index) => (index === slotIndex ? null : entry)),
              }))
            }
          />
        </div>

        <ComparisonSummary analysisA={analysisA} analysisB={analysisB} />

        <section className="glass-surface rounded-[28px] p-6">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Expériences sauvegardées</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">Retrouver un duel ou une comparaison miroir.</h2>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {savedExperiments.map((entry) => (
              <div key={entry.id} className="surface-elevated min-w-[320px] max-w-[360px] rounded-2xl p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{entry.name}</p>
                    <p className="text-xs text-muted-foreground">{entry.mode === "mirror" ? "Mode miroir" : "Mode duel"} · {new Date(entry.updatedAt).toLocaleString("fr-FR")}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      deleteSavedExperiment(entry.id);
                      setSavedExperiments(getSavedExperiments());
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>A: {championIndex.get(entry.setupA.championId)?.name ?? "Champion inconnu"} · {entry.setupA.role} · niv. {entry.setupA.level}</p>
                  <p>B: {championIndex.get(entry.setupB.championId)?.name ?? "Champion inconnu"} · {entry.setupB.role} · niv. {entry.setupB.level}</p>
                </div>
                <Button variant="premium" className="mt-4 w-full" onClick={() => loadExperiment(entry)}>
                  Charger cette expérience
                </Button>
              </div>
            ))}
            {savedExperiments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-5 text-sm text-muted-foreground">
                Aucune expérience sauvegardée pour l'instant.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Lab;
