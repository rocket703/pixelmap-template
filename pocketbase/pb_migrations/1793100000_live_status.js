/// <reference path="../pb_data/types.d.ts" />
/**
 * Live-Status und Streamplan für die Pixelmap-Seite.
 *
 * - status:   genau ein Datensatz, mode = auto (nach Streamplan) | on (jetzt live) | off (offline)
 * - schedule: Streamplan, Uhrzeiten in Europe/Berlin; Ende vor Start = über Mitternacht
 * - users:    Login nur per Einmal-Code (OTP) an die E-Mail; Selbstregistrierung aus.
 *             Das Konto der Streamerin legt der Admin im Dashboard an (/_/ → users → New record).
 *
 * Lesen dürfen alle (die Seite zeigt den Status an), ändern nur angemeldete users.
 */
const AUTH = '@request.auth.collectionName = "users"';
const TIME = '^([01][0-9]|2[0-3]):[0-5][0-9]$';

migrate(
  (app) => {
    const status = new Collection({
      type: 'base',
      name: 'status',
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: AUTH,
      deleteRule: null,
      fields: [
        { type: 'select', name: 'mode', required: true, maxSelect: 1, values: ['auto', 'on', 'off'] },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
    });
    app.save(status);

    const record = new Record(status);
    record.set('mode', 'auto');
    app.save(record);

    const schedule = new Collection({
      type: 'base',
      name: 'schedule',
      listRule: '',
      viewRule: '',
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        { type: 'select', name: 'weekday', required: true, maxSelect: 1, values: ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'] },
        { type: 'text', name: 'start', required: true, pattern: TIME },
        { type: 'text', name: 'end', required: true, pattern: TIME },
        { type: 'text', name: 'title', max: 60 },
      ],
    });
    app.save(schedule);

    // Beispielplan (kann im Studio geändert werden)
    for (const [weekday, start, end, title] of [
      ['mo', '19:00', '23:00', 'Cozy Montag'],
      ['mi', '19:00', '23:00', 'Koop mit der Community'],
      ['fr', '20:00', '01:00', 'Horror Night'],
      ['so', '15:00', '19:00', 'Just Chatting & Indies'],
    ]) {
      const slot = new Record(schedule);
      slot.set('weekday', weekday);
      slot.set('start', start);
      slot.set('end', end);
      slot.set('title', title);
      app.save(slot);
    }

    const users = app.findCollectionByNameOrId('users');
    users.createRule = null; // niemand kann sich selbst registrieren
    users.passwordAuth.enabled = false;
    users.otp.enabled = true;
    users.otp.duration = 600;
    users.otp.length = 6;
    users.otp.emailTemplate.subject = 'Dein Login-Code fürs Studio';
    users.otp.emailTemplate.body =
      '<p>Hallo,</p><p>dein Code für das Studio: <strong>{OTP}</strong></p><p>Er gilt 10 Minuten. Wenn du ihn nicht angefordert hast, ignoriere diese E-Mail einfach.</p>';
    app.save(users);
  },
  (app) => {
    for (const name of ['schedule', 'status']) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {
        /* schon gelöscht */
      }
    }
    const users = app.findCollectionByNameOrId('users');
    users.otp.enabled = false;
    users.passwordAuth.enabled = true;
    app.save(users);
  },
);
