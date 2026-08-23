import type { WorkflowDefinition } from "@workflow/graph";
import type { NodeStatus } from "@workflow/shared";

export interface ScheduleDecision {
  /** Pending nodes whose every parent has succeeded (or that have no parents). */
  becomeReady: string[];
  /** Pending nodes that can never run: a parent failed or was skipped. */
  becomeSkipped: string[];
}

/**
 * One look at the graph. Returns the events the runtime should apply —
 * it does not apply them. Importing transitionNode from runtime would
 * cycle the package DAG and give this package a second doorway into
 * node state.
 */
export function schedule(
  workflow: WorkflowDefinition,
  statuses: ReadonlyMap<string, NodeStatus>,
): ScheduleDecision {
  const parents = parentsByNode(workflow);
  const becomeReady: string[] = [];
  const becomeSkipped: string[] = [];

  for (const node of workflow.nodes) {
    if (statuses.get(node.id) !== "pending") continue;

    const parentIds = parents.get(node.id) ?? [];
    const parentStatuses = parentIds.map((id) => statuses.get(id));

    // A missing parent status is a caller bug. Leave the node pending so
    // we do not invent a transition from incomplete data.
    if (parentStatuses.some((status) => status === undefined)) continue;

    const blocked = parentStatuses.some(
      (status) => status === "failed" || status === "skipped",
    );
    if (blocked) {
      becomeSkipped.push(node.id);
      continue;
    }

    if (parentStatuses.every((status) => status === "succeeded")) {
      becomeReady.push(node.id);
    }
  }

  return { becomeReady, becomeSkipped };
}

function parentsByNode(workflow: WorkflowDefinition): Map<string, string[]> {
  const parents = new Map<string, string[]>();
  for (const node of workflow.nodes) {
    parents.set(node.id, []);
  }
  for (const edge of workflow.edges) {
    parents.get(edge.to)?.push(edge.from);
  }
  return parents;
}
