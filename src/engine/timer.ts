export class ActiveTimer {
  private accumulated = 0;
  private since: number | null = null;
  constructor(private now: () => number = () => performance.now()) {}
  start() {
    if (this.since === null) this.since = this.now();
  }
  pause() {
    if (this.since !== null) {
      this.accumulated += this.now() - this.since;
      this.since = null;
    }
  }
  reset() {
    this.accumulated = 0;
    this.since = null;
  }
  elapsed() {
    return (
      this.accumulated + (this.since === null ? 0 : this.now() - this.since)
    );
  }
  get running() {
    return this.since !== null;
  }
}
