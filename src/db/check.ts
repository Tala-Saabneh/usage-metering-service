
import pool from "./pool.js";

async function checkDatabase(): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS username
    `);

    console.log("Database connection successful!");
    console.log(result.rows[0]);

    const plans = await pool.query(`
      SELECT
        name,
        plan_type,
        monthly_allowance,
        max_units_per_request
      FROM plans
      ORDER BY plan_type, monthly_allowance
    `);

    console.log("Available plans:");
    console.table(plans.rows);
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

checkDatabase();
