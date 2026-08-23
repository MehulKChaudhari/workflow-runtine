import { describe, expect, it } from "vitest";
import type { WorkflowDefinition } from "@workflow/graph";
import type { NodeStatus } from "@workflow/shared";
import { schedule } from "./schedule";

function workflow(
  ids: string[],
  edges: `${string}->${string}`[],
): WorkflowDefinition {
  return {
    name: "test",
    nodes: ids.map((id) => ({ id, type: "noop", config: {} })),
    edges: edges.map((pair) => {
      const [from = "", to = ""] = pair.split("->");
      return { from, to };
    }),
  };
}

function statuses(
  entries: Record<string, NodeStatus>,
): Map<string, NodeStatus> {
  return new Map(Object.entries(entries));
}

const cake = workflow(
  ["buy", "bake", "make-frosting", "frost"],
  ["buy->bake", "buy->make-frosting", "bake->frost", "make-frosting->frost"],
);

describe("schedule", () => {
  it("marks entry nodes ready and leaves everyone else pending", () => {
    const decision = schedule(
      cake,
      statuses({
        buy: "pending",
        bake: "pending",
        "make-frosting": "pending",
        frost: "pending",
      }),
    );
    expect(decision.becomeReady).toEqual(["buy"]);
    expect(decision.becomeSkipped).toEqual([]);
  });

  it("releases both parallel children once their parent succeeds", () => {
    const decision = schedule(
      cake,
      statuses({
        buy: "succeeded",
        bake: "pending",
        "make-frosting": "pending",
        frost: "pending",
      }),
    );
    expect(decision.becomeReady).toEqual(["bake", "make-frosting"]);
    expect(decision.becomeSkipped).toEqual([]);
  });

  it("does not ready frost until both parents have succeeded", () => {
    const decision = schedule(
      cake,
      statuses({
        buy: "succeeded",
        bake: "succeeded",
        "make-frosting": "running",
        frost: "pending",
      }),
    );
    expect(decision.becomeReady).toEqual([]);
    expect(decision.becomeSkipped).toEqual([]);
  });

  it("skips frost when bake failed, and leaves an independent running sibling alone", () => {
    const decision = schedule(
      cake,
      statuses({
        buy: "succeeded",
        bake: "failed",
        "make-frosting": "running",
        frost: "pending",
      }),
    );
    expect(decision.becomeReady).toEqual([]);
    expect(decision.becomeSkipped).toEqual(["frost"]);
  });

  it("ripples skip one hop per look: A failed skips B, not yet C", () => {
    const chain = workflow(["a", "b", "c"], ["a->b", "b->c"]);
    const first = schedule(
      chain,
      statuses({ a: "failed", b: "pending", c: "pending" }),
    );
    expect(first.becomeSkipped).toEqual(["b"]);
    expect(first.becomeReady).toEqual([]);

    const second = schedule(
      chain,
      statuses({ a: "failed", b: "skipped", c: "pending" }),
    );
    expect(second.becomeSkipped).toEqual(["c"]);
  });

  it("does not re-run a failed branch after statuses are reloaded", () => {
    const chain = workflow(["a", "b", "c"], ["a->b", "b->c"]);
    const decision = schedule(
      chain,
      statuses({ a: "failed", b: "skipped", c: "skipped" }),
    );
    expect(decision.becomeReady).toEqual([]);
    expect(decision.becomeSkipped).toEqual([]);
  });

  it("never re-proposes a node that is already ready, running, or terminal", () => {
    const decision = schedule(
      cake,
      statuses({
        buy: "succeeded",
        bake: "ready",
        "make-frosting": "running",
        frost: "pending",
      }),
    );
    expect(decision.becomeReady).toEqual([]);
    expect(decision.becomeSkipped).toEqual([]);
  });

  it("marks a disconnected node ready immediately", () => {
    const loner = workflow(["a", "loner"], []);
    const decision = schedule(
      loner,
      statuses({ a: "pending", loner: "pending" }),
    );
    expect(decision.becomeReady).toEqual(["a", "loner"]);
  });
});
