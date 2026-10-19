# Usage Metering and Quota Service
## Test Results and Verification Report

**Project:** Usage Metering and Quota Service  
**Category:** Backend API, Usage Tracking, and Quota Enforcement  
**Technology Stack:** TypeScript, Express.js, PostgreSQL, Docker Compose  
**Test Environment:** Local development environment  
**Report Date:** October 19, 2026

---

## 1. Overview

This document records the functional verification of the Usage Metering and Quota Service. It provides evidence of API behavior, usage tracking, quota enforcement, request validation, idempotency, and usage reporting.

Screenshots are included to demonstrate the observed results of the executed test cases.

Only tests that have been executed should be marked as **PASS** or **FAIL**. Tests that have not yet been verified must remain **PENDING**.

## 2. Test Summary

| Test ID | Test Scenario | Expected HTTP Status | Result |
|---|---|---|---|
| TC-01 | Successful Usage Request | 201 Created | Pending |
| TC-02 | User Quota Rejection | 429 Too Many Requests | Pending |
| TC-03 | Account Quota Rejection | 429 Too Many Requests | Pending |
| TC-04 | Duplicate Request Handling | 200 OK on identical retry | Pending |
| TC-05 | Invalid API Key | 401 Unauthorized | Pending |
| TC-06 | Usage Report Verification | 200 OK | Pending |

**Note:** HTTP status codes above describe the expected behavior for these scenarios. The actual responses must be checked against the running application.

---

## 3. Detailed Test Cases

### TC-01 — Successful Usage Request

**Objective:** Verify that a valid usage request is accepted and recorded by the service.

**Test Procedure:**
1. Submit a valid usage request for an existing user.
2. Provide a valid account API key.
3. Use a unique request ID and a positive integer for the requested units.
4. Inspect the HTTP response.

**Expected Result:**
- The API returns `201 Created`.
- The response indicates that the request was accepted.
- The accepted usage is recorded correctly.

**Actual Result:** To be documented after verification.

**Status:** PENDING

**Evidence:**

<img width="1421" height="772" alt="image" src="https://github.com/user-attachments/assets/9fb3c500-3882-4b08-864e-85edb666d4d1" />

<img width="1402" height="515" alt="image" src="https://github.com/user-attachments/assets/7f2adeea-a42a-4a32-a586-278fde60717b" />

---

### TC-02 — User Quota Rejection

**Objective:** Verify that a request is rejected when the user exceeds their monthly usage allowance.

**Test Procedure:**
1. Use a user with a known monthly usage limit.
2. Submit valid requests until the user's remaining allowance is insufficient.
3. Submit an additional request that exceeds the remaining allowance.
4. Inspect the response and verify that the rejection is associated with the user quota.

**Expected Result:**
- The API returns `429 Too Many Requests`.
- The response identifies the user quota as the rejection reason, where supported by the API.
- Rejected usage is not added to accepted usage totals.

**Actual Result:** To be documented after verification.

**Status:** PENDING

**Evidence:**

<img width="1262" height="870" alt="image" src="https://github.com/user-attachments/assets/f3ddebc6-c083-4329-a81c-9b5ef013c47a" />
<img width="1222" height="370" alt="image" src="https://github.com/user-attachments/assets/564d065d-fd42-4818-9cd8-1559d06fc5cf" />
<img width="1282" height="542" alt="image" src="https://github.com/user-attachments/assets/fac7e536-fc1f-4b00-af97-0455aade3c73" />


---

### TC-03 — Account Quota Rejection

**Objective:** Verify that the shared monthly account allowance is enforced across users belonging to the same account.

**Test Procedure:**
1. Use an account with a known monthly usage allowance.
2. Submit accepted requests through users associated with that account.
3. Consume the shared account allowance until an additional request exceeds it.
4. Inspect the rejection response and the account usage report.

**Expected Result:**
- The API returns `429 Too Many Requests`.
- The response identifies the account quota as the rejection reason, where supported by the API.
- The shared account allowance is enforced across its users.
- The rejected request does not increase accepted usage.

