# Trackline — real push notifications, step by step

This gets you a planner that sends a real phone/desktop notification when a task
is due, even if your browser is fully closed. That needs two pieces, both free to run:

- `backend/` — a small server that stores your tasks and pushes the alert at the right time
- `frontend/` — the planner page itself, installable to your home screen

Total setup time: about 15 minutes, no credit card needed.

## 1. Generate your push keys

On your own computer (needs Node.js installed — nodejs.org):

```
cd backend
npm install
npx web-push generate-vapid-keys
```

This prints a `Public Key` and `Private Key`. Save both — you'll paste them in step 2.

## 2. Deploy the backend (Render, free tier)

1. Create a free GitHub account if you don't have one, and push this whole `trackline` folder to a new repo.
2. Go to [render.com](https://render.com) → sign up (free) → **New +** → **Web Service**.
3. Connect your GitHub repo. When asked for settings:
   - **Root directory**: `backend`
   - **Build command**: `npm install`
   - **Start command**: `npm start`
4. Under **Environment**, add these variables:
   - `VAPID_PUBLIC_KEY` — from step 1
   - `VAPID_PRIVATE_KEY` — from step 1
   - `VAPID_CONTACT` — `mailto:` plus your email
   - `TIMEZONE` — your IANA timezone, e.g. `Asia/Kolkata`
5. Click **Create Web Service**. Wait for it to deploy, then copy the URL Render gives you
   (something like `https://trackline-xyz.onrender.com`).

Note: Render's free tier sleeps after 15 minutes of no traffic and takes ~30s to
wake on the next request — this doesn't affect the cron check (it runs inside the
same always-on process while the service is awake) but a fully idle free service
can go to sleep between checks. If reminders matter a lot, either upgrade to
Render's cheapest paid tier ($7/mo) to keep it always-on, or ping the `/health`
URL from a free service like [cron-job.org](https://cron-job.org) every 10 minutes
to keep it awake.

## 3. Deploy the frontend (GitHub Pages, free)

1. In your GitHub repo, go to **Settings → Pages**.
2. Set **Source** to your main branch, folder `/frontend`.
3. Save — GitHub gives you a URL like `https://yourname.github.io/trackline/`.

(Netlify or Vercel work the same way if you'd rather use those — just point them
at the `frontend` folder.)

## 4. Connect and turn on reminders

1. Open your GitHub Pages URL on your phone or computer.
2. Paste your Render backend URL into the "Connect your backend" box at the top.
3. Add a task or two.
4. Tap **Turn on** under "Push reminders" and allow notifications when prompted.
5. On phone: use your browser's **Add to Home Screen** option so Trackline runs
   like a real app — this makes background push more reliable, especially on iPhone
   (needs iOS 16.4+).

That's it — tasks now fire a real notification at their scheduled time, checked
every minute by the backend, regardless of whether your browser is open.

## Notes

- All your tasks live on your backend (in a `data.json` file) — not tied to any
  single device, so you can open the planner from your phone and laptop and see
  the same schedule.
- This is a single-user setup with no login screen, meant for personal use. Don't
  share your Render URL publicly, since anyone with it could see or edit your tasks.
- iOS Safari requires the site to be added to your home screen before push
  notifications will work — this is an Apple restriction, not something this app
  can work around.
