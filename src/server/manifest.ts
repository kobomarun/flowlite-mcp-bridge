import { zodToJsonSchema } from "zod-to-json-schema";
import {
  ParseMessageInputSchema,
  RunWorkflowInputSchema,
  ReplayRunInputSchema,
  GetAuditTrailInputSchema,
} from "./types.js";

/**
 * Tool definitions presented to the MCP client.
 * We use zod-to-json-schema to ensure our TypeScript types strictly match
 * the JSON Schema we send to the AI client.
 */
export const TOOL_MANIFEST = [
  {
    name: "flowlite.parseMessage",
    description: "Parses a natural language message to extract intent and entities. Use this as a first step to determine which workflow to run.",
    inputSchema: zodToJsonSchema(ParseMessageInputSchema),
  },
  {
    name: "flowlite.runWorkflow",
    description: "Executes a FlowLite workflow by ID. If the workflow requires human approval, you will receive a notification in the metadata.",
    inputSchema: zodToJsonSchema(RunWorkflowInputSchema),
  },
  {
    name: "flowlite.replayRun",
    description: "Replays a failed or completed workflow run with optional input overrides.",
    inputSchema: zodToJsonSchema(ReplayRunInputSchema),
  },
  {
    name: "flowlite.getAuditTrail",
    description: "Retrieves the compliance audit trail for a specific run or workflow.",
    inputSchema: zodToJsonSchema(GetAuditTrailInputSchema),
  },
] as const;
