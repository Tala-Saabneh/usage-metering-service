import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Health endpoint", () => {
  it("should return database connection status", async () => {
    const response = await request(app).get("/health");

    expect([200, 503]).toContain(response.status);

    if (response.status === 200) {
      expect(response.body).toEqual({
        status: "ok",
        database: "connected"
      });
    } else {
      expect(response.body).toEqual({
        status: "error",
        database: "disconnected"
      });
    }
  });
});
