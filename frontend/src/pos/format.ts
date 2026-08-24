export function formatMinor(value: string | bigint, currency = "₪") {
  const minor = typeof value === "bigint" ? value : BigInt(value || "0");
  const sign = minor < 0n ? "-" : "";
  const absolute = minor < 0n ? -minor : minor;
  const remainder = absolute % 100n;
  const fraction = remainder === 0n
    ? ""
    : `.${remainder.toString().padStart(2, "0").replace(/0+$/, "")}`;
  return `${sign}${absolute / 100n}${fraction} ${currency}`;
}

export function paymentMethodLabel(method: string) {
  return method === "CASH" ? "نقدي" : method === "VISA" ? "Visa" : method;
}
