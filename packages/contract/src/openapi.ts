import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { endpoints, type EndpointDef } from "./endpoints.js";
import { HOSTS, META } from "./meta.js";

extendZodWithOpenApi(z);

/**
 * Generate an OpenAPI 3.1 document FROM the zod contract. The zod schemas are
 * the source of truth; this file produces the publishable spec as a byproduct.
 */
export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  for (const e of Object.values(endpoints) as EndpointDef[]) {
    const openapiPath = e.path.replace(/\{(\w+)\}/g, ":$1");

    const request: Record<string, unknown> = {};
    if (e.query && e.query.length > 0) {
      request.query = z.object(
        Object.fromEntries(e.query.map((q) => [q, z.string().optional()])),
      );
    }
    if (e.request) {
      const isMultipart = e.contentType === "multipart";
      request.body = {
        content: {
          [isMultipart ? "multipart/form-data" : "application/json"]: {
            schema: e.request,
          },
        },
      };
    }

    registry.registerPath({
      method: e.method.toLowerCase() as Lowercase<EndpointDef["method"]>,
      path: openapiPath,
      summary: e.summary,
      operationId: e.id,
      servers: [{ url: HOSTS[e.host] }],
      security: e.auth ? [{ bearerAuth: [] }] : [],
      request: Object.keys(request).length ? request : undefined,
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: e.response } },
        },
      },
    });
  }

  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Beli API (reverse-engineered)",
      version: META.appVersion,
      description:
        "Unofficial, reverse-engineered contract for the Beli app API. " +
        "Snapshot of app v" +
        META.appVersion +
        "; no compatibility guarantee. Every authenticated request also needs " +
        "Origin: https://localhost.",
    },
    servers: Object.values(HOSTS).map((url) => ({ url })),
  });
}
