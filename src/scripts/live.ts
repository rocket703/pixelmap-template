/**
 * Live-Anzeige: fragt Status und Streamplan bei PocketBase ab (ohne SDK, nur fetch).
 * Setzt html.is-live → Twitch-Button pulsiert, LIVE-Schild am Studio leuchtet.
 * Ersetzt außerdem die Liste der Streamplan-Station ([data-schedule]) durch den aktuellen Plan.
 */
import { formatSlot, isLive, sortSlots, slotActive, localNow, type Mode, type Slot } from '../lib/live';

export function initLive(pbUrl: string, timeZone: string, refreshSec: number) {
  const root = document.documentElement;
  root.classList.add('live-enabled');
  let mode: Mode = 'auto';
  let slots: Slot[] = [];

  async function load() {
    try {
      const [st, sc] = await Promise.all([
        fetch(`${pbUrl}/api/collections/status/records?perPage=1&fields=mode`).then((r) => r.json()),
        fetch(`${pbUrl}/api/collections/schedule/records?perPage=200&fields=weekday,start,end,title`).then((r) => r.json()),
      ]);
      mode = st.items?.[0]?.mode ?? 'auto';
      slots = sortSlots(sc.items ?? []);
      renderPlan();
    } catch {
      /* Server nicht erreichbar: letzte bekannte Werte behalten */
    }
    render();
  }

  function render() {
    const live = isLive(mode, slots, timeZone);
    root.classList.toggle('is-live', live);
    document.querySelectorAll<HTMLElement>('[data-live-text]').forEach((el) => (el.textContent = live ? ' – jetzt live' : ''));
  }

  function renderPlan() {
    if (!slots.length) return;
    const now = localNow(timeZone);
    document.querySelectorAll<HTMLUListElement>('ul[data-schedule]').forEach((ul) =>
      ul.replaceChildren(
        ...slots.map((s) => {
          const li = document.createElement('li');
          li.textContent = formatSlot(s);
          if (slotActive(s, now) && mode !== 'off') li.classList.add('is-now');
          return li;
        }),
      ),
    );
  }

  void load();
  // Regelmäßig neu laden, solange der Tab sichtbar ist; dazwischen jede Minute neu bewerten (Plan-Zeiten)
  setInterval(() => !document.hidden && void load(), refreshSec * 1000);
  setInterval(render, 60_000);
  document.addEventListener('visibilitychange', () => !document.hidden && void load());
}
