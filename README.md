# Supabase Keep‑Alive Workflow

This repository contains a tiny GitHub Actions workflow that pings a Supabase project once a day. The ping prevents Supabase's free‑tier projects from being automatically paused due to inactivity.

## Files

- **`.github/workflows/keepalive.yml`** – the workflow definition.
- **`README.md`** – this documentation (you are reading it).

## How to add to your own repo
1. Copy the two files into your repository:
   - `keepalive.yml` must be placed at `.github/workflows/keepalive.yml`.
   - `README.md` can stay at the top level (optional).
2. In your GitHub repository go to **Settings → Security → Secrets → Actions** and add two repository secrets:
   - `SUPABASE_URL` – e.g. `https://your‑project.supabase.co`
   - `SUPABASE_ANON_KEY` – the anonymous API key from Supabase (Settings → API).
3. Commit the files and push to your default branch.
4. Open the **Actions** tab – you should see a workflow run named *Supabase Keep‑Alive*.
   - Click **Run workflow** → **Run workflow** to test immediately.
   - A successful run ends with a green check (✅) and the log line `Ping completed`.
5. (Optional) Change the schedule by editing the `cron:` line in `keepalive.yml`.

## Why this works
Supabase treats any incoming HTTP request as activity and resets the idle timer. The workflow makes a lightweight request to the public `pg_catalog.pg_tables` endpoint, which requires only the `anon` key and returns a tiny JSON payload.

## FAQ
- **Do I need to worry about security?** The anon key only has the permissions you grant to the `anonymous` role (usually read‑only). The request is read‑only and does not modify data.
- **Can I run this more often?** Yes – edit the `cron:` expression. For example `*/6 * * * *` runs every 6 minutes.
- **What if I delete the workflow?** The project will pause again after 24 h of inactivity.

---
*Created by Antigravity, your AI coding assistant.*
