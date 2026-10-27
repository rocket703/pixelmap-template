/**
 * Map-Logik: Scroll → Ziel → Figur → Kamera → Inhalt.
 *
 * Die Map ist so hoch wie die Seite und scrollt ganz normal mit.
 * 1. Scroll legt nur das ZIEL fest (targetS = Pfadlänge in Map-Pixeln, Station etwa in Bildmitte).
 * 2. Die Figur läuft pro Frame höchstens HERO.speed · dt Richtung Ziel (heroS).
 *    Scrollt man schneller, fällt sie aus dem Bild und läuft danach wieder hinein.
 * 3. Senkrecht ist die Kamera der Scroll, waagerecht folgt sie dem Ziel (Desktop-Map).
 *    Auf der Handy-Map steht sie waagerecht still – die Gebäude stehen untereinander,
 *    der Weg schwenkt zwischen ihnen seitlich aus dem Bild.
 * 4. Steht die Figur an einer Station, wird deren <section> eingeblendet.
 */
import { createPath, pointAt, type Point } from '../lib/path';

type Facing = 'down' | 'left' | 'right' | 'up';

interface LayoutConfig {
  width: number;
  height: number;
  path: Point[];
  /** Wegpunkt-Index je Haltepunkt */
  waypoints: number[];
}

interface MapConfig {
  zoom: { min: number; max: number; viewSpan: number };
  /** Media-Query für die Handy-Map */
  mobileQuery: string;
  layouts: { desktop: LayoutConfig; mobile: LayoutConfig };
  hero: { speed: number; sprintFrom: number; sprintMax: number; stride: number; anchorX: number; anchorY: number };
  scroll: { hold: number; snap: boolean; magnet: boolean; views: boolean; pause: number; focus: number; focusMobile: number };
  /** halfW/h: halbe Breite und Höhe des Gebäudes in Map-Pixeln (Inhaltsfenster steht daneben) */
  stations: { id: string; panel: 'left' | 'right'; face: Facing; halfW: number; h: number }[];
  /** Abstand Unterkante Gebäude → Wegmitte, halbe Wegbreite */
  gap: number;
  pathHalf: number;
}

