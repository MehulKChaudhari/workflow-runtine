import { z } from "zod";

/**
 * A value that survives JSON serialization unchanged. Everything that crosses
 * a boundary (Postgres, HTTP, an LLM) must be a JsonValue — no Dates, no
 * undefined, no functions, no class instances.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

/** A JSON object — the shape of node config, inputs and outputs. */
export type JsonObject = { [key: string]: JsonValue };

export const jsonObjectSchema: z.ZodType<JsonObject> = z.record(
  z.string(),
  jsonValueSchema,
);
