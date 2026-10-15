
import { Router } from "express";
import { createHash } from "node:crypto";
import pool from "../db/pool.js";

const router = Router();

router.post("/", async (req, res) => {
  const { externalUserId, planId } = req.body;
  const apiKey = req.header("x-api-key");

  if (
    !apiKey ||
    typeof externalUserId !== "string" ||
    externalUserId.trim().length === 0 ||
    externalUserId.trim().length > 150 ||
    typeof planId !== "string"
  ) {
    res.status(400).json({
      error: "API key, externalUserId, and planId are required"
    });
    return;
  }

  const apiKeyHash = createHash("sha256")
    .update(apiKey)
    .digest("hex");

  try {
    const accountResult = await pool.query(
      `SELECT id
       FROM accounts
       WHERE api_key_hash = $1`,
      [apiKeyHash]
    );

    if (accountResult.rowCount === 0) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    const accountId = accountResult.rows[0].id;

    
    const planResult = await pool.query(
  `SELECT id
   FROM plans
   WHERE id = $1
     AND plan_type = 'user'
     AND (
       is_predefined = true
       OR owner_account_id = $2
     )
   LIMIT 1`,
    [planId, accountId]
    );

    if (planResult.rowCount === 0) {
      res.status(400).json({ error: "Invalid user plan" });
      return;
    }

    const userResult = await pool.query(
      `INSERT INTO users (account_id, external_user_id, plan_id)
       VALUES ($1, $2, $3)
       RETURNING id, account_id, external_user_id, plan_id, created_at`,
      [accountId, externalUserId.trim(), planId]
    );

    res.status(201).json({ user: userResult.rows[0] });
  } catch (error) {
    console.error("Failed to create user:", error);

    res.status(500).json({
      error: "Internal server error"
    });
  }
});

export default router;