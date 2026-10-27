/** Gemeinsame Logik für Live-Anzeige und Studio: Ist laut Modus und Streamplan gerade live? */

export type Mode = 'auto' | 'on' | 'off';
export type Weekday = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so';

export interface Slot {
  id?: string;
  weekday: Weekday;
  /** "HH:MM" */
  start: string;
  end: string;
  title?: string;
}

export const WEEKDAYS: Weekday[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
export const WEEKDAY_LABEL: Record<Weekday, string> = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So' };

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Wochentag (0 = Mo) und Minuten seit Mitternacht in der Zeitzone des Plans */
export function localNow(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(date)
    .reduce<Record<string, string>>((o, p) => ((o[p.type] = p.value), o), {});
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday);
  return { day, min: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Läuft der Termin gerade? Ende vor Start = über Mitternacht in den nächsten Tag */
export function slotActive(slot: Slot, now: { day: number; min: number }) {
  const d = WEEKDAYS.indexOf(slot.weekday);
  const s = minutes(slot.start);
  const e = minutes(slot.end);
  if (e > s) return now.day === d && now.min >= s && now.min < e;
  return (now.day === d && now.min >= s) || (now.day === (d + 1) % 7 && now.min < e);
}

export function isLive(mode: Mode, slots: Slot[], timeZone: string, date = new Date()) {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  const now = localNow(timeZone, date);
  return slots.some((s) => slotActive(s, now));
}

/** Sortiert nach Wochentag und Beginn */
export const sortSlots = <T extends Slot>(slots: T[]) =>
  [...slots].sort((a, b) => WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday) || minutes(a.start) - minutes(b.start));

/** "Mo 19–23 Uhr · Cozy Montag", "Fr 20–01 Uhr" (volle Stunden ohne :00) */
export function formatSlot(slot: Slot) {
  const t = (hhmm: string) => (hhmm.endsWith(':00') ? hhmm.slice(0, 2) : hhmm);
  return `${WEEKDAY_LABEL[slot.weekday]} ${t(slot.start)}–${t(slot.end)} Uhr${slot.title ? ` · ${slot.title}` : ''}`;
}
