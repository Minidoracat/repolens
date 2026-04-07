export type SseEventType =
  | "step_started"
  | "step_finished"
  | "llm_thought"
  | "mermaid_final"
  | "run_completed"
  | "run_failed";

export interface SseEvent {
  type: SseEventType;
  stepIndex?: number;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  content?: string;
  code?: string;
  error?: string;
  runId?: string;
}
