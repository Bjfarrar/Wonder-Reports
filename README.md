# Wonder Reports
JavaScript web app for rehearsal and show reports. Requires Node.js 24 or newer; Python is not required.

## Run from GitHub Codespaces
1. Open the repository on GitHub. Choose Code → Codespaces → Create codespace on main.
2. In the terminal, run `npm ci`, then `npm start`.
3. Open port 8000 from the Ports tab. Keep visibility Private.

For a local checkout, use the same commands in the repository directory. Run checks with `npm test`.

Data persists in `reports.sqlite3`; existing Python-version databases remain compatible. Back this file up before moving hosts. REPORTS_DB can specify another persistent path. PORT defaults to 8000 and HOST to 127.0.0.1.

Create a production, add managers and personnel, write a report, and review both email distributions. Both copies have identical content. Managers appear in To; cast recipients are envelope-only BCC. Other personnel appear in CC. Cast addresses are excluded from the team distribution, even if they also have another role.

Email requires SMTP_HOST and SMTP_FROM, SMTP_PORT (default 587), and optionally SMTP_USER / SMTP_PASSWORD. STARTTLS verification is required. Supply credentials through environment settings, never source control. SMTP acceptance does not guarantee inbox delivery. After partial-send errors, check mail logs before retrying.

GitHub stores the code; GitHub Pages cannot run this server. Codespaces is suitable for development. Regular company use requires a Node.js host with persistent storage, authentication, authorization, CSRF protection, delivery tracking/idempotency and backups. This prototype has no login and uses last-write-wins for concurrent edits. No live mail service is configured by default.
