# Agent Handoff Contract

To ensure robustness and avoid unstructured delegation, agents MUST NOT communicate using unstructured plain text when transferring a task to another agent.
When passing the task to the next agent (e.g., orchestrator -> navigator, test-guardian -> builder), the agent MUST output a structured JSON block representing the state, context, and evidence of the work done.

## Required JSON Schema
All handoffs must strictly adhere to the following JSON structure:

```json
{
  "task": {
    "id": "string",
    "title": "string",
    "description": "string"
  },
  "classification": {
    "risk_level": "L0|L1|L2|L3",
    "surface": "string",
    "workflow": "string"
  },
  "status": "RED|GREEN|REFACTOR|SECURITY_CHECKED|DESIGN_APPROVED|PLANNING",
  "summary": "string",
  "decisions": ["string"],
  "changes": ["string"],
  "tests": {
    "claim": {
      "status": "RED|GREEN|REFACTOR|NONE"
    },
    "evidence": {
      "evidence_level": "L0|L1|L2|L3|L4",
      "execution_id": "string"
    }
  },
  "security": "string",
  "database": "string",
  "api": "string",
  "frontend": "string",
  "design_system": "string",
  "evidence": "string",
  "blockers": ["string"],
  "next_agent": "string"
}
```

## Handoff Rules

1. **No Plain Text Delegation**: An agent must not delegate a task simply by saying "Builder, please implement this". The JSON contract is mandatory.
2. **Rejection Rule**: If an agent receives a task without this structured contract, or without the required execution evidence populated (e.g. `tests.evidence.execution_id` is missing when execution is required), the agent MUST REJECT the request.
3. **Explicit State & Execution Validation**: The `tests` block is critical for TDD Enforcement. A builder cannot implement a fix or feature unless `tests.claim.status` is explicitly `RED` and a valid `tests.evidence.execution_id` is provided pointing to a verifiable runtime failure. A Release Gatekeeper cannot approve unless `tests.claim.status` is `GREEN` and `tests.evidence.execution_id` points to a verified execution with `exit_code: 0`. Simulated claims without a valid execution ID MUST result in a BLOCK.
