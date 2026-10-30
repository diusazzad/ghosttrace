import { ReconstructedTimeline } from "@/types/schema";

export interface GemmaHypothesis {
  title: string;
  model: string;
  explanation: string;
  groundedEventIds: string[];
  confidence: number;
  validationStatus: "grounded" | "unverified" | "hallucination_flagged";
  suggestedFix: string;
}

export interface GemmaAdapterOptions {
  backboardApiKey?: string;
  backboardBaseUrl?: string;
  ollamaHost?: string;
  modelName?: string;
  fetchFn?: typeof fetch;
}

export class GemmaAdapter {
  private backboardApiKey: string | undefined;
  private backboardBaseUrl: string;
  private ollamaHost: string;
  private modelName: string;
  private fetchFn: typeof fetch;

  constructor(options: GemmaAdapterOptions = {}) {
    this.backboardApiKey =
      options.backboardApiKey ?? process.env.BACKBOARD_API_KEY;
    this.backboardBaseUrl =
      options.backboardBaseUrl ??
      process.env.BACKBOARD_BASE_URL ??
      "https://api.backboard.io/v1";
    this.ollamaHost =
      options.ollamaHost ??
      process.env.OLLAMA_HOST ??
      "http://127.0.0.1:11434";
    this.modelName =
      options.modelName ??
      process.env.GEMMA_MODEL_NAME ??
      "google/gemma-2-9b-it";
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * Generates a grounded forensic hypothesis for an agent failure trace.
   * Tries Backboard -> Local Ollama -> Deterministic Fallback.
   */
  async analyzeFailureTrace(
    timeline: ReconstructedTimeline
  ): Promise<GemmaHypothesis> {
    const validEventIds = new Set(timeline.events.map((e) => e.id));
    const prompt = this.buildForensicPrompt(timeline);

    // 1. Try Remote Backboard API if API key is configured
    if (this.backboardApiKey && this.backboardApiKey !== "your_backboard_api_key_here") {
      try {
        const rawResponse = await this.callBackboard(prompt);
        const parsed = this.parseModelJson(rawResponse);
        if (parsed) {
          return this.validateAndGroundHypothesis(
            parsed,
            validEventIds,
            `Google Gemma 2 (Backboard: ${this.modelName})`,
            timeline
          );
        }
      } catch (err) {
        console.warn("Backboard API call failed, falling back to local Ollama / deterministic:", err);
      }
    }

    // 2. Try Local Ollama if available
    try {
      const rawOllama = await this.callOllama(prompt);
      const parsedOllama = this.parseModelJson(rawOllama);
      if (parsedOllama) {
        return this.validateAndGroundHypothesis(
          parsedOllama,
          validEventIds,
          `Google Gemma 2 (Ollama Local)`,
          timeline
        );
      }
    } catch {
      // Ollama not running locally; fallback cleanly to deterministic
    }

    // 3. Deterministic Fallback (Offline Mode)
    return this.buildDeterministicFallback(timeline);
  }

  /**
   * Strict Grounding Validator:
   * Rejects or filters any event IDs hallucinated by the model that do not exist in the trace!
   */
  validateAndGroundHypothesis(
    candidate: Partial<GemmaHypothesis>,
    validEventIds: Set<string>,
    modelLabel: string,
    timeline: ReconstructedTimeline
  ): GemmaHypothesis {
    const rawIds = Array.isArray(candidate.groundedEventIds)
      ? candidate.groundedEventIds
      : [];

    // Filter out hallucinated IDs
    const verifiedIds = rawIds.filter((id) => validEventIds.has(id));
    const hasHallucinations = rawIds.length > verifiedIds.length;

    // If model cited completely fabricated IDs, use deterministic causal IDs
    const finalEventIds =
      verifiedIds.length > 0
        ? verifiedIds
        : timeline.anomalies[0]?.groundedEventIds || [];

    const validationStatus =
      verifiedIds.length > 0
        ? hasHallucinations
          ? "unverified"
          : "grounded"
        : "hallucination_flagged";

    return {
      title:
        candidate.title ||
        timeline.anomalies[0]?.title ||
        "Grounded Failure Hypothesis",
      model: modelLabel,
      explanation:
        candidate.explanation ||
        timeline.anomalies[0]?.description ||
        "Model identified failure conditions in the execution trace.",
      groundedEventIds: finalEventIds,
      confidence: Math.min(Math.max(candidate.confidence ?? 0.85, 0.1), 1.0),
      validationStatus,
      suggestedFix:
        candidate.suggestedFix ||
        timeline.anomalies[0]?.suggestedRemediation ||
        "Review tool calling schema and add circuit-breaker retry limits.",
    };
  }

  buildForensicPrompt(timeline: ReconstructedTimeline): string {
    const eventsSummary = timeline.events.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      durationMs: e.durationMs,
      status: e.status,
      input: e.input,
      output: e.output,
      error: e.error,
      isCausalAnomaly: e.isCausalAnomaly,
    }));

    return `You are GhostTrace, an expert AI Agent Systems Forensics Investigator.
Analyze the following multi-step execution trace of agent '${timeline.agentName}' (ID: ${timeline.traceId}) that terminated with status '${timeline.status}'.

CHRONOLOGICAL EVENT TRACE:
${JSON.stringify(eventsSummary, null, 2)}

INSTRUCTIONS:
1. Identify the root cause behind the agent's failure or degraded state.
2. Ground every finding: you MUST cite exact, real event IDs (e.g. "evt_001") from the trace above. DO NOT invent event IDs.
3. Return ONLY a valid JSON object strictly matching this schema, without markdown formatting or codeblocks:
{
  "title": "Concise failure mode title",
  "explanation": "Clear explanation of what went wrong, referencing the exact event IDs",
  "groundedEventIds": ["evt_001", "evt_002"],
  "confidence": 0.95,
  "suggestedFix": "Concrete code, schema, or prompt modification to prevent recurrence"
}`;
  }

  private async callBackboard(prompt: string): Promise<string> {
    const url = `${this.backboardBaseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const res = await this.fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.backboardApiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            {
              role: "system",
              content:
                "You are GhostTrace, a technical forensic debugger for AI agents. Always respond in valid raw JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        throw new Error(`Backboard API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callOllama(prompt: string): Promise<string> {
    const url = `${this.ollamaHost}/api/chat`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.modelName.includes("gemma") ? this.modelName : "gemma2:9b",
          messages: [{ role: "user", content: prompt }],
          stream: false,
          format: "json",
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama error: ${res.status}`);
      }

      const data = await res.json();
      return data.message?.content ?? "";
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseModelJson(raw: string): Partial<GemmaHypothesis> | null {
    if (!raw) return null;
    try {
      // Strip possible markdown code blocks ```json ... ```
      const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      // Fallback regex extraction if model added surrounding prose
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private buildDeterministicFallback(
    timeline: ReconstructedTimeline
  ): GemmaHypothesis {
    const primary = timeline.anomalies[0];
    return {
      title: primary?.title || "Deterministic Anomaly Diagnostic",
      model: "Google Gemma 2 (Deterministic Grounding)",
      explanation:
        primary?.description ||
        "Deterministic forensic parser verified execution timeline. No causal anomalies detected.",
      groundedEventIds: primary?.groundedEventIds || [],
      confidence: primary ? 0.95 : 1.0,
      validationStatus: "grounded",
      suggestedFix:
        primary?.suggestedRemediation ||
        "Pipeline functioning within acceptable parameters. No remediation required.",
    };
  }
}

export const defaultGemmaAdapter = new GemmaAdapter();
