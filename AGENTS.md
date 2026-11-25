# ConformUI: AI-enabled cross-platform installable PWA to turn designs into checkable contracts, verify implementations against it with measured evidence, and hand the failures back to the coding agent

Follow @docs/ROADMAP.md

Final UI/UX must be exactly like @design/prototype/

## Agentic Workflow

For every task, follow in order:
1. Understand the task
2. Plan
3. Implement the plan using a new subagent
4. Validate e.g. build + run checks
5. Review changes using a new separate subagent
5. Apply the sound changes suggested by the reviewer using a new subagent & then validate again
6. Land changes

Whenever any functionality requires writing tests, write failing tests first with edgecases before development.

The main session will plan, think & give orders to subagents but it will never directly implement anything itself.
