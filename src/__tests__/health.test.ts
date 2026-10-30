import { describe, it, expect } from "vitest";
import { GET } from "../app/api/health/route";

describe("Health API Route", () => {
  it("returns status healthy with comprehensive subsystem readiness report", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("healthy");
    expect(data.service).toBe("ghosttrace");
    expect(data.version).toBe("0.1.0");
    expect(data.timestamp).toBeDefined();
    expect(data.uptimeSeconds).toBeGreaterThanOrEqual(0);

    // Verify subsystems
    expect(data.subsystems).toBeDefined();
    expect(data.subsystems.forensicsEngine).toBe("active_deterministic");
    expect(data.subsystems.aiReasoner.groundingEnforcement).toBe("active");
    expect(data.subsystems.workflowOrchestration.engine).toContain("Mastra");
    expect(data.subsystems.workflowOrchestration.steps).toBe(4);
    expect(data.subsystems.observability.genAiSpans).toBe("enabled");
    expect(data.subsystems.storage.engine).toBeDefined();
  });
});
