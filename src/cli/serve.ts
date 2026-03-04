#!/usr/bin/env node
import { Command } from "commander";
import { FlowLiteMcpServer } from "../server/index.js";
import { ServerConfigSchema } from "../server/types.js";
import logger from "../utils/logger.js";
import path from "path";

const program = new Command();

program
  .name("flowlite-mcp")
  .description("Bridge between FlowLite workflows and the Model Context Protocol (MCP)")
  .version("0.1.0")
  .option("-w, --workflows-dir <path>", "Directory containing FlowLite .yml files", "./workflows")
  .option("-d, --data-dir <path>", "Directory for audit trails and trace manifests", "./data")
  .option("-v, --verbose", "Enable debug logging", false)
  .option("--strict", "Enable strict compliance mode (audit failures block execution)", false)
  .action(async (options) => {
    try {
      if (options.verbose) {
        logger.level = "debug";
      }

      // Validate and normalize configuration
      const config = ServerConfigSchema.parse({
        workflowsDir: path.resolve(process.cwd(), options.workflowsDir),
        dataDir: path.resolve(process.cwd(), options.dataDir),
        strictComplianceMode: options.strict,
        serverName: "FlowLite MCP Bridge",
        serverVersion: "0.1.0",
        logLevel: options.verbose ? "debug" : "info",
      });

      const server = new FlowLiteMcpServer(config);
      await server.run();
    } catch (error) {
      logger.error(`Critical Failure: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
