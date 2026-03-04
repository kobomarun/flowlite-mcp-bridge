import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import YAML from "yaml";
import { Flow, createTool, LLMTool } from "flowlite";

import type {
  WorkflowDefinition,
  WorkflowRunResult,
  WorkflowStep,
  ParsedMessage,
  AuditTrail,
  AuditEntry,
} from "./types.js";
import {
  WorkflowDefinitionSchema,
  WorkflowRunResultSchema,
  ParsedMessageSchema,
  AuditTrailSchema,
} from "./types.js";
import type { McpErrorCode } from "../server/types.js";
import logger from "../utils/logger.js";
import { getWorkflowPath, getTraceManifestPath, ensureDir } from "../utils/paths.js";

/**
 * Custom error class for FlowLite domain errors.
 */
export class FlowLiteError extends Error {
  constructor(
    public code: McpErrorCode,
    message: string,
    public workflowId?: string,
    public stepId?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "FlowLiteError";
  }
}

export interface AdapterConfig {
  workflowsDir: string;
  dataDir: string;
  strictComplianceMode: boolean;
}

/**
 * Builds a real FlowLite `Flow` from a parsed WorkflowDefinition.
 */
function buildFlowFromDefinition(
  definition: WorkflowDefinition,
  inputs: Record<string, unknown>
): Flow {
  const steps = definition.steps;
  if (!steps || steps.length === 0) {
    throw new FlowLiteError(
      "WORKFLOW_PARSE_ERROR",
      `Workflow '${definition.id}' has no steps defined.`,
      definition.id
    );
  }

  // Create FlowLite nodes from YAML steps
  const tools = steps.map((step: WorkflowStep) => {
    // Check if this is an LLM action
    const isLlmAction = step.action === "flowlite.llm" || step.action === "flowlite.generate";

    if (isLlmAction) {
      logger.debug(`Registering LLM step: ${step.id}`);
      // Use FlowLite's specialized LLMTool
      return new LLMTool({
        name: step.id,
        description: step.description ?? step.action,
        input: Object.keys(step.input ?? {}).map(k => ({ name: k, type: 'string' }))
      });
    }

    // Otherwise use a standard generic tool
    return createTool(
      async (ctx: Record<string, unknown>) => {
        logger.debug(`Executing step: ${step.id} [${step.action}]`);
        const stepInput = { ...inputs, ...(step.input ?? {}), ...ctx };
        return { ...stepInput, _step: step.id, _action: step.action };
      },
      { name: step.id, description: step.action }
    );
  });

  // Build the Flow
  let flow = Flow.start(tools[0]);
  for (let i = 1; i < tools.length; i++) {
    flow = flow.next(tools[i]);
  }

  return flow;
}

/**
 * The FlowLiteAdapter — now with native LLMTool support.
 */
export class FlowLiteAdapter {
  constructor(private config: AdapterConfig) { }

  async initialize() {
    await ensureDir(this.config.workflowsDir);
    await ensureDir(this.config.dataDir);
  }

