import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it
} from "vitest";
import { createHash, randomBytes } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import pool from "../src/db/pool.js";

describe("Authenticated API routes", () => {
  let accountId: string;
  let otherAccountId: string;
  let apiKey: string;
  let otherApiKey: string;
  let customPlanId: string;

  async function createAccount(name: string, key: string) {
    const plan = await pool.query(
      `SELECT id
       FROM plans
       WHERE name = 'Test Account Plan'
         AND plan_type = 'account'
       LIMIT 1`
    );

    if (!plan.rows[0]) {
      throw new Error("Test Account Plan is missing");
    }

    const keyHash = createHash("sha256")
      .update(key)
      .digest("hex");

    const result = await pool.query(
      `INSERT INTO accounts (name, api_key_hash, plan_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [name, keyHash, plan.rows[0].id]
    );

    return result.rows[0].id as string;
  }

  beforeAll(async () => {
    apiKey = randomBytes(32).toString("hex");
    otherApiKey = randomBytes(32).toString("hex");

    accountId = await createAccount(
      `API Test Account ${randomBytes(4).toString("hex")}`,
      apiKey
    );

    otherAccountId = await createAccount(
      `Other API Test Account ${randomBytes(4).toString("hex")}`,
      otherApiKey
    );

    const planResult = await pool.query(
      `INSERT INTO plans (
         name,
         plan_type,
         monthly_allowance,
         max_units_per_request,
         is_predefined,
         owner_account_id
       )
       VALUES ($1, 'user', 100, 10, FALSE, $2)
       RETURNING id`,
      [`Private Test Plan ${randomBytes(4).toString("hex")}`, accountId]
    );

    customPlanId = planResult.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(
      "DELETE FROM plans WHERE owner_account_id = $1",
      [accountId]
    );

    await pool.query(
      "DELETE FROM accounts WHERE id = ANY($1::uuid[])",
      [[accountId, otherAccountId]]
    );
  });

  it.each([
    ["account creation", "post", "/api/accounts"],
    ["user creation", "post", "/api/users"],
    ["plan creation", "post", "/api/plans"],
    ["usage consumption", "post", "/api/usage"],
    ["user plan update", "patch", "/api/users/00000000-0000-4000-8000-000000000000/plan"],
    ["plan update", "patch", "/api/plans/00000000-0000-4000-8000-000000000000"]
  ])("handles a null request body safely for %s", async (_name, method, url) => {
    let call = request(app)[method as "post"](url).set("Content-Type", "application/json").send("null");

    if (url !== "/api/accounts") {
      call = call.set("x-api-key", apiKey);
    }

    const response = await call;

    expect(response.status).toBe(400);
  });

  it("rejects requests without an API key", async () => {
    const response = await request(app).get("/api/users");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("API key is required");
  });

  it("rejects an invalid API key", async () => {
    const response = await request(app)
      .get("/api/users")
      .set("x-api-key", "invalid-api-key");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid API key");
  });

  it("rejects an invalid user UUID before querying the database", async () => {
    const response = await request(app)
      .get("/api/users/not-a-uuid")
      .set("x-api-key", apiKey);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid user ID");
  });

  it("rejects an invalid user UUID when changing a plan", async () => {
    const response = await request(app)
      .patch("/api/users/not-a-uuid/plan")
      .set("x-api-key", apiKey)
      .send({ planId: customPlanId });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid user ID");
  });

  it("rejects invalid report months", async () => {
    const response = await request(app)
      .get("/api/usage/summary")
      .query({ month: "2026-13" })
      .set("x-api-key", apiKey);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("month must use YYYY-MM format");
  });

  it("returns an account summary for a valid API key", async () => {
    const response = await request(app)
      .get("/api/usage/summary")
      .query({ month: "2026-10" })
      .set("x-api-key", apiKey);

    expect(response.status).toBe(200);
    expect(response.body.account.id).toBe(accountId);
    expect(response.body.month).toBe("2026-10");
  });

  it("returns usage history for a valid API key", async () => {
    const response = await request(app)
      .get("/api/usage/history")
      .query({ month: "2026-10", limit: 10, offset: 0 })
      .set("x-api-key", apiKey);

    expect(response.status).toBe(200);
    expect(response.body.month).toBe("2026-10");
    expect(response.body.history).toBeInstanceOf(Array);
  });

  it("does not expose another account's private plan", async () => {
    const response = await request(app)
      .get(`/api/plans/${customPlanId}`)
      .set("x-api-key", otherApiKey);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Plan not found");
  });

  it("does not allow another account to modify a private plan", async () => {
    const response = await request(app)
      .patch(`/api/plans/${customPlanId}`)
      .set("x-api-key", otherApiKey)
      .send({ name: "Unauthorized Change" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe(
      "Custom plan not found or cannot be modified"
    );

    const storedPlan = await pool.query(
      "SELECT name FROM plans WHERE id = $1",
      [customPlanId]
    );

    expect(storedPlan.rows[0].name).not.toBe("Unauthorized Change");
  });
});
