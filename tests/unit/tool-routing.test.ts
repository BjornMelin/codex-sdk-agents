import { describe, expect, it } from "vitest";

import {
  resolveToolBundlesForStep,
  ToolRouter,
  type ToolRoutingTable,
} from "../../packages/workflows/src/tool-routing.js";

describe("tool routing", () => {
  const table: ToolRoutingTable = {
    codeReview: {
      reviewer: {
        plan: ["repoRead"],
        implement: ["repoRead", "repoWrite"],
      },
    },
  };

  it("resolves bundles from the static table", () => {
    const bundleIds = resolveToolBundlesForStep(table, {
      workflowId: "codeReview",
      roleId: "reviewer",
      stepId: "plan",
    });

    expect(bundleIds).toEqual(["repoRead"]);
  });

  it("is deny-by-default when no mapping exists", () => {
    const bundleIds = resolveToolBundlesForStep(table, {
      workflowId: "unknown",
      roleId: "reviewer",
      stepId: "plan",
    });

    expect(bundleIds).toEqual([]);
  });

  it("applies overrides and caches per step", () => {
    const router = new ToolRouter({
      table,
      overrides: {
        codeReview: {
          reviewer: {
            plan: ["repoRead", "shell"],
          },
        },
      },
    });

    const first = router.resolve({
      workflowId: "codeReview",
      roleId: "reviewer",
      stepId: "plan",
    });
    const second = router.resolve({
      workflowId: "codeReview",
      roleId: "reviewer",
      stepId: "plan",
    });

    expect(first).toEqual(["repoRead", "shell"]);
    expect(second).toBe(first);
  });
});
