import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app";

describe("GET /api/healthz", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/healthz");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
  });

  it("includes x-request-id response header", async () => {
    const res = await request(app).get("/api/healthz");

    expect(res.headers["x-request-id"]).toBeDefined();
    expect(typeof res.headers["x-request-id"]).toBe("string");
  });

  it("echoes a provided x-request-id", async () => {
    const id = "test-request-id-123";
    const res = await request(app)
      .get("/api/healthz")
      .set("x-request-id", id);

    expect(res.headers["x-request-id"]).toBe(id);
  });
});
