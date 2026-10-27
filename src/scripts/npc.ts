/**
 * NPCs auf dem Hundeplatz: Bulldogge und Entenküken laufen frei herum.
 *
 * Sparsam gebaut – keine eigene Animationsschleife:
 * - Laufen = CSS-Übergang auf transform (läuft auf der Grafikkarte)
 * - Beine/Fressen = CSS-Sprite-Animation (wie bei der Figur)
 * - JavaScript entscheidet nur alle paar Sekunden, was als Nächstes passiert
 * - Ist der Platz nicht im Bild oder der Tab im Hintergrund, pausiert alles
 * Bei prefers-reduced-motion schläft der Hund im Körbchen, die Enten schwimmen still.
 */

type State = 'walk' | 'run' | 'stand' | 'eat' | 'sleep' | 'swim';

interface Pt {
  x: number;
  y: number;
}

interface Park {
  x: number;
  y: number;
  w: number;
  h: number;
  bed: Pt;
  bowls: Pt;
  pond: { cx: number; cy: number; rx: number; ry: number };
  duckSpeed: number;
}

interface NpcConfig {
  /** Media-Query für die Handy-Map; je Map liegt der Platz woanders */
  mobileQuery: string;
  parks: { desktop: Park; mobile: Park };
  dog: { walk: number; run: number; anchorX: number; anchorY: number };
  duck: { anchorX: number; anchorY: number };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/* ------------------------------------------------ Pausierbares Warten */

let paused = false;
let resume: (() => void)[] = [];

async function wait(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
  while (paused) await new Promise<void>((r) => resume.push(r));
}

function setPaused(value: boolean, mapEl: HTMLElement) {
  if (paused === value) return;
  paused = value;
  mapEl.classList.toggle('npc-paused', value);
  if (!value) {
    resume.forEach((r) => r());
    resume = [];
  }
}

/* ------------------------------------------------------------ Figuren */

class Actor {
  x = 0;
  y = 0;

  constructor(
    readonly el: HTMLElement,
    private anchor: Pt,
    private zBase: number,
    start: Pt,
  ) {
    this.place(start.x, start.y, 0);
  }

  /** Position in Map-Pixeln; dur = Dauer des CSS-Übergangs in Sekunden */
  place(x: number, y: number, dur: number) {
    this.el.style.transitionDuration = `${dur}s`;
    this.el.style.setProperty('--nx', String(Math.round(x - this.anchor.x)));
    this.el.style.setProperty('--ny', String(Math.round(y - this.anchor.y)));
    this.el.style.zIndex = String(Math.max(1, Math.round(y - this.zBase)));
    this.x = x;
    this.y = y;
  }

  set(state: State, dir?: 'left' | 'right') {
    this.el.dataset.state = state;
    if (dir) this.el.dataset.dir = dir;
  }