  async parseMessage(text: string, locale = "en"): Promise<ParsedMessage> {
    logger.debug(`Parsing message: "${text}" [${locale}]`);

    try {
      const files = await fs.readdir(this.config.workflowsDir).catch(() => []);
      const workflowIds = files
        .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
        .map((f) => f.replace(/\.(yml|yaml)$/, ""));

      const matchedId = workflowIds.find((id) =>
        text.toLowerCase().includes(id.replace(/-/g, " ").toLowerCase())
      );

      const result: ParsedMessage = {
        rawText: text,
        intent: matchedId ?? "unknown",
        confidence: matchedId ? 0.85 : 0,
        entities: [],
        parsedAt: new Date().toISOString(),
        locale,
        suggestedWorkflowId: matchedId,
      };

      return ParsedMessageSchema.parse(result);
    } catch (error) {
      throw new FlowLiteError(
        "SERVER_ERROR",
        `Failed to parse message: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async runWorkflow(
    workflowId: string,
    inputs: Record<string, unknown> = {},
    humanApprovalGranted = false
  ): Promise<WorkflowRunResult> {
    const runId = uuidv4();
    const workflowPath = getWorkflowPath(this.config.workflowsDir, workflowId);

    logger.info(`Starting workflow run ${runId} [${workflowId}]`);

    const definition = await this.loadWorkflowDefinition(workflowId, workflowPath);

    if (definition.compliance.requiresHumanApproval && !humanApprovalGranted) {
      logger.warn(`Workflow ${workflowId} blocked: requires human approval.`);
      throw new FlowLiteError(
        "HUMAN_APPROVAL_REQUIRED",
        `Workflow '${workflowId}' requires human approval before execution.`,
        workflowId
      );
    }

    const auditTrail: AuditTrail = {
      runId,
      workflowId,
      workflowName: definition.name,
      startedAt: new Date().toISOString(),
      entries: [],
      complianceFlags: definition.compliance,
    };

    this.addAuditEntry(auditTrail, "workflow_started", { inputs });

    try {
      const flow = buildFlowFromDefinition(definition, inputs);

      // Note: LLM tools will look for process.env.OPENAI_API_KEY
      const engineResult = await flow.run(inputs);

      const completedAt = new Date().toISOString();
      const durationMs =
        new Date(completedAt).getTime() - new Date(auditTrail.startedAt).getTime();

      const stepResults = definition.steps.map((step: WorkflowStep) => ({
        stepId: step.id,
        action: step.action,
        status: "success" as const,
        startedAt: auditTrail.startedAt,
        attempt: 1,
        durationMs: 0,
      }));

      const executionResult: WorkflowRunResult = {
        runId,
        workflowId,
        status: "completed",
        steps: stepResults,
        inputs,
        outputs: typeof engineResult === "object" && engineResult !== null
          ? (engineResult as Record<string, unknown>)
          : { result: engineResult },
        triggeredAt: auditTrail.startedAt,
        completedAt,
        totalDurationMs: durationMs,
        traceManifestPath: getTraceManifestPath(this.config.dataDir, runId),
        complianceSummary: definition.compliance,
      };

      auditTrail.completedAt = completedAt;
      auditTrail.finalStatus = "completed";
      this.addAuditEntry(auditTrail, "workflow_completed", { outputs: executionResult.outputs });
      await this.persistAuditTrail(auditTrail);

      return WorkflowRunResultSchema.parse(executionResult);
    } catch (error) {
      if (error instanceof FlowLiteError) throw error;

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addAuditEntry(auditTrail, "workflow_failed", { error: errorMessage });
      await this.persistAuditTrail(auditTrail);

      throw new FlowLiteError(
        "WORKFLOW_EXECUTION_FAILED",
        `Execution failed for '${workflowId}': ${errorMessage}`,
        workflowId
      );
    }
  }

  private async loadWorkflowDefinition(
    workflowId: string,
    path: string
  ): Promise<WorkflowDefinition> {
    try {
      const content = await fs.readFile(path, "utf-8");
      const yamlData = YAML.parse(content);
      return WorkflowDefinitionSchema.parse(yamlData);
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new FlowLiteError(
          "WORKFLOW_NOT_FOUND",
          `Workflow '${workflowId}' not found at ${path}`,
          workflowId
        );
      }
      throw new FlowLiteError(
        "WORKFLOW_PARSE_ERROR",
        `Failed to parse workflow '${workflowId}': ${error instanceof Error ? error.message : String(error)}`,
        workflowId
      );
    }
  }

  private addAuditEntry(
    trail: AuditTrail,
    event: AuditEntry["event"],
    payload?: Record<string, unknown>
  ) {
    trail.entries.push({
      entryId: uuidv4(),
      runId: trail.runId,
      workflowId: trail.workflowId,
      event,
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  private async persistAuditTrail(trail: AuditTrail) {
    const filePath = getTraceManifestPath(this.config.dataDir, trail.runId);
    try {
      await fs.writeFile(filePath, JSON.stringify(trail, null, 2), "utf-8");
      logger.debug(`Audit trail persisted: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to persist audit trail: ${error}`);
      if (this.config.strictComplianceMode) {
        throw new FlowLiteError("AUDIT_WRITE_FAILED", "Critical: Could not write audit log.");
      }
    }
  }

  async getAuditTrail(runId: string): Promise<AuditTrail> {
    const filePath = getTraceManifestPath(this.config.dataDir, runId);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return AuditTrailSchema.parse(JSON.parse(content));
    } catch {
      throw new FlowLiteError(
        "RUN_NOT_FOUND",
        `Audit trail for run '${runId}' not found.`,
        undefined,
        undefined,
        { runId }
      );
    }
  }
}
