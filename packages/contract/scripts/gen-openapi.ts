import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildOpenApiDocument } from "../src/openapi.js";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "openapi.json");
writeFileSync(out, JSON.stringify(buildOpenApiDocument(), null, 2) + "\n");
console.log("wrote", out);
