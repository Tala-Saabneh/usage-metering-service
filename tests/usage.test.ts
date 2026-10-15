
import {
  beforeEach,
  afterEach,
  describe,
  it,
  expect
} from "vitest";
import { createHash, randomBytes } from "node:crypto";
import pool from "../src/db/pool.js";
import { consumeUsage } from "../src/services/usage.js";

describe("Usage consumption", () => {
  let accountId: string;
  let userId: string;
  let apiKey: string;
  let externalUserId: string;

  beforeEach(async () => {
    apiKey = randomBytes(32).toString("hex");
    externalUserId = `test-user-${randomBytes(6).toString("hex")}`;

    const apiKeyHash = createHash("sha256")
      .update(apiKey)
      .digest("hex");

    const accountPlan = await pool.query(
      `SELECT id FROM plans
       WHERE name = 'Test Account Plan'
         AND plan_type = 'account'
       LIMIT 1`
    );

    const userPlan = await pool.query(
      `SELECT id FROM plans
       WHERE name = 'Test User Plan'
         AND plan_type = 'user'
       LIMIT 1`
    );

    if (!accountPlan.rows[0] || !userPlan.rows[0]) {
      throw new Error("Test plans are missing from the test database");
    }

    const accountResult = await pool.query(
      `INSERT INTO accounts (name, api_key_hash, plan_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [
        `Test Account ${randomBytes(4).toString("hex")}`,
        apiKeyHash,
        accountPlan.rows[0].id
      ]
    );

    accountId = accountResult.rows[0].id;

    const userResult = await pool.query(
      `INSERT INTO users (account_id, external_user_id, plan_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [accountId, externalUserId, userPlan.rows[0].id]
    );

    userId = userResult.rows[0].id;
  });

  afterEach(async () => {
    await pool.query(
      "DELETE FROM usage_requests WHERE account_id = $1",
      [accountId]
    );

    await pool.query(
      "DELETE FROM user_monthly_usage WHERE user_id = $1",
      [userId]
    );

    await pool.query(
      "DELETE FROM account_monthly_usage WHERE account_id = $1",
      [accountId]
    );

    await pool.query(
      "DELETE FROM users WHERE id = $1",
      [userId]
    );

    await pool.query(
      "DELETE FROM accounts WHERE id = $1",
      [accountId]
    );
  });

  it("accepts valid usage and updates monthly counters", async () => {
    const result = await consumeUsage({
      apiKey,
      externalUserId,
      requestId: "accepted-request",
      units: 10
    });

    expect(result.status).toBe(201);
    expect(result.body.status).toBe("accepted");

    const accountUsage = await pool.query(
      `SELECT consumed_units
       FROM account_monthly_usage
       WHERE account_id = $1`,
      [accountId]
    );

    const userUsage = await pool.query(
      `SELECT consumed_units
       FROM user_monthly_usage
       WHERE user_id = $1`,
      [userId]
    );

    expect(Number(accountUsage.rows[0].consumed_units)).toBe(10);
    expect(Number(userUsage.rows[0].consumed_units)).toBe(10);
  });

  it("rejects usage that exceeds the user's monthly allowance", async () => {
    for (let i = 1; i <= 5; i++) {
      const result = await consumeUsage({
        apiKey,
        externalUserId,
        requestId: `monthly-request-${i}`,
        units: 10
      });

      expect(result.status).toBe(201);
    }

    const rejected = await consumeUsage({
      apiKey,
      externalUserId,
      requestId: "monthly-request-6",
      units: 10
    });

    expect(rejected.status).toBe(429);
    expect(rejected.body.status).toBe("rejected");
    expect(rejected.body.rejection_scope).toBe("user");

    const usage = await pool.query(
      `SELECT consumed_units
       FROM user_monthly_usage
       WHERE user_id = $1`,
      [userId]
    );

    expect(Number(usage.rows[0].consumed_units)).toBe(50);
  });

  it("does not count an idempotent replay twice", async () => {
    const input = {
      apiKey,
      externalUserId,
      requestId: "idempotent-request",
      units: 10
    };

    const first = await consumeUsage(input);
    const second = await consumeUsage(input);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.idempotentReplay).toBe(true);

    const usage = await pool.query(
      `SELECT consumed_units
       FROM user_monthly_usage
       WHERE user_id = $1`,
      [userId]
    );

    expect(Number(usage.rows[0].consumed_units)).toBe(10);
  });

  it("rejects reuse of a request ID with different input", async () => {
    const first = await consumeUsage({
      apiKey,
      externalUserId,
      requestId: "conflicting-request",
      units: 5
    });

    const second = await consumeUsage({
      apiKey,
      externalUserId,
      requestId: "conflicting-request",
      units: 10
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it("rejects a request above the user's per-request limit", async () => {
    const result = await consumeUsage({
      apiKey,
      externalUserId,
      requestId: "too-large-request",
      units: 11
    });

    expect(result.status).toBe(429);
    expect(result.body.rejection_scope).toBe("user");

    const usage = await pool.query(
      `SELECT consumed_units
       FROM user_monthly_usage
       WHERE user_id = $1`,
      [userId]
    );

    expect(Number(usage.rows[0].consumed_units)).toBe(0);
  });

  it("does not exceed the monthly allowance with concurrent requests", async () => {
    const requests = Array.from({ length: 6 }, (_, index) =>
      consumeUsage({
        apiKey,
        externalUserId,
        requestId: `concurrent-request-${index}`,
        units: 10
      })
    );

    const results = await Promise.all(requests);

    const accepted = results.filter(
      (result) => result.status === 201
    );

    const rejected = results.filter(
      (result) => result.status === 429
    );

    expect(accepted).toHaveLength(5);
    expect(rejected).toHaveLength(1);

    const accountUsage = await pool.query(
      `SELECT consumed_units
       FROM account_monthly_usage
       WHERE account_id = $1`,
      [accountId]
    );

    const userUsage = await pool.query(
      `SELECT consumed_units
       FROM user_monthly_usage
       WHERE user_id = $1`,
      [userId]
    );

    expect(Number(accountUsage.rows[0].consumed_units)).toBe(50);
    expect(Number(userUsage.rows[0].consumed_units)).toBe(50);
  });
});