/**
 * @workflow/scheduler — decides which pending nodes should become ready
 * or skipped. Pure: reads a graph and statuses, proposes moves, stops.
 */
export { schedule, type ScheduleDecision } from "./schedule";
