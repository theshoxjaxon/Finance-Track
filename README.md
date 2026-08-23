# Expense Tracker

A small Express API for tracking expenses, backed by a flat JSON file instead of a database.

**Repository:** https://github.com/theshoxjaxon/Finance-Track

## Tech stack

- Node.js, Express 5
- File-based storage — reads/writes `data/userdata.json` directly, no database
- `nodemon` for auto-restart during development

## Project structure

```
Expense Tracker/
├── app.js                 # entry point — creates the app, mounts the router, starts listening
├── routers/
│   └── expense.js         # route definitions
├── controllers/
│   └── expense.js         # route handlers + all file read/write logic
├── data/
│   └── userdata.json      # the "database" — a flat JSON array of records
├── package.json
└── DEBUGGING_NOTES.md      # history of bugs found/fixed while building this
```

## Setup

```bash
cd "Expense Tracker"
npm install
npm run dev
```

`npm run dev` and `npm start` both run `nodemon app.js`, so the server restarts automatically on file changes. The server listens on **http://localhost:3003**.

## API reference

Base URL: `http://localhost:3003/expense`

| Method | Path | Description |
|---|---|---|
| GET | `/expense` | List every record |
| POST | `/expense` | Create a new expense |
| GET | `/expense/:id` | Get one record by id |
| PATCH | `/expense/:id` | Update fields on a record |
| DELETE | `/expense/:id` | Delete a record |
| GET | `/expense/summary` | Totals across records that have an `amount`, optionally filtered by month |

### `GET /expense`

```json
{
  "status": "Successful",
  "statusCode": 200,
  "length": 10,
  "expenses": [ { "...": "..." } ]
}
```

### `POST /expense`

Body — any shape you want; the server just stamps an `id` onto it:

```json
{ "description": "Coffee", "amount": 5, "category": "Food" }
```

Response (`201`):

```json
{
  "status": "success",
  "results": 11,
  "data": { "data": { "id": "<generated-uuid>", "description": "Coffee", "amount": 5, "category": "Food" } }
}
```

### `GET /expense/:id`

```json
{
  "status": "Successful",
  "result": 1,
  "data": { "expense": { "id": "...", "description": "Coffee", "amount": 5 } }
}
```

`404` if no record has that `id`.

### `PATCH /expense/:id`

Body — any fields to merge into the existing record:

```json
{ "amount": 6 }
```

Response (`200`) returns the updated record. `404` if not found.

### `DELETE /expense/:id`

`204 No Content` on success, `404` if not found.

### `GET /expense/summary`

Optional `?month=` query param (1–12), filters by the `date` field's month — records with no `date` are excluded once you filter.

```bash
curl "http://localhost:3003/expense/summary?month=8"
```

```json
{
  "status": "success",
  "filter": "Month: 8",
  "count": 4,
  "totalExpenses": 90.99
}
```

(All four seed expenses happen to be dated in August, so `month=8` currently matches all of them.)

Without `?month=`, it totals every record that has an `amount` field, across all time — right now that's the same four, since nothing else in the data has an `amount`.

## Data model

A record is just whatever you POST, plus a generated `id`:

```json
{ "id": "2453f02a-bcd0-4d57-8715-2dede7907f22", "description": "Coffee", "amount": 5, "category": "Food" }
```

There's no schema enforcement — `amount`, `category`, `date`, etc. are all optional as far as the server is concerned.

## Known limitations

- **Seed data mismatch**: the four expenses the project shipped with (Lunch, Dinner, Monthly Subscriptions, Bus pass) use a Mongo-style `_id` field instead of `id`. Every lookup (`GET/PATCH/DELETE /expense/:id`) matches on `.id`, so those four specifically can't be fetched, updated, or deleted through the API right now — only records created via `POST` can.
- **No concurrency safety**: all data lives in one in-memory array, loaded from disk once at process startup and written back out on every change. Since `nodemon` restarts the process on every file save, saving a file mid-request can drop whatever hadn't been flushed to disk yet.
- **Request logging isn't actually wired up**: `app.js` calls `morgan("dev")` but never passes the result to `app.use(...)`, so it currently has no effect.
- **`helmet` is installed but unused** — it's in `package.json` but never imported in `app.js`.

See [DEBUGGING_NOTES.md](DEBUGGING_NOTES.md) for the full list of bugs found and fixed while getting this working.
