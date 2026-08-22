import {
  isTerminalNodeStatus,
  type NodeStatus,
  type RunStatus,
} from "@workflow/shared";

/**
 * A run's status is derived, not stored as an independent machine: it is a
 * pure fold over its nodes' statuses, so it can never disagree with them.
 *
 * Callers guarantee at least one node (the validator rejects empty graphs).
 */
export function computeRunStatus(
  nodeStatuses: readonly NodeStatus[],
): RunStatus {
  if (nodeStatuses.every((status) => status === "pending")) {
    return "pending";
  }
  if (nodeStatuses.every(isTerminalNodeStatus)) {
    const anyBad = nodeStatuses.some(
      (status) => status === "failed" || status === "skipped",
    );
    return anyBad ? "failed" : "succeeded";
  }
  return "running";
}
