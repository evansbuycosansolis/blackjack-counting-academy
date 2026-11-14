import { defaultRules } from "@/engine/rules";
import { useGame } from "@/stores/game-store";
import { useLab } from "@/stores/lab-store";
import { Backup, restoreRoundArchive, validateBackup } from "./backup";
export async function restoreBackup(input: unknown) {
  const backup: Backup = validateBackup(input),
    g = backup.game,
    l = backup.lab;
  await restoreRoundArchive(backup.rounds);
  const gameKeys = [
    "game",
    "history",
    "session",
    "started",
    "coach",
    "countVisible",
    "casino",
    "light",
    "speed",
    "sound",
    "ramp",
    "completed",
    "goal",
    "drills",
    "checks",
    "presets",
    "indexProfiles",
    "activeIndexId",
    "bettingMode",
    "bettingUnit",
    "bettingKelly",
    "timedRecords",
    "mastery",
    "autoDifficulty",
  ] as const;
  const patch: Record<string, unknown> = {};
  for (const key of gameKeys) if (g[key] !== undefined) patch[key] = g[key];
  patch.rules = (g.game as { rules?: unknown } | null)?.rules ?? {
    ...defaultRules,
    ...(g.rules as object),
  };
  patch.paused = true;
  useGame.setState(patch);
  const labPatch: Record<string, unknown> = {};
  for (const k of ["ramps", "runs", "riskRuns", "models"])
    if (l[k] !== undefined) labPatch[k] = l[k];
  useLab.setState(labPatch);
  return backup;
}
