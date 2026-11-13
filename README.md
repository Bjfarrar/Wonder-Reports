# Wonder Reports
Local development prototype for rehearsal and show reports. Python 3.12+, no third-party dependencies.

Run `python3 server.py` and open port 8000 locally. Data persists in SQLite. Create a production, enter managers and company members, create a report, then review both distributions before sending. Both copies have identical content. Cast recipients are envelope-only BCC; other personnel appear in CC. Anyone classified as cast is excluded from the team envelope.

Email requires SMTP_HOST, SMTP_PORT (default 587), SMTP_FROM, and optionally SMTP_USER / SMTP_PASSWORD. STARTTLS certificate verification is enabled. Supply credentials through environment settings, never source control. Sending is explicit; no sample emails are sent. SMTP acceptance does not guarantee inbox delivery. Partial-send errors require checking mail logs before retrying.

This is a local, single-workspace prototype. Add authentication, authorization, CSRF protection, durable delivery tracking/idempotency, backups and deployment configuration before exposing it publicly or using it for a live company. Concurrent edits currently use last-write-wins. No live email service is configured by default.
