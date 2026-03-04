# Contributing to FlowLite MCP Bridge 🤝

Thank you for your interest in contributing to the FlowLite MCP Bridge! We aim to maintain a high-quality, "Visa-Ready" codebase for AI-driven workflow automation.

## 📜 Code of Conduct

By participating in this project, you agree to abide by our standards of professionalism and respect toward all contributors.

## 🛠 Technical Standards

To ensure the safety and auditability of the bridge, all contributions must meet these criteria:

### 1. No `any` Policy
We use strict TypeScript. The use of `any` is prohibited. If a type is truly dynamic, use `unknown` and perform a type-check or use a Zod schema.

### 2. Schema-First Design
Every new tool or data structure must be defined as a **Zod Schema** in `src/flowlite/types.ts` or `src/server/types.ts`. Types should be inferred from these schemas using `z.infer<T>`.

### 3. Auditability
Any change that affects workflow execution must ensure that a corresponding entry is added to the **Audit Trail**. Use the `this.addAuditEntry` method in the `FlowLiteAdapter`.

### 4. Tests are Mandatory
- New features require unit tests in `tests/`.
- Bug fixes should include a regression test.
- We use **Vitest** for testing.

## 🚀 Development Workflow

1. **Fork & Branch**: Create a feature branch from `main`.
2. **Setup**: Run `npm install`.
3. **Validate**:
   - `npm run typecheck`: Ensure no TS errors.
   - `npm run lint`: Ensure code style compliance.
   - `npm test`: Ensure all tests pass.
4. **Build**: `npm run build` to verify the production bundle.
5. **PR Template**: Fill out the Pull Request template completely.

## 🏗 Project Structure

- `src/flowlite/`: Domain logic and FlowLite engine integration.
- `src/server/`: MCP protocol implementation and tool routing.
- `src/utils/`: Shared utilities (Stdio-safe logger).
- `src/cli/`: Command-line interface.

## 🚦 Compliance & Safety

If your contribution modifies the compliance logic (e.g., Human-in-the-Loop triggers), it will undergo a mandatory security review. Safety and deterministic blocking of high-risk actions are the core value of this bridge.

---

Thank you for helping us build a more secure way to connect AI to real-world workflows!
