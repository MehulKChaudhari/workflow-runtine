/**
 * Lifecycle vocabulary shared by the runtime, scheduler, API and UI.
 * The transition rules (which moves are legal) live in @workflow/runtime;
 * this file only defines the states themselves.
 */

export const NODE_STATUSES = [
  /** Waiting for one or more dependencies to succeed. */
  "pending",
  /** All dependencies succeeded; queued for a worker. */
  "ready",
  /** A worker is executing an attempt right now. */
  "running",
  /** Terminal: the node completed and its output is trustworthy. */
  "succeeded",
  /** Terminal: all retry attempts are exhausted. */
  "failed",
  /** Terminal: never ran — an upstream dependency failed permanently. */
  "skipped",
] as const;

export type NodeStatus = (typeof NODE_STATUSES)[number];

export const TERMINAL_NODE_STATUSES = [
  "succeeded",
  "failed",
  "skipped",
] as const satisfies readonly NodeStatus[];

export function isTerminalNodeStatus(status: NodeStatus): boolean {
  return (TERMINAL_NODE_STATUSES as readonly NodeStatus[]).includes(status);
}

export const RUN_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "failed",
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];
