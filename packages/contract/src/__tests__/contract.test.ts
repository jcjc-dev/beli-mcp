import { describe, expect, it } from "vitest";
import {
  AddRankingRequest,
  buildOpenApiDocument,
  endpoints,
  SENTIMENT_VALUE,
  UploadPhotoFields,
} from "@beli/contract";

describe("@beli/contract", () => {
  it("maps sentiment labels to the ranker seed value", () => {
    expect(SENTIMENT_VALUE.liked).toBe(2.5);
    expect(SENTIMENT_VALUE.fine).toBe(1.5);
    expect(SENTIMENT_VALUE.disliked).toBe(0.5);
  });

  it("registers the core write endpoints with correct shapes", () => {
    expect(endpoints.addRanking.method).toBe("POST");
    expect(endpoints.addRanking.host).toBe("API");
    expect(endpoints.uploadPhoto.contentType).toBe("multipart");
    expect(endpoints.login.auth).toBe(false);
    expect(endpoints.getRanking.auth).toBe(true);
  });

  it("validates an add-ranking payload and rejects a bad visit date", () => {
    const base = {
      category: "BAR" as const,
      user_id: "00000000-0000-0000-0000-000000000000",
      business_id: 1727551,
      value: 2.5,
      local_datetime: "2026-06-14T16:03:46.365Z",
      utc_offset: 420,
      visit_dates: ["2026-06-08"],
    };
    expect(() => AddRankingRequest.parse(base)).not.toThrow();
    expect(() =>
      AddRankingRequest.parse({ ...base, visit_dates: ["June 8"] }),
    ).toThrow();
  });

  it("defaults photo multipart fields", () => {
    const f = UploadPhotoFields.parse({
      business: 1,
      user: "00000000-0000-0000-0000-000000000000",
    });
    expect(f.order).toBe(0);
    expect(f.favorite_dish).toBe(false);
    expect(f.description).toBe("");
  });

  it("generates a valid OpenAPI 3.1 document from the zod contract", () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths ?? {}).length).toBeGreaterThan(5);
  });
});
