import { z } from "zod";
import { IntId, IsoDateTime, Uuid } from "./common.js";

/**
 * Multipart fields for POST /api/user-business-photo/ (one request per photo).
 * Sent as multipart/form-data. `order` is the EXPLICIT display position
 * (verified decoupled from upload sequence). A photo can be attached to a
 * business WITHOUT a ranking — it then shows in the uploader's profile photos
 * but NOT on the public business page until a ranking exists.
 *
 * This schema describes the logical fields; the `image` binary is supplied
 * separately by the client as a Blob/file, not as part of this object.
 */
export const UploadPhotoFields = z.object({
  business: IntId,
  user: Uuid,
  description: z.string().default(""),
  order: z.number().int().default(0),
  favorite_dish: z.boolean().default(false),
});
export type UploadPhotoFields = z.infer<typeof UploadPhotoFields>;

/** 201 response: just the new photo id. */
export const UploadPhotoResponse = z.object({ id: IntId });
export type UploadPhotoResponse = z.infer<typeof UploadPhotoResponse>;

/** Photo status lifecycle. Uploads default to ACTIVE; soft-delete sets DELETED. */
export const PhotoStatus = z.enum(["ACTIVE", "PENDING", "DELETED"]);

/** A photo record from GET /api/user-business-photo/?user=&business=. */
export const PhotoRecord = z
  .object({
    id: IntId,
    user: z.union([Uuid, z.string()]),
    business: z.union([IntId, z.string()]),
    image: z.string().nullable().optional(),
    thumbnail: z.string().nullable().optional(),
    bb_image: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    order: z.union([z.number(), z.string()]).nullable().optional(),
    favorite_dish: z.union([z.boolean(), z.string()]).optional(),
    status: PhotoStatus.optional(),
    created_dt: IsoDateTime.optional(),
  })
  .passthrough();
export type PhotoRecord = z.infer<typeof PhotoRecord>;

export const PhotoListResponse = z.object({ results: z.array(PhotoRecord) });

/** Body for PUT /api/user-business-photo/{id}/ (status update / soft delete). */
export const UpdatePhotoRequest = z.object({ status: PhotoStatus });
