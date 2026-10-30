import { describe, it, expect } from "vitest";
import { GET } from "../app/api/health/route";

describe("Health API Route", () => {
  it("returns status healthy with service name", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("healthy");
    expect(data.service).toBe("ghosttrace");
    expect(data.version).toBe("0.1.0");
    expect(data.timestamp).toBeDefined();
  });
});
