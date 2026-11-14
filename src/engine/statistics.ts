export function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
export function quantile(xs: number[], p: number) {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y),
    t = (a.length - 1) * p,
    i = Math.floor(t);
  return a[i] + (a[Math.min(a.length - 1, i + 1)] - a[i]) * (t - i);
}
export function wilson(
  successes: number,
  n: number,
  z = 1.959963984540054,
): [number, number] {
  if (!n) return [0, 1];
  const p = successes / n,
    den = 1 + (z * z) / n,
    mid = (p + (z * z) / (2 * n)) / den,
    m = (z / den) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, mid - m), Math.min(1, mid + m)];
}
export function bootstrapMeanCI(
  xs: number[],
  rng: () => number,
  resamples = 1000,
): [number, number] {
  if (!xs.length) return [0, 0];
  if (xs.length === 1) return [xs[0], xs[0]];
  const means: number[] = [];
  for (let b = 0; b < resamples; b++) {
    let sum = 0;
    for (let i = 0; i < xs.length; i++)
      sum += xs[Math.floor(rng() * xs.length)];
    means.push(sum / xs.length);
  }
  return [quantile(means, 0.025), quantile(means, 0.975)];
}
export function histogram(xs: number[], bins = 16) {
  if (!xs.length) return [];
  const lo = Math.min(...xs),
    hi = Math.max(...xs),
    width = hi === lo ? 1 : (hi - lo) / bins;
  const a = Array.from({ length: hi === lo ? 1 : bins }, (_, i) => ({
    lower: lo + i * width,
    upper: lo + (i + 1) * width,
    count: 0,
    label: `${(lo + i * width).toFixed(0)}–${(lo + (i + 1) * width).toFixed(0)}`,
  }));
  for (const x of xs)
    a[Math.min(a.length - 1, Math.floor((x - lo) / width))].count++;
  return a;
}
export function derivedSeed(seed: number, session: number) {
  let x = (seed ^ Math.imul(session + 1, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}
