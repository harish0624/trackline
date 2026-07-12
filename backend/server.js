const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
const cron = require('node-cron');
const { DateTime } = require('luxon');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';
const DATA_FILE = path.join(__dirname, 'data.json');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_CONTACT = process.env.VAPID_CONTACT || 'mailto:you@example.com';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars.');
  console.error('Generate them with: npx web-push generate-vapid-keys');
  process.exit(1);
}

webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { tasks: [], subscriptions: [], notifiedLog: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return { tasks: [], subscriptions: [], notifiedLog: {} };
  }
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let db = loadData();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.get('/api/tasks', (req, res) => {
  res.json({ tasks: db.tasks });
});

app.post('/api/tasks', (req, res) => {
  const { id, title, track, date, time, repeat } = req.body;
  if (!title || !track || !date || !time) {
    return res.status(400).json({ error: 'title, track, date, and time are required' });
  }
  const task = {
    id: id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title,
    track,
    date,
    time,
    repeat: repeat || 'none',
    doneDates: []
  };
  db.tasks.push(task);
  saveData(db);
  res.status(201).json({ task });
});

app.patch('/api/tasks/:id/toggle', (req, res) => {
  const { date } = req.body;
  const task = db.tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  task.doneDates = task.doneDates || [];
  const i = task.doneDates.indexOf(date);
  if (i >= 0) task.doneDates.splice(i, 1);
  else task.doneDates.push(date);
  saveData(db);
  res.json({ task });
});

app.delete('/api/tasks/:id', (req, res) => {
  db.tasks = db.tasks.filter((t) => t.id !== req.params.id);
  saveData(db);
  res.json({ ok: true });
});

app.post('/api/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'invalid subscription' });
  const exists = db.subscriptions.find((s) => s.endpoint === sub.endpoint);
  if (!exists) db.subscriptions.push(sub);
  saveData(db);
  res.status(201).json({ ok: true });
});

app.delete('/api/subscribe', (req, res) => {
  const { endpoint } = req.body;
  db.subscriptions = db.subscriptions.filter((s) => s.endpoint !== endpoint);
  saveData(db);
  res.json({ ok: true });
});

function occursOn(task, dt) {
  const dStr = dt.toISODate();
  if (task.repeat === 'none') return task.date === dStr;
  if (task.date > dStr) return false;
  const wd = dt.weekday % 7;
  if (task.repeat === 'daily') return true;
  if (task.repeat === 'weekdays') return wd >= 1 && wd <= 5;
  if (task.repeat === 'weekly') {
    const origWd = DateTime.fromISO(task.date).weekday % 7;
    return wd === origWd;
  }
  return false;
}

function trackLabel(t) {
  return t === 'college' ? 'College' : t === 'build' ? 'Skill-build' : 'Personal';
}

async function sendPushToAll(payload) {
  const body = JSON.stringify(payload);
  const stillValid = [];
  for (const sub of db.subscriptions) {
    try {
      await webpush.sendNotification(sub, body);
      stillValid.push(sub);
    } catch (e) {
      if (e.statusCode !== 410 && e.statusCode !== 404) stillValid.push(sub);
    }
  }
  db.subscriptions = stillValid;
  saveData(db);
}

cron.schedule('* * * * *', async () => {
  const now = DateTime.now().setZone(TIMEZONE);
  const dStr = now.toISODate();
  const nowHM = now.toFormat('HH:mm');

  for (const task of db.tasks) {
    if (!occursOn(task, now)) continue;
    if ((task.doneDates || []).includes(dStr)) continue;
    if (task.time !== nowHM) continue;

    const key = `${task.id}_${dStr}`;
    if (db.notifiedLog[key]) continue;
    db.notifiedLog[key] = true;

    await sendPushToAll({
      title: task.title,
      body: `${trackLabel(task.track)} · due now`,
      track: task.track,
      tag: task.id
    });
  }

  const cutoff = now.minus({ days: 2 }).toISODate();
  Object.keys(db.notifiedLog).forEach((k) => {
    const parts = k.split('_');
    const d = parts[parts.length - 1];
    if (d < cutoff) delete db.notifiedLog[k];
  });
  saveData(db);
}, { timezone: TIMEZONE });

app.listen(PORT, () => {
  console.log(`Trackline backend running on port ${PORT}, timezone ${TIMEZONE}`);
});
