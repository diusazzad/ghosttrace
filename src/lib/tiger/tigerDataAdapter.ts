import { z } from "zod";
import { ReconstructedTimeline } from "@/types/schema";
import { recordAgentBreadcrumb } from "@/lib/telemetry/sentryTracer";

/**
 * Zod Schemas for Tiger Data Graph & Knowledge Store
 */
export const TigerVertexSchema = z.object({
  id: z.string().min(1, "Vertex ID must not be empty"),
  type: z.enum([
    "Agent",
    "Trace",
    "FailureCategory",
    "TriggerEvent",
    "Tool",
    "Remediation",
  ]),
  attributes: z.record(z.string(), z.unknown()),
});

export type TigerVertex = z.infer<typeof TigerVertexSchema>;

export const TigerEdgeSchema = z.object({
  fromId: z.string().min(1),
  fromType: z.string().min(1),
  toId: z.string().min(1),
  toType: z.string().min(1),
  type: z.enum([
    "PRODUCED_TRACE",
    "EXHIBITED_FAILURE",
    "TRIGGERED_BY",
    "CALLED_TOOL",
    "RESOLVED_BY",
  ]),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export type TigerEdge = z.infer<typeof TigerEdgeSchema>;

export const TigerGraphPayloadSchema = z.object({
  graphName: z.string().min(1),
  vertices: z.array(TigerVertexSchema),
  edges: z.array(TigerEdgeSchema),
});

export type TigerGraphPayload = z.infer<typeof TigerGraphPayloadSchema>;

export const TigerSimilarPatternResultSchema = z.object({
  category: z.string(),
  matchingTraceIds: z.array(z.string()),
  commonToolFailures: z.array(z.string()),
  recommendedRemediations: z.array(z.string()),
  frequency: z.number().int().nonnegative(),
});

export type TigerSimilarPatternResult = z.infer<
  typeof TigerSimilarPatternResultSchema
>;

export class TigerDataError extends Error {
  readonly code:
    | "CONFIG_MISSING"
    | "AUTHENTICATION_FAILED"
    | "QUERY_FAILED"
    | "UPSTREAM_REQUEST_FAILED"
    | "SCHEMA_VALIDATION_FAILED";
  readonly statusCode: number;
  readonly isRetryable: boolean;

  constructor(
    message: string,
    code: TigerDataError["code"],
    statusCode: number = 500,
    isRetryable: boolean = false
  ) {
    super(`[TigerData] ${message}`);
    this.name = "TigerDataError";
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

export interface TigerDataAdapterOptions {
  url?: string;
  apiKey?: string;
  graphName?: string;
  fetchFn?: typeof fetch;
}

export class TigerDataAdapter {
  private url?: string;
  private apiKey?: string;
  private graphName: string;
  private fetchFn: typeof fetch;

  constructor(options: TigerDataAdapterOptions = {}) {
    this.url =
      options.url ??
      process.env.TIGER_DATA_URL ??
      process.env.TIGERGRAPH_URL;
    this.apiKey =
      options.apiKey ??
      process.env.TIGER_API_KEY ??
      process.env.TIGERGRAPH_TOKEN;
    this.graphName =
      options.graphName ??
      process.env.TIGER_GRAPH_NAME ??
      "GhostTraceKnowledgeGraph";
    this.fetchFn = options.fetchFn ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(
      this.url &&
      this.url.trim().length > 0 &&
      this.url !== "https://tigergraph.example.com"
    );
  }

  /**
   * Converts a forensic trace timeline into graph entities and ingests into Tiger Data.
   */
  async ingestTraceGraph(
    timeline: ReconstructedTimeline
  ): Promise<{ vertexCount: number; edgeCount: number; success: boolean }> {
    if (!this.isConfigured()) {
      throw new TigerDataError(
        "TIGER_DATA_URL is not configured in environment.",
        "CONFIG_MISSING",
        401,
        false
      );
    }

    recordAgentBreadcrumb(
      "workflow",
      `Ingesting forensic graph for trace ${timeline.traceId} into Tiger Data (${this.graphName})`,
      {
        traceId: timeline.traceId,
        graphName: this.graphName,
      }
    );

    // Build topological graph entities
    const vertices: TigerVertex[] = [
      {
        id: `agent_${timeline.agentName}`,
        type: "Agent",
        attributes: { name: timeline.agentName },
      },
      {
        id: `trace_${timeline.traceId}`,
        type: "Trace",
        attributes: {
          traceId: timeline.traceId,
          status: timeline.status,
          totalDurationMs: timeline.totalDurationMs,
        },
      },
      {
        id: `cat_${timeline.primaryFailureCategory}`,
        type: "FailureCategory",
        attributes: { category: timeline.primaryFailureCategory },
      },
    ];

    const edges: TigerEdge[] = [
      {
        fromId: `agent_${timeline.agentName}`,
        fromType: "Agent",
        toId: `trace_${timeline.traceId}`,
        toType: "Trace",
        type: "PRODUCED_TRACE",
      },
      {
        fromId: `trace_${timeline.traceId}`,
        fromType: "Trace",
        toId: `cat_${timeline.primaryFailureCategory}`,
        toType: "FailureCategory",
        type: "EXHIBITED_FAILURE",
      },
    ];

    // Add tool and trigger event nodes if anomalies exist
    for (const anomaly of timeline.anomalies) {
      const anomalyId = `trigger_${timeline.traceId}_${anomaly.category}`;
      vertices.push({
        id: anomalyId,
        type: "TriggerEvent",
        attributes: {
          severity: anomaly.severity,
          title: anomaly.title,
          description: anomaly.description,
        },
      });

      edges.push({
        fromId: `trace_${timeline.traceId}`,
        fromType: "Trace",
        toId: anomalyId,
        toType: "TriggerEvent",
        type: "TRIGGERED_BY",
      });

      if (anomaly.suggestedRemediation) {
        const remId = `rem_${timeline.traceId}_${anomaly.category}`;
        vertices.push({
          id: remId,
          type: "Remediation",
          attributes: { text: anomaly.suggestedRemediation },
        });

        edges.push({
          fromId: anomalyId,
          fromType: "TriggerEvent",
          toId: remId,
          toType: "Remediation",
          type: "RESOLVED_BY",
        });
      }
    }

    const payload: TigerGraphPayload = {
      graphName: this.graphName,
      vertices,
      edges,
    };

    const targetUrl = `${this.url}/api/v1/graph/${encodeURIComponent(
      this.graphName
    )}/entities`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let res: Response;
    try {
      res = await this.fetchFn(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      throw new TigerDataError(
        `Failed to reach Tiger Data API: ${
          err instanceof Error ? err.message : String(err)
        }`,
        "UPSTREAM_REQUEST_FAILED",
        500,
        true
      );
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new TigerDataError(
          "Tiger Data authentication failed",
          "AUTHENTICATION_FAILED",
          401,
          false
        );
      }
      throw new TigerDataError(
        `Failed to ingest graph entities: HTTP ${res.status}`,
        "UPSTREAM_REQUEST_FAILED",
        res.status,
        res.status >= 500
      );
    }

    return {
      vertexCount: vertices.length,
      edgeCount: edges.length,
      success: true,
    };
  }

  /**
   * Queries Tiger Data for recurring failure topological patterns and known fixes.
   */
  async querySimilarFailurePatterns(
    category: string
  ): Promise<TigerSimilarPatternResult> {
    if (!this.isConfigured()) {
      throw new TigerDataError(
        "TIGER_DATA_URL is not configured in environment.",
        "CONFIG_MISSING",
        401,
        false
      );
    }

    const targetUrl = `${this.url}/api/v1/graph/${encodeURIComponent(
      this.graphName
    )}/patterns?category=${encodeURIComponent(category)}`;

    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let res: Response;
    try {
      res = await this.fetchFn(targetUrl, {
        method: "GET",
        headers,
      });
    } catch (err: unknown) {
      throw new TigerDataError(
        `Failed to reach Tiger Data API: ${
          err instanceof Error ? err.message : String(err)
        }`,
        "UPSTREAM_REQUEST_FAILED",
        500,
        true
      );
    }

    if (!res.ok) {
      throw new TigerDataError(
        `Failed to query pattern graph: HTTP ${res.status}`,
        "QUERY_FAILED",
        res.status,
        res.status >= 500
      );
    }

    const data = await res.json();
    const parsed = TigerSimilarPatternResultSchema.safeParse(data);
    if (!parsed.success) {
      throw new TigerDataError(
        `Invalid pattern response schema: ${parsed.error.message}`,
        "SCHEMA_VALIDATION_FAILED",
        500,
        false
      );
    }

    return parsed.data;
  }
}

export const defaultTigerDataAdapter = new TigerDataAdapter();
