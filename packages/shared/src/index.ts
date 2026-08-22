/**
 * @workflow/shared — types and Zod schemas every other package agrees on.
 * Contains no logic and no I/O. Depends on nothing.
 */
export {
  jsonValueSchema,
  jsonObjectSchema,
  type JsonValue,
  type JsonObject,
} from "./json";
export {
  NODE_STATUSES,
  TERMINAL_NODE_STATUSES,
  RUN_STATUSES,
  isTerminalNodeStatus,
  type NodeStatus,
  type RunStatus,
} from "./status";
