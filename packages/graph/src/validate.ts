import { workflowDefinitionSchema, type WorkflowDefinition } from "./schema";
import { topologicalSort } from "./toposort";

export type ValidationIssueCode =
  | "INVALID_SHAPE"
  | "DUPLICATE_NODE_ID"
  | "DUPLICATE_EDGE"
  | "UNKNOWN_NODE_REFERENCE"
  | "SELF_DEPENDENCY"
  | "CYCLE_DETECTED";

export interface ValidationIssue {
  code: ValidationIssueCode;
  /** Human- and LLM-readable. These get fed back to the planner on retry. */
  message: string;
  /** JSON path to the offending value, when known (e.g. "nodes.2.id"). */
  path?: string;
}

export type ParseWorkflowResult =
  | { ok: true; workflow: WorkflowDefinition }
  | { ok: false; issues: ValidationIssue[] };

/**
 * The single entry point for untrusted plans (LLM output, HTTP bodies).
 * Parse, don't validate: unknown goes in, a trusted WorkflowDefinition
 * comes out — or a list of every problem found.
 *
 * Layers, cheapest first:
 *   1. shape (Zod)
 *   2. referential integrity (ids unique, edges point at real nodes)
 *   3. semantics (acyclicity via Kahn's algorithm)
 */
export function parseWorkflowDefinition(input: unknown): ParseWorkflowResult {
  const shape = workflowDefinitionSchema.safeParse(input);
  if (!shape.success) {
    return {
      ok: false,
      issues: shape.error.issues.map((issue) => ({
        code: "INVALID_SHAPE",
        message: issue.message,
        path: issue.path.join("."),
      })),
    };
  }

  const workflow = shape.data;
  const issues: ValidationIssue[] = [];

  const nodeIds = new Set<string>();
  for (const node of workflow.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({
        code: "DUPLICATE_NODE_ID",
        message: `node id "${node.id}" is used more than once; ids must be unique`,
      });
    }
    nodeIds.add(node.id);
  }

  const seenEdges = new Set<string>();
  for (const [index, edge] of workflow.edges.entries()) {
    for (const endpoint of ["from", "to"] as const) {
      if (!nodeIds.has(edge[endpoint])) {
        issues.push({
          code: "UNKNOWN_NODE_REFERENCE",
          message: `edge ${edge.from} -> ${edge.to}: "${edge[endpoint]}" is not the id of any node`,
          path: `edges.${index}.${endpoint}`,
        });
      }
    }
    if (edge.from === edge.to) {
      issues.push({
        code: "SELF_DEPENDENCY",
        message: `node "${edge.from}" depends on itself; a node cannot wait for its own completion`,
        path: `edges.${index}`,
      });
    }
    const key = `${edge.from}->${edge.to}`;
    if (seenEdges.has(key)) {
      issues.push({
        code: "DUPLICATE_EDGE",
        message: `edge ${key} is declared more than once`,
        path: `edges.${index}`,
      });
    }
    seenEdges.add(key);
  }

  // Cycle detection assumes a referentially intact graph; don't run it on one
  // that already failed layer 2.
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const { stuck } = topologicalSort(workflow.nodes, workflow.edges);
  if (stuck.length > 0) {
    return {
      ok: false,
      issues: [
        {
          code: "CYCLE_DETECTED",
          message:
            `nodes [${stuck.join(", ")}] can never run: each is waiting on a ` +
            `dependency that is (directly or indirectly) waiting on it`,
        },
      ],
    };
  }

  return { ok: true, workflow };
}
