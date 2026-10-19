# Load Test Results

## Environment

- Test date: October 19, 2026
- Deployment: Local Docker Compose
- Endpoint: `POST /api/usage`
- Database: PostgreSQL 16
- Tool: Node.js built-in Fetch API
- Account plan: Pro
- User plan: Premium
- Request payload: One usage unit per unique request ID

## Reproduction

Start the services:

```bash
docker compose up --build -d
```

Run the test:

```bash
LOAD_REQUESTS=100 LOAD_CONCURRENCY=10 node scripts/load-test.mjs
```

## Measured Results

| Metric | Result |
|---|---:|
| Total requests | 100 |
| Concurrency | 10 |
| Total duration | 756.39 ms |
| Throughput | 132.21 requests/second |
| Minimum latency | 58.48 ms |
| Average latency | 72.27 ms |
| P50 latency | 65.98 ms |
| P95 latency | 116.04 ms |
| Maximum latency | 163.35 ms |
| Accepted (HTTP 201) | 100 |
| Quota rejected (HTTP 429) | 0 |
| Other responses | 0 |
| Server/network errors | 0 |

## Interpretation

All 100 usage requests were accepted successfully. The test completed in 756.39 ms, with observed throughput of 132.21 requests per second. Average response latency was 72.27 ms, and P95 latency was 116.04 ms. No quota rejections, unexpected responses, or server errors occurred.

Before the test, the health endpoint returned HTTP 200 and confirmed that the database connection was healthy.

## Limitations

These results represent one local test run with 100 requests and concurrency of 10. They are not a production capacity guarantee. Performance depends on hardware, Docker resources, database settings, workload, and concurrency. Repeated tests and higher loads are needed for a more complete assessment.
