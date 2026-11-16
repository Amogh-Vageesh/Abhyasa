import { isNative } from '../firebase';
import { toICS, addDays } from './logic';

// Stable numeric ids for local notifications
function hashId(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 2000000000;
}

function at(dateStr, time) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (time || '07:30').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

// Re-schedules everything; safe to call whenever events/settings change.
export async function syncReminders({ events, blocks = [], settings, role }) {
  if (!isNative) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') {
    const r = await LocalNotifications.requestPermissions();
    if (r.display !== 'granted') return;
  }
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });

  const now = new Date();
  const list = [];
  if (role === 'student') {
    const [h, m] = settings.reminderTime.split(':').map(Number);
    list.push({ id: 1, title: 'Abhyasa time 📚', body: "Log today's classes and finish your routine.", schedule: { on: { hour: h, minute: m }, allowWhileIdle: true } });
  }
  if (role === 'student') {
    for (const b of blocks.filter((x) => x.remind)) {
      const [h, m] = b.start.split(':').map(Number);
      for (const d of b.days || []) {
        list.push({ id: hashId(`blk:${b.id}:${d}`), title: `⏰ ${b.title || b.kind}`, body: `${b.start}–${b.end} · from your timetable`, schedule: { on: { weekday: d + 1, hour: h, minute: m }, allowWhileIdle: true } });
      }
    }
  }
  for (const ev of events.filter((e) => e.type !== 'holiday' || e.date >= new Date().toISOString().slice(0, 10))) {
    for (const before of ev.remind || [1, 0]) {
      const when = at(addDays(ev.date, -before), before === 0 ? (ev.time ? null : '07:00') : '19:00');
      const fire = before === 0 && ev.time ? new Date(at(ev.date, ev.time).getTime() - 60 * 60000) : when;
      if (fire > now) {
        list.push({
          id: hashId(ev.id + ':' + before),
          title: before === 0 ? `Today: ${ev.title}` : `${before === 1 ? 'Tomorrow' : `In ${before} days`}: ${ev.title}`,
          body: ev.notes || (ev.type === 'test' ? 'Revise the chapters in Abhyasa.' : 'Reminder from Abhyasa'),
          schedule: { at: fire, allowWhileIdle: true }
        });
      }
    }
  }
  if (list.length) await LocalNotifications.schedule({ notifications: list.slice(0, 60) });
}

export function downloadICS(ev) {
  const blob = new Blob([toICS(ev)], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ev.title.replace(/[^\w]+/g, '-').slice(0, 40) || 'event'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
