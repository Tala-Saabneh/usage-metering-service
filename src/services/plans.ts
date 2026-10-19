import pool from "../db/pool.js";

export const PLAN_COLUMNS = `
  id,
  name,
  plan_type,
  monthly_allowance,
  max_units_per_request,
  created_at
`;

export async function findAssignablePlan(
  planId: string,
  accountId: string,
  planType: "account" | "user"
) {
  const result = await pool.query(
    `
      SELECT ${PLAN_COLUMNS}
      FROM plans
      WHERE id = $1
        AND plan_type = $2
        AND (
          is_predefined = TRUE
          OR owner_account_id = $3
        )
      LIMIT 1
    `,
    [planId, planType, accountId]
  );

  return result.rows[0] ?? null;
}
