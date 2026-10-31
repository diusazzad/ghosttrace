import { z } from "zod";
import { recordAgentBreadcrumb } from "@/lib/telemetry/sentryTracer";

/**
 * Zod schemas for Temporal Durable Forensic Execution
 */
export const TemporalWorkflowStatusSchema = z.enum([
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "TERMINATED",
  "TIMED_OUT",
]);

export type TemporalWorkflowStatus = z.infer<
  typeof TemporalWorkflowStatusSchema
>;

export const TemporalWorkflowExecutionSchema = z.object({
  workflowId: z.string().min(1, "Workflow ID is required"),
  runId: z.string().min(1, "Run ID is required"),
  status: TemporalWorkflowStatusSchema,
  taskQueue: z.string().min(1, "Task queue is required"),
  startTime: z.string(),
  closeTime: z.string().optional(),
  historyLength: z.number().int().nonnegative().optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
});

export type TemporalWorkflowExecution = z.infer<
  typeof TemporalWorkflowExecutionSchema
>;

export class TemporalError extends Error {
  readonly code:
    | "CONFIG_MISSING"
    | "AUTHENTICATION_FAILED"
    | "WORKFLOW_NOT_FOUND"
    | "UPSTREAM_REQUEST_FAILED"
    | "SCHEMA_VALIDATION_FAILED";
  readonly statusCode: number;
  readonly isRetryable: boolean;

