# Migration Scripts

Run from the **project root** with `node server/src/scripts/...` or from `server/` with `npm run migrate:...`. Ensure `MONGO_URI` is set in `.env`.

## 1. Role migration (`migrate-roles.js`)

Converts `BOSS` → `ADMIN`. Idempotent.

```bash
# Apply changes
npm run migrate:roles
# or: node server/src/scripts/migrate-roles.js

# Preview only (no DB writes)
npm run migrate:roles:dry
```

## 2. JobProfile migration (`migrate-job-profiles.js`)

- Sets `ownerUserId` from `assignedUserId` when missing
- Inits `attachments` to `[]` when missing
- Moves legacy `resumeFileId` into `attachments` and removes `resumeFileId`

Idempotent.

```bash
npm run migrate:job-profiles
npm run migrate:job-profiles:dry
```

## 3. Interview → InterviewTicket migration (`migrate-interviews-to-tickets.js`)

- Creates a default board per user (or one shared "Legacy" board per owner)
- Creates default stages: Scheduled, Completed, Cancelled
- Converts each legacy `Interview` into an `InterviewTicket` with `dates`/`notes`
- Writes `InterviewActivityLog` for each imported ticket
- Skips and logs rows that cannot be mapped

```bash
# One "Legacy Interviews (Migrated)" board per owner
npm run migrate:interviews

# One "Interviews" board per user
node server/src/scripts/migrate-interviews-to-tickets.js --board-per-user

# Preview only
npm run migrate:interviews:dry
```

## Order

Recommended: **1 → 2 → 3** (roles first, then JobProfiles, then Interviews).

