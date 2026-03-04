import { describe, it, expect } from "vitest";
import { TOOL_MANIFEST } from "../src/server/manifest.js";

describe("MCP Tool Manifest", () => {
  it("should define all required FlowLite tools", () => {
    const toolNames = TOOL_MANIFEST.map(t => t.name);
    expect(toolNames).toContain("flowlite.parseMessage");
    expect(toolNames).toContain("flowlite.runWorkflow");
    expect(toolNames).toContain("flowlite.replayRun");
    expect(toolNames).toContain("flowlite.getAuditTrail");
  });

  it("should have valid JSON-Schema for inputs", () => {
    TOOL_MANIFEST.forEach(tool => {
      const schema = tool.inputSchema as Record<string, unknown>;
      expect(schema).toBeDefined();
      expect(schema["type"]).toBe("object");
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(10);
    });
  });

  it("should strictly define workflowId as a non-empty string in runWorkflow", () => {
    const runWorkflow = TOOL_MANIFEST.find(t => t.name === "flowlite.runWorkflow");
    const schema = runWorkflow?.inputSchema as Record<string, unknown>;
    const properties = schema["properties"] as Record<string, Record<string, unknown>>;
    expect(properties["workflowId"]).toBeDefined();
    expect(properties["workflowId"]["type"]).toBe("string");
    expect(properties["workflowId"]["minLength"]).toBe(1);
  });
});