  constructor(
    message: string,
    code: TemporalError["code"],
    statusCode: number = 500,
    isRetryable: boolean = false
  ) {
    super(`[Temporal] ${message}`);
    this.name = "TemporalError";
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

export interface TemporalAdapterOptions {
  address?: string;
  namespace?: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
}

export class TemporalAdapter {
  private address?: string;
  private namespace: string;
  private apiKey?: string;
  private fetchFn: typeof fetch;

  constructor(options: TemporalAdapterOptions = {}) {
    this.address =
      options.address ??
      process.env.TEMPORAL_ADDRESS ??
      process.env.TEMPORAL_HOST_URL;
    this.namespace =
      options.namespace ??
      process.env.TEMPORAL_NAMESPACE ??
      "default";
    this.apiKey =
      options.apiKey ??
      process.env.TEMPORAL_API_KEY;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(
      this.address &&
      this.address.trim().length > 0 &&
      this.address !== "localhost:7233_unconfigured"
    );
  }

  /**
   * Starts a durable forensic investigation workflow.
   */
  async startForensicWorkflow(params: {
    workflowId: string;
    taskQueue?: string;
    tracePayload: Record<string, unknown>;
  }): Promise<TemporalWorkflowExecution> {
    if (!this.isConfigured()) {
      throw new TemporalError(
        "TEMPORAL_ADDRESS is not configured in environment.",
        "CONFIG_MISSING",
        401,
        false
      );
    }

    const taskQueue = params.taskQueue ?? "ghosttrace-forensics-queue";

    recordAgentBreadcrumb(
      "workflow",
      `Dispatching durable forensic workflow ${params.workflowId} to Temporal (${this.namespace})`,
      {
        workflowId: params.workflowId,
        taskQueue,
        namespace: this.namespace,
      }
    );

    const baseURL = this.address!.startsWith("http")
      ? this.address!
      : `https://${this.address!}`;
    const url = `${baseURL}/api/v1/namespaces/${encodeURIComponent(
      this.namespace
    )}/workflows/${encodeURIComponent(params.workflowId)}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let res: Response;
    try {
      res = await this.fetchFn(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          taskQueue,
          input: params.tracePayload,
          workflowType: "GhostTraceForensicWorkflow",
        }),
      });
    } catch (err: unknown) {
      throw new TemporalError(
        `Failed to reach Temporal server: ${
          err instanceof Error ? err.message : String(err)
        }`,
        "UPSTREAM_REQUEST_FAILED",
        500,
        true
      );
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new TemporalError(
          "Temporal authentication failed",
          "AUTHENTICATION_FAILED",
          401,
          false
        );
      }
      throw new TemporalError(
        `Failed to start Temporal workflow: HTTP ${res.status}`,
        "UPSTREAM_REQUEST_FAILED",
        res.status,
        res.status >= 500
      );
    }

    const data = await res.json();
    const parsed = TemporalWorkflowExecutionSchema.safeParse(data);
    if (!parsed.success) {
      throw new TemporalError(
        `Invalid Temporal workflow execution response: ${parsed.error.message}`,
        "SCHEMA_VALIDATION_FAILED",
        500,
        false
      );
    }

    return parsed.data;
  }

  /**
   * Retrieves live execution state for a durable forensic workflow.
   */
  async getWorkflowExecution(
    workflowId: string,
    runId?: string
  ): Promise<TemporalWorkflowExecution> {
    if (!this.isConfigured()) {
      throw new TemporalError(
        "TEMPORAL_ADDRESS is not configured in environment.",
        "CONFIG_MISSING",
        401,
        false
      );
    }

    const baseURL = this.address!.startsWith("http")
      ? this.address!
      : `https://${this.address!}`;
    let url = `${baseURL}/api/v1/namespaces/${encodeURIComponent(
      this.namespace
    )}/workflows/${encodeURIComponent(workflowId)}`;
    if (runId) {
      url += `?runId=${encodeURIComponent(runId)}`;
    }

    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let res: Response;
    try {
      res = await this.fetchFn(url, {
        method: "GET",
        headers,
      });
    } catch (err: unknown) {
      throw new TemporalError(
        `Failed to reach Temporal server: ${
          err instanceof Error ? err.message : String(err)
        }`,
        "UPSTREAM_REQUEST_FAILED",
        500,
        true
      );
    }

    if (res.status === 404) {
      throw new TemporalError(
        `Workflow ${workflowId} not found in Temporal namespace ${this.namespace}`,
        "WORKFLOW_NOT_FOUND",
        404,
        false
      );
    }

    if (!res.ok) {
      throw new TemporalError(
        `Failed to retrieve workflow: HTTP ${res.status}`,
        "UPSTREAM_REQUEST_FAILED",
        res.status,
        res.status >= 500
      );
    }

    const data = await res.json();
    const parsed = TemporalWorkflowExecutionSchema.safeParse(data);
    if (!parsed.success) {
      throw new TemporalError(
        `Invalid Temporal workflow execution response: ${parsed.error.message}`,
        "SCHEMA_VALIDATION_FAILED",
        500,
        false
      );
    }

    return parsed.data;
  }

  /**
   * Sends a signal to a running workflow (e.g. human approval for fix deployment).
   */
  async sendSignal(
    workflowId: string,
    signalName: string,
    signalData: Record<string, unknown>
  ): Promise<{ success: boolean }> {
    if (!this.isConfigured()) {
      throw new TemporalError(
        "TEMPORAL_ADDRESS is not configured in environment.",
        "CONFIG_MISSING",
        401,
        false
      );
    }

    const baseURL = this.address!.startsWith("http")
      ? this.address!
      : `https://${this.address!}`;
    const url = `${baseURL}/api/v1/namespaces/${encodeURIComponent(
      this.namespace
    )}/workflows/${encodeURIComponent(workflowId)}/signal/${encodeURIComponent(
      signalName
    )}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let res: Response;
    try {
      res = await this.fetchFn(url, {
        method: "POST",
        headers,
        body: JSON.stringify(signalData),
      });
    } catch (err: unknown) {
      throw new TemporalError(
        `Failed to send signal to Temporal: ${
          err instanceof Error ? err.message : String(err)
        }`,
        "UPSTREAM_REQUEST_FAILED",
        500,
        true
      );
    }

    if (!res.ok) {
      throw new TemporalError(
        `Failed to send signal: HTTP ${res.status}`,
        "UPSTREAM_REQUEST_FAILED",
        res.status,
        res.status >= 500
      );
    }

    return { success: true };
  }
}

export const defaultTemporalAdapter = new TemporalAdapter();
