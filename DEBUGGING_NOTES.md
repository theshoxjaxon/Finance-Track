# Expense Tracker — Debugging Notes

A record of the bugs found and fixed in this project, and how they were diagnosed. Kept for learning purposes — see the "Lessons" section at the bottom for the patterns worth remembering.

## Round 1 — original single-file `app.js`

Back when everything lived in one `app.js`, the POST route looked like this:

```js
app.post("/", (req, res) => {
    const uniqueId = crypto.randomUUID();
    const newExpense = Object.assign({ id: uniqueId }, req.body)

    data.expenses.push(newExpense)

    fs.writeFile(dataPath, JSON.stringify(data.expenses, null, 2), () => {
        if (err) { ... }
        res.status(201).json({ ..., results: tours.length, ... });
    })
})
```

**Symptom:** a POST request would appear to work, then error out with nothing sent back to the client.

| # | Bug | Why it broke |
|---|-----|---------------|
| 1 | `fs.writeFile(..., () => { if (err) ... })` | The callback took **zero parameters**, so `err` referenced nothing. Node always passes `err` as the first callback argument. Accessing an undeclared variable threw `ReferenceError: err is not defined` — inside an **async callback**, so Express couldn't catch it. This crashed the whole process *after* the file had already been written, which is exactly why "it worked, but then errored." |
| 2 | `JSON.stringify(data.expenses, ...)` | Wrote only the `expenses` array back to disk, discarding the `users` key and the `{expenses, users}` wrapper object entirely. Every successful POST silently flattened the data file's shape. |
| 3 | `results: tours.length` | `tours` didn't exist anywhere — leftover from a copy-pasted tutorial project. Would have crashed next, once bug #1 was fixed. |

Bug #2 had already done real damage before we even started: the live `data/userdata.json` was found already flattened into a bare array, with a stray `{ id, name: "Sean" }` record sitting in it — the fingerprint of an earlier POST with body `{"name": "Sean"}` that got written via this exact bug.

All three were reproduced with real `curl` requests against a sandboxed copy of the project (never against the live data) before being explained.

## Round 2 — after the refactor into `routers/` + `controllers/`

The project was restructured (by the user) into `routers/expense.js` + `controllers/expense.js`. The refactor fixed bugs #1–#3 above on its own, but introduced a new batch:

