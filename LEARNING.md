# Learning Log

One entry per phase: the concept, why it exists, and what we built.

## Lesson 0 — Why a workflow runtime exists

The naive agent is a loop: ask the LLM "what next?", do it, repeat. It fails in
production because control flow is non-deterministic, state lives in process
memory (no crash recovery), there is no structured trace, and every decision
costs an LLM call.

The fix is a separation of concerns: **the LLM plans once, up front; a
deterministic runtime executes the plan.**

Three sentences to retain:

1. **The scheduler decides, the graph encodes.** Steps are dumb; control flow
   is centralized. (Policy = graph, mechanism = scheduler.)
2. **Durability means `kill -9` is survivable.** Persist state before acting;
   recovery is just "reload state and reschedule" — the same code path as
   normal operation.
3. **Acyclic means guaranteed progress.** A cycle gives the scheduler either a
   deadlock (no node is ever ready) or an infinite loop. Every DAG has a
   topological order, so termination is guaranteed and bad plans can be
   rejected at submission time.

Production parallels: Temporal, AWS Step Functions, Airflow, GitHub Actions,
Kubernetes controllers.

## Phase 0 — Monorepo as enforced architecture

Package boundaries are the SGH separation of concerns made compiler-enforced:
a package can only import what its `package.json` declares, so the scheduler
*cannot* reach the LLM provider. Our own package dependency structure is
itself a DAG.

Rules we hold ourselves to:

- `shared` is the bottom: types and schemas only, no logic, no I/O.
- The scheduler never knows LLMs exist. Test of the abstraction: rip out the
  AI packages and the runtime should still be a good generic job orchestrator.

Implementation notes: pnpm workspaces; the "internal packages" pattern (each
package exports its TypeScript source directly — no build step, since nothing
is published to npm); one root tsconfig for typechecking.
