const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const requestCount = Number(process.env.LOAD_REQUESTS || 100);
const concurrency = Number(process.env.LOAD_CONCURRENCY || 10);

if (
  !Number.isSafeInteger(requestCount) ||
  requestCount < 1 ||
  !Number.isSafeInteger(concurrency) ||
  concurrency < 1
) {
  console.error("LOAD_REQUESTS and LOAD_CONCURRENCY must be positive integers.");
  process.exit(1);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.apiKey ? { "x-api-key": options.apiKey } : {}),
    },
  });

  const text = await response.text();
  let body;

  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  return { status: response.status, body };
}

function percentile(values, percent) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(percent * sorted.length) - 1);
  return sorted[index] ?? 0;
}

async function main() {
  console.log("Preparing a dedicated account for the load test...");

  const accountPlansResponse = await request(
    "/api/plans/predefined?planType=account"
  );
  const userPlansResponse = await request(
    "/api/plans/predefined?planType=user"
  );

  if (accountPlansResponse.status !== 200 || userPlansResponse.status !== 200) {
    throw new Error(
      `Could not load predefined plans. Account status: ${accountPlansResponse.status}; ` +
      `user status: ${userPlansResponse.status}`
    );
  }

  const accountPlans = accountPlansResponse.body.plans || [];
  const userPlans = userPlansResponse.body.plans || [];

  const accountPlan = [...accountPlans].sort(
    (a, b) => Number(b.monthly_allowance) - Number(a.monthly_allowance)
  )[0];

  const userPlan = [...userPlans].sort(
    (a, b) => Number(b.monthly_allowance) - Number(a.monthly_allowance)
  )[0];

  if (!accountPlan || !userPlan) {
    throw new Error("No predefined account or user plans were returned.");
  }

  const accountResponse = await request("/api/accounts", {
    method: "POST",
    body: JSON.stringify({
      name: `Load Test ${new Date().toISOString()}`,
      planId: accountPlan.id,
    }),
  });

  if (accountResponse.status !== 201 || !accountResponse.body.apiKey) {
    throw new Error(
      `Account creation failed with HTTP ${accountResponse.status}: ` +
      JSON.stringify(accountResponse.body)
    );
  }

  const apiKey = accountResponse.body.apiKey;
  const externalUserId = `load-test-${Date.now()}`;

  const userResponse = await request("/api/users", {
    method: "POST",
    apiKey,
    body: JSON.stringify({
      externalUserId,
      planId: userPlan.id,
    }),
  });

  if (userResponse.status !== 201) {
    throw new Error(
      `User creation failed with HTTP ${userResponse.status}: ` +
      JSON.stringify(userResponse.body)
    );
  }

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Account plan: ${accountPlan.name}`);
  console.log(`User plan: ${userPlan.name}`);
  console.log(`Requests: ${requestCount}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log("Sending requests...");

  const results = new Array(requestCount);
  let nextIndex = 0;

  const startedAt = performance.now();

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= requestCount) return;

      const requestStartedAt = performance.now();

      try {
        const response = await request("/api/usage", {
          method: "POST",
          apiKey,
          body: JSON.stringify({
            externalUserId,
            requestId: `load-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
            units: 1,
          }),
        });

        results[index] = {
          status: response.status,
          latency: performance.now() - requestStartedAt,
          error: response.status >= 500,
          body: response.body,
        };
      } catch (error) {
        results[index] = {
          status: 0,
          latency: performance.now() - requestStartedAt,
          error: true,
          message: String(error),
        };
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, requestCount) },
      () => worker()
    )
  );

  const durationMs = performance.now() - startedAt;
  const latencies = results.map((result) => result.latency);
  const counts = {};

  for (const result of results) {
    const label = result.status === 0 ? "network_error" : String(result.status);
    counts[label] = (counts[label] || 0) + 1;
  }

  const accepted = results.filter((result) => result.status === 201).length;
  const rejected = results.filter((result) => result.status === 429).length;
  const otherResponses = requestCount - accepted - rejected;

  const summary = {
    timestamp: new Date().toISOString(),
    baseUrl,
    requestCount,
    concurrency,
    durationMs: Number(durationMs.toFixed(2)),
    requestsPerSecond: Number((requestCount / (durationMs / 1000)).toFixed(2)),
    latencyMs: {
      min: Number(Math.min(...latencies).toFixed(2)),
      average: Number((latencies.reduce((sum, value) => sum + value, 0) / latencies.length).toFixed(2)),
      p50: Number(percentile(latencies, 0.50).toFixed(2)),
      p95: Number(percentile(latencies, 0.95).toFixed(2)),
      max: Number(Math.max(...latencies).toFixed(2)),
    },
    responsesByStatus: counts,
    accepted,
    quotaRejected: rejected,
    otherResponses,
    serverErrors: results.filter((result) => result.status >= 500 || result.status === 0).length,
    unexpectedResponses: results
      .filter((result) => ![201, 429].includes(result.status))
      .slice(0, 5)
      .map((result) => ({
        status: result.status,
        body: result.body ?? result.message,
      })),
  };

  console.log("\n===== LOAD TEST RESULTS =====");
  console.log(JSON.stringify(summary, null, 2));

  if (summary.serverErrors > 0 || otherResponses > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Load test failed:", error.message || error);
  process.exitCode = 1;
});
