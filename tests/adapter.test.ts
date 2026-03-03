import { describe, it, expect, beforeEach, vi } from "vitest";
import { FlowLiteAdapter } from "../src/flowlite/adapter.js";
import fs from "fs/promises";
import path from "path";
import YAML from "yaml";

// Mock the dependencies
vi.mock("fs/promises");
vi.mock("../src/utils/logger.js");

describe("FlowLiteAdapter Unit Tests", () => {
  const config = {
    workflowsDir: "/test/workflows",
    dataDir: "/test/data",
    strictComplianceMode: true,
  };

  let adapter: FlowLiteAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new FlowLiteAdapter(config);
  });

  describe("runWorkflow", () => {
    it("should succeed for a standard workflow", async () => {
      const mockWorkflow = {
        id: "test-flow",
        name: "Test Flow",
        version: "1.0.0",
        compliance: { requiresHumanApproval: false },
        steps: [{ id: "step1", action: "test-action" }],
      };

      // Mock reading the workflow file
      vi.mocked(fs.readFile).mockResolvedValue(YAML.stringify(mockWorkflow));
      // Mock writing the audit trail
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await adapter.runWorkflow("test-flow", { key: "value" });

      expect(result.status).toBe("completed");
      expect(result.workflowId).toBe("test-flow");
      expect(fs.writeFile).toHaveBeenCalled(); // Verification that audit trail was persisted
    });

    it("should block execution when human approval is required but not granted", async () => {
      const mockWorkflow = {
        id: "high-risk-flow",
        name: "High Risk Flow",
        version: "1.0.0",
        compliance: { requiresHumanApproval: true },
        steps: [{ id: "step1", action: "sensitive-action" }],
      };

      vi.mocked(fs.readFile).mockResolvedValue(YAML.stringify(mockWorkflow));

      await expect(adapter.runWorkflow("high-risk-flow", {}, false))
        .rejects.toThrow(/requires human approval/);

      expect(vi.mocked(fs.writeFile)).not.toHaveBeenCalled(); // No execution = no audit trail written yet
    });

    it("should allow execution when human approval is required AND granted", async () => {
      const mockWorkflow = {
        id: "high-risk-flow",
        name: "High Risk Flow",
        version: "1.0.0",
        compliance: { requiresHumanApproval: true },
        steps: [{ id: "step1", action: "sensitive-action" }],
      };

      vi.mocked(fs.readFile).mockResolvedValue(YAML.stringify(mockWorkflow));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await adapter.runWorkflow("high-risk-flow", {}, true);

      expect(result.status).toBe("completed");
      expect(vi.mocked(fs.writeFile)).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should throw WORKFLOW_NOT_FOUND when file doesn't exist", async () => {
      const error = new Error("File not found");
      (error as any).code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(error);

      try {
        await adapter.runWorkflow("missing-flow");
      } catch (err: any) {
        expect(err.code).toBe("WORKFLOW_NOT_FOUND");
      }
    });
  });
});
