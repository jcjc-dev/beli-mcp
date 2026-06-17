import { z } from "zod";
import { IntId, PlaceId } from "./common.js";

/**
 * Full business object returned by GET /api/business/?id= or ?place_id=.
 * Only the stable, observed fields are typed; unknown extras are allowed via
 * .passthrough() so the contract tolerates additive API changes.
 */
export const Business = z
  .object({
    id: IntId,
    place_id: PlaceId.nullable().optional(),
    name: z.string(),
    status: z.string().optional(),
    city: z.string().nullable().optional(),
    borough: z.string().nullable().optional(),
    neighborhood: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
    price: z.number().nullable().optional(),
    price_key: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    phone_number: z.string().nullable().optional(),
    cuisines: z.array(z.string()).optional(),
    quick_link: z.string().nullable().optional(),
    tz: z.string().nullable().optional(),
  })
  .passthrough();
export type Business = z.infer<typeof Business>;

/** GET /api/business/ returns either {results:[Business]} or a bare Business. */
export const BusinessResponse = z.union([
  z.object({ results: z.array(Business) }),
  Business,
]);

/**
 * Google-Places-style autocomplete prediction from GET /api/search-app/.
 * `business` is the Beli integer id, present INLINE when the place already
 * exists in Beli's DB (otherwise resolve place_id via GET /api/business/).
 */
export const SearchPrediction = z
  .object({
    place_id: PlaceId,
    structured_formatting: z
      .object({
        main_text: z.string(),
        secondary_text: z.string().optional(),
        main_text_matched_substrings: z
          .array(z.object({ length: z.number(), offset: z.number() }))
          .optional(),
      })
      .optional(),
    business: IntId.nullable().optional(),
    types: z.array(z.string()).optional(),
    distance_meters: z.number().nullable().optional(),
    default_category: z.string().nullable().optional(),
    source_used: z.string().optional(),
  })
  .passthrough();
export type SearchPrediction = z.infer<typeof SearchPrediction>;

export const SearchResponse = z.object({
  predictions: z.array(SearchPrediction),
});
export type SearchResponse = z.infer<typeof SearchResponse>;
