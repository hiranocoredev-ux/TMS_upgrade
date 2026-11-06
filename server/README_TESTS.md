# Tests

## Running

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

On Windows, if `NODE_OPTIONS=--experimental-vm-modules` in the npm script fails, run from `server/`:

```powershell
$env:NODE_OPTIONS="--experimental-vm-modules"; npx jest
```

## Requirements

- MongoDB running (default: `MONGO_URI_TEST` or `MONGO_URI` or `mongodb://localhost:27017/teammanagement_test`)
- `JWT_SECRET` (or default test secret)
- `ENCRYPTION_KEY` (32+ bytes) for encryption-related tests

## Test Files

| File | Scope |
|------|--------|
| `__tests__/security.test.js` | Personal profile access, freelancer password masking, file download access, job-ticket move-stage + audit, audit log without decrypted secrets |
| `__tests__/smoke.test.js` | Finance team-summary admin-only; finance summary totals and goalProgress vs transactions/goals; interview board `PATCH .../tickets/:id/move-stage` + InterviewActivityLog (STAGE_MOVE) + AuditLog (INTERVIEW_TICKET_STAGE_MOVE) |
| `__tests__/jobProfile.test.js` | Job profile CRUD |
| `__tests__/jobProfileFileUpload.test.js` | Job profile file uploads |
| `__tests__/sanitizer.test.js` | Input sanitization |
| `tests/financeCalculations.test.js` | `getAvailableBudget` and finance calculation helpers |

## Coverage (by suite)

- **Security**: Owner-only access, sensitive masking, file access, move-stage history and audit, no secrets in audit meta.
- **Smoke**: Permissions (team-summary admin-only), finance summary vs transactions, goalProgress vs FinanceGoal, interview move-stage and activity/audit logs.
- **Finance calculations**: Budget availability, exclusion of transaction, rolling vs monthly.

## Database

Tests use a separate DB (e.g. `teammanagement_test`). Collections are cleared or isolated per describe/beforeAll as needed.
