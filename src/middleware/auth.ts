import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import pool from "../db/pool.js";

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = req.header("x-api-key");

    if (!apiKey) {
      res.status(401).json({ error: "API key is required" });
      return;
    }

    const result = await pool.query(
      "SELECT id FROM accounts WHERE api_key_hash = $1",
      [hashApiKey(apiKey)]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    res.locals.accountId = result.rows[0].id;
    next();
  } catch (error) {
    next(error);
  }
}
