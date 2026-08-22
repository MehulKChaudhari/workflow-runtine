import type { NodeStatus } from "@workflow/shared";

/**
 * The mutable part of a node during one run. The definition (id, type,
 * config) is frozen elsewhere; this is the piece that changes.
 */
export interface NodeLifecycleState {
  status: NodeStatus;
  /** Attempts dispatched so far. Increments on DISPATCHED, never resets. */
  attempts: number;
}

export interface RetryPolicy {
  /** Total attempts allowed, including the first (1 = no retries). */
  maxAttempts: number;
}

/** Everything that can happen to a node, from the node's point of view. */
export type NodeEvent =
  /** Scheduler: every dependency has succeeded. */
  | { type: "DEPENDENCIES_MET" }
  /** Scheduler: an upstream dependency failed permanently; this node will never run. */
  | { type: "UPSTREAM_FAILED" }
  /** Runtime: handed to a worker; an attempt is starting. */
  | { type: "DISPATCHED" }
  /** Worker: the current attempt completed successfully. */
  | { type: "ATTEMPT_SUCCEEDED" }
  /** Worker: the current attempt failed (error, timeout, crash). */
  | { type: "ATTEMPT_FAILED" };

export type NodeTransitionResult =
  | { ok: true; state: NodeLifecycleState }
  | { ok: false; reason: string };

export function initialNodeState(): NodeLifecycleState {
  return { status: "pending", attempts: 0 };
}

/**
 * The single doorway for node status changes. Pure: no I/O, no clock, no
 * randomness — (state, event) in, new state out. Every (status, event)
 * pair not listed here is illegal and rejected loudly.
 *
 * Retries are a counter, not a status loop: a failed attempt with budget
 * left returns the node to `ready` (its dependencies are still met).
 * `failed` always means failed for good.
 */
export function transitionNode(
  state: NodeLifecycleState,
  event: NodeEvent,
  policy: RetryPolicy,
): NodeTransitionResult {
  switch (event.type) {
    case "DEPENDENCIES_MET":
      if (state.status !== "pending") return illegal(state, event);
      return legal({ ...state, status: "ready" });

    case "UPSTREAM_FAILED":
      if (state.status !== "pending") return illegal(state, event);
      return legal({ ...state, status: "skipped" });

    case "DISPATCHED":
      if (state.status !== "ready") return illegal(state, event);
      return legal({ status: "running", attempts: state.attempts + 1 });

    case "ATTEMPT_SUCCEEDED":
      if (state.status !== "running") return illegal(state, event);
      return legal({ ...state, status: "succeeded" });

    case "ATTEMPT_FAILED": {
      if (state.status !== "running") return illegal(state, event);
      const budgetRemains = state.attempts < policy.maxAttempts;
      return legal({ ...state, status: budgetRemains ? "ready" : "failed" });
    }
  }
}

function legal(state: NodeLifecycleState): NodeTransitionResult {
  return { ok: true, state };
}

function illegal(
  state: NodeLifecycleState,
  event: NodeEvent,
): NodeTransitionResult {
  return {
    ok: false,
    reason: `illegal transition: event ${event.type} is not valid while status is "${state.status}"`,
  };
}
