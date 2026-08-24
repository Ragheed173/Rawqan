export function formatMinor(value: string | bigint, currency = "₪") {
  const minor = typeof value === "bigint" ? value : BigInt(value || "0");
  const sign = minor < 0n ? "-" : "";
  const absolute = minor < 0n ? -minor : minor;
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")} ${currency}`;
}

export function paymentMethodLabel(method: string) {
  return method === "CASH" ? "نقدي" : method === "VISA" ? "Visa" : method;
}
