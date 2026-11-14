/// <reference lib="webworker" />
import {
  ActionSampler,
  AnalysisLimit,
  exactActionAnalysis,
  exactActionStudy,
} from "../engine/analysis";
import type { Game } from "../engine/game";
let job: ActionSampler | null = null,
  cancel = false;
let theoretical: ReturnType<typeof exactActionAnalysis> | undefined;
self.onmessage = (
  e: MessageEvent<{
    type: "analyze" | "cancel";
    game: Game;
    samples: number;
    seed: number;
    exactLimit?: number;
    sampleOnly?: boolean;
    compareExact?: boolean;
    exactOnly?: boolean;
  }>,
) => {
  if (e.data.type === "cancel") {
    cancel = true;
    return;
  }
  cancel = false;
  theoretical = undefined;
  if (e.data.compareExact) {
    try {
      const study = exactActionStudy(e.data.game, e.data.exactLimit ?? 75000);
      theoretical = study.result;
      job = new ActionSampler(
        e.data.game,
        e.data.samples,
        e.data.seed,
        study.continuation,
        true,
      );
      tick();
    } catch (error) {
      self.postMessage({ type: "error", message: String(error) });
    }
    return;
  }
  if (e.data.sampleOnly) {
    job = new ActionSampler(e.data.game, e.data.samples, e.data.seed);
    tick();
    return;
  }
  try {
    const exact = exactActionAnalysis(e.data.game, e.data.exactLimit ?? 75000);
    self.postMessage({ type: "done", result: exact });
  } catch (e2) {
    if (e.data.exactOnly && e2 instanceof AnalysisLimit) {
      self.postMessage({
        type: "error",
        message:
          "Exact coaching reached its state budget. No certified recommendation is available for this decision; use labelled policy analysis for estimates.",
      });
      return;
    }
    if (!(e2 instanceof AnalysisLimit)) {
      self.postMessage({ type: "error", message: String(e2) });
      return;
    }
    job = new ActionSampler(e.data.game, e.data.samples, e.data.seed);
    tick();
  }
};
function tick() {
  if (!job) return;
  try {
    const done = job.step(100);
    self.postMessage({ type: "progress", samples: job.samples });
    if (done || cancel) {
      self.postMessage({
        type: "done",
        result: job.finish(),
        theoretical,
        curve: job.curve,
        cancelled: cancel,
      });
      job = null;
    } else setTimeout(tick, 0);
  } catch (e) {
    self.postMessage({ type: "error", message: String(e) });
    job = null;
  }
}