**Actual Result:** To be documented after verification.

**Status:** PENDING

**Evidence:**

<img width="1233" height="435" alt="image" src="https://github.com/user-attachments/assets/5fa2884e-c178-45ae-9a38-0c55f6f2585f" />

<img width="1327" height="777" alt="image" src="https://github.com/user-attachments/assets/72c9d32d-2b0c-46b3-a845-adbf90eb5ad9" />


---

### TC-04 — Duplicate Request and Idempotency

**Objective:** Verify that retrying the same request does not cause usage to be counted twice.

**Test Procedure:**
1. Submit a valid usage request with a unique request ID.
2. Submit the same request again using the same request ID and identical payload.
3. Compare both responses and inspect the resulting usage totals.

**Expected Result:**
- The service handles the repeated request according to its idempotency rules.
- The same request is not counted twice.
- The API returns the documented duplicate-request response.

**Actual Result:** To be documented after verification.

**Status:** PENDING

**Evidence:**

<img width="1225" height="457" alt="image" src="https://github.com/user-attachments/assets/2115c2fe-303e-40d1-917f-cbedd3bce4cd" />
<img width="1228" height="440" alt="image" src="https://github.com/user-attachments/assets/e9bb5b99-d9b8-45fa-82ac-99f52c6198dd" />
<img width="1238" height="711" alt="image" src="https://github.com/user-attachments/assets/5ad85b71-04dc-4a3d-aecd-9560e6d80c78" />


---

### TC-05 — Invalid API Key

**Objective:** Verify that unauthenticated requests are rejected.

**Test Procedure:**
1. Submit a protected API request using an invalid API key.
2. Inspect the HTTP response.

**Expected Result:**
- The API returns `401 Unauthorized`.
- The protected operation is not performed.
- No unauthorized usage is recorded.

**Actual Result:** To be documented after verification.

**Status:** PENDING

**Evidence:**

<img width="1267" height="537" alt="image" src="https://github.com/user-attachments/assets/29dd0840-3782-4cab-94d1-441974df83f0" />
<img width="396" height="122" alt="image" src="https://github.com/user-attachments/assets/8eb631bd-204f-4c83-9317-44e7aaff4fb7" />

---

### TC-06 — Usage Report Verification

**Objective:** Verify that the usage report reflects recorded requests and usage totals correctly.

**Test Procedure:**
1. Submit one or more accepted usage requests.
2. Open the usage summary or request history.
3. Compare the displayed totals with the known test requests.

**Expected Result:**
- The report returns successfully.
- Accepted usage and request history are consistent with the recorded test activity.
- Rejected requests are represented according to the service's reporting rules.

**Actual Result:** To be documented after verification.

**Status:** PENDING

**Evidence:**

<img width="1193" height="848" alt="image" src="https://github.com/user-attachments/assets/52cd8317-643e-4b0c-bb3b-db9967942440" />


---

## 4. Automated Verification

The following checks were executed during development.

| Verification | Observed Result |
|---|---|
| TypeScript type checking | Passed |
| Production build | Passed |
| Automated test suite | 27 tests passed |
| Application health endpoint | Healthy; database connected |
| Client availability | HTTP 200 OK |
| Load test | 100 requests completed successfully |

### Load Test Observation

The recorded local load test used 100 requests with a concurrency level of 10.

| Metric | Observed Value |
|---|---:|
| Total Requests | 100 |
| Successful Responses | 100 |
| Server Errors | 0 |
| Duration | 756.39 ms |
| Throughput | 132.21 requests/second |
| Average Latency | 72.27 ms |
| P95 Latency | 116.04 ms |

These figures represent one local test run. They should not be interpreted as a production capacity guarantee.

---

## 5. Conclusion

This report provides a structured record of the service's functional and automated verification. The documented test cases cover successful usage submission, user and account quota enforcement, idempotency, authentication, and usage reporting.

Final test statuses and screenshots should reflect the actual observed behavior of the application. Any pending scenarios must be executed before this report is considered complete.

