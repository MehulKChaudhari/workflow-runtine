import { describe, expect, it } from "vitest";
import { computeRunStatus } from "./runStatus";

describe("computeRunStatus", () => {
  it("is pending only while every node is pending", () => {
    expect(computeRunStatus(["pending", "pending"])).toBe("pending");
  });

  it("is running once anything has moved", () => {
    expect(computeRunStatus(["ready", "pending"])).toBe("running");
    expect(computeRunStatus(["running", "pending"])).toBe("running");
    expect(computeRunStatus(["succeeded", "pending"])).toBe("running");
    expect(computeRunStatus(["failed", "running"])).toBe("running"); // let independents finish
  });

  it("succeeds only when every node succeeded", () => {
    expect(computeRunStatus(["succeeded", "succeeded"])).toBe("succeeded");
  });

  it("fails when all nodes are settled and any failed or was skipped", () => {
    expect(computeRunStatus(["succeeded", "failed"])).toBe("failed");
    expect(computeRunStatus(["succeeded", "failed", "skipped"])).toBe("failed");
  });

  it("handles a single-node run", () => {
    expect(computeRunStatus(["pending"])).toBe("pending");
    expect(computeRunStatus(["running"])).toBe("running");
    expect(computeRunStatus(["succeeded"])).toBe("succeeded");
    expect(computeRunStatus(["failed"])).toBe("failed");
  });
});
