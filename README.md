# Juppies

A team hub for the NUS Jupitans: training and match RSVPs, match results, player stats and match videos.
Players pick their name once (no logins). Admins unlock editing with a PIN.

**Everyone can see** the schedule, who's coming, results, scorers, assists, the player of the match, the season leaderboard and attendance.
**Only admins can change** things: the schedule, results, stats, players and videos. Only admins can read the feedback inbox.

| Part | What it does | Who touches it |
|---|---|---|
| Google Sheet | Stores everything (one tab per kind of data) | Admins, to fix data by hand |
| `backend/*.gs` (Apps Script) | Lets the app read and write the Sheet | Nobody after setup |
| `index.html`, `css/`, `js/`, `logo.png` (GitHub Pages) | The app players open on their phones | Nobody after setup |

Try it first with `npm start` and then open <http://localhost:8000>. With no Sheet connected (empty `API_URL`), it runs in **demo mode**: the real 2026/27 fixtures, results and streams, with made-up player names, RSVP reasons and trainings. The admin PIN is `1234` (demo only).

---

## Everyday admin (no code)

| Task | Where |
|---|---|
| **Enter a match result** | Admin → *Match results* lists finished matches without a score. Open one → **Enter result** → type the score, tick who played, add goals and assists, pick the player of the match → **Save result**. |
| Fix a result | Open the match (Matches → Results, or Stats → Results) → **Edit**. **Delete result** removes it. |
| Upload or update the schedule | Admin → *Upload match schedule*. Re-uploading updates times and never overwrites RSVPs players gave in the app. |
| Cancel a training or match | Open the session → **Cancel session** |
| Extra training or friendly | Admin → *Add a one-off session* |
| Add a match video | Open the match → paste a YouTube link |
| Player joins or leaves | Admin → *Players* (deactivating keeps their history and stats) |
| Read feedback | Admin → *Feedback inbox* |
| Download everything | Admin → *Export to Excel* (RSVPs, results, player stats) |

**Result rules:** our score adds itself up from player goals as you type. To record an own goal, type a higher score and the extra is kept as "goals without a scorer". Assists can't exceed the score. The player of the match must be someone who played.
**Attendance:** once a match has a lineup (who played), attendance counts who actually played. Otherwise, including for trainings, it counts who RSVP'd Going.

**Fixing things in the Sheet directly** is fine. Two rules: don't rename tabs or header cells, and **cancel sessions instead of deleting rows** (deleted trainings get recreated). You can add your own columns to the right of the existing ones.

### Sheet tabs

| Tab | One row per | Notes |
|---|---|---|
| Settings | setting | See below |
| Players | player | `Active` is TRUE/FALSE |
| TrainingSlots | weekly training | e.g. Tuesday 18:45–21:30. New times apply to sessions created from then on |
| Sessions | training or match | `Status` is Active/Cancelled |
| RSVPs | player per session | |
| Videos | YouTube link | |
| Feedback | message | `Status` is New/Seen/Done |
| MatchResults | match with a result | Score and player of the match |
| PlayerStats | player per match they played | Goals and assists. Being listed means they played |

| Setting | Meaning |
|---|---|
| `ADMIN_PIN` | The admin PIN, at least 6 characters. Change it if it leaks. After 10 wrong guesses, admin unlock pauses for 10 minutes. |
| `TRAINING_LOCK_HOURS` / `MATCH_LOCK_HOURS` | RSVP cutoff (2 and 12). After it, Going/Not going are locked; TBC or no answer can still change. |
| `WEEKS_AHEAD` | How far ahead trainings appear (3). |
| `TRAINING_START` | First date trainings are created from. |
| `MATCH_VENUE` | Optional, shown on every match. |

---

## One-time setup (about 15 minutes)

