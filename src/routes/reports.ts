import { Router } from "express";
import pool from "../db/pool.js";
import { requireApiKey } from "../middleware/auth.js";

const router = Router();

router.use(requireApiKey);

function getMonth(value: unknown): string | null {
  if (value === undefined) {
    const now = new Date();

    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    )
      .toISOString()
      .slice(0, 10);
  }

  if (
    typeof value !== "string" ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)
  ) {
    return null;
  }

  return `${value}-01`;
}

function validExternalUserId(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 150
  );
}

function parseLimit(value: unknown): number | null {
  if (value === undefined) {
    return 20;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  const limit = Number(value);

  return Number.isSafeInteger(limit) && limit >= 1 && limit <= 100
    ? limit
    : null;
}

function parseOffset(value: unknown): number | null {
  if (value === undefined) {
    return 0;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  const offset = Number(value);

  return Number.isSafeInteger(offset) && offset >= 0
    ? offset
    : null;
}

router.get("/summary", async (req, res, next) => {
  const accountId = res.locals.accountId as string;
  const month = getMonth(req.query.month);
  const externalUserId = req.query.externalUserId;

  if (!month) {
    res.status(400).json({
      error: "month must use YYYY-MM format"
    });
    return;
  }

  if (
    externalUserId !== undefined &&
    !validExternalUserId(externalUserId)
  ) {
    res.status(400).json({
      error: "Invalid externalUserId"
    });
    return;
  }

  try {
    const accountResult = await pool.query(
      `SELECT
         a.id AS account_id,
         a.name AS account_name,
         p.name AS plan_name,
         p.monthly_allowance AS monthly_allowance,
         COALESCE(u.consumed_units, 0) AS consumed_units
       FROM accounts a
       JOIN plans p ON p.id = a.plan_id
       LEFT JOIN account_monthly_usage u
         ON u.account_id = a.id
        AND u.usage_month = $2::date
       WHERE a.id = $1`,
      [accountId, month]
    );

    if (accountResult.rowCount === 0) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const account = accountResult.rows[0];
    const accountAllowance = Number(account.monthly_allowance);
    const accountConsumed = Number(account.consumed_units);

    const response: Record<string, unknown> = {
      month: month.slice(0, 7),
      account: {
        id: account.account_id,
        name: account.account_name,
        plan: account.plan_name,
        monthlyAllowance: accountAllowance,
        consumedUnits: accountConsumed,
        remainingUnits: Math.max(
          0,
          accountAllowance - accountConsumed
        )
      }
    };

    if (typeof externalUserId === "string") {
      const userResult = await pool.query(
        `SELECT
           u.external_user_id,
           p.name AS plan_name,
           p.monthly_allowance AS monthly_allowance,
           COALESCE(m.consumed_units, 0) AS consumed_units
         FROM users u
         JOIN plans p ON p.id = u.plan_id
         LEFT JOIN user_monthly_usage m
           ON m.user_id = u.id
          AND m.usage_month = $3::date
         WHERE u.account_id = $1
           AND u.external_user_id = $2`,
        [accountId, externalUserId.trim(), month]
      );

      if (userResult.rowCount === 0) {
        res.status(404).json({
          error: "User not found for this account"
        });
        return;
      }

      const user = userResult.rows[0];
      const allowance = Number(user.monthly_allowance);
      const consumed = Number(user.consumed_units);

      response.user = {
        externalUserId: user.external_user_id,
        plan: user.plan_name,
        monthlyAllowance: allowance,
        consumedUnits: consumed,
        remainingUnits: Math.max(0, allowance - consumed)
      };
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

router.get("/history", async (req, res, next) => {
  const accountId = res.locals.accountId as string;
  const month = getMonth(req.query.month);
  const externalUserId = req.query.externalUserId;
  const limit = parseLimit(req.query.limit);
  const offset = parseOffset(req.query.offset);

  if (!month) {
    res.status(400).json({
      error: "month must use YYYY-MM format"
    });
    return;
  }

  if (limit === null) {
    res.status(400).json({
      error: "limit must be an integer between 1 and 100"
    });
    return;
  }

  if (offset === null) {
    res.status(400).json({
      error: "offset must be a non-negative integer"
    });
    return;
  }

  if (
    externalUserId !== undefined &&
    !validExternalUserId(externalUserId)
  ) {
    res.status(400).json({
      error: "Invalid externalUserId"
    });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
         r.id,
         r.request_id AS "requestId",
         u.external_user_id AS "externalUserId",
         r.units,
         r.status,
         r.rejection_scope AS "rejectionScope",
         r.rejection_reason AS "rejectionReason",
         r.usage_month::text AS month,
         r.created_at AS "createdAt"
       FROM usage_requests r
       JOIN users u ON u.id = r.user_id
       WHERE r.account_id = $1
         AND r.usage_month = $2::date
         AND (
           $3::text IS NULL
           OR u.external_user_id = $3
         )
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT $4 OFFSET $5`,
      [
        accountId,
        month,
        typeof externalUserId === "string"
          ? externalUserId.trim()
          : null,
        limit,
        offset
      ]
    );

    res.status(200).json({
      month: month.slice(0, 7),
      count: result.rows.length,
      limit,
      offset,
      history: result.rows
    });
  } catch (error) {
    next(error);
  }
});

export default router;
