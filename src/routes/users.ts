import { Router } from "express";
import pool from "../db/pool.js";
import { requireApiKey } from "../middleware/auth.js";
import {
  isUuid,
  parsePagination,
  validExternalUserId
} from "../lib/validation.js";
import { findAssignablePlan } from "../services/plans.js";

const router = Router();

router.use(requireApiKey);

router.post("/", async (req, res, next) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "A JSON object body is required" });
    return;
  }

  const { externalUserId, planId } = req.body;
  const accountId = res.locals.accountId as string;

  if (!validExternalUserId(externalUserId) || !isUuid(planId)) {
    res.status(400).json({
      error: "A valid externalUserId and planId are required"
    });
    return;
  }

  try {
    const plan = await findAssignablePlan(planId, accountId, "user");

    if (!plan) {
      res.status(400).json({ error: "Invalid user plan" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO users (account_id, external_user_id, plan_id)
       VALUES ($1, $2, $3)
       RETURNING id, account_id, external_user_id, plan_id, created_at`,
      [accountId, externalUserId.trim(), planId]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  const accountId = res.locals.accountId as string;
  const pagination = parsePagination(req.query as Record<string, unknown>);

  if (!pagination) {
    res.status(400).json({
      error: "limit must be between 1 and 100 and offset must be non-negative"
    });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.external_user_id AS "externalUserId",
         u.plan_id AS "planId",
         p.name AS "planName",
         u.created_at AS "createdAt"
       FROM users u
       JOIN plans p ON p.id = u.plan_id
       WHERE u.account_id = $1
       ORDER BY u.created_at DESC, u.id
       LIMIT $2 OFFSET $3`,
      [accountId, pagination.limit, pagination.offset]
    );

    res.status(200).json({
      count: result.rows.length,
      limit: pagination.limit,
      offset: pagination.offset,
      users: result.rows
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  const accountId = res.locals.accountId as string;
  const userId = req.params.id;

  if (!isUuid(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.external_user_id AS "externalUserId",
         u.plan_id AS "planId",
         p.name AS "planName",
         u.created_at AS "createdAt"
       FROM users u
       JOIN plans p ON p.id = u.plan_id
       WHERE u.id = $1
         AND u.account_id = $2`,
      [userId, accountId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/plan", async (req, res, next) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "A JSON object body is required" });
    return;
  }

  const accountId = res.locals.accountId as string;
  const userId = req.params.id;
  const { planId } = req.body;

  if (!isUuid(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  if (!isUuid(planId)) {
    res.status(400).json({ error: "A valid planId is required" });
    return;
  }

  try {
    const plan = await findAssignablePlan(planId, accountId, "user");

    if (!plan) {
      res.status(400).json({ error: "Invalid user plan" });
      return;
    }

    const result = await pool.query(
      `UPDATE users
       SET plan_id = $1
       WHERE id = $2
         AND account_id = $3
       RETURNING id, account_id, external_user_id, plan_id, created_at`,
      [planId, userId, accountId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
