/** "1,500.50" or "₱1500.5" → 1500.5; "" → null. */
export function pesos(value: string): number | null {
  const n = Number(value.replace(/[^\d.]/g, ""));
  return value.trim() === "" || Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

/** 1500.5 → "₱1,500.50". */
export const peso = (n: number) =>
  "₱" +
  n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
