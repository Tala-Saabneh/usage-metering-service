import { Router } from "express";
import { createHash } from "node:crypto";
import pool from "../db/pool.js";

const router = Router();

async function getAccountId(apiKey: string) {
const apiKeyHash = createHash("sha256")
.update(apiKey)
.digest("hex");

const result = await pool.query(
`SELECT id
     FROM accounts
     WHERE api_key_hash = $1`,
[apiKeyHash]
);

if (result.rowCount === 0) {
return null;
}

return result.rows[0].id as string;
}

router.post("/", async (req, res) => {
const apiKey = req.header("x-api-key");
const {
name,
planType,
monthlyAllowance,
maxUnitsPerRequest
} = req.body;

if (!apiKey) {
res.status(401).json({ error: "API key is required" });
return;
}

if (
typeof name !== "string" ||
name.trim().length === 0 ||
name.trim().length > 100 ||
!["account", "user"].includes(planType) ||
!Number.isSafeInteger(monthlyAllowance) ||
monthlyAllowance <= 0 ||
!Number.isSafeInteger(maxUnitsPerRequest) ||
maxUnitsPerRequest <= 0 ||
maxUnitsPerRequest > monthlyAllowance
) {
res.status(400).json({
error: "Provide a valid name, planType, monthlyAllowance, and maxUnitsPerRequest"
});
return;
}

try {
const accountId = await getAccountId(apiKey);

if (!accountId) {
  res.status(401).json({ error: "Invalid API key" });
  return;
}

const result = await pool.query(
  `INSERT INTO plans (
     name,
     plan_type,
     monthly_allowance,
     max_units_per_request,
     is_predefined,
     owner_account_id
   )
   VALUES ($1, $2, $3, $4, false, $5)
   RETURNING
     id,
     name,
     plan_type,
     monthly_allowance,
     max_units_per_request,
     is_predefined,
     owner_account_id`,
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
console.error("Failed to create custom plan:", error);


res.status(500).json({
  error: "Internal server error"
});


}
});

router.get("/", async (req, res) => {
const apiKey = req.header("x-api-key");
const planType = req.query.planType;
const predefinedOnly = req.query.predefinedOnly === "true";

if (
planType !== "account" &&
planType !== "user"
) {
res.status(400).json({
error: "planType must be account or user"
});
return;
}

try {
if (predefinedOnly) {
const result = await pool.query(
`SELECT
           id,
           name,
           plan_type,
           monthly_allowance,
           max_units_per_request,
           is_predefined,
           owner_account_id
         FROM plans
         WHERE plan_type = $1
           AND is_predefined = true
         ORDER BY name ASC`,
[planType]
);


  res.status(200).json({
    count: result.rows.length,
    plans: result.rows
  });
  return;
}

if (!apiKey) {
  res.status(401).json({
    error: "API key is required"
  });
  return;
}

const accountId = await getAccountId(apiKey);

if (!accountId) {
  res.status(401).json({
    error: "Invalid API key"
  });
  return;
}

const result = await pool.query(
  `SELECT
     id,
     name,
     plan_type,
     monthly_allowance,
     max_units_per_request,
     is_predefined,
     owner_account_id
   FROM plans
   WHERE plan_type = $1
     AND (
       is_predefined = true
       OR owner_account_id = $2
     )
   ORDER BY is_predefined DESC, name ASC`,
  [planType, accountId]
);

res.status(200).json({
  count: result.rows.length,
  plans: result.rows
});


} catch (error) {
console.error("Failed to list plans:", error);


res.status(500).json({
  error: "Internal server error"
});


}
});

export default router;
