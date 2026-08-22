/**
 * @workflow/runtime — the execution engine. Owns execution semantics:
 * which lifecycle transitions are legal and how failure is handled.
 */
export {
  initialNodeState,
  transitionNode,
  type NodeLifecycleState,
  type NodeEvent,
  type NodeTransitionResult,
  type RetryPolicy,
} from "./nodeLifecycle";
export { computeRunStatus } from "./runStatus";
