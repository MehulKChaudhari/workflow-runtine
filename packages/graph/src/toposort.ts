import type { EdgeDefinition, NodeDefinition } from "./schema";

export interface TopologicalSortResult {
  /** Node ids in a valid execution order (dependencies always first). */
  order: string[];
  /** Node ids that never became ready — each is in, or downstream of, a cycle. */
  stuck: string[];
}

/**
 * Kahn's algorithm. Repeatedly "run" nodes with no unmet dependencies,
 * releasing their dependents as they finish. This is the scheduler's core
 * loop, fast-forwarded: if every node gets emitted the graph is a DAG; the
 * leftovers are deadlocked in a cycle.
 *
 * Assumes referential integrity (edges point at real nodes) — the validator
 * checks that before calling.
 */
export function topologicalSort(
  nodes: readonly NodeDefinition[],
  edges: readonly EdgeDefinition[],
): TopologicalSortResult {
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const node of nodes) {
    indegree.set(node.id, 0);
    dependents.set(node.id, []);
  }
  for (const edge of edges) {
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    dependents.get(edge.from)?.push(edge.to);
  }

  const ready: string[] = [];
  for (const [id, degree] of indegree) {
    if (degree === 0) ready.push(id);
  }

  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.pop();
    if (id === undefined) break;
    order.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const remaining = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, remaining);
      if (remaining === 0) ready.push(dependent);
    }
  }

  const emitted = new Set(order);
  const stuck = nodes.map((n) => n.id).filter((id) => !emitted.has(id));
  return { order, stuck };
}
