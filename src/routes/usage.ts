import { Router } from "express";
import { consumeUsage } from "../services/usage.js";

const router = Router();

router.post("/", async (req, res) => {
  const apiKey = req.header("x-api-key");
  const { externalUserId, requestId, units } = req.body;

  if (
    !apiKey ||
    typeof externalUserId !== "string" ||
    externalUserId.trim().length === 0 ||
    externalUserId.trim().length > 150 ||
    typeof requestId !== "string" ||
    requestId.trim().length === 0 ||
    requestId.trim().length > 200 ||
    !Number.isSafeInteger(units) ||
    units <= 0
  ) {
    res.status(400).json({
      error: "Valid API key, externalUserId, requestId, and positive integer units are required"
    });
    return;
  }

  try {
    const result = await consumeUsage({
      apiKey,
      externalUserId: externalUserId.trim(),
      requestId: requestId.trim(),
      units
    });

    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Failed to consume usage:", error);

    res.status(500).json({
      error: "Internal server error"
    });
  }
});

export default router;