  /** Läuft zu (x, y) und wartet, bis es angekommen ist */
  async go(x: number, y: number, speed: number, state: State) {
    const dist = Math.hypot(x - this.x, y - this.y);
    if (dist < 1) return;
    this.set(state, Math.abs(x - this.x) < 1 ? undefined : x < this.x ? 'left' : 'right');
    const dur = dist / speed;
    this.place(x, y, dur);
    await wait(dur * 1000);
  }
}

class Duck extends Actor {
  swimming = false;
  fleeing = false;
}

/* ------------------------------------------------------------- Start */

export function initNpc() {
  const cfgEl = document.getElementById('npc-config');
  const mapEl = document.getElementById('map');
  const parkEl = document.getElementById('park');
  const dogEl = document.getElementById('dog');
  const card = document.getElementById('npc-card');
  if (!cfgEl || !mapEl || !parkEl || !dogEl || !card) return;

  const cfg: NpcConfig = JSON.parse(cfgEl.textContent ?? '{}');
  const mobileQ = matchMedia(cfg.mobileQuery);
  let park = mobileQ.matches ? cfg.parks.mobile : cfg.parks.desktop;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Geometrie */
  const inPond = (p: Pt, margin = 0) => ((p.x - park.pond.cx) / (park.pond.rx + margin)) ** 2 + ((p.y - park.pond.cy) / (park.pond.ry + margin)) ** 2 <= 1;
  const pondPoint = (): Pt => {
    const a = rand(0, Math.PI * 2);
    const r = Math.sqrt(Math.random()) * 0.6;
    return { x: park.pond.cx + Math.cos(a) * park.pond.rx * r, y: park.pond.cy + 3 + Math.sin(a) * park.pond.ry * r };
  };
  /** Uferpunkt in Richtung von p */
  const shore = (p: Pt, margin = 5): Pt => {
    const a = Math.atan2((p.y - park.pond.cy) / park.pond.ry, (p.x - park.pond.cx) / park.pond.rx);
    return { x: park.pond.cx + Math.cos(a) * (park.pond.rx + margin), y: park.pond.cy + Math.sin(a) * (park.pond.ry + margin) };
  };
  const landPoint = (near?: Pt, radius = 30): Pt => {
    for (let i = 0; i < 30; i++) {
      const p = near
        ? { x: near.x + rand(-radius, radius), y: near.y + rand(-radius, radius) }
        : { x: rand(park.x + 10, park.x + park.w - 10), y: rand(park.y + 12, park.y + park.h - 4) };
      const inside = p.x > park.x + 8 && p.x < park.x + park.w - 8 && p.y > park.y + 10 && p.y < park.y + park.h - 3;
      if (inside && !inPond(p, 6)) return p;
    }
    return { x: park.bed.x + 14, y: park.bed.y - 14 };
  };

  /* Figuren */
  const dog = new Actor(dogEl, { x: cfg.dog.anchorX, y: cfg.dog.anchorY }, park.y, park.bed);
  dog.set('sleep', 'right');
  const ducks = [...document.querySelectorAll<HTMLElement>('.duck')].map((el, i) => {
    const swimming = i === 0 || reduced;
    const start = swimming ? pondPoint() : landPoint(shore(pondPoint(), 8), 14);
    const d = new Duck(el, { x: cfg.duck.anchorX, y: cfg.duck.anchorY }, park.y, start);
    d.swimming = swimming;
    d.set(d.swimming ? 'swim' : 'stand', i % 2 ? 'left' : 'right');
    return d;
  });

  /** Anderer Platz (Wechsel Desktop ↔ Handy-Map): alle sofort dorthin setzen */
  function moveToPark() {
    park = mobileQ.matches ? cfg.parks.mobile : cfg.parks.desktop;
    dog.place(park.bed.x, park.bed.y, 0);
    dog.set('sleep');
    ducks.forEach((d) => {
      const p = pondPoint();
      d.place(p.x, p.y, 0);
      d.swimming = true;
      d.set('swim');
    });
  }
  mobileQ.addEventListener('change', moveToPark);

  setupCard();
  if (reduced) return;

  /* Pausieren, solange der Platz nicht zu sehen ist */
  let visible = false;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    setPaused(!visible || document.hidden, mapEl);
  }, { rootMargin: '150px' }).observe(parkEl);
  document.addEventListener('visibilitychange', () => setPaused(!visible || document.hidden, mapEl));
  setPaused(true, mapEl);

  /* ---------------------------------------------------- Hund */

  async function nap() {
    await dog.go(park.bed.x, park.bed.y, cfg.dog.walk, 'walk');
    dog.set('sleep');
    await wait(rand(9000, 16000));
    dog.set('stand');
    await wait(600);
  }

  async function eat() {
    await dog.go(park.bowls.x - 6, park.bowls.y + 1, cfg.dog.walk, 'walk');
    dog.set('eat', 'right');
    await wait(rand(3000, 5000));
    await dog.go(park.bowls.x + 4, park.bowls.y + 1, cfg.dog.walk, 'walk');
    dog.set('eat', 'right');
    await wait(rand(1500, 2500));
    dog.set('stand');
  }

  async function wander() {
    for (let i = 0, n = Math.round(rand(2, 3)); i < n; i++) {
      const p = landPoint();
      await dog.go(p.x, p.y, cfg.dog.walk, 'walk');
      dog.set('stand');
      await wait(rand(800, 2500));
    }
  }

  async function chase() {
    const target = pick(ducks.filter((d) => !d.swimming && !d.fleeing));
    if (!target) return wander();
    // Kurz stutzen, dann los
    dog.set('stand', target.x < dog.x ? 'left' : 'right');
    dogEl!.classList.add('is-alert');
    await wait(500);
    dogEl!.classList.remove('is-alert');
    void flee(target);
    await dog.go(target.x, target.y, cfg.dog.run, 'run');
    // Am Ufer stehen bleiben und verdutzt gucken
    const s = shore(dog, 7);
    await dog.go(s.x, s.y, cfg.dog.run, 'run');
    dog.set('stand', park.pond.cx < dog.x ? 'left' : 'right');
    await wait(rand(1500, 2500));
  }

  async function dogLoop() {
    await wait(rand(2000, 5000)); // erst noch etwas weiterschlafen
    for (;;) {
      const r = Math.random();
      if (r < 0.22) await nap();
      else if (r < 0.4) await eat();
      else if (r < 0.7) await chase();
      else await wander();
    }
  }

  /* ---------------------------------------------------- Enten */

  async function flee(d: Duck) {
    d.fleeing = true;
    await wait(250);
    const s = shore(d, 0);
    await d.go(s.x, s.y, park.duckSpeed * 3.5, 'walk');
    d.swimming = true;
    const p = pondPoint();
    await d.go(p.x, p.y, park.duckSpeed * 1.5, 'swim');
    d.set('swim');
    d.fleeing = false;
  }

  async function duckLoop(d: Duck) {
    await wait(rand(0, 2000));
    for (;;) {
      if (d.fleeing) {
        await wait(400);
        continue;
      }
      if (d.swimming) {
        if (Math.random() < 0.25) {
          // an Land watscheln
          const s = shore(d, 6);
          await d.go(s.x, s.y, park.duckSpeed * 0.7, 'swim');
          if (d.fleeing) continue;
          d.swimming = false;
          d.set('stand');
        } else {
          const p = pondPoint();
          await d.go(p.x, p.y, park.duckSpeed * 0.6, 'swim');
          if (d.fleeing) continue;
          d.set('swim');
        }
      } else if (Math.random() < 0.2) {
        const s = shore(d, 0);
        await d.go(s.x, s.y, park.duckSpeed, 'walk');
        if (d.fleeing) continue;
        d.swimming = true;
        d.set('swim');
      } else {
        const p = landPoint(shore(d, 10), 16);
        await d.go(p.x, p.y, park.duckSpeed, 'walk');
        if (d.fleeing) continue;
        d.set('stand');
      }
      await wait(rand(700, 2600));
    }
  }

  void dogLoop();
  ducks.forEach((d) => void duckLoop(d));

  /* ---------------------------------------------------- Infokarte */

  function setupCard() {
    const close = card!.querySelector<HTMLButtonElement>('.npc-card-close');
    let openedAt = 0;
    const hide = () => {
      card!.hidden = true;
    };
    dogEl!.addEventListener('click', (e) => {
      e.stopPropagation();
      dogEl!.classList.add('is-happy');
      setTimeout(() => dogEl!.classList.remove('is-happy'), 2200);
      card!.hidden = false;
      const r = dogEl!.getBoundingClientRect();
      const header = document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 0;
      const w = card!.offsetWidth;
      const h = card!.offsetHeight;
      const vw = document.documentElement.clientWidth;
      const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, 16), vw - w - 16);
      const above = r.top - h - 20 > header + 8;
      card!.style.left = `${Math.round(left + scrollX)}px`;
      card!.style.top = `${Math.round((above ? r.top - h - 20 : r.bottom + 16) + scrollY)}px`;
      openedAt = scrollY;
      close?.focus({ preventScroll: true });
    });
    close?.addEventListener('click', hide);
    addEventListener('keydown', (e) => e.key === 'Escape' && hide());
    addEventListener('click', (e) => !card!.hidden && !card!.contains(e.target as Node) && hide());
    addEventListener('scroll', () => !card!.hidden && Math.abs(scrollY - openedAt) > 400 && hide(), { passive: true });
  }
}
