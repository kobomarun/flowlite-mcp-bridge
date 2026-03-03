import winston from "winston";
import chalk from "chalk";

/**
 * Configure Winston logger for the MCP server.
 *
 * IMPORTANT: In an MCP server, stdout is reserved for the JSON-RPC pipe.
 * All logs MUST be directed to stderr to avoid corrupting the protocol stream.
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
      const colorize = (lvl: string) => {
        switch (lvl) {
          case "error":
            return chalk.red(lvl.toUpperCase());
          case "warn":
            return chalk.yellow(lvl.toUpperCase());
          case "info":
            return chalk.blue(lvl.toUpperCase());
          case "debug":
            return chalk.magenta(lvl.toUpperCase());
          default:
            return lvl.toUpperCase();
        }
      };

      const logMessage = stack || message;
      return `[${timestamp}] ${colorize(level)}: ${logMessage}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ["error", "warn", "info", "debug", "verbose"],
    }),
  ],
});

export default logger;
