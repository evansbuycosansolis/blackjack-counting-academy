export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
export const signed = (n: number) => `${n >= 0 ? "+" : ""}${money(n)}`;
