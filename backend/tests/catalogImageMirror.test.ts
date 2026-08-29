import { describe, expect, it } from "vitest";
import { isExternalCatalogImageUrl } from "../src/modules/upload/catalogImageMirror.service.js";

describe("external catalog image URL validation", () => {
  it("accepts only HTTPS images from the imported catalog host", () => {
    expect(isExternalCatalogImageUrl("https://res.nunps.com/api/image?id=123")).toBe(true);
    expect(isExternalCatalogImageUrl("http://res.nunps.com/api/image?id=123")).toBe(false);
    expect(isExternalCatalogImageUrl("https://evil.example/api/image?id=123")).toBe(false);
    expect(isExternalCatalogImageUrl("not-a-url")).toBe(false);
  });
});
