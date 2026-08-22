import { describe, expect, it } from "vitest";
import {
  initialNodeState,
  transitionNode,
  type NodeEvent,
  type NodeLifecycleState,
  type RetryPolicy,
} from "./nodeLifecycle";

const NO_RETRIES: RetryPolicy = { maxAttempts: 1 };
const THREE_ATTEMPTS: RetryPolicy = { maxAttempts: 3 };

/** Applies an event that must be legal, returning the new state. */
function step(
  state: NodeLifecycleState,
  event: NodeEvent["type"],
  policy: RetryPolicy = NO_RETRIES,
): NodeLifecycleState {
  const result = transitionNode(state, { type: event }, policy);
  expect(result.ok, `expected ${event} to be legal from "${state.status}"`).toBe(true);
  if (!result.ok) throw new Error("unreachable");
  return result.state;
}

describe("transitionNode", () => {
  it("walks the happy path: pending -> ready -> running -> succeeded", () => {
    let state = initialNodeState();
    expect(state).toEqual({ status: "pending", attempts: 0 });

    state = step(state, "DEPENDENCIES_MET");
    expect(state.status).toBe("ready");

    state = step(state, "DISPATCHED");
    expect(state).toEqual({ status: "running", attempts: 1 });

    state = step(state, "ATTEMPT_SUCCEEDED");
    expect(state).toEqual({ status: "succeeded", attempts: 1 });
  });

  it("skips a pending node whose upstream failed", () => {
    const state = step(initialNodeState(), "UPSTREAM_FAILED");
    expect(state.status).toBe("skipped");
  });

  it("walks the full retry story: fail, requeue, fail, requeue, fail for good", () => {
    let state = initialNodeState();
    state = step(state, "DEPENDENCIES_MET", THREE_ATTEMPTS);

    state = step(state, "DISPATCHED", THREE_ATTEMPTS);
    state = step(state, "ATTEMPT_FAILED", THREE_ATTEMPTS);
    expect(state).toEqual({ status: "ready", attempts: 1 }); // budget left: requeued

    state = step(state, "DISPATCHED", THREE_ATTEMPTS);
    state = step(state, "ATTEMPT_FAILED", THREE_ATTEMPTS);
    expect(state).toEqual({ status: "ready", attempts: 2 }); // one more chance

    state = step(state, "DISPATCHED", THREE_ATTEMPTS);
    state = step(state, "ATTEMPT_FAILED", THREE_ATTEMPTS);
    expect(state).toEqual({ status: "failed", attempts: 3 }); // budget exhausted
  });

  it("fails immediately when maxAttempts is 1", () => {
    let state = step(initialNodeState(), "DEPENDENCIES_MET");
    state = step(state, "DISPATCHED");
    state = step(state, "ATTEMPT_FAILED");
    expect(state.status).toBe("failed");
  });

  it("rejects every event from terminal states", () => {
    const terminals: NodeLifecycleState[] = [
      { status: "succeeded", attempts: 1 },
      { status: "failed", attempts: 3 },
      { status: "skipped", attempts: 0 },
    ];
    const events: NodeEvent["type"][] = [
      "DEPENDENCIES_MET",
      "UPSTREAM_FAILED",
      "DISPATCHED",
      "ATTEMPT_SUCCEEDED",
      "ATTEMPT_FAILED",
    ];
    for (const state of terminals) {
      for (const event of events) {
        const result = transitionNode(state, { type: event }, THREE_ATTEMPTS);
        expect(result.ok, `${event} from "${state.status}" must be illegal`).toBe(false);
      }
    }
  });

  it("rejects out-of-order events with a readable reason", () => {
    const dispatchPending = transitionNode(
      initialNodeState(),
      { type: "DISPATCHED" },
      NO_RETRIES,
    );
    expect(dispatchPending.ok).toBe(false);
    if (dispatchPending.ok) return;
    expect(dispatchPending.reason).toContain("DISPATCHED");
    expect(dispatchPending.reason).toContain("pending");

    const succeedWithoutRunning = transitionNode(
      { status: "ready", attempts: 0 },
      { type: "ATTEMPT_SUCCEEDED" },
      NO_RETRIES,
    );
    expect(succeedWithoutRunning.ok).toBe(false);
  });

  it("never mutates the input state", () => {
    const state = initialNodeState();
    transitionNode(state, { type: "DEPENDENCIES_MET" }, NO_RETRIES);
    expect(state).toEqual({ status: "pending", attempts: 0 });
  });
});
