import { describe, expect, it } from "vitest";
import type { EdgeDefinition, NodeDefinition } from "./schema";
import { topologicalSort } from "./toposort";

function nodes(...ids: string[]): NodeDefinition[] {
  return ids.map((id) => ({ id, type: "noop", config: {} }));
}

function edges(...pairs: `${string}->${string}`[]): EdgeDefinition[] {
  return pairs.map((pair) => {
    const [from = "", to = ""] = pair.split("->");
    return { from, to };
  });
}

/** Asserts `before` appears earlier than `after` in the order. */
function expectBefore(order: string[], before: string, after: string): void {
  expect(order.indexOf(before)).toBeGreaterThanOrEqual(0);
  expect(order.indexOf(before)).toBeLessThan(order.indexOf(after));
}

describe("topologicalSort", () => {
  it("orders the cake diamond with dependencies first", () => {
    const result = topologicalSort(
      nodes("buy", "bake", "make-frosting", "frost"),
      edges("buy->bake", "buy->make-frosting", "bake->frost", "make-frosting->frost"),
    );

    expect(result.stuck).toEqual([]);
    expect(result.order).toHaveLength(4);
    expectBefore(result.order, "buy", "bake");
    expectBefore(result.order, "buy", "make-frosting");
    expectBefore(result.order, "bake", "frost");
    expectBefore(result.order, "make-frosting", "frost");
  });

  it("emits every node of an edgeless graph (all immediately ready)", () => {
    const result = topologicalSort(nodes("a", "b", "c"), []);
    expect(result.stuck).toEqual([]);
    expect(result.order).toHaveLength(3);
  });

  it("reports all members of a cycle as stuck", () => {
    const result = topologicalSort(
      nodes("a", "b", "c"),
      edges("a->b", "b->c", "c->a"),
    );
    expect(result.order).toEqual([]);
    expect(result.stuck).toEqual(["a", "b", "c"]);
  });

  it("reports nodes downstream of a cycle as stuck too", () => {
    // entry -> (a <-> b) -> exit : entry runs, but a, b and exit are trapped.
    const result = topologicalSort(
      nodes("entry", "a", "b", "exit"),
      edges("entry->a", "a->b", "b->a", "b->exit"),
    );
    expect(result.order).toEqual(["entry"]);
    expect(result.stuck).toEqual(["a", "b", "exit"]);
  });
});
