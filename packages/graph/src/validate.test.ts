import { describe, expect, it } from "vitest";
import { parseWorkflowDefinition } from "./validate";

function cakeWorkflow(): unknown {
  return {
    name: "birthday cake",
    nodes: [
      { id: "buy", type: "shop", config: { list: ["flour", "sugar"] } },
      { id: "bake", type: "oven", config: { minutes: 40 } },
      { id: "make-frosting", type: "mix" },
      { id: "frost", type: "assemble" },
    ],
    edges: [
      { from: "buy", to: "bake" },
      { from: "buy", to: "make-frosting" },
      { from: "bake", to: "frost" },
      { from: "make-frosting", to: "frost" },
    ],
  };
}

function issueCodes(input: unknown): string[] {
  const result = parseWorkflowDefinition(input);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe("parseWorkflowDefinition", () => {
  it("accepts a valid workflow and defaults missing config to {}", () => {
    const result = parseWorkflowDefinition(cakeWorkflow());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const frosting = result.workflow.nodes.find((n) => n.id === "make-frosting");
    expect(frosting?.config).toEqual({});
  });

  it("accepts a disconnected node (it is just immediately ready)", () => {
    const wf = cakeWorkflow() as { nodes: unknown[] };
    wf.nodes.push({ id: "loner", type: "noop" });
    expect(parseWorkflowDefinition(wf).ok).toBe(true);
  });

  it("rejects non-objects and structurally broken input", () => {
    expect(issueCodes("not even an object")).toContain("INVALID_SHAPE");
    expect(issueCodes({ name: "x", nodes: [{ id: "a" }], edges: [] })).toContain(
      "INVALID_SHAPE", // node missing `type`
    );
  });

  it("rejects an empty workflow", () => {
    expect(issueCodes({ name: "empty", nodes: [], edges: [] })).toContain(
      "INVALID_SHAPE",
    );
  });

  it("rejects node ids that are not slugs", () => {
    expect(
      issueCodes({
        name: "bad id",
        nodes: [{ id: "Hello World!", type: "noop" }],
        edges: [],
      }),
    ).toContain("INVALID_SHAPE");
  });

  it("rejects duplicate node ids", () => {
    expect(
      issueCodes({
        name: "dupes",
        nodes: [
          { id: "a", type: "noop" },
          { id: "a", type: "noop" },
        ],
        edges: [],
      }),
    ).toContain("DUPLICATE_NODE_ID");
  });

  it("rejects edges that reference unknown nodes, naming the bad endpoint", () => {
    const result = parseWorkflowDefinition({
      name: "dangling",
      nodes: [{ id: "a", type: "noop" }],
      edges: [{ from: "a", to: "bkae" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("UNKNOWN_NODE_REFERENCE");
    expect(result.issues[0]?.message).toContain("bkae");
    expect(result.issues[0]?.path).toBe("edges.0.to");
  });

  it("rejects self-dependencies", () => {
    expect(
      issueCodes({
        name: "self",
        nodes: [{ id: "a", type: "noop" }],
        edges: [{ from: "a", to: "a" }],
      }),
    ).toContain("SELF_DEPENDENCY");
  });

  it("rejects duplicate edges", () => {
    expect(
      issueCodes({
        name: "double arrow",
        nodes: [
          { id: "a", type: "noop" },
          { id: "b", type: "noop" },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "a", to: "b" },
        ],
      }),
    ).toContain("DUPLICATE_EDGE");
  });

  it("rejects cycles and names the trapped nodes", () => {
    const result = parseWorkflowDefinition({
      name: "deadlock",
      nodes: [
        { id: "a", type: "noop" },
        { id: "b", type: "noop" },
        { id: "c", type: "noop" },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "a" },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("CYCLE_DETECTED");
    expect(result.issues[0]?.message).toContain("a");
  });

  it("collects multiple independent problems in one pass", () => {
    const codes = issueCodes({
      name: "many problems",
      nodes: [
        { id: "a", type: "noop" },
        { id: "a", type: "noop" },
      ],
      edges: [
        { from: "a", to: "ghost" },
        { from: "a", to: "a" },
      ],
    });
    expect(codes).toContain("DUPLICATE_NODE_ID");
    expect(codes).toContain("UNKNOWN_NODE_REFERENCE");
    expect(codes).toContain("SELF_DEPENDENCY");
  });
});
