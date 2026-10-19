import { Router } from "express";
import pool from "../db/pool.js";
import { requireApiKey } from "../middleware/auth.js";
import {
  isPositiveInteger,
  isUuid,
  parsePagination
} from "../lib/validation.js";

const router = Router();

const PLAN_COLUMNS = `
  id,
  name,
  plan_type,
  monthly_allowance,
  max_units_per_request,
  is_predefined,
  owner_account_id,
  created_at
`;

router.get("/predefined", async (req, res, next) => {
  const planType = req.query.planType;

  if (planType !== "account" && planType !== "user") {
    res.status(400).json({
      error: "planType must be account or user"
    });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT ${PLAN_COLUMNS}
       FROM plans
       WHERE plan_type = $1
         AND is_predefined = TRUE
       ORDER BY name ASC`,
      [planType]
    );

    res.status(200).json({
      count: result.rows.length,
      plans: result.rows
    });
  } catch (error) {
    next(error);
  }
});

router.use(requireApiKey);

router.post("/", async (req, res, next) => {
  const accountId = res.locals.accountId as string;
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "A JSON object body is required" });
    return;
  }

  const {
    name,
    planType,
    monthlyAllowance,
    maxUnitsPerRequest
  } = req.body;

  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.trim().length > 100 ||
    (planType !== "account" && planType !== "user") ||
    !Number.isSafeInteger(monthlyAllowance) ||
    monthlyAllowance < 0 ||
    !isPositiveInteger(maxUnitsPerRequest) ||
    maxUnitsPerRequest > monthlyAllowance
  ) {
    res.status(400).json({
      error:
        "Provide a valid name, planType, monthlyAllowance, and maxUnitsPerRequest"
    });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO plans (
         name,
         plan_type,
         monthly_allowance,
         max_units_per_request,
         is_predefined,
         owner_account_id
       )
       VALUES ($1, $2, $3, $4, FALSE, $5)
       RETURNING ${PLAN_COLUMNS}`,
      [
        name.trim(),
        planType,
        monthlyAllowance,
        maxUnitsPerRequest,
        accountId
      ]
    );

    res.status(201).json({ plan: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  const accountId = res.locals.accountId as string;
  const planType = req.query.planType;
  const pagination = parsePagination(
    req.query as Record<string, unknown>
  );

  if (planType !== "account" && planType !== "user") {
    res.status(400).json({
      error: "planType must be account or user"
    });
    return;
  }

  if (!pagination) {
    res.status(400).json({
      error: "limit must be between 1 and 100 and offset must be non-negative"
    });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT ${PLAN_COLUMNS}
       FROM plans
       WHERE plan_type = $1
         AND (
           is_predefined = TRUE
           OR owner_account_id = $2
         )
       ORDER BY is_predefined DESC, name ASC
       LIMIT $3 OFFSET $4`,
      [
        planType,
        accountId,
        pagination.limit,
        pagination.offset
      ]
    );

    res.status(200).json({
      count: result.rows.length,
      limit: pagination.limit,
      offset: pagination.offset,
      plans: result.rows
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  const accountId = res.locals.accountId as string;
  const planId = req.params.id;

  if (!isUuid(planId)) {
    res.status(400).json({ error: "Invalid plan ID" });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT ${PLAN_COLUMNS}
       FROM plans
       WHERE id = $1
         AND (
           is_predefined = TRUE
           OR owner_account_id = $2
         )`,
      [planId, accountId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    res.status(200).json({ plan: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  const accountId = res.locals.accountId as string;
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "A JSON object body is required" });
    return;
  }

  const planId = req.params.id;
  const {
    name,
    monthlyAllowance,
    maxUnitsPerRequest
  } = req.body;

  if (!isUuid(planId)) {
    res.status(400).json({ error: "Invalid plan ID" });
    return;
  }

  if (
    (name !== undefined &&
      (typeof name !== "string" ||
        name.trim().length === 0 ||
        name.trim().length > 100)) ||
    (monthlyAllowance !== undefined &&
      (!Number.isSafeInteger(monthlyAllowance) ||
        monthlyAllowance < 0)) ||
    (maxUnitsPerRequest !== undefined &&
      !isPositiveInteger(maxUnitsPerRequest)) ||
    (name === undefined &&
      monthlyAllowance === undefined &&
      maxUnitsPerRequest === undefined)
  ) {
    res.status(400).json({
      error: "Provide valid plan fields to update"
    });
    return;
  }

  try {
    const existing = await pool.query(
      `SELECT id, name, monthly_allowance, max_units_per_request
       FROM plans
       WHERE id = $1
         AND owner_account_id = $2
         AND is_predefined = FALSE`,
      [planId, accountId]
    );

    if (existing.rowCount === 0) {
      res.status(404).json({
        error: "Custom plan not found or cannot be modified"
      });
      return;
    }

    const current = existing.rows[0];
    const nextAllowance =
      monthlyAllowance ?? Number(current.monthly_allowance);
    const nextMaxUnits =
      maxUnitsPerRequest ?? Number(current.max_units_per_request);

    if (nextMaxUnits > nextAllowance) {
      res.status(400).json({
        error: "maxUnitsPerRequest cannot exceed monthlyAllowance"
      });
      return;
    }

    const result = await pool.query(
      `UPDATE plans
       SET name = $1,
           monthly_allowance = $2,
           max_units_per_request = $3
       WHERE id = $4
         AND owner_account_id = $5
         AND is_predefined = FALSE
       RETURNING ${PLAN_COLUMNS}`,
      [
        name === undefined ? current.name : name.trim(),
        nextAllowance,
        nextMaxUnits,
        planId,
        accountId
      ]
    );

    if (result.rowCount === 0) {
      res.status(404).json({
        error: "Custom plan not found or cannot be modified"
      });
      return;
    }

    res.status(200).json({ plan: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
