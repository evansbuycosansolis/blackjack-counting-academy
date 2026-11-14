/// <reference lib="webworker" />
import { RiskConfig, RiskStudy } from "../engine/risk";
let study: RiskStudy | null = null,
  cancel = false;
self.onmessage = (
  e: MessageEvent<{ type: "start" | "cancel"; config: RiskConfig }>,
) => {
  if (e.data.type === "cancel") {
    cancel = true;
    return;
  }
  cancel = false;
  try {
    study = new RiskStudy(e.data.config);
    tick();
  } catch (e) {
    self.postMessage({ type: "error", message: String(e) });
  }
};
function tick() {
  if (!study) return;
  try {
    const done = study.step(500);
    self.postMessage({
      type: "progress",
      completed: study.completed,
      total: study.config.sessions * study.config.strategies.length,
    });
    if (done || cancel) {
      self.postMessage({ type: "done", result: study.finish(cancel) });
      study = null;
    } else setTimeout(tick, 0);
  } catch (e) {
    self.postMessage({ type: "error", message: String(e) });
    study = null;
  }
}