### 1. Create the Sheet and backend
1. Go to [sheets.new](https://sheets.new) and name it **Juppies**.
2. **Extensions → Apps Script**. For each file in `backend/`, create a script file with the same name (＋ → Script) and paste its contents. Replace the default `Code.gs` contents with `Config.gs` (or delete it).
   In **Project Settings**, tick *Show "appsscript.json"* and paste `backend/appsscript.json` into it.
   *(Developers: `clasp push` from `backend/` does the same.)*
3. Pick **setup** in the function dropdown, click **Run**, and approve the permissions prompt (*Advanced → Go to project*).
4. In the **Settings** tab in the Google Sheet (not the script editor), change `ADMIN_PIN` to something **at least 6 characters** long. Admin tools stay locked while it's `1234` or shorter.

### 2. Publish the backend
**Deploy → New deployment → ⚙ → Web app**, *Execute as:* **Me**, *Who has access:* **Anyone** → **Deploy**. Copy the URL ending in `/exec`.

### 3. Publish the app on GitHub Pages
1. Push this folder to a GitHub repo.
2. In `js/config.js`, paste the `/exec` URL into `API_URL` and commit.
3. Repo **Settings → Pages → Branch: main, folder: / (root) → Save**.

### 4. Load the season
Open the app → **Admin** → PIN → **Upload match schedule** → choose the Excel → tick *Also import RSVPs* → **Preview** → **Import**. This also builds the player list.

### Upgrading an existing Sheet
Paste in the new `backend/*.gs` files, run **setup** once (it adds the `MatchResults` and `PlayerStats` tabs and leaves your data alone), then **Deploy → Manage deployments → ✏ → Version: New version → Deploy**. The URL stays the same.

---

## For developers

No build step: the app is plain ES modules served as static files. That keeps GitHub Pages deploys to a commit and lets a non-developer change `js/config.js` in the GitHub web editor.

```
index.html            page shell
css/theme.css         design tokens (light + dark)
css/app.css           layout and components
js/main.js            entry point: wires state, rendering, events
js/store.js           UI state; setState() re-renders
js/render.js          state -> DOM (tabs, page, bottom sheet)
js/actions.js         click / submit / change handlers (data-action, data-form, data-change)
js/controller.js      load data, run backend actions
js/api.js             backend client (real or demo)
js/demo-backend.js    in-memory backend mirroring backend/*.gs
js/demo-schedule.js   2026/27 fixtures + results with made-up players; used by the demo and tests
js/logic/             pure, tested functions: dates, ids, rsvp, match-result, stats, selectors, schedule-import
js/ui/                html`` templating (auto-escaping), formatting, icons, toast, theme, effects (motion)
assets/               illustrations (optional; see assets/README.md)
js/views/             one module per page, plus shared components
js/admin/excel.js     Excel import/export (SheetJS from CDN)
backend/              Apps Script, split by concern; see Config.gs for the map
tests/                node:test unit tests for js/logic
```

```bash
npm test     # unit tests (Node 20+, no dependencies)
npm start    # serves the app on http://localhost:8000 (ES modules don't load from file://)
```

**Conventions**
- Views are pure functions of state that return `html```, which escapes every interpolated value. Raw markup only goes through `trusted()`, which is used for static icons.
- Views don't attach listeners. They declare `data-action` / `data-form` / `data-change` / `data-input`, and `js/actions.js` maps those to handlers.
- Motion is reserved for big moments: page entrance, the sheet opening, the scoreboard reveal and confetti on a saved win. It plays only on navigation or opening (never on re-render), and is off under `prefers-reduced-motion`.
- After any write, the app reloads the full bootstrap payload. The data is small, and this keeps the screen identical to the Sheet.
- Rules that both sides enforce live in two places on purpose, because Apps Script can't import ES modules: `validateMatchResult` (`js/logic/match-result.js` ↔ `backend/Matches.gs`), RSVP locking (`js/logic/rsvp.js` ↔ `backend/Rsvps.gs`), and id and time helpers. Each copy names its twin, so change both.
- The backend reads columns by header name, so admins can add columns without breaking it.

**Security model**
- The admin PIN is a shared secret, checked on the server for every admin action. The setup default `1234` and anything under 6 characters are refused. 10 wrong guesses pause admin unlock for 10 minutes, so the PIN can't be brute-forced. The PIN is only ever sent in POST bodies, never in URLs. Rotate it when admins change.
- `API_URL` (the `/exec` link) is public by design, because every visitor's browser calls it. It grants nothing without the PIN.
- No logins: anyone with the link can RSVP or send feedback under any player's name. That's the agreed trade-off for a team tool, so don't store anything sensitive.
- RSVP reasons, attendance and stats are visible to everyone with the link.
- All text from the app is length-capped, stored as plain text (a leading `=`/`+`/`-`/`@` can't become a Sheet formula), and HTML-escaped when shown.
- Videos must be https YouTube links. They're stored in one canonical form and only ever embedded through youtube-nocookie.
- `index.html` sets a Content Security Policy (code only from this site and SheetJS, network only to Apps Script, frames only YouTube). SheetJS is pinned with an integrity hash.
- `.gitignore` keeps local tooling, OS files and clasp credentials (`.clasprc.json`) out of the repo.

## Handing over to a new owner
1. Sheet: Share → new owner as Editor → ⋯ → **Transfer ownership**.
2. New owner: Apps Script → **Deploy → New deployment** (Web app, Me, Anyone) → copy the URL.
3. Update `API_URL` in `js/config.js` (or transfer the GitHub repo).
4. Archive the old deployment once the new link works, and change `ADMIN_PIN` if needed.

## Troubleshooting
| Problem | Fix |
|---|---|
| "Couldn't load the team data" | Check `API_URL` is the `/exec` link and access is **Anyone**. |
| "Missing tab …" | In the Sheet: **Juppies → Set up / repair tabs**. |
| A name is missing from the picker | Admin → Players → check they're active. |
| Dates imported in the wrong year | Set **Season starts in** correctly before Preview, then re-import. |
| A change on GitHub isn't showing | GitHub Pages caches for up to 10 minutes. Wait, then refresh. |
