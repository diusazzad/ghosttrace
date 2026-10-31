import { describe, it, expect } from "vitest";
import { SAMPLE_TRACES } from "@/lib/sampleTraces";
import { defaultGemmaAdapter } from "@/lib/ai/gemmaAdapter";
import { reconstructTimeline } from "@/lib/detector";
import { GET as healthGet } from "@/app/api/health/route";

describe("Evidence Integrity, Provenance & Truthful Telemetry (PR 14)", () => {
  describe("1. Sample Trace Provenance & Fixture Labeling", () => {
    it("explicitly labels all bundled demo traces as sample fixtures", () => {
      expect(SAMPLE_TRACES.length).toBeGreaterThanOrEqual(5);
      for (const trace of SAMPLE_TRACES) {
        expect(trace.isSampleFixture).toBe(true);
        expect(trace.fixtureDisclaimer).toBeDefined();
        expect(trace.fixtureDisclaimer).toContain("Illustrative");
      }
    });

    it("ensures default trace hypothesis attributes diagnosis to rule engine when unconfigured", () => {
      const defaultTrace = SAMPLE_TRACES[0];
      expect(defaultTrace.hypothesis.provider).toBe("deterministic_rules");
      expect(defaultTrace.hypothesis.executionMode).toBe("deterministic_fallback");
      expect(defaultTrace.hypothesis.fallbackReason).toContain("Deterministic Forensic Engine Active");
      expect(defaultTrace.hypothesis.fallbackReason).toContain("Rule-based analysis completed successfully without LLM inference");
    });
  });

  describe("2. Event Citation Validation & Anomaly Separation", () => {
    it("rejects hallucinated event IDs not present in trace events", () => {
      const testTrace = SAMPLE_TRACES[0];
      const timeline = reconstructTimeline(testTrace as any);
      const validIds = new Set(timeline.events.map((e) => e.id));

      const candidateHypothesis = {
        title: "Test Hypothesis",
        explanation: "Failure at fake_123",
        groundedEventIds: ["fake_123", "evt_302"],
        confidence: 0.9,
      };

      const result = defaultGemmaAdapter.validateAndGroundHypothesis(
        candidateHypothesis,
        validIds,
        "Google Gemma 2",
        timeline
      );

      // Verify that fake_123 was flagged and removed from verified IDs
      expect(result.evidenceValidation?.hallucinatedEventIds).toContain("fake_123");
      expect(result.evidenceValidation?.validEventIds).not.toContain("fake_123");
      expect(result.evidenceValidation?.validEventIds).toContain("evt_302");
    });
  });

  describe("3. Health Endpoint Bounded Probe & Dependency Reporting", () => {
    it("honestly reports deterministic_rules and degraded_fallback when remote Backboard is unreachable", async () => {
      const originalKey = process.env.BACKBOARD_API_KEY;
      delete process.env.BACKBOARD_API_KEY;

      const res = await healthGet();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe("healthy");
      expect(data.subsystems.forensicsEngine).toBe("active_deterministic");
      expect(data.subsystems.aiReasoner.provider).toBe("deterministic_rules");
      expect(data.subsystems.aiReasoner.status).toBe("degraded_fallback");

      if (originalKey) {
        process.env.BACKBOARD_API_KEY = originalKey;
      }
    });

    it("truthfully reports identity as not_configured when Auth0 environment variables are absent", async () => {
      const originalDomain = process.env.AUTH0_DOMAIN;
      delete process.env.AUTH0_DOMAIN;

      const res = await healthGet();
      const data = await res.json();

      expect(data.subsystems.identity.provider).toBe("auth0");
      expect(data.subsystems.identity.status).toBe("not_configured");

      if (originalDomain) {
        process.env.AUTH0_DOMAIN = originalDomain;
      }
    });
  });
});
