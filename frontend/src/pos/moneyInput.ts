const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
const easternArabicDigits = "۰۱۲۳۴۵۶۷۸۹";

function normalizeDigits(value: string) {
  return [...value]
    .map((character) => {
      const arabicIndex = arabicDigits.indexOf(character);
      if (arabicIndex >= 0) return String(arabicIndex);
      const easternIndex = easternArabicDigits.indexOf(character);
      return easternIndex >= 0 ? String(easternIndex) : character;
    })
    .join("");
}

export function normalizeShekelInput(value: string) {
  const normalized = normalizeDigits(value)
    .replace(/[٫،,]/g, ".")
    .replace(/[^\d.]/g, "");
  const [whole = "", ...fractions] = normalized.split(".");
  const fraction = fractions.join("").slice(0, 2);
  return fractions.length ? `${whole || "0"}.${fraction}` : whole;
}

export function shekelInputToMinor(value: string) {
  const normalized = normalizeShekelInput(value);
  if (!normalized) return "0";
  const [whole = "0", fraction = ""] = normalized.split(".");
  return (
    BigInt(whole || "0") * 100n +
    BigInt(fraction.padEnd(2, "0").slice(0, 2) || "0")
  ).toString();
}

export function minorToShekelInput(value: string | bigint) {
  const minor = typeof value === "bigint" ? value : BigInt(value || "0");
  const sign = minor < 0n ? "-" : "";
  const absolute = minor < 0n ? -minor : minor;
  const fraction = (absolute % 100n)
    .toString()
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `${sign}${absolute / 100n}${fraction ? `.${fraction}` : ""}`;
}