/** Zeile im Sprite-Sheet je Blickrichtung */
const ROW: Record<Facing, number> = { down: 0, left: 1, right: 2, up: 3 };

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function initMap() {
  const cfgEl = document.getElementById('map-config');
  const mapEl = document.getElementById('map');
  const world = document.getElementById('world');
  const hero = document.getElementById('hero');
  const hint = document.getElementById('hero-hint');
  if (!cfgEl || !mapEl || !world || !hero || !hint) return;

  const cfg: MapConfig = JSON.parse(cfgEl.textContent ?? '{}');
  const root = document.documentElement;
  const header = document.querySelector<HTMLElement>('.site-header');
  const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav]')];
  const buildings = [...document.querySelectorAll<HTMLElement>('[data-building]')];

  const segs = cfg.stations.length - 1;
  const ids = cfg.stations.map((s) => s.id);
  // Inhaltsfenster je Haltepunkt (die Tür am Ende hat keins)
  const panels = ids.map((id) => document.querySelector<HTMLElement>(`.station#${CSS.escape(id)}`));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia(cfg.mobileQuery);

  /* Aktive Map (Desktop/Handy) – wechselt, wenn die Bildschirmbreite die Grenze überschreitet */
  let L = cfg.layouts.desktop;
  let path = createPath(L.path);
  let stationS: number[] = [];
  let stationY: number[] = [];
  function applyLayout() {
    L = mobile.matches ? cfg.layouts.mobile : cfg.layouts.desktop;
    path = createPath(L.path);
    stationS = L.waypoints.map((w) => path.cum[w]);
    stationY = L.waypoints.map((w) => L.path[w].y);
  }
  applyLayout();
  /** Wegpunkt der Station i auf der aktiven Map */
  const stationPoint = (i: number) => L.path[L.waypoints[i]];

  let scale = 2;
  let vw = 0;
  let vh = 0;
  let headerH = 0;
  let signH = 24; // Höhe der Schilder über den Gebäuden
  let targetS = 0; // Ziel (aus Scroll)
  let heroS = 0; // tatsächliche Position der Figur
  let hx = 0;
  let hy = 0;
  let row = ROW.down;
  let walking = false;
  let camX = 0;
  let snapCamera = true;
  let active = -1;
  let running = false;
  let last = 0;
  let pace = 1; // aktueller Sprint-Faktor

  /* ---------------------------------------------- 1. Scroll → Ziel */

  const maxScroll = () => Math.max(1, root.scrollHeight - innerHeight);
  /**
   * Abstand vom oberen Bildrand, auf dem Station i steht, wenn sie „dran“ ist.
   * Handy: so weit oben, dass Schild und Gebäude genau unter die Kopfzeile passen –
   * darunter bleibt möglichst viel Platz für die Infoleiste (höchstens focusMobile).
   */
  function focusPx(i: number) {
    if (!mobile.matches) return headerH + (vh - headerH) * cfg.scroll.focus;
    const fit = headerH + 10 + signH + (cfg.stations[i].h + cfg.gap) * scale;
    return Math.min(fit, headerH + (vh - headerH) * cfg.scroll.focusMobile);
  }

  /** Scroll-Position, bei der Station i das Ziel ist. Der Start ist immer ganz oben (kein Hochscrollen beim Laden). */
  const scrollYFor = (i: number) => {
    if (i === 0) return 0;
    // Handy: Die letzte View (Tür) ist das Seitenende – darunter steht der ganze Footer
    if (snapViews() && i === segs) return maxScroll();
    return clamp(stationY[i] * scale - focusPx(i), 0, maxScroll());
  };

  /** Scroll-Position → Fortschritt in Stationen (0 … segs, Bruchteile zwischen zwei Stationen) */
  function progress() {
    const y = scrollY;
    const ys = stationY.map((_, i) => scrollYFor(i));
    if (y <= ys[0]) return 0;
    for (let k = 0; k < segs; k++) if (y < ys[k + 1]) return k + (y - ys[k]) / Math.max(1, ys[k + 1] - ys[k]);
    return segs;
  }

  /** Fortschritt → Pfadlänge. Jede Station hat eine Halte-Zone. */
  function targetFromScroll() {
    const f = progress();
    const k = Math.min(Math.floor(f), segs - 1);
    const h = cfg.scroll.hold / 2;
    const t = clamp((f - k - h) / (1 - 2 * h), 0, 1);
    return stationS[k] + (stationS[k + 1] - stationS[k]) * t;
  }

  /** Station, an der Figur UND Ziel gerade stehen (sonst -1) */
  const stationAt = (s: number) => stationS.findIndex((st) => Math.abs(st - s) < 0.5);

  /* ------------------------------------- Handy: feste Views (Scroll-Snap) */

  const snapBox = document.createElement('div');
  snapBox.className = 'snap-points';
  snapBox.setAttribute('aria-hidden', 'true');
  document.body.append(snapBox);
  const snapViews = () => cfg.scroll.views && mobile.matches;

  /** Je Station ein Einrastpunkt an ihrer Scroll-Position, dazu einer ganz unten (Footer) */
  function updateSnaps() {
    const on = snapViews();
    root.classList.toggle('snap-views', on);
    if (!on) return snapBox.replaceChildren();
    const ys = pages();
    snapBox.replaceChildren(
      ...ys.map((y) => {
        const el = document.createElement('div');
        el.className = 'snap-point';
        el.style.top = `${Math.round(y)}px`;
        return el;
      }),
    );
  }

  /* Wisch-Blättern: ein Wisch = genau eine Station weiter/zurück, egal wie viel Schwung.
     Natives Scrollen ist dafür abgeschaltet – außer in einer Infoleiste, deren Text länger ist. */
  const pages = () =>
    [...stationY.map((_, i) => scrollYFor(i)), maxScroll()].filter((y, i, all) => i === 0 || y - all[i - 1] > 1);
  let pageTarget = -1; // Ziel einer laufenden Blätter-Animation (für schnelle Folgewische)
  let touchY0 = 0;
  let touchDir = 0;
  let nativeTouch = false;

  function currentPage() {
    const ys = pages();
    if (pageTarget >= 0) return pageTarget;
    let best = 0;
    ys.forEach((y, i) => Math.abs(y - scrollY) < Math.abs(ys[best] - scrollY) && (best = i));
    return best;
  }

  addEventListener(
    'touchstart',
    (e) => {
      if (!snapViews() || e.touches.length > 1) return;
      touchY0 = e.touches[0].clientY;
      touchDir = 0;
      nativeTouch = false;
    },
    { passive: true },
  );
  addEventListener(
    'touchmove',
    (e) => {
      if (!snapViews() || e.touches.length > 1) return;
      const dy = touchY0 - e.touches[0].clientY;
      if (!touchDir && Math.abs(dy) > 4) {
        touchDir = Math.sign(dy);
        // Längerer Text in der Infoleiste: dort normal scrollen, solange es in diese Richtung geht
        const sheet = (e.target as Element).closest<HTMLElement>('.station');
        const room = sheet ? (touchDir > 0 ? sheet.scrollHeight - sheet.clientHeight - sheet.scrollTop : sheet.scrollTop) : 0;
        nativeTouch = room > 1;
      }
      if (!nativeTouch && e.cancelable) e.preventDefault();
    },
    { passive: false },
  );
  addEventListener(
    'touchend',
    (e) => {
      if (!snapViews() || nativeTouch || !touchDir) return;
      const dy = touchY0 - e.changedTouches[0].clientY;
      if (Math.abs(dy) < 24) return; // nur ein Antippen
      const ys = pages();
      const next = Math.min(Math.max(currentPage() + Math.sign(dy), 0), ys.length - 1);
      pageTarget = next;
      scrollTo({ top: ys[next], behavior: reduced.matches ? 'instant' : 'smooth' });
    },
    { passive: true },
  );

  /* ------------------------------------------------------- Layout */

  function layout() {
    vw = root.clientWidth;
    vh = innerHeight;
    headerH = header?.offsetHeight ?? 0;
    signH = document.querySelector<HTMLElement>('.sign')?.offsetHeight ?? 24;
    const { zoom } = cfg;
    const { width } = L;
    // Ganzzahliger Zoom (scharfe Pixel); die Map muss die Bildschirmbreite immer füllen
    const wish = clamp(Math.floor(Math.min(vw, vh) / zoom.viewSpan), zoom.min, zoom.max);
    scale = Math.max(wish, Math.ceil(vw / width));
    root.style.setProperty('--s', String(scale));
    fitLastView();
    snapCamera = true;
    updateSnaps();
  }

  /**
   * Handy: Die Map endet so knapp unter der Tür, dass in der letzten View Tür (mit Schild) und der
   * komplette Footer gleichzeitig zu sehen sind – passend zur Bildschirmhöhe jedes Handys.
   */
  function fitLastView() {
    if (!snapViews()) return void (mapEl!.style.height = '');
    const footerH = document.querySelector<HTMLElement>('.site-footer')?.offsetHeight ?? 0;
    const door = cfg.stations[segs];
    const doorView = (door.h + cfg.gap) * scale + signH + 10; // Gebäude + Schild über dem Wegpunkt
    const below = clamp(vh - footerH - headerH - doorView, 24, 400);
    mapEl!.style.height = `${Math.round(stationY[segs] * scale + below)}px`;
  }

  /* ---------------------------------------------- Hauptschleife */

  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.1); // Tab-Wechsel: keine Riesensprünge
    last = now;

    // 2. Figur bewegt sich mit begrenzter Geschwindigkeit auf dem Pfad Richtung Ziel (weit hinten: Sprint)
    const diff = targetS - heroS;
    const { speed, sprintFrom, sprintMax } = cfg.hero;
    pace = Math.round(clamp(Math.abs(diff) / sprintFrom, 1, sprintMax) * 4) / 4;
    const maxStep = reduced.matches ? Infinity : speed * pace * dt;
    heroS = Math.abs(diff) <= maxStep ? targetS : heroS + Math.sign(diff) * maxStep;
    walking = heroS !== targetS;

    // Laufrichtung aus der tatsächlichen Bewegung (dominante Achse)
    const p = pointAt(path, heroS);
    const dx = p.x - hx;
    const dy = p.y - hy;
    if (walking && Math.abs(dx) + Math.abs(dy) > 0.001) {
      row = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? ROW.left : ROW.right) : dy < 0 ? ROW.up : ROW.down;
    }
    hx = p.x;
    hy = p.y;

    const here = walking ? -1 : stationAt(heroS);
    if (here >= 0) row = ROW[cfg.stations[here].face];
    renderHero();

    // 3. Kamera (waagerecht)
    const camMoving = updateCamera(dt);
    renderHint();

    // 4. Inhalt
    setActive(here);
    positionPanel();

    if (walking || camMoving) requestAnimationFrame(frame);
    else running = false; // Ruhezustand: kein rAF, kein CPU-Verbrauch
  }

  function wake() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  function renderHero() {
    const { anchorX, anchorY } = cfg.hero;
    hero!.style.transform = `translate3d(${Math.round((hx - anchorX) * scale)}px, ${Math.round((hy - anchorY) * scale)}px, 0)`;
    hero!.style.setProperty('--row', String(row));
    hero!.style.setProperty('--pace', String(pace));
    hero!.classList.toggle('is-walking', walking && !reduced.matches);
  }

  /** Waagerecht: Ziel mittig halten (Desktop-Map); Handy-Map: fest in der Mitte */
  function updateCamera(dt: number) {
    const worldW = L.width * scale;
    const goal = pointAt(path, targetS);
    // Auf dem Desktop etwas Platz auf der Seite des Inhaltsfensters lassen
    const st = stationAt(targetS);
    const bias = st >= 0 && !mobile.matches ? (cfg.stations[st].panel === 'right' ? 1 : -1) * Math.min(vw * 0.14, 200) : 0;
    const tx =
      worldW <= vw || mobile.matches ? (worldW - vw) / 2 : clamp(goal.x * scale - vw / 2 + bias, 0, worldW - vw);

    const k = snapCamera || reduced.matches ? 1 : 1 - Math.exp(-dt * 5);
    snapCamera = false;
    camX += (tx - camX) * k;
    if (Math.abs(tx - camX) < 0.5) camX = tx;
    world!.style.transform = `translate3d(${-Math.round(camX)}px, 0, 0)`;
    return camX !== tx;
  }

  /** Hinweis am Bildrand, solange die Figur außerhalb des Bildes ist */
  function renderHint() {
    const top = (hy - cfg.hero.anchorY) * scale - scrollY;
    const bottom = hy * scale - scrollY;
    const dir = bottom < headerH + 8 ? 'up' : top > vh - 8 ? 'down' : '';
    hint!.dataset.dir = dir;
    if (!dir) return;
    const half = hint!.offsetWidth / 2 + 12;
    hint!.style.setProperty('--hint-x', `${Math.round(clamp(hx * scale - camX, half, vw - half))}px`);
  }

  function setActive(i: number) {
    if (i === active) return;
    panels[active]?.classList.remove('is-active');
    buildings[active]?.classList.remove('is-active');
    active = i;
    if (i < 0) return;
    panels[i]?.classList.add('is-active');
    buildings[i]?.classList.add('is-active');
    navLinks.forEach((a) => a.setAttribute('aria-current', String(a.dataset.nav === ids[i])));
    // Adresse merkt sich die Station (Teilen, Zurück-Button)
    history.replaceState(history.state, '', i === 0 ? location.pathname : `#${ids[i]}`);
  }

  /**
   * Inhaltsfenster neben dem Gebäude wie eine Sprechblase: möglichst oberhalb des Wegs,
   * mit Pfeil (data-tail, --tail-y) zum Gebäude. Scrollt mit der Seite (Handy: CSS-Leiste unten).
   */
  function positionPanel() {
    const panel = panels[active];
    if (!panel) return;
    if (mobile.matches) {
      // Leiste unten darf die Figur nicht verdecken; längerer Inhalt scrollt in der Leiste
      panel.style.maxHeight = `${Math.max(140, Math.round(vh - (focusPx(active) - (scrollY - scrollYFor(active))) - 28))}px`;
      return;
    }
    panel.style.maxHeight = '';
    const station = cfg.stations[active];
    const st = stationPoint(active);
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const sx = st.x * scale - camX;
    const gap = (station.halfW + 6) * scale + 30; // Platz für den Pfeil
    const margin = 16;
    let x = station.panel === 'right' ? sx + gap : sx - gap - w;
    if (x + w > vw - margin) x = sx - gap - w;
    if (x < margin) x = sx + gap;
    x = clamp(x, margin, vw - w - margin);

    // Pfeil zielt auf die Gebäudemitte; die Karte endet möglichst über dem Weg
    const target = (st.y - cfg.gap - station.h * 0.45) * scale;
    const aboveRoad = (st.y - cfg.pathHalf - 4) * scale - h;
    const top = scrollYFor(active) + headerH + margin; // oberer Bildrand, wenn die Station dran ist
    const y = Math.max(top, Math.min(target - h / 2, aboveRoad));
    panel.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
    panel.dataset.tail = x > sx ? 'left' : 'right';
    panel.style.setProperty('--tail-y', `${Math.round(clamp(target - y, 28, h - 28))}px`);
  }

  /* -------------------------------------------- Navigation & Events */

  function goTo(i: number, instant = false) {
    scrollTo({ top: scrollYFor(i), behavior: instant || reduced.matches ? 'instant' : 'smooth' });
  }

  /** Figur sofort an Station i stellen (Laden mit #anker, Tastatur-Fokus) */
  function placeAt(i: number) {
    scrollTo({ top: scrollYFor(i), behavior: 'instant' });
    targetS = heroS = stationS[i];
    const p = pointAt(path, heroS);
    hx = p.x;
    hy = p.y;
    snapCamera = true;
    wake();
  }

  navLinks.forEach((a) =>
    a.addEventListener('click', (e) => {
      const i = ids.indexOf(a.dataset.nav ?? '');
      if (i < 0) return;
      e.preventDefault();
      goTo(i);
    }),
  );
  document.querySelector('.brand')?.addEventListener('click', (e) => {
    e.preventDefault();
    goTo(0);
  });

  // Tastatur: Fokus in einem Inhaltsfenster holt die Figur sofort dorthin
  panels.forEach((panel, i) =>
    panel?.addEventListener('focusin', () => {
      if (active !== i) placeAt(i);
    }),
  );

  addEventListener('hashchange', () => {
    const i = ids.indexOf(location.hash.slice(1));
    if (i >= 0) goTo(i);
  });

  /* Einrasten: Endet das Scrollen zwischen zwei Stationen, geht es zur nächsten in
     Scroll-Richtung weiter – so bleibt die Figur immer an einer Station stehen. */
  let lastY = scrollY;
  let lastDir = 0;
  let touching = false;
  let settleTimer = 0;

  function settle() {
    pageTarget = -1;
    if (touching) return;
    const f = progress();
    const near = Math.round(f);
    if (Math.abs(f - near) <= cfg.scroll.hold / 2) {
      // Magnet (Handy): in der Halte-Zone sanft die paar Pixel nachrücken, bis das Haus ganz zu sehen ist
      // Desktop (mit Halt) und Handy ohne feste Views: in der Halte-Zone sanft genau auf die Station
      const magnet = cfg.scroll.magnet && (mobile.matches ? !snapViews() : cfg.scroll.pause > 0);
      if (magnet && Math.abs(scrollY - scrollYFor(near)) > 6) goTo(near);
      return;
    }
    if (cfg.scroll.snap) goTo(clamp(lastDir > 0 ? Math.ceil(f) : lastDir < 0 ? Math.floor(f) : near, 0, segs));
  }

  addEventListener(
    'scroll',
    () => {
      if (scrollY !== lastY) lastDir = Math.sign(scrollY - lastY);
      lastY = scrollY;
      clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settle, 220);
      targetS = targetFromScroll();
      renderHint();
      wake();
    },
    { passive: true },
  );
  addEventListener('touchstart', () => (touching = true), { passive: true });
  addEventListener(
    'touchend',
    () => {
      touching = false;
      clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settle, 220);
    },
    { passive: true },
  );

  let resizeTimer = 0;
  addEventListener('resize', () => {
    const keep = active >= 0 ? active : Math.round(progress());
    const before = { scale, vw, L };
    applyLayout(); // ggf. Wechsel Desktop ↔ Handy-Map (z. B. beim Drehen)
    layout();
    // Handy-Adressleiste ändert nur die Höhe: einfach weiterlaufen
    if (scale === before.scale && vw === before.vw && L === before.L) {
      // Höhe geändert (Adressleiste): Einrastpunkte neu, sonst einfach weiterlaufen
      targetS = targetFromScroll();
      wake();
      return;
    }
    // Neuer Zoom ändert die Seitenhöhe: dieselbe Station wieder einstellen
    placeAt(keep);
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => placeAt(keep), 150);
  });
  reduced.addEventListener('change', wake);

  /* Desktop: kurzer Halt an jeder Station. Überquert ein Mausrad-/Trackpad-Schritt eine Station,
     bleibt die Seite dort für SCROLL.pause ms stehen. Danach wird der ausklingende Restschwung
     derselben Bewegung ignoriert (Trackpad) – erst neues Scrollen geht weiter. */
  let holdUntil = 0;
  let heldAt = -1;
  let swallowTail = false;
  let lastAbs = 0;
  let lastWheel = 0;
  addEventListener(
    'wheel',
    (e) => {
      if (mobile.matches || !cfg.scroll.pause || e.ctrlKey) return;
      const now = performance.now();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
      const abs = Math.abs(dy);
      // Schwung klingt aus (kleiner werdende oder gleich kleine Trackpad-Schritte) – keine neue Bewegung.
      // Mausrad-Rasten sind groß und gleich groß und zählen deshalb als neues Scrollen.
      const fading = now - lastWheel < 120 && (abs < lastAbs || (abs <= lastAbs && abs < 40));
      lastAbs = abs;
      lastWheel = now;
      if (now < holdUntil) return e.preventDefault();
      if (swallowTail) {
        if (fading) return e.preventDefault();
        swallowTail = false;
      }
      if (heldAt >= 0 && Math.abs(scrollY - scrollYFor(heldAt)) > 40) heldAt = -1;
      const from = scrollY;
      const to = from + dy;
      for (let i = 0; i <= segs; i++) {
        const y = scrollYFor(i);
        if (i === heldAt || !((from < y && to >= y) || (from > y && to <= y))) continue;
        e.preventDefault();
        scrollTo({ top: y, behavior: reduced.matches ? 'instant' : 'smooth' });
        heldAt = i;
        holdUntil = now + cfg.scroll.pause;
        swallowTail = true;
        return;
      }
    },
    { passive: false },
  );

  /* ------------------------------------------------------- Start */

  // Die Station steckt in der Adresse (/#clips) – Scroll-Position nicht vom Browser wiederherstellen
  history.scrollRestoration = 'manual';
  layout();
  const start = ids.indexOf(location.hash.slice(1));
  placeAt(Math.max(start, 0));
  // Der Browser springt beim Laden evtl. noch zum Anker – danach erneut korrigieren
  addEventListener('load', () => start >= 0 && placeAt(start), { once: true });
  mapEl.classList.add('is-ready');

  if (import.meta.env.DEV) {
    Object.assign(window, {
      __pixelmap: {
        get stationS() {
          return stationS;
        },
        scrollYFor,
        get state() {
          return { heroS, targetS, scale, camX, active, walking, row, hx, hy };
        },
      },
    });
  }
}
