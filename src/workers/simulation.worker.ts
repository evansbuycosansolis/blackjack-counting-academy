/// <reference lib="webworker" />
import { SimulationConfig, Simulator } from "../engine/simulation";
let sim: Simulator | null = null,
  cancel = false;
self.onmessage = (
  e: MessageEvent<{ type: "start" | "cancel"; config: SimulationConfig }>,
) => {
  if (e.data.type === "cancel") {
    cancel = true;
    return;
  }
  cancel = false;
  try {
    sim = new Simulator(e.data.config);
    run();
  } catch (e) {
    self.postMessage({ type: "error", message: String(e) });
  }
};
function run() {
  try {
    if (!sim) return;
    const done = sim.step(500);
    self.postMessage({ type: "progress", hands: sim.result.hands });
    if (done || cancel) {
      self.postMessage({
        type: "done",
        result: sim.finish(cancel ? "Cancelled" : undefined),
      });
      sim = null;
    } else setTimeout(run, 0);
  } catch (e) {
    self.postMessage({ type: "error", message: String(e) });
    sim = null;
  }
}
