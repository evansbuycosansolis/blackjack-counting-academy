import { BettingMode, RampRow, defaultRamp, wager } from "@/engine/betting";
import { rulesKey } from "@/engine/calibration";
import { trueCount } from "@/engine/cards";
import { Action, Game, act, deal, insurance, newGame } from "@/engine/game";
import {
  IndexProfile,
  indexDecision,
  selectProfile,
  validateIndexProfile,
} from "@/engine/index-profiles";
import { Rules, defaultRules, validateRules } from "@/engine/rules";
import { adjusted, deviationsSupported, recommend } from "@/engine/strategy";
import { MasterySettings, TimedDrill, defaultMastery } from "@/engine/training";
import { RoundRecord } from "@/lib/analytics";
import { validateGame } from "@/lib/backup";
import { archiveRound, durableStorage } from "@/lib/storage";
import { validateProgress } from "@/lib/validation";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useLab } from "./lab-store";
interface State {
  timedRecords: TimedDrill[];
  mastery: MasterySettings;
  autoDifficulty: boolean;
  recordTimed: (r: TimedDrill) => void;
  setMastery: (m: MasterySettings) => void;
  setAutoDifficulty: (enabled: boolean) => void;
  bettingMode: "manual" | BettingMode;
  bettingUnit: number;
  bettingKelly: number;
  setBetting: (mode: State["bettingMode"], unit: number, kelly: number) => void;
  indexProfiles: IndexProfile[];
  activeIndexId: string;
  saveIndex: (p: IndexProfile) => void;
  deleteIndex: (id: string) => void;
  selectIndex: (id: string) => void;
  game: Game | null;
  rules: Rules;
  history: RoundRecord[];
  session: string;
  started: number;
  error: string;
  paused: boolean;
  coach: boolean;
  countVisible: boolean;
  casino: boolean;
  light: boolean;
  speed: number;
  sound: boolean;
  ramp: RampRow[];
  completed: number[];
  goal: number;
  drills: { correct: number; total: number; tcError: number; tcTotal: number };
  checks: {
    date: string;
    kind:
      | "counting"
      | "strategy"
      | "deviation"
      | "insurance"
      | "memory"
      | "threshold";
    correct: boolean;
    error?: number;
  }[];
  presets: Record<string, Rules>;
  init: () => void;
  deal: (bet: number) => void;
  action: (a: Action) => void;
  insure: (take: boolean, even?: boolean) => void;
  configure: (r: Rules, bankroll: number) => void;
  toggle: (
    key: "paused" | "coach" | "countVisible" | "casino" | "light" | "sound",
  ) => void;
  setSpeed: (n: number) => void;
  setRamp: (r: RampRow[]) => void;
  complete: (i: number) => void;
  score: (
    correct: boolean,
    tcError?: number,
    kind?:
      | "counting"
      | "strategy"
      | "deviation"
      | "insurance"
      | "memory"
      | "threshold",
  ) => void;
  savePreset: (name: string, r: Rules) => void;
  setGoal: (n: number) => void;
}
export const useGame = create<State>()(
  persist(
    (set, get) => {
      const commit = (f: (g: Game) => Game) => {
        try {
          const s = get();
          if (s.paused) throw Error("Resume your session to continue.");
          if (!s.game) return;
          const g = f(s.game);
          let history = s.history;
          if (
            g.phase === "settled" &&
            (s.game.phase !== "settled" || g.round !== s.game.round)
          ) {
            const rec: RoundRecord = {
              id: `${s.session}-${g.round}`,
              session: s.session,
              date: new Date().toISOString(),
              round: g.round,
              bankroll: g.bankroll,
              profit: g.bankroll - g.roundStart,
              wager: g.wagerCount,
              tc: g.tcAtBet,
              results: g.hands.map((h) => h.result ?? ""),
              decisions: g.decisions,
              rules: g.rules,
              duration: Date.now() - s.started,
              betAssessment: g.betAssessment,
            };
            void archiveRound({
              id: rec.id,
              session: s.session,
              record: rec,
              events: g.events ?? [],
            });
            history = [...history, rec].slice(-5000);
          }
          set({ game: g, history, error: "" });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : "Action failed" });
        }
      };
      return {
        game: null,
        timedRecords: [],
        mastery: defaultMastery,
        autoDifficulty: false,
        recordTimed: (r) =>
          set((s) => ({ timedRecords: [...s.timedRecords, r].slice(-1000) })),
        setMastery: (mastery) => set({ mastery }),
        setAutoDifficulty: (autoDifficulty) => set({ autoDifficulty }),
        bettingMode: "manual",
        bettingUnit: 10,
        bettingKelly: 0.25,
        setBetting: (bettingMode, bettingUnit, bettingKelly) => {
          if (
            !Number.isSafeInteger(bettingUnit) ||
            bettingUnit < 1 ||
            !Number.isFinite(bettingKelly) ||
            bettingKelly <= 0 ||
            bettingKelly > 1
          ) {
            set({
              error:
                "Use a positive whole-chip unit and a Kelly fraction from zero (exclusive) to one.",
            });
            return;
          }
          set({ bettingMode, bettingUnit, bettingKelly });
        },
        indexProfiles: [],
        activeIndexId: "auto",
        saveIndex: (p) => {
          validateIndexProfile(p);
          set((s) => ({
            indexProfiles: [
              ...s.indexProfiles.filter((x) => x.id !== p.id),
              { ...p, validated: false },
            ],
          }));
        },
        deleteIndex: (id) =>
          set((s) => ({
            indexProfiles: s.indexProfiles.filter((p) => p.id !== id),
            activeIndexId: s.activeIndexId === id ? "auto" : s.activeIndexId,
          })),
        selectIndex: (activeIndexId) => set({ activeIndexId }),
        rules: defaultRules,
        history: [],
        session: "",
        started: 0,
        error: "",
        paused: false,
        coach: true,
        countVisible: true,
        casino: false,
        light: false,
        speed: 0.25,
        sound: false,
        ramp: defaultRamp,
        completed: [],
        goal: 50,
        drills: { correct: 0, total: 0, tcError: 0, tcTotal: 0 },
        checks: [],
        presets: {},
        init: () => {
          const existing = get().game;
          if (existing) {
            if (!existing.recordEvents)
              set({
                game: {
                  ...existing,
                  recordEvents: true,
                  events: existing.events ?? [],
                },
              });
            return;
          }
          if (!get().game)
            set({
              game: newGame(get().rules, 100000, undefined, true),
              session: crypto.randomUUID(),
              started: Date.now(),
            });
        },
        deal: (bet) =>
          commit((g) => {
            const s = get(),
              tc =
                g.cursor >= Math.floor(g.shoe.length * g.rules.penetration)
                  ? 0
                  : trueCount(
                      g.running,
                      g.shoe.length - g.cursor,
                      g.rules.countPrecision,
                      g.rules.countRounding,
                    ).index,
              method = s.bettingMode === "manual" ? "ramp" : s.bettingMode,
              model = useLab
                .getState()
                .models.find(
                  (m) =>
                    m.rulesKey === rulesKey(g.rules) && m.policy === "basic",
                );
            const recommended = wager(
                method,
                tc,
                g.bankroll / 100,
                g.rules,
                s.bettingUnit,
                s.ramp,
                s.bettingKelly,
                model,
              ),
              n = deal(g, bet);
            n.betAssessment = {
              actual: bet,
              recommended,
              correct: bet === recommended,
              method:
                s.bettingMode === "manual"
                  ? "Manual · compared with working ramp"
                  : method,
              tc,
            };
            return n;
          }),
        action: (a) =>
          commit((g) => {
            const d = {
              cards: structuredClone(g.hands[g.active].cards),
              dealer: g.dealer[0],
              action: a,
              recommended: recommend(g),
              countRecommended:
                selectProfile(
                  g.rules,
                  get().activeIndexId,
                  get().indexProfiles,
                ) &&
                deviationsSupported(
                  g.rules,
                  selectProfile(
                    g.rules,
                    get().activeIndexId,
                    get().indexProfiles,
                  ),
                )
                  ? adjusted(
                      g,
                      undefined,
                      selectProfile(
                        g.rules,
                        get().activeIndexId,
                        get().indexProfiles,
                      ),
                    )
                  : null,
              count: trueCount(
                g.running,
                g.shoe.length - g.cursor,
                g.rules.countPrecision,
                g.rules.countRounding,
              ).index,
            };
            const n = act(g, a);
            n.decisions.push(d);
            return n;
          }),
        insure: (take, even) =>
          commit((g) => {
            const n = insurance(g, take, even);
            const p = selectProfile(
                g.rules,
                get().activeIndexId,
                get().indexProfiles,
              ),
              x = p?.entries.find((x) => x.above === "insurance");
            if (x) {
              const tc = trueCount(
                g.running,
                g.shoe.length - g.cursor,
                p!.precision,
                p!.rounding,
              ).index;
              get().score(
                (take || !!even) ===
                  (indexDecision(x, tc, g.running) === "insurance"),
                undefined,
                "insurance",
              );
            }
            return n;
          }),
        configure: (r, bankroll) => {
          if (
            get().game &&
            !["betting", "settled"].includes(get().game!.phase)
          ) {
            set({ error: "Finish the current round before changing rules." });
            return;
          }
          try {
            set({
              game: newGame(r, bankroll * 100, undefined, true),
              rules: r,
              session: crypto.randomUUID(),
              started: Date.now(),
              paused: false,
              error: "",
            });
          } catch (e) {
            set({ error: String(e) });
          }
        },
        toggle: (key) => set((s) => ({ [key]: !s[key] })),
        setSpeed: (speed) => set({ speed }),
        setRamp: (ramp) => set({ ramp }),
        complete: (i) =>
          set((s) => ({ completed: [...new Set([...s.completed, i])] })),
        score: (correct, err, kind = "counting") =>
          set((s) => ({
            checks: [
              ...s.checks,
              { date: new Date().toISOString(), kind, correct, error: err },
            ].slice(-5000),
            drills: {
              correct: s.drills.correct + Number(correct),
              total: s.drills.total + 1,
              tcError: s.drills.tcError + (err ?? 0),
              tcTotal: s.drills.tcTotal + (err === undefined ? 0 : 1),
            },
          })),
        savePreset: (name, r) => {
          try {
            validateRules(r);
            if (!name.trim()) throw Error("Enter a preset name.");
            set((s) => ({
              presets: { ...s.presets, [name]: { ...r } },
              error: "",
            }));
          } catch (e) {
            set({ error: String(e) });
          }
        },
        setGoal: (goal) => set({ goal }),
      };
    },
    {
      name: "blackjack-academy-v1",
      storage: createJSONStorage(() => durableStorage),
      skipHydration: true,
      merge: (saved, current) => {
        if (saved == null) return current;
        try {
          validateProgress(saved);
          const p = Object.fromEntries(
            Object.entries(saved as object).filter(
              ([key]) =>
                key in current &&
                typeof current[key as keyof State] !== "function",
            ),
          ) as Partial<State>;
          const game = p.game ? validateGame(p.game) : null;
          return {
            ...current,
            ...p,
            game,
            rules: game?.rules ?? p.rules ?? current.rules,
          };
        } catch {
          return {
            ...current,
            error:
              "Saved progress failed validation. A new session is ready; restore a known-good backup in Settings.",
          };
        }
      },
      partialize: (s) => ({
        game: s.game,
        timedRecords: s.timedRecords,
        mastery: s.mastery,
        autoDifficulty: s.autoDifficulty,
        bettingMode: s.bettingMode,
        bettingUnit: s.bettingUnit,
        bettingKelly: s.bettingKelly,
        paused: s.paused,
        indexProfiles: s.indexProfiles,
        activeIndexId: s.activeIndexId,
        rules: s.rules,
        history: s.history,
        session: s.session,
        started: s.started,
        coach: s.coach,
        countVisible: s.countVisible,
        casino: s.casino,
        light: s.light,
        speed: s.speed,
        sound: s.sound,
        ramp: s.ramp,
        completed: s.completed,
        goal: s.goal,
        drills: s.drills,
        checks: s.checks,
        presets: s.presets,
      }),
    },
  ),
);
