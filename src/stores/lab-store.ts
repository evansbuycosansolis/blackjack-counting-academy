import { RampRow, defaultRamp, validateRamp } from "@/engine/betting";
import { EdgeModel } from "@/engine/calibration";
import { RiskResult } from "@/engine/risk";
import { SimulationResult } from "@/engine/simulation";
import { durableStorage } from "@/lib/storage";
import { validateLab } from "@/lib/validation";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
export interface NamedRamp {
  id: string;
  name: string;
  rows: RampRow[];
}
interface LabState {
  ramps: NamedRamp[];
  runs: { id: string; date: string; name: string; result: SimulationResult }[];
  riskRuns: { id: string; date: string; result: RiskResult }[];
  models: EdgeModel[];
  saveRamp: (r: NamedRamp) => void;
  deleteRamp: (id: string) => void;
  saveRun: (r: SimulationResult) => void;
  deleteRun: (id: string) => void;
  saveRisk: (r: RiskResult) => void;
  saveModel: (m: EdgeModel) => void;
}
export const useLab = create<LabState>()(
  persist(
    (set) => ({
      ramps: [
        { id: "example", name: "Educational 1–8 spread", rows: defaultRamp },
      ],
      runs: [],
      riskRuns: [],
      models: [],
      saveRamp: (r) => {
        if (!r.name.trim() || !validateRamp(r.rows))
          throw Error(
            "A named ramp needs increasing thresholds and positive whole-chip wagers.",
          );
        set((s) => ({
          ramps: [...s.ramps.filter((x) => x.id !== r.id), structuredClone(r)],
        }));
      },
      deleteRamp: (id) =>
        set((s) => ({ ramps: s.ramps.filter((r) => r.id !== id) })),
      saveRun: (result) =>
        set((s) => ({
          runs: [
            ...s.runs,
            {
              id: crypto.randomUUID(),
              date: new Date().toISOString(),
              name: `${result.config.mode} · seed ${result.seed}`,
              result,
            },
          ].slice(-10),
          models: result.edgeModel
            ? [
                ...s.models.filter(
                  (m) =>
                    m.rulesKey !== result.edgeModel!.rulesKey ||
                    m.policy !== result.edgeModel!.policy,
                ),
                result.edgeModel,
              ].slice(-10)
            : s.models,
        })),
      deleteRun: (id) =>
        set((s) => ({ runs: s.runs.filter((r) => r.id !== id) })),
      saveRisk: (result) =>
        set((s) => ({
          riskRuns: [
            ...s.riskRuns,
            { id: crypto.randomUUID(), date: new Date().toISOString(), result },
          ].slice(-5),
        })),
      saveModel: (m) =>
        set((s) => ({
          models: [
            ...s.models.filter(
              (x) => x.rulesKey !== m.rulesKey || x.policy !== m.policy,
            ),
            m,
          ].slice(-10),
        })),
    }),
    {
      name: "blackjack-lab-v2",
      storage: createJSONStorage(() => durableStorage),
      skipHydration: true,
      merge: (saved, current) => {
        if (saved == null) return current;
        try {
          validateLab(saved);
          const p = Object.fromEntries(
            Object.entries(saved as object).filter(
              ([key]) =>
                key in current &&
                typeof current[key as keyof LabState] !== "function",
            ),
          );
          return { ...current, ...p };
        } catch {
          return current;
        }
      },
    },
  ),
);
