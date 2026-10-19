
cat > README.md <<'EOF'
# Usage Metering and Quota Service

A TypeScript-based REST API for tracking application usage and enforcing monthly quotas at both account and user levels.

The service allows applications to submit usage requests, validates them against configurable plans, records accepted and rejected requests, and provides usage summaries and history. It is designed to maintain accurate quota accounting even when multiple requests are processed concurrently.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Running with Docker Compose](#running-with-docker-compose)
- [Environment Configuration](#environment-configuration)
- [Authentication and Security](#authentication-and-security)
- [Plans and Quota Rules](#plans-and-quota-rules)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Idempotency and Retry Behavior](#idempotency-and-retry-behavior)
- [Usage Reports and History](#usage-reports-and-history)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Design Decisions](#design-decisions)
- [Limitations](#limitations)

## Overview

The Usage Metering and Quota Service provides a centralized way for applications to track consumption and enforce usage limits.

The service uses two levels of quota enforcement:

- **Account level:** Limits the total usage shared by all users belonging to an account.
- **User level:** Limits the usage of an individual user within that account.

Every usage request must satisfy both levels of enforcement. The service records the outcome and updates usage counters transactionally to prevent concurrent requests from exceeding configured limits.

## Features

- Account creation with API-key authentication.
- Secure API-key storage using SHA-256 hashes.
- User management scoped to individual accounts.
- Predefined and account-owned custom plans.
- Separate account-level and user-level monthly allowances.
- Maximum units per request at both levels.
- Transaction-based quota enforcement.
- Idempotent usage requests using unique request IDs.
- Recording of accepted and rejected usage requests.
- Monthly usage summaries and request history.
- Pagination for supported listing and history endpoints.
- Input validation and consistent HTTP error handling.
- PostgreSQL persistence.
- Automated tests using Vitest and Supertest.
- Docker Compose configuration for running the service and its database.
- A static web client served through nginx.

## Technology Stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| TypeScript | Type-safe application development |
| Express 5 | REST API and HTTP middleware |
| PostgreSQL 16 | Persistent storage and transactional accounting |
| Vitest | Automated test runner |
| Supertest | HTTP endpoint testing |
| Docker Compose | Application and database orchestration |
| Nginx | Static client hosting and API reverse proxy |

## Architecture

The service follows a layered structure:

1. **HTTP layer:** Express routes receive requests, validate input, and return responses.
2. **Authentication layer:** API-key middleware identifies the calling account.
3. **Service layer:** Usage processing applies quota rules and coordinates database operations.
4. **Database layer:** PostgreSQL stores accounts, users, plans, request history, and monthly usage counters.
5. **Client layer:** A static web application provides an interface for interacting with the API.

### Usage request lifecycle

1. The client submits a usage request with an account API key.
2. The service authenticates the account and validates the request.
3. The service checks whether the request ID has already been processed.
4. The account and user usage records are locked and checked against their current plans.
5. The service records the decision and updates usage counters when the request is accepted.
6. The transaction commits, and the API returns the result.

All accounting changes for a usage request are handled transactionally so that request history and usage totals remain consistent.

## Getting Started

### Prerequisites

For local development, install:

- Node.js 20 or later.
- npm.
- PostgreSQL 16 or a compatible PostgreSQL installation.

For the containerized setup, Docker with the Compose plugin is required.

### Installation

Clone the repository and enter the project directory:

```bash
git clone https://github.com/Tala-Saabneh/usage-metering-service.git
cd usage-metering-service
npm install
```

### Environment Configuration

Create a local environment file:

```bash
cp .env.example .env
```

Open `.env` and configure the database credentials required by your environment. For example:

```dotenv
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=usage_metering
DB_USER=metering_user
DB_PASSWORD=your_local_database_password
DB_POOL_MAX=10
```

Use the variable names and values supported by the supplied `.env.example` and Docker Compose configuration. When running the application inside Docker Compose, the database host should be the Compose database service name rather than `localhost`.

**Security:** Never commit `.env` or real passwords, API keys, or other secrets to version control.

### Database Initialization

Create the application database and PostgreSQL user according to your local setup.

Initialize the database using the supplied SQL scripts in `db/init/`. For example, when connecting to a local PostgreSQL instance:

```bash
createdb usage_metering
psql -d usage_metering -f db/init/001-schema.sql
psql -d usage_metering -f db/init/002-seed-plans.sql
```

If these scripts have already been applied, do not run them again blindly. The database initialization scripts supplied with the project define the schema and predefined plans.

### Run in Development Mode

Start the development server:

```bash
npm run dev
```

The service listens on the configured port, which defaults to `3000` in the provided Docker configuration.

Check the health endpoint:

```bash
curl -i http://localhost:3000/health
```

A successful response returns HTTP `200 OK` and indicates that the service and database connection are healthy.

### Build and Run the Compiled Application

Build the TypeScript project:

```bash
npm run build
```

Start the compiled application:

```bash
npm start
```

Run static type checking:

```bash
npm run typecheck
```

## Running with Docker Compose

Docker Compose runs the API, PostgreSQL database, and static web client.

### 1. Configure the environment

Create `.env` and set `DB_PASSWORD` to a password appropriate for your local environment:

```bash
cp .env.example .env
```

Make sure the Compose configuration and environment variables agree.

### 2. Validate the Compose configuration

```bash
docker compose config --quiet
```

### 3. Build and start the services

```bash
docker compose up --build -d
```

### 4. Check service status

```bash
docker compose ps
```

Wait until PostgreSQL is healthy and the application is running.

### 5. Check the API

```bash
curl -i http://localhost:3000/health
```

### 6. Open the web client

- **Web client:** http://localhost:8080
- **API health:** http://localhost:3000/health

The nginx client configuration proxies API requests to the backend service.

### Stop the services

```bash
docker compose down
```

This stops and removes the Compose containers and network while retaining the named database volume.

To remove the database volume and its stored data as well, use:

```bash
docker compose down -v
```

**Warning:** The `-v` option permanently removes the Compose-managed database volume. Use it only when you intentionally want to reset the local database.

PostgreSQL initialization scripts are normally applied when the database volume is initialized for the first time. Changing an initialization script does not automatically rerun it against an existing volume.

## Authentication and Security

Account API keys authenticate protected endpoints.

- Create an account using `POST /api/accounts`.
- The response includes the generated API key.
- Store the key securely because it is returned at account creation and is not intended to be retrieved in plaintext later.
- Send the key in the `x-api-key` header for protected requests.
- The database stores the SHA-256 hash of the API key rather than the plaintext key.
- Protected operations are scoped to the authenticated account.
- Accounts cannot access another account's users, usage history, or private custom plans through the account-scoped API.
- Missing or invalid API keys result in HTTP `401 Unauthorized`.

Example authentication header:

```http
x-api-key: YOUR_ACCOUNT_API_KEY
```

Never include a real API key in source code, documentation, screenshots, public issues, or version control.

## Plans and Quota Rules

Each account has an account plan, and each registered user has a user plan.

Both plans define:

- **Monthly allowance:** The maximum number of units available during a calendar month.
- **Maximum units per request:** The maximum number of units accepted in a single request.

### Predefined Plans

The project provides the following seeded plans:

| Plan | Type | Monthly Allowance | Max Units per Request |
|---|---|---:|---:|
| Starter | Account | 1,000 | 100 |
| Pro | Account | 10,000 | 500 |
| Basic | User | 100 | 20 |
| Premium | User | 1,000 | 100 |

Predefined plans are read-only through the plan modification endpoints.

### Custom Plans

An authenticated account can create and manage its own custom plans. Custom plans can be used for the account itself or assigned to its users, subject to the plan type and ownership checks.

A custom plan belongs to the account that created it. Other accounts cannot view or modify that private plan through the protected API.

Updating a shared custom plan affects the accounts or users assigned to it. Changing a plan does not reset usage already consumed during the current month.

### Usage Decision Order

A usage request is accepted only when all four checks pass, in this order:

1. Account maximum units per request.
2. User maximum units per request.
3. Account monthly allowance.
4. User monthly allowance.

The first failing rule determines the rejection reason and scope.

When a request is accepted, its units are added to both the user's usage and the account's usage. Account usage represents the combined accepted usage of its users.

A rejected request consumes no quota, but its outcome is recorded in request history.

Monthly usage is associated with the UTC calendar month in which the request is processed. Earlier months remain available for historical reporting.

## API Reference

The following table summarizes the main endpoints. Protected endpoints require the `x-api-key` header unless explicitly stated otherwise.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Check application and database health |
| POST | `/api/accounts` | Create an account and issue its API key |
| GET | `/api/accounts/me` | Retrieve the authenticated account and its plan information |
| PATCH | `/api/accounts/me/plan` | Change the account's plan |
| GET | `/api/plans/predefined?planType=account` | List predefined account plans |
| GET | `/api/plans/predefined?planType=user` | List predefined user plans |
| GET | `/api/plans` | List plans available to the authenticated account |
| POST | `/api/plans` | Create a custom plan |
| GET | `/api/plans/:id` | Retrieve a plan visible to the authenticated account |
| PATCH | `/api/plans/:id` | Update an owned custom plan |
| POST | `/api/users` | Register a user under the authenticated account |
| GET | `/api/users` | List users belonging to the authenticated account |
| GET | `/api/users/:id` | Retrieve a user by the identifier accepted by the route |
| PATCH | `/api/users/:id/plan` | Change a user's plan |
| POST | `/api/usage` | Submit a usage request |
| GET | `/api/usage/summary` | Retrieve monthly usage totals |
| GET | `/api/usage/history` | Retrieve recorded usage request outcomes |

Listing and reporting endpoints support filters or pagination where implemented. Consult the route definitions for the exact accepted parameters and response schemas.

### Common HTTP Responses

| Status | Meaning |
|---|---|
| `200 OK` | Successful read or idempotent replay |
| `201 Created` | Resource or usage request created |
| `400 Bad Request` | Invalid input or malformed request |
| `401 Unauthorized` | API key missing or invalid |
| `403 Forbidden` | Operation is not permitted |
| `404 Not Found` | Resource not found within the accessible scope |
| `409 Conflict` | Request ID reused with different input |
| `429 Too Many Requests` | Usage request rejected by a quota rule |
| `500 Internal Server Error` | Unexpected server error |

For usage requests, a `429` response indicates that the request was rejected by a configured account or user limit. The response identifies the rejection scope and reason.

## Usage Examples

The following examples assume the API is running locally at `http://localhost:3000`.

### 1. Retrieve Predefined Account Plans

This endpoint is public and does not require an API key:

```bash
curl "http://localhost:3000/api/plans/predefined?planType=account"
```

Retrieve predefined user plans:

```bash
curl "http://localhost:3000/api/plans/predefined?planType=user"
```

Use a plan ID returned by the API in subsequent requests.

### 2. Create an Account

```bash
curl -X POST "http://localhost:3000/api/accounts" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Example Application",
    "planId": "YOUR_STARTER_PLAN_ID"
  }'
```

Save the `apiKey` from the response securely. Replace `YOUR_STARTER_PLAN_ID` with a real plan ID returned by the predefined account plans endpoint.

### 3. Register a User

Set your account API key in the shell:

```bash
export API_KEY="YOUR_ACCOUNT_API_KEY"
```

Then register a user with a predefined user plan:

```bash
curl -X POST "http://localhost:3000/api/users" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "externalUserId": "user-001",
    "planId": "YOUR_BASIC_PLAN_ID"
  }'
```

Replace `YOUR_BASIC_PLAN_ID` with the ID of the predefined Basic user plan.

### 4. Submit a Usage Request

```bash
curl -i -X POST "http://localhost:3000/api/usage" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "externalUserId": "user-001",
    "requestId": "request-001",
    "units": 10
  }'
```

A successful request returns a response indicating that the usage was accepted, together with the available usage details.

If the request exceeds a configured limit, the API returns a rejection response with the relevant scope and reason.

### 5. Retrieve a Usage Summary

```bash
curl -i \
  "http://localhost:3000/api/usage/summary?month=2026-10&externalUserId=user-001" \
  -H "x-api-key: $API_KEY"
```

The `month` parameter uses the `YYYY-MM` format. The user filter is optional where supported by the route.

### 6. Retrieve Usage History

```bash
curl -i \
  "http://localhost:3000/api/usage/history?month=2026-10&limit=10&offset=0" \
  -H "x-api-key: $API_KEY"
```

History records include usage request outcomes, including rejected requests. Use supported query parameters to filter and paginate the results.

### 7. Create a Custom Plan

```bash
curl -i -X POST "http://localhost:3000/api/plans" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "Custom User Plan",
    "planType": "user",
    "monthlyAllowance": 500,
    "maxUnitsPerRequest": 50
  }'
```

The plan type must be `account` or `user`. The per-request limit must be valid for the monthly allowance.

### 8. Update a Custom Plan

```bash
curl -i -X PATCH "http://localhost:3000/api/plans/YOUR_CUSTOM_PLAN_ID" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "monthlyAllowance": 750
  }'
```

Replace the example ID with a custom plan owned by the authenticated account. Predefined plans cannot be modified.

## Idempotency and Retry Behavior

Each usage request includes a `requestId` that is unique within the account.

The service supports idempotent retries:

- Repeating a request with the same request ID and identical input returns the previously recorded outcome.
- An idempotent replay does not consume usage a second time.
- Reusing a request ID with different input, such as different units or a different user, returns HTTP `409 Conflict`.
- Rejected requests are also recorded, and their request IDs remain reserved.

If a request was rejected and the underlying issue is later resolved, submit a new request with a new request ID.

This behavior helps clients retry requests safely when a network timeout or other transient failure makes the original response uncertain.

## Usage Reports and History

The reporting endpoints expose monthly consumption and recorded request outcomes.

Reports can be used to inspect:

- The account's consumed and remaining units.
- An individual user's consumed and remaining units.
- Usage for a selected month.
- Accepted and rejected request history.
- Request outcomes and rejection reasons.
- Paginated historical results where supported.

When an allowance is reduced below existing usage, the remaining allowance is treated as zero and additional requests at that level are rejected until the allowance is increased or the next month begins.

Changing a plan does not rewrite historical request decisions or erase previously consumed usage.

## Testing

The automated test suite uses Vitest and Supertest.

### Configure the Test Database

The test script uses the `usage_metering_test` database. Create a separate test database and initialize it with the SQL files supplied by the project:

```bash
createdb usage_metering_test
```

Apply the schema and seed scripts to the test database as required by your local PostgreSQL setup. If the project includes additional test-specific SQL fixtures, apply those according to the test setup before running the suite.

**Important:** Never configure the automated test suite to run against a production database or a database containing data you need to preserve.

### Run the Checks

```bash
npm run typecheck
npm run build
npm test
```

The tests cover health checks, API behavior, input validation, authentication and account isolation, quota enforcement, usage history, and retry behavior.

The exact test coverage is defined by the test files in the repository.

## Project Structure

```text
.
├── client/
│   ├── Dockerfile
│   ├── app.js
│   ├── index.html
│   ├── style.css
│   └── nginx.conf
├── db/
│   └── init/
│       ├── 001-schema.sql
│       └── 002-seed-plans.sql
├── src/
│   ├── app.ts
│   ├── index.ts
│   ├── db/
│   │   ├── check.ts
│   │   └── pool.ts
│   ├── lib/
│   │   └── validation.ts
│   ├── middleware/
│   │   └── auth.ts
│   ├── routes/
│   │   ├── accounts.ts
│   │   ├── plans.ts
│   │   ├── reports.ts
│   │   ├── usage.ts
│   │   └── users.ts
│   └── services/
│       ├── plans.ts
│       └── usage.ts
├── tests/
│   ├── api.test.ts
│   ├── health.test.ts
│   └── usage.test.ts
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

This structure summarizes the main application components. Additional configuration files or scripts may also exist in the repository.

## Design Decisions

### Transactional Accounting

Usage processing uses PostgreSQL transactions to coordinate quota checks, counter updates, and request history. This prevents accepted usage from being counted separately from its corresponding history record.

### Account-Level Isolation

The API key identifies the account making a request. Protected data access is scoped to that account to prevent cross-account access to users, plans, and usage records.

### Idempotent Requests

A unique request ID per account makes retries safe and prevents duplicate usage from being counted more than once.

### Separate Monthly Counters

Account and user monthly usage counters support efficient reporting and enforcement while preserving historical usage across calendar months.

### Shared Custom Plans

Custom plans can be reused by multiple entities within the owning account. Updating a shared plan changes the limits applied to entities assigned to it.

## Limitations

- Account creation is not protected by an administrative authorization system.
- API-key rotation and recovery are not implemented.
- Account, user, and plan deletion are not available through the documented API.
- Rate limiting and automated key revocation are not included.
- History retention and archival policies are not configured.
- Offset-based pagination may become less efficient for very large datasets.
- A separate PostgreSQL test database is required to run the automated test suite safely.
- Production deployment requires additional operational controls, such as HTTPS, secret management, monitoring, and backup policies.

## License

A license has not yet been specified. All rights and reuse permissions should be clarified before distributing the project under an open-source license.
EOF
