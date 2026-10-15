
import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import pool from "../db/pool.js";

const router = Router();

router.post("/", async (req, res) => {
  const { name, planId } = req.body;

  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.trim().length > 150 ||
    typeof planId !== "string"
  ) {
    res.status(400).json({
      error: "A valid account name and planId are required"
    });
    return;
  }

  const client = await pool.connect();

  try {
    const planResult = await client.query(
      `SELECT id
       FROM plans
       WHERE id = $1
         AND plan_type = 'account'
         AND is_predefined = true
       LIMIT 1`,
      [planId]
    );

    if (planResult.rowCount === 0) {
      res.status(400).json({
        error: "Invalid account plan"
      });
      return;
    }

    const apiKey = randomBytes(32).toString("hex");
    const apiKeyHash = createHash("sha256")
      .update(apiKey)
      .digest("hex");

    const accountResult = await client.query(
      `INSERT INTO accounts (name, api_key_hash, plan_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, plan_id, created_at`,
      [name.trim(), apiKeyHash, planId]
    );

    res.status(201).json({
      account: accountResult.rows[0],
      apiKey
    });
  } catch (error) {
    console.error("Failed to create account:", error);
    res.status(500).json({
      error: "Internal server error"
    });
  } finally {
    client.release();
  }
});

export default router;
