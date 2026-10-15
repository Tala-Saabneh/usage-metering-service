# Usage Metering and Quota Service

A TypeScript-based REST API for tracking usage and enforcing monthly quotas for accounts and their users. The service supports API-key authentication, configurable plans, idempotent usage requests, and monthly usage reports.

## Features

* Account creation with API-key authentication.
* User management within accounts.
* Predefined and custom usage plans.
* Account-level and user-level monthly usage allowances.
* Per-request usage limits.
* Idempotent usage requests using unique request IDs.
* Usage history and monthly summary endpoints.
* Transaction-based quota enforcement to protect concurrent requests.
* PostgreSQL persistence.
* Automated tests with Vitest and Supertest.

## Tech Stack

* Node.js
* TypeScript
* Express
* PostgreSQL
* Vitest
* Supertest

## Prerequisites

Install the following before running the service:

* Node.js
* npm
* PostgreSQL

## Installation

Clone the repository and enter its directory:

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd usage-metering-service
npm install
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the actual repository URL.

## Environment Configuration

Create a local `.env` file in the project root:

```dotenv
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=usage_metering
DB_USER=metering_user
DB_PASSWORD=your_local_database_password
```

Replace the database credentials with your local configuration. Never commit `.env` or real credentials to GitHub.

Create the database and configure the PostgreSQL user according to your local setup. Ensure the required database tables and schema have been initialized before starting the service.

## Running the Service

Start the development server:

```bash
npm run dev
```

Build the TypeScript project:

```bash
npm run build
```

Start the compiled application:

```bash
npm start
```

Check the health endpoint:

```bash
curl http://localhost:3000/health
```

A successful response indicates that the service and database connection are available.

## API Overview

| Method | Endpoint             | Purpose                           |
| ------ | -------------------- | --------------------------------- |
| GET    | `/health`            | Check service and database health |
| POST   | `/api/accounts`      | Create an account                 |
| POST   | `/api/users`         | Create a user within an account   |
| POST   | `/api/plans`         | Create a custom plan              |
| GET    | `/api/plans`         | List available plans              |
| POST   | `/api/usage`         | Submit a usage request            |
| GET    | `/api/usage/summary` | Retrieve monthly usage totals     |
| GET    | `/api/usage/history` | Retrieve usage request history    |

Protected endpoints use the `x-api-key` request header where required. Refer to the route implementations for exact request fields and response formats.

## Usage Request Example

```bash
curl -X POST http://localhost:3000/api/usage \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ACCOUNT_API_KEY" \
  -d '{
    "externalUserId": "user-001",
    "requestId": "request-001",
    "units": 10
  }'
```

Replace the example API key with the key returned when creating your account. Do not publish real API keys.

The service checks request limits and monthly account and user allowances before accepting usage. Repeating a request with the same request ID and identical input does not consume the quota again.

## Monthly Usage Reports

Retrieve a monthly summary:

```bash
curl "http://localhost:3000/api/usage/summary?month=2026-10" \
  -H "x-api-key: YOUR_ACCOUNT_API_KEY"
```

Retrieve usage history:

```bash
curl "http://localhost:3000/api/usage/history?month=2026-10" \
  -H "x-api-key: YOUR_ACCOUNT_API_KEY"
```

The month parameter uses the `YYYY-MM` format. Check the route implementation for supported optional filters and pagination parameters.

## Testing

Run the automated tests:

```bash
npm test
```

The test script uses the `usage_metering_test` database. Create and initialize this separate test database before running the tests. Never point automated tests at a production database.

## Project Structure

```text
src/
  app.ts
  index.ts
  db/
    check.ts
    pool.ts
  routes/
    accounts.ts
    plans.ts
    reports.ts
    usage.ts
    users.ts
  services/
    usage.ts
tests/
  health.test.ts
  usage.test.ts
```

## Security Notes

* Store only API-key hashes in the database.
* Keep API keys and database passwords out of source control.
* Use a separate database for automated tests.
* Validate incoming request data before processing usage.
* Use HTTPS and appropriate secret management in production.

## License

License information has not yet been specified.
