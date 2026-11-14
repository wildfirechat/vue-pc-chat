/**
 * Minimal ambient type declarations for the dsh core packages used by this
 * plugin. They mirror the public surfaces documented in the corresponding
 * `@deepseek-ai/*` README files.
 */

declare module "@deepseek-ai/dsh-llm" {
  export interface UserMessageInput {
    content: Array<{ type: "text"; text: string } | { type: "image"; attachment: any }>;
    source: { kind: "user" };
  }
  export function createUserMessage(input: UserMessageInput): any;
  export function ReasoningEffortId(id: string): string & { __brand: "ReasoningEffortId" };
}

declare module "@deepseek-ai/dsh-agent" {
  /**
   * Install a live model selection for an agent scope. Mutating
   * `selection.current` applies to the agent's next request.
   */
  export function installModelSelection(
    agentCtx: any,
    selection: { current?: any; assembled?: any }
  ): void;
}

/** The interaction services used by this plugin (userQuestions / attachments). */
declare module "@deepseek-ai/dsh-user-questions" {
  export interface AskUserQuestionRequest {
    questions: Array<{
      id: string;
      question: string;
      detail?: string;
      header?: string;
      options?: Array<{ label: string; description?: string }>;
      multiSelect?: boolean;
      intent?: any;
    }>;
    agent?: any;
    signal?: AbortSignal;
  }
  export interface AskUserQuestionAnswer {
    answers: Array<{ id: string; selected: string[]; custom?: string }>;
  }
  export interface UserQuestionProvider {
    ask(request: AskUserQuestionRequest): Promise<AskUserQuestionAnswer>;
  }
}

declare module "@deepseek-ai/dsh-attachment" {
  export interface ImageAttachmentRef {
    id: string;
    mediaType: string;
    [k: string]: unknown;
  }
  export interface AttachmentService {
    saveImages(inputs: Array<{ data: Buffer; mediaType: string; name?: string }>): Promise<ImageAttachmentRef[]>;
  }
}

declare module "@deepseek-ai/dsh-session" {
  export interface SessionEvent {
    type: string;
    seq: number;
    time: number;
    data: any;
  }
  export function SessionId(id: string): string & { __brand: "SessionId" };
}

declare module "@deepseek-ai/dsh-sandbox-policy" {
  /** Every sandbox mode ('read-only' | 'workspace-write' | 'danger-full-access'). */
  export const SANDBOX_MODES: readonly string[];
  /**
   * Append one `sandbox/mode` event to the session log — takes effect on the
   * session's next confined call (bash/fs) and persists with the log.
   */
  export function setSandboxMode(session: any, mode: string): void;
}
