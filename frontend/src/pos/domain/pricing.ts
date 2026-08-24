export interface LocalPriceModifier { groupType: "VARIANT" | "ADD_ON"; priceType: "DELTA" | "REPLACEMENT"; priceMinor: string; quantity?: number }
export function priceLine(baseMinor: string, quantity: number, modifiers: LocalPriceModifier[]) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("INVALID_QUANTITY");
  let base = BigInt(baseMinor);
  const replacements = modifiers.filter((modifier) => modifier.groupType === "VARIANT" && modifier.priceType === "REPLACEMENT");
  if (replacements.length > 1) throw new Error("INVALID_MODIFIER_SELECTION");
  if (replacements[0]) base = BigInt(replacements[0].priceMinor);
  for (const modifier of modifiers.filter((value) => value.groupType === "VARIANT" && value.priceType === "DELTA")) base += BigInt(modifier.priceMinor) * BigInt(modifier.quantity ?? 1);
  const addOns = modifiers.filter((value) => value.groupType === "ADD_ON").reduce((sum, value) => sum + BigInt(value.priceMinor) * BigInt(value.quantity ?? 1), 0n);
  const unitPriceMinor = base + addOns;
  if (unitPriceMinor < 0n) throw new Error("INVALID_MODIFIER_SELECTION");
  return { unitPriceMinor: unitPriceMinor.toString(), lineTotalMinor: (unitPriceMinor * BigInt(quantity)).toString() };
}
