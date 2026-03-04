import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToolHandlers } from "../src/server/handlers.js";
import { FlowLiteAdapter, FlowLiteError } from "../src/flowlite/adapter.js";
import type { McpToolResponse } from "../src/server/types.js";

describe("ToolHandlers", () => {
  let mockAdapter: any;
  let handlers: ToolHandlers;
  const SERVER_VERSION = "0.1.0";

  beforeEach(() => {
    // Create a mock adapter with all necessary methods
    mockAdapter = {
      parseMessage: vi.fn(),
      runWorkflow: vi.fn(),
      getAuditTrail: vi.fn(),
    };
    handlers = new ToolHandlers(mockAdapter as unknown as FlowLiteAdapter, SERVER_VERSION);
  });

  describe("flowlite.parseMessage", () => {
    it("should route to adapter.parseMessage and return success", async () => {
      const mockResult = { rawText: "test message", intent: "test", confidence: 0.9 };
      mockAdapter.parseMessage.mockResolvedValue(mockResult);

      const response = await handlers.handle("flowlite.parseMessage", {
        message: "test message",
        locale: "en",
      });

      expect(response.success).toBe(true);
      expect(response.result).toEqual(mockResult);
      expect(mockAdapter.parseMessage).toHaveBeenCalledWith("test message", "en");
    });

    it("should handle adapter errors and return failure", async () => {
      mockAdapter.parseMessage.mockRejectedValue(
        new FlowLiteError("SERVER_ERROR", "Parsing failed")
      );

      const response = await handlers.handle("flowlite.parseMessage", {
        message: "test message",
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("SERVER_ERROR");
      expect(response.error?.message).toBe("Parsing failed");
    });
  });

  describe("flowlite.runWorkflow", () => {
    it("should route to adapter.runWorkflow and return success", async () => {
      const mockResult = { runId: "123", status: "completed" };
      mockAdapter.runWorkflow.mockResolvedValue(mockResult);

      const response = await handlers.handle("flowlite.runWorkflow", {
        workflowId: "test-workflow",
        inputs: { foo: "bar" },
        humanApprovalGranted: true,
      });

      expect(response.success).toBe(true);
      expect(response.result).toEqual(mockResult);
      expect(mockAdapter.runWorkflow).toHaveBeenCalledWith(
        "test-workflow",
        { foo: "bar" },
        true
      );
    });

    it("should handle validation errors (Zod)", async () => {
      // Missing workflowId
      const response = await handlers.handle("flowlite.runWorkflow", {
        inputs: {},
      });

      expect(response.success).toBe(false);
      // Zod errors are caught in the catch block and converted to generic Errors if not FlowLiteError
      expect(response.error?.message).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should return unknowns as SERVER_ERROR", async () => {
      mockAdapter.parseMessage.mockRejectedValue(new Error("Unknown doom"));

      const response = await handlers.handle("flowlite.parseMessage", {
        message: "test",
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("SERVER_ERROR");
      expect(response.error?.message).toBe("Unknown doom");
    });
  });
});
