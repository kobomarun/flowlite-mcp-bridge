# 🎓 FlowLite-MCP Bridge Tutorials

This guide provides step-by-step tutorials for different use cases, showing how to use the bridge for more than just simple automation.

---

## 🛠 Tutorial 1: Safe Infrastructure Scaling (DevOps)

**Goal**: Allow an AI agent to scale cloud resources, but only after an AI-driven cost analysis and human approval.

### 1. The Workflow
Use the [`examples/cloud-scaling.yml`](../examples/cloud-scaling.yml) file. It defines a flow that first asks an LLM for a cost prediction before running a `kubectl` command.

### 2. How to run
Ask your AI client:
> *"The traffic is high. Scale the 'web-api' service to 15 replicas in the 'production' environment."*

### 3. What to expect
- The bridge will run the **Impact Analysis** (LLM) first.
- It will then **block** and ask you for approval.
- You can check the Audit Trail to see the LLM's cost prediction before you type "Approve".

---

## 🔒 Tutorial 2: Emergency Security Revocation (SecOps)

**Goal**: Create a "Kill Switch" that can revoke a compromised user's access across GitHub and Slack instantly.

### 1. The Workflow
Use the [`examples/access-revocation.yml`](../examples/access-revocation.yml) file. 

### 2. How to run
Ask your AI client:
> *"Emergency! User 'attacker_123' is compromised. Run the access-revocation workflow for GitHub and Slack."*

### 3. What to expect
- The AI will trigger the multi-step revocation.
- Because `requiresHumanApproval` is set to `true`, the bridge will ensure you confirm this life-altering action for that user.
- A full **Audit Trail** is generated, which is critical for post-incident reports.

---

## 👋 Tutorial 3: Hands-Free Onboarding (HR Ops)

**Goal**: Automate the tedious process of setting up new engineers.

### 1. The Workflow
Use the [`examples/employee-onboarding.yml`](../examples/employee-onboarding.yml) file. Notice that `requiresHumanApproval` is `false` here—this is a "low-risk, high-frequency" task.

### 2. How to run
Ask your AI client:
> *"We have a new hire! John Doe is joining as a Backend Engineer. His GitHub is 'jdoe_dev'. Please onboard him."*

### 3. What to expect
- The bridge will execute all steps sequentially without stopping.
- It will use an LLM to generate a personalized "Welcome Package".
- It will simulate/call the APIs for Jira and GitHub.
- You get a structured confirmation at the end.

---

## 💡 Pro Tip: Creating Your Own
To create a tutorial for your own custom logic:
1.  Define a new `.yml` file in your `workflows/` directory.
2.  Choose your **Safety Level** (HITL: `true` or `false`).
3.  Chain your actions (LLM for logic, API for actions).
4.  Restart the MCP bridge so the AI "discovers" the new tool.
