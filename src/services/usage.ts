import { createHash } from "node:crypto";
import pool from "../db/pool.js";

type ConsumeInput = {
  apiKey: string;
  externalUserId: string;
  requestId: string;
  units: number;
};

export async function consumeUsage(input: ConsumeInput) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const apiKeyHash = createHash("sha256")
      .update(input.apiKey)
      .digest("hex");

    const accountResult = await client.query(
      `SELECT
         a.id AS account_id,
         p.monthly_allowance AS account_allowance,
         p.max_units_per_request AS account_request_limit
       FROM accounts a
       JOIN plans p ON p.id = a.plan_id
       WHERE a.api_key_hash = $1
       FOR UPDATE OF a`,
      [apiKeyHash]
    );

    if (accountResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return {
        status: 401,
        body: { error: "Invalid API key" }
      };
    }

    const account = accountResult.rows[0];

    const previousResult = await client.query(
      `SELECT
         ur.id,
         ur.user_id,
         ur.units,
         ur.status,
         ur.rejection_scope,
         ur.rejection_reason,
         ur.usage_month,
         u.external_user_id
       FROM usage_requests ur
       JOIN users u ON u.id = ur.user_id
       WHERE ur.account_id = $1
         AND ur.request_id = $2`,
      [account.account_id, input.requestId]
    );

    if (previousResult.rowCount && previousResult.rowCount > 0) {
      const previous = previousResult.rows[0];

      if (
        previous.external_user_id !== input.externalUserId ||
        Number(previous.units) !== input.units
      ) {
        await client.query("ROLLBACK");
        return {
          status: 409,
          body: {
            error: "requestId was already used with different input"
          }
        };
      }

      await client.query("COMMIT");

      return {
        status: 200,
        body: {
          ...previous,
          idempotentReplay: true
        }
      };
    }

    const userResult = await client.query(
      `SELECT
         u.id AS user_id,
         p.monthly_allowance AS user_allowance,
         p.max_units_per_request AS user_request_limit
       FROM users u
       JOIN plans p ON p.id = u.plan_id
       WHERE u.account_id = $1
         AND u.external_user_id = $2
       FOR UPDATE OF u`,
      [account.account_id, input.externalUserId]
    );

    if (userResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return {
        status: 404,
        body: { error: "User not found for this account" }
      };
    }

    const user = userResult.rows[0];

    const now = new Date();
    const usageMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    )
      .toISOString()
      .slice(0, 10);

    await client.query(
      `INSERT INTO account_monthly_usage
         (account_id, usage_month, consumed_units)
       VALUES ($1, $2, 0)
       ON CONFLICT (account_id, usage_month) DO NOTHING`,
      [account.account_id, usageMonth]
    );

    await client.query(
      `INSERT INTO user_monthly_usage
         (user_id, usage_month, consumed_units)
       VALUES ($1, $2, 0)
       ON CONFLICT (user_id, usage_month) DO NOTHING`,
      [user.user_id, usageMonth]
    );

    const accountUsageResult = await client.query(
      `SELECT consumed_units
       FROM account_monthly_usage
       WHERE account_id = $1 AND usage_month = $2
       FOR UPDATE`,
      [account.account_id, usageMonth]
    );

    const userUsageResult = await client.query(
      `SELECT consumed_units
       FROM user_monthly_usage
       WHERE user_id = $1 AND usage_month = $2
       FOR UPDATE`,
      [user.user_id, usageMonth]
    );

    const accountConsumed = Number(
      accountUsageResult.rows[0].consumed_units
    );

    const userConsumed = Number(
      userUsageResult.rows[0].consumed_units
    );

    let rejectionScope: "account" | "user" | null = null;
    let rejectionReason: string | null = null;

    if (input.units > Number(account.account_request_limit)) {
      rejectionScope = "account";
      rejectionReason = "Request exceeds account per-request limit";
    } else if (input.units > Number(user.user_request_limit)) {
      rejectionScope = "user";
      rejectionReason = "Request exceeds user per-request limit";
    } else if (
      accountConsumed + input.units >
      Number(account.account_allowance)
    ) {
      rejectionScope = "account";
      rejectionReason = "Account monthly allowance exceeded";
    } else if (
      userConsumed + input.units >
      Number(user.user_allowance)
    ) {
      rejectionScope = "user";
      rejectionReason = "User monthly allowance exceeded";
    }

    if (rejectionScope !== null) {
      const rejectedResult = await client.query(
        `INSERT INTO usage_requests (
           account_id, user_id, request_id, units,
           status, rejection_scope, rejection_reason, usage_month
         )
         VALUES ($1, $2, $3, $4, 'rejected', $5, $6, $7)
         RETURNING *`,
        [
          account.account_id,
          user.user_id,
          input.requestId,
          input.units,
          rejectionScope,
          rejectionReason,
          usageMonth
        ]
      );

      await client.query("COMMIT");

      return {
        status: 429,
        body: rejectedResult.rows[0]
      };
    }

    await client.query(
      `UPDATE account_monthly_usage
       SET consumed_units = consumed_units + $1
       WHERE account_id = $2 AND usage_month = $3`,
      [input.units, account.account_id, usageMonth]
    );

    await client.query(
      `UPDATE user_monthly_usage
       SET consumed_units = consumed_units + $1
       WHERE user_id = $2 AND usage_month = $3`,
      [input.units, user.user_id, usageMonth]
    );

    const acceptedResult = await client.query(
      `INSERT INTO usage_requests (
         account_id, user_id, request_id, units,
         status, rejection_scope, rejection_reason, usage_month
       )
       VALUES ($1, $2, $3, $4, 'accepted', NULL, NULL, $5)
       RETURNING *`,
      [
        account.account_id,
        user.user_id,
        input.requestId,
        input.units,
        usageMonth
      ]
    );

    await client.query("COMMIT");

    return {
      status: 201,
      body: acceptedResult.rows[0]
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
