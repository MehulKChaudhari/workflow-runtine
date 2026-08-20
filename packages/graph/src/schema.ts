import { z } from "zod";
import { jsonObjectSchema } from "@workflow/shared";

/**
 * Node ids are slugs, not free text: they get embedded in error messages,
 * log lines, DB rows and URLs, and the planner LLM must be able to repeat
 * them exactly in edges.
 */
export const nodeIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9][a-z0-9_-]*$/,
    "node id must be a lowercase slug (a-z, 0-9, '-', '_')",
  );

export const nodeDefinitionSchema = z.object({
  /** Unique within the workflow. What edges point at. */
  id: nodeIdSchema,
  /** Which worker executes this node (e.g. "http-fetch", "llm-call"). */
  type: z.string().min(1),
  /**
   * Instance-specific parameters, interpreted only by the matching worker.
   * The scheduler and runtime treat this as an opaque JSON object.
   */
  config: jsonObjectSchema.default({}),
});

/** A dependency arrow: `to` may not start until `from` has succeeded. */
export const edgeDefinitionSchema = z.object({
  from: nodeIdSchema,
  to: nodeIdSchema,
});

export const workflowDefinitionSchema = z.object({
  name: z.string().min(1).max(200),
  nodes: z
    .array(nodeDefinitionSchema)
    .min(1, "a workflow must contain at least one node"),
  edges: z.array(edgeDefinitionSchema),
});

export type NodeDefinition = z.infer<typeof nodeDefinitionSchema>;
export type EdgeDefinition = z.infer<typeof edgeDefinitionSchema>;
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
