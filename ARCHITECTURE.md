# Architecture

Juppies is a static web app (GitHub Pages) talking to one Postgres database (Supabase). The database enforces every rule. The browser repeats some rules only to give instant feedback.

## Layers

Dependencies point one way, down this diagram. Nothing in `logic/` knows about the DOM, the network or Supabase.

```
 index.html
     │
 main.js ─────────── wires events → handlers, state → render
     │
 ┌───┴────────────────────────────┐
 │ UI                             │
 │  render.js   views/*.js        │  pure functions: state → html``
 │  actions.js                    │  data-action / data-form / data-change / data-input → handlers
 │  ui/*.js                       │  templating, formatting, icons, toast, theme, motion
 └───┬────────────────────────────┘
     │ setState()                    reads state
 ┌───┴────────────────────────────┐
 │ State                          │
 │  store.js                      │  the single UI state object; setState() re-renders
 │  controller.js                 │  load(), runAction(), admin sign-in
 └───┬────────────────────────────┘
     │ callApi(action, payload)
 ┌───┴────────────────────────────┐
 │ Data                           │
 │  api.js                        │  action → Postgres function (RPC_CALLS), timeouts, friendly errors
 │  auth.js                       │  email magic links
 │  supabase-client.js            │  the one Supabase client
 │  demo-backend.js               │  in-memory stand-in when no project is configured
 └───┬────────────────────────────┘
     │ HTTPS (anon key + admin's session token)
 ┌───┴────────────────────────────┐
 │ Database: supabase/setup.sql   │  tables, row-level security, one function per action
 └────────────────────────────────┘

 logic/*.js   pure rules used by every layer above: dates, ids, RSVP locking,
              result validation, stats, selectors, schedule import
```

This follows the usual "state flows down, events flow up" model for UI code ([Thinking in React](https://react.dev/learn/thinking-in-react) describes the same idea), without a framework.

## Data flow

**Reading.** `controller.load()` calls the `bootstrap()` database function once. It returns everything the screens need in one JSON payload. The controller stores it in `state.data`, and every view derives what it shows from that object through `logic/selectors.js` and `logic/stats.js`.

**Writing.** A button or form declares an action, for example `data-action="rsvp"`. `actions.js` handles it and calls `controller.runAction()`. That calls `callApi()`, which calls one Postgres function, for example `submit_rsvp`. After any successful write, the app reloads the whole bootstrap payload, so the screen always matches the database.

**Signing in.** `auth.js` asks Supabase to email a magic link. When the admin opens it, supabase-js stores the session and `main.js` reloads. Each admin function then calls `is_admin()`, which checks the email from the session against the `admins` table.

## Key decisions

| Decision | Why | Trade-off |
|---|---|---|
| No build step: plain ES modules | Deploy is a git push, and a non-developer can edit `js/config.js` on GitHub | No TypeScript or bundling. Fine at this size |
| All writes through `security definer` functions; browser roles get read-only grants | Rules can't be bypassed by calling the API directly. One place to audit | Business rules live in SQL, so the database tests (PGlite) matter |
| One `bootstrap()` payload, reloaded after every write | Simple and always consistent | Downloads all seasons' data; fine for one team, revisit after a few seasons |
| Rules mirrored in the browser | Instant feedback, and a typo doesn't cost a round trip or wipe a form | Two copies. Each names its twin, and tests check the id helpers agree |
| Players don't sign in | Zero friction for about 30 players | Anyone with the link can see team data and RSVP as anyone. A team code is the planned next step |
| Admins use email magic links plus an `admins` table | No shared password, and access is revoked by deleting a row | Depends on email delivery; custom SMTP is recommended |
| supabase-js self-hosted; SheetJS lazy-loaded with an integrity hash | Fewer third-party runtime dependencies; phones don't download the 950 KB Excel library | Vendored files must be updated by hand |
| Singapore time (UTC+8) hard-coded | The team plays in Singapore, and SG has no daylight saving | Not reusable for other time zones without changes |

## Testing

`npm test` runs everything with Node's built-in test runner:

- `tests/*.test.js` cover the pure rules in `js/logic/`, the async helper, and the schedule importer, including the real 2026/27 layout.
- `tests/database.test.js` runs `supabase/setup.sql` in PGlite (real Postgres compiled to WebAssembly). It sets up Supabase's roles and permissive default grants, then proves:
  - anonymous visitors and non-admins can't write
  - the rules behave
  - every function the browser calls exists with matching parameters

CI (`.github/workflows/test.yml`) runs the same suite on every push.
