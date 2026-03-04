import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PLAYGROUND = path.join(ROOT, "playground");
const WORKFLOWS = path.join(PLAYGROUND, "workflows");
const DATA = path.join(PLAYGROUND, "data");

async function setup() {
  console.log(chalk.blue("\n🚀 Setting up FlowLite MCP Playground...\n"));

  try {
    // 1. Create directories
    await fs.mkdir(WORKFLOWS, { recursive: true });
    await fs.mkdir(DATA, { recursive: true });
    console.log(chalk.green("✅ Created playground directories"));

    // 2. Copy example workflow
    const exampleSource = path.join(ROOT, "examples", "invoice.yml");
    const exampleDest = path.join(WORKFLOWS, "invoice.yml");
    
    await fs.copyFile(exampleSource, exampleDest);
    console.log(chalk.green("✅ Copied example: workflows/invoice.yml"));

    // 3. Output instructions
    console.log(chalk.yellow("\n--- NEXT STEPS ---\n"));
    console.log("To run the bridge against this playground, use:\n");
    console.log(chalk.cyan(`  npm run build`));
    console.log(chalk.cyan(`  node dist/cli/serve.js --workflows-dir ./playground/workflows --data-dir ./playground/data --verbose`));
    
    console.log("\nThis will allow you to test tools like:");
    console.log("- flowlite.runWorkflow({ workflowId: 'invoice' })");
    console.log("- flowlite.getAuditTrail()");
    
    console.log(chalk.blue("\nHappy testing! 🌉\n"));

  } catch (error) {
    console.error(chalk.red("\n❌ Setup failed:"), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

setup();
