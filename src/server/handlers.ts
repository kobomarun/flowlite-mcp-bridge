import type { FlowLiteAdapter } from "../flowlite/adapter.js";
import type {
  McpToolName,
  McpToolResponse,
} from "./types.js";
import {
  ParseMessageInputSchema,
  RunWorkflowInputSchema,
  ReplayRunInputSchema,
  GetAuditTrailInputSchema,
} from "./types.js";
import { FlowLiteError } from "../flowlite/adapter.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Routes and handles incoming MCP tool calls.
 * This class translates protocol-level calls into adapter-level business logic.
 */
export class ToolHandlers {
  constructor(
    private adapter: FlowLiteAdapter,
    private serverVersion: string
  ) { }

  /**
   * Main dispatch method for all tools.
   */
  async handle(name: string, args: unknown): Promise<McpToolResponse<unknown>> {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      const result = await this.dispatch(name as McpToolName, args);

      return {
        success: true,
        result,
        metadata: {
          requestId,
          toolName: name,
          serverVersion: this.serverVersion,
          processedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(name, error, requestId, startTime);
    }
  }

  /**
   * Dispatches to the specific handler based on tool name.
   */
  private async dispatch(name: McpToolName, args: unknown): Promise<unknown> {
    switch (name) {
      case "flowlite.parseMessage": {
        const input = ParseMessageInputSchema.parse(args);
        return await this.adapter.parseMessage(input.message, input.locale);
      }

      case "flowlite.runWorkflow": {
        const input = RunWorkflowInputSchema.parse(args);
        return await this.adapter.runWorkflow(
          input.workflowId,
          input.inputs,
          input.humanApprovalGranted
        );
      }

      case "flowlite.replayRun": {
        const input = ReplayRunInputSchema.parse(args);
        // Replay logic would use adapter.getAuditTrail then runWorkflow
        // Simplified for this sprint:
        const audit = await this.adapter.getAuditTrail(input.runId);
        const originalInputs = (audit.entries[0]?.payload?.inputs as Record<string, unknown>) || {};
        return await this.adapter.runWorkflow(
          audit.workflowId,
          { ...originalInputs, ...input.inputOverrides },
          true
        );
      }

      case "flowlite.getAuditTrail": {
        const input = GetAuditTrailInputSchema.parse(args);
        if (input.runId) {
          return [await this.adapter.getAuditTrail(input.runId)];
        }
        // Range queries would be implemented here in a real DB
        return [];
      }

      default:
        throw new FlowLiteError("SERVER_ERROR", `Unknown tool: ${name}`);
    }
  }

  /**
   * Standardized error handler that maps domain errors to MCP error payloads.
   */
  private handleError(
    name: string,
    error: unknown,
    requestId: string,
    startTime: number
  ): McpToolResponse<null> {
    let errorCode: import("./types.js").McpErrorCode = "SERVER_ERROR";
    let message = "Internal server error";
    let details: Record<string, unknown> | undefined = undefined;

    if (error instanceof FlowLiteError) {
      errorCode = error.code;
      message = error.message;
      details = error.details;
    } else if (error instanceof Error) {
      message = error.message;
    }

    return {
      success: false,
      result: null,
      metadata: {
        requestId,
        toolName: name,
        serverVersion: this.serverVersion,
        processedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      },
      error: {
        code: errorCode,
        message,
        details,
      },
    };
  }
}
