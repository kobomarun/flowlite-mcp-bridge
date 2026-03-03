import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import YAML from "yaml";
// Note: In a real implementation, 'flowlite' would be imported here.
// For this scaffolding, we simulate the interface based on the requirements.
// import { parse, runWorkflow as executeWorkflow, normalize } from "flowlite";

import type {
  WorkflowDefinition,
  WorkflowRunResult,
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
 * Includes structured metadata for MCP response mapping.
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
 * The FlowLiteAdapter wraps the core workflow engine with bridge-specific
 * concerns: audit logging, compliance checking, and path resolution.
 */
export class FlowLiteAdapter {
  constructor(private config: AdapterConfig) { }

  /**
   * Initializes the adapter by ensuring directories exist.
   */
  async initialize() {
    await ensureDir(this.config.workflowsDir);
    await ensureDir(this.config.dataDir);
  }

  /**
   * Parses a natural language message using FlowLite NLU.
   */
  async parseMessage(text: string, locale = "en"): Promise<ParsedMessage> {
    logger.debug(`Parsing message: "${text}" [${locale}]`);

    try {
      // Simulation of flowlite.parse(text, locale)
      const mockResult: ParsedMessage = {
        rawText: text,
        intent: "unknown",
        confidence: 0,
        entities: [],
        parsedAt: new Date().toISOString(),
        locale,
      };

      return ParsedMessageSchema.parse(mockResult);
    } catch (error) {
      throw new FlowLiteError(
        "SERVER_ERROR",
        `Failed to parse message: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Loads and executes a workflow by ID.
   */
  async runWorkflow(
    workflowId: string,
    inputs: Record<string, unknown> = {},
    humanApprovalGranted = false
  ): Promise<WorkflowRunResult> {
    const runId = uuidv4();
    const workflowPath = getWorkflowPath(this.config.workflowsDir, workflowId);

    logger.info(`Starting workflow run ${runId} [${workflowId}]`);

    // 1. Load and parse the workflow definition
    const definition = await this.loadWorkflowDefinition(workflowId, workflowPath);

    // 2. Compliance Check
    if (definition.compliance.requiresHumanApproval && !humanApprovalGranted) {
      logger.warn(`Workflow ${workflowId} blocked: Requires human approval.`);
      throw new FlowLiteError(
        "HUMAN_APPROVAL_REQUIRED",
        `Workflow '${workflowId}' requires human approval before execution.`,
        workflowId
      );
    }

    // 3. Initialize Audit Trail
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
      // 4. Execute (Simulation)
      // In reality: const result = await flowlite.runWorkflow(definition, inputs);

      const executionResult: WorkflowRunResult = {
        runId,
        workflowId,
        status: "completed",
        steps: [], // This would be populated by the engine
        inputs,
        outputs: {},
        triggeredAt: auditTrail.startedAt,
        completedAt: new Date().toISOString(),
        totalDurationMs: 0,
        traceManifestPath: getTraceManifestPath(this.config.dataDir, runId),
        complianceSummary: definition.compliance,
      };

      // 5. Finalize and Persist Audit Trail
      auditTrail.completedAt = executionResult.completedAt;
      auditTrail.finalStatus = "completed";
      this.addAuditEntry(auditTrail, "workflow_completed", { outputs: executionResult.outputs });

      await this.persistAuditTrail(auditTrail);

      return WorkflowRunResultSchema.parse(executionResult);
    } catch (error) {
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

  /**
   * Helper to load and validate a workflow YAML file.
   */
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

  /**
   * Helper to add an entry to the audit trail.
   */
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

  /**
   * Writes the audit trail manifest to the data directory.
   */
  private async persistAuditTrail(trail: AuditTrail) {
    const filePath = getTraceManifestPath(this.config.dataDir, trail.runId);
    try {
      await fs.writeFile(filePath, JSON.stringify(trail, null, 2), "utf-8");
      logger.debug(`Audit trail persisted: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to persist audit trail: ${error}`);
      // In strict mode, we might want to throw here
      if (this.config.strictComplianceMode) {
        throw new FlowLiteError(
          "AUDIT_WRITE_FAILED",
          "Critical failure: Could not write audit log."
        );
      }
    }
  }

  /**
   * Retrieves an audit trail by Run ID.
   */
  async getAuditTrail(runId: string): Promise<AuditTrail> {
    const filePath = getTraceManifestPath(this.config.dataDir, runId);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return AuditTrailSchema.parse(JSON.parse(content));
    } catch (error) {
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