| # | File | Bug | Fix |
|---|------|-----|-----|
| 4 | `routers/expense.js` | `from "../controllers/expense"` — missing `.js` extension, required by Node ESM (`"type": "module"`) for relative imports. Server wouldn't start at all (`ERR_MODULE_NOT_FOUND`). | Added `.js`. *(Fixed by the user before I got to it.)* |
| 5 | `controllers/expense.js` | `dataPath` computed as `path.join(__dirname, "./data/userdata.json")`. Once this code moved into `controllers/`, `__dirname` pointed at `controllers/`, not the project root — looked for a nonexistent `controllers/data/userdata.json`. | Changed to `"../data/userdata.json"`. *(Fixed by the user before I got to it.)* |
| 6 | `app.js` | `expenseRoute` was imported but never mounted with `app.use(...)` — every route was a dead 404. | Added `app.use("/expense", expenseRoute)`. *(Fixed by the user before I got to it.)* |
| 7 | `controllers/expense.js` — `getALlExpenses` | Still read `data.expenses` / `data.users`, but `data` is now a flat array (matching the file's real, flattened shape). Threw `TypeError: Cannot read properties of undefined (reading 'length')`. | Changed to read `data` directly. |
| 8 | `routers/expense.js` | `/summary` was declared *after* `/:id`. Express matches top-to-bottom, and `/:id` matches literally any single segment — so `GET /expense/summary` was being swallowed by `getExpenseById` with `id = "summary"`, instead of reaching `getSummaryExpense`. | Moved `/summary` above `/:id`. |
| 9 | `controllers/expense.js` — `deleteExpense` | `if (expenseId > -1)` — wrong variable (should check the lookup result `expenseIndex`, not the raw `expenseId` string) *and* inverted logic. Since a UUID string compared with `> -1` always coerces to `NaN > -1` (`false`), the "not found" branch never fired for **any** id. Verified live: `DELETE` with a made-up id returned `204 No Content` and silently deleted the **last item in the array** (`splice(-1, 1)`). | Changed to `if (expenseIndex === -1)`. |
| 10 | `controllers/expense.js` — `updateExpense` | `if (!expenseIndex)` — `0` is falsy in JS, so updating the very first array item (`index 0`) incorrectly reported "not found"; meanwhile a real not-found (`-1`) is truthy, so it incorrectly fell through to a fake success. Also: the handler never applied `req.body` or wrote to disk — pure stub. | Changed to `if (expenseIndex === -1)`, then merges `req.body` into the record and persists it via `fs.writeFile`, mirroring `deleteExpense`. |
| 11 | `controllers/expense.js`, `app.js` | Unused imports (`log` from `console`, `json` from `stream/consumers`, `express` in the controller file). | Removed. |
| 12 | `package.json` | `"crypto": "^1.0.1"` dependency — unnecessary. `crypto` is a Node built-in; that npm package name is an old, unrelated abandoned package that Node's built-in always shadows anyway. | Removed via `npm uninstall crypto`. |

Every fix above was verified against the **real** running server with real `curl` requests (GET all, GET summary, DELETE with a bad id, DELETE a real id, PATCH), with the real data file backed up beforehand and restored afterward so testing never left artifacts behind.

## The "nothing in Postman" investigation

Two separate things were reported together and turned out to be unrelated:

1. **Repeated `The value is <id>` console logs** — not an error. It's `router.param("id", ...)` in `routers/expense.js`, which logs on *every* request matching `/expense/:id` (GET, PATCH, or DELETE). Working exactly as written; harmless.
2. **A POST-created id (`2592eb09-...`) that showed up in the console log but wasn't in the data file** — investigated by checking the process tree (`ps`, `pgrep -P`) to rule out two competing server instances; confirmed there was only one (`nodemon` supervising a single child on port 3003). Root cause wasn't nailed down with certainty, but the strong candidate: this app keeps its entire dataset in one in-memory array, reloaded from disk only when the process restarts. `nodemon` restarts the process on every file save. A request in flight — or one that landed just before a save-triggered restart — can lose anything not yet flushed to disk. A live POST → GET-by-id → disk-check → DELETE cycle was run against the actual server afterward and worked correctly end-to-end, confirming the server itself is healthy; the practical guidance was to avoid saving files while mid-request-testing in Postman.

## Known issue — not yet fixed

The four original seed expenses (Lunch, Dinner, Monthly Subscriptions, Bus pass) use a Mongo-style `_id` field, while every lookup (`getExpenseById`, `updateExpense`, `deleteExpense`) matches on `.id`. Only records created via POST (which sets `.id`) can currently be fetched/updated/deleted by id — the four seed records can't. Needs a decision: rename those fields to `id`, or make the lookups accept both `id` and `_id`.

## Lessons worth keeping in mind

- **`fs.writeFile`'s callback always receives `(err, ...)` first** — declaring it with zero params silently turns any reference to `err` inside into a crash.
- **An uncaught exception inside an async callback isn't caught by Express**, even in Express 5 (which *does* auto-catch synchronous throws in route handlers). It crashes the whole process instead of producing a clean 500.
- **Node ESM (`"type": "module"`) requires explicit file extensions** on relative imports — `"../controllers/expense"` fails; `"../controllers/expense.js"` doesn't.
- **`__dirname` is relative to the file it's computed in**, not the project root — moving code between folders silently breaks any path built from it.
- **Express matches routes top-to-bottom, and `:id` matches anything** — a specific route like `/summary` must be declared *before* a `/:id` route, or it'll never be reached.
- **`someString > -1` is not an "not found" check** — comparing a non-numeric string coerces to `NaN`, which is never `> -1` or `< -1`; always compare `findIndex`'s result with `=== -1`.
- **`0` is falsy in JavaScript** — `if (!index)` breaks for the very first array element; use `=== -1` (or `>= 0`) instead of a truthy/falsy check on an index.
