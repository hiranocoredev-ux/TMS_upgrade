# TMS_upgrade

Team Management System: users and groups, daily/weekly/monthly reports, finance,
worktime tracking (Hubstaff), competition scoring, profiles, interviews and the
Weekly / Monthly Summarize pages.

- `server/`: Node.js + Express + MongoDB (Mongoose) API, port 3003
- `client/`: Vue 3 + Vite app, port 5173 (proxies `/api` to the server)

## Requirements

- Node.js 18 or newer
- MongoDB running locally (default `mongodb://localhost:27017/teammanagement`)

## Setup

```
npm install
copy server\.env.example server\.env
```

Edit `server/.env` and set at least `MONGO_URI`, `JWT_SECRET` and the
`SEED_SUPERADMIN_*` values. On first start the server creates the default groups
and the super admin account from those values.

## Run

```
start-app.bat
```

or in two terminals:

```
cd server
node src/server.js
```

```
cd client
npx vite
```

Then open http://localhost:5173.
