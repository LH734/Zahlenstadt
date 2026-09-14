/*
 * Zahlenstadt – Tests des Spielablaufs (Pflichtenheft 9.4, 9.5, Abschnitte 4, 5, 8)
 * Nutzt nur js/spiel.js (ohne Oberfläche) mit simulierter Uhr.
 * codeLesen wird von test/test.html übergeben (eigene, unabhängige Entschlüsselung).
 */
(function (root) {
  'use strict';

  const S = root.Spiel, A = root.Aufgaben, B = root.Bauplan;

  function speicherImSpeicher() {
    const daten = {};
    return {
      getItem: k => (k in daten ? daten[k] : null),
      setItem: (k, v) => { daten[k] = String(v); },
      removeItem: k => { delete daten[k]; }
    };
  }

  const falscheZahl = a => String(a.loesung + 1);
  const richtigeZahl = a => String(a.loesung);

  /** Neues Spiel, Tutorial gelöst → erste Etappe läuft */
  function spielImGang(jetzt) {
    const z = S.neuerZustand(jetzt);
    S.starten(z, jetzt);
    S.eingabe(z, richtigeZahl(z.aufgabe), jetzt);
    return z;
  }

  /** Aufgabe lösen; fehlerVorher = Anzahl falscher Eingaben vorher (0, 1 oder 2 = Lösungskarte) */
  function loese(z, uhr, fehlerVorher) {
    const ereignisse = [];
    if (fehlerVorher >= 1) {
      ereignisse.push(...S.eingabe(z, falscheZahl(z.aufgabe), uhr.t));
      uhr.t = Math.max(uhr.t, z.sperreBis);
    }
    if (fehlerVorher >= 2) {
      ereignisse.push(...S.eingabe(z, falscheZahl(z.aufgabe), uhr.t));
      uhr.t += S.KARTE_MS;
      ereignisse.push(...S.loesungskarteSchliessen(z, uhr.t));
      return ereignisse;
    }
    ereignisse.push(...S.eingabe(z, richtigeZahl(z.aufgabe), uhr.t));
    return ereignisse;
  }

  const hat = (ereignisse, art) => ereignisse.some(e => e.art === art);

  function laufen(codeLesen) {
    const tests = [];
    const pruefe = (bereich, name, ok, detail) => tests.push({ bereich, name, ok: !!ok, detail: detail || '' });

    // ---------------------------------------------------------------- 9.4 Sperre
    (function () {
      const t0 = 1700000000000;
      const z = spielImGang(t0);
      const aufgabeVorher = z.aufgabe.anzeige;
      const ev = S.eingabe(z, falscheZahl(z.aufgabe), t0);
      pruefe('9.4 Sperre', 'Falsche Eingabe startet 15-s-Sperre mit Zeitstempel', hat(ev, 'sperre') && z.sperreBis === t0 + 15000, 'sperreBis = ' + z.sperreBis);

      const speicher = speicherImSpeicher();
      S.speichern(z, speicher);
      const neu = S.laden(speicher).zustand;
      pruefe('9.4 Sperre', 'Nach „Neuladen" (speichern → laden) ist die Sperre noch aktiv', neu && S.istGesperrt(neu, t0 + 5000));
      pruefe('9.4 Sperre', 'Restzeit läuft weiter (nach 5 s noch 10 s)', neu && S.sperreRest(neu, t0 + 5000) === 10000, 'Rest ' + (neu && S.sperreRest(neu, t0 + 5000)) + ' ms');
      pruefe('9.4 Sperre', 'Aufgabe bleibt stehen, gleiche Zahlen', neu && neu.aufgabe.anzeige === aufgabeVorher);
      const gesperrt = S.eingabe(neu, richtigeZahl(neu.aufgabe), t0 + 14999);
      pruefe('9.4 Sperre', 'Während der Sperre wird keine Eingabe bewertet', hat(gesperrt, 'gesperrt') && neu.richtig === z.richtig);
      const frei = S.eingabe(neu, richtigeZahl(neu.aufgabe), t0 + 15000);
      pruefe('9.4 Sperre', 'Nach 15 s ist die Eingabe frei', hat(frei, 'richtig'));

      // Neuladen mit einem neuen Zeitpunkt, der nach der Sperre liegt
      const z2 = spielImGang(t0);
      S.eingabe(z2, falscheZahl(z2.aufgabe), t0);
      const sp2 = speicherImSpeicher();
      S.speichern(z2, sp2);
      pruefe('9.4 Sperre', 'Nach langer Pause (Tab zu, 1 min später) ist die Sperre abgelaufen', !S.istGesperrt(S.laden(sp2).zustand, t0 + 60000));

      if (root.localStorage) {
        const schluessel = 'zahlenstadt.test.sperre';
        try {
          const z3 = spielImGang(Date.now());
          S.eingabe(z3, falscheZahl(z3.aufgabe), Date.now());
          S.speichern(z3, root.localStorage, schluessel);
          const echt = S.laden(root.localStorage, schluessel).zustand;
          pruefe('9.4 Sperre', 'Echter localStorage: Zeitstempel übersteht Speichern und Laden', echt && echt.sperreBis === z3.sperreBis && S.istGesperrt(echt, Date.now()));
        } finally {
          S.loeschen(root.localStorage, schluessel);
        }
      }
    })();

    // ------------------------------------------------------- Lösungskarte (Abschnitt 4)
    (function () {
      const uhr = { t: 1000 };
      const z = spielImGang(uhr.t);
      const typ = z.aufgabe.typ, anzeige = z.aufgabe.anzeige, geloestVorher = z.geloest, gebautVorher = z.gebaut.length;
      S.eingabe(z, falscheZahl(z.aufgabe), uhr.t);
      uhr.t = z.sperreBis;
      const ev = S.eingabe(z, falscheZahl(z.aufgabe), uhr.t);
      pruefe('Fehlerlogik', 'Zweiter Fehler öffnet die Lösungskarte (ohne Sperre)', hat(ev, 'loesungskarte') && z.sperreBis === 0);
      pruefe('Fehlerlogik', 'Während der Karte wird keine Eingabe bewertet', hat(S.eingabe(z, richtigeZahl(z.aufgabe), uhr.t + 100), 'ignoriert'));
      const zufrueh = S.loesungskarteSchliessen(z, uhr.t + 7999);
      pruefe('Fehlerlogik', 'Button vor 8 s wirkungslos', hat(zufrueh, 'nochNicht') && z.loesungskarteSeit > 0);
      const ok = S.loesungskarteSchliessen(z, uhr.t + 8000);
      pruefe('Fehlerlogik', 'Nach 8 s: derselbe Typ mit neuen Zahlen', hat(ok, 'neueAufgabe') && z.aufgabe.typ === typ && z.aufgabe.anzeige !== anzeige);
      pruefe('Fehlerlogik', 'Lösungskarte baut nichts, Aufgabe zählt nicht als gelöst', z.geloest === geloestVorher && z.gebaut.length === gebautVorher);
      pruefe('Fehlerlogik', 'Zähler: jede falsche Eingabe = 1 falsch', z.falsch === 2);
      const speicher = speicherImSpeicher();
      const z2 = spielImGang(0);
      S.eingabe(z2, falscheZahl(z2.aufgabe), 0);
      S.eingabe(z2, falscheZahl(z2.aufgabe), 15000);
      S.speichern(z2, speicher);
      const z2neu = S.laden(speicher).zustand;
      pruefe('Fehlerlogik', 'Lösungskarte bleibt nach Neuladen offen, 8 s zählen weiter', S.karteRest(z2neu, 18000) === 5000);
      const z3 = spielImGang(0), falschVorher = z3.falsch;
      pruefe('Fehlerlogik', 'Leere Eingabe wird nicht bewertet (kein Fehler, keine Sperre)', hat(S.eingabe(z3, '', 0), 'leer') && z3.falsch === falschVorher && !S.istGesperrt(z3, 1));
    })();

    // ------------------------------------------------------ Stufenautomatik (Abschnitt 5)
    (function () {
      const uhr = { t: 0 };
      let z = spielImGang(0);
      S.stufeWaehlen(z, 'G');
      z.automatikPause = 0;                       // Aufstieg ab Grundstufe prüfen
      let ev = [];
      for (let i = 0; i < 4; i++) ev = ev.concat(loese(z, uhr, 0));
      pruefe('Stufen', '4 richtige in Folge: noch kein Aufstieg', z.stufe === 'G' && !ev.some(e => e.art === 'stufe'));
      ev = loese(z, uhr, 0);
      const hoch = ev.find(e => e.art === 'stufe');
      pruefe('Stufen', '5 richtige in Folge → Stufe hoch (G → H)', z.stufe === 'H' && hoch && hoch.richtung === 'hoch');
      pruefe('Stufen', 'Meldung „Du bist jetzt in der Hauptstufe!"', hoch && hoch.text === 'Du bist jetzt in der Hauptstufe!');
      while (z.etappe < S.EXPERTE_AB_ETAPPE) loese(z, uhr, 0);
      pruefe('Stufen', 'Etappe 1–2: Automatik gibt keine Expertenstufe (trotz lauter richtiger Aufgaben)', z.stufe === 'H');
      ev = [];
      for (let i = 0; i < 5 && z.stufe !== 'E'; i++) ev = ev.concat(loese(z, uhr, 0));
      const experte = ev.find(e => e.art === 'stufe');
      pruefe('Stufen', 'Ab Etappe 3: Aufstieg in die Expertenstufe mit Meldung', z.stufe === 'E' && experte && experte.text === 'Du bist jetzt in der Expertenstufe!');
      for (let i = 0; i < 6; i++) loese(z, uhr, 0);
      pruefe('Stufen', 'Expertenstufe ist die höchste Stufe', z.stufe === 'E');

      const start = spielImGang(0);
      for (let i = 0; i < 10; i++) loese(start, uhr, 0);
      pruefe('Stufen', 'Wer von Anfang an alles richtig hat, startet auf der Hauptstufe und bleibt in Etappe 1–2 dort', start.stufe === 'H' && start.etappe === 3);

      z = spielImGang(0);
      ev = loese(z, uhr, 1).concat(loese(z, uhr, 2));
      const runter = ev.find(e => e.art === 'stufe');
      pruefe('Stufen', '2 Aufgaben in Folge mit Fehler → Stufe runter (H → G)', z.stufe === 'G' && runter && runter.richtung === 'runter');
      pruefe('Stufen', 'Neutrale Meldung „Wir nehmen ein etwas kleineres Baumaß."', runter && runter.text === 'Wir nehmen ein etwas kleineres Baumaß.');

      z = spielImGang(0);
      loese(z, uhr, 1); loese(z, uhr, 0); loese(z, uhr, 1);
      pruefe('Stufen', 'Fehler, richtig, Fehler → keine Änderung (nicht in Folge)', z.stufe === 'H');

      z = spielImGang(0);
      S.stufeWaehlen(z, 'G');
      for (let i = 0; i < 5; i++) loese(z, uhr, 0);
      pruefe('Stufen', 'Manuelle Wahl: 5 Aufgaben ohne Automatik (5 richtige → bleibt G)', z.stufe === 'G' && z.automatikPause === 0);
      for (let i = 0; i < 5; i++) loese(z, uhr, 0);
      pruefe('Stufen', 'Danach greift die Automatik wieder (5 richtige → H)', z.stufe === 'H');

      z = spielImGang(0);
      const typ = z.aufgabe.typ;
      S.stufeWaehlen(z, 'E');
      pruefe('Stufen', 'Unberührte Aufgabe wird bei manueller Wahl in der neuen Stufe neu gestellt', z.aufgabe.stufe === 'E' && z.aufgabe.typ === typ);
      S.eingabe(z, falscheZahl(z.aufgabe), 0);
      const anzeige = z.aufgabe.anzeige;
      S.stufeWaehlen(z, 'G');
      pruefe('Stufen', 'Nach einem Fehlversuch bleibt die Aufgabe stehen (keine Flucht aus der Sperre)', z.aufgabe.anzeige === anzeige && S.istGesperrt(z, 1));
    })();

    // ---------------------------------------------------- Tipp-Knopf, „hängt" (Abschnitte 4, 8)
    (function () {
      const uhr = { t: 0 };
      const z = spielImGang(0);
      const typ = z.aufgabe.typ;
      loese(z, uhr, 1);
      pruefe('Tipp und hängt', 'Nach einem Fehler dieses Typs noch kein Tipp-Knopf', (z.fehlerJeTyp[typ] || 0) === 1);
      // denselben Typ erzwingen: zweiter Fehler bei einer neuen Aufgabe desselben Typs
      z.aufgabe.typ = typ;
      S.eingabe(z, falscheZahl(z.aufgabe), uhr.t);
      pruefe('Tipp und hängt', 'Ab dem zweiten Fehler desselben Typs erscheint der Tipp-Knopf', S.tippSichtbar(z));
      const speicher = speicherImSpeicher();
      S.speichern(z, speicher);
      pruefe('Tipp und hängt', 'Tipp-Zähler gilt über den gespeicherten Spielstand (nach Neuladen)', S.tippSichtbar(S.laden(speicher).zustand));

      const z2 = spielImGang(0);
      S.eingabe(z2, falscheZahl(z2.aufgabe), 0);
      S.eingabe(z2, falscheZahl(z2.aufgabe), 15000);
      pruefe('Tipp und hängt', 'Zwei Fehler in Folge: noch kein „hängt"', !S.haengt(z2));
      S.loesungskarteSchliessen(z2, 23000);
      S.eingabe(z2, falscheZahl(z2.aufgabe), 23000);
      pruefe('Tipp und hängt', 'Drei Fehler in Folge → „hängt"-Symbol', S.haengt(z2) && S.status(z2).haengt);
      S.eingabe(z2, richtigeZahl(z2.aufgabe), 38000);
      pruefe('Tipp und hängt', 'Richtige Eingabe nimmt „hängt" zurück', !S.haengt(z2));
    })();

    // ---------------------------------------------- Etappen, Rotation, Bautempo (2, 3, 5, 6.1)
    (function () {
      let rotationOk = true, paarOk = true, wiederholungOk = true, grossOk = true, zaehlerOk = true, bautempoOk = true;
      let detail = '';
      for (let spiel = 0; spiel < 200; spiel++) {
        const uhr = { t: 0 };
        const z = spielImGang(0);
        const stufen = ['G', 'H', 'E'];
        let letzterTyp = 'vorrang';
        const typenJeEtappe = {};
        while (z.etappe <= 10) {
          const etappe = z.etappe, schritt = z.schritt, typ = z.aufgabe.typ;
          (typenJeEtappe[etappe] = typenJeEtappe[etappe] || []).push(typ);
          if (typ === letzterTyp) { wiederholungOk = false; detail = 'Wiederholung ' + typ + ' in Etappe ' + etappe; }
          const e = B.etappe(etappe);
          if ((typ === 'grossbauwerk') !== (schritt === e.normal)) { grossOk = false; detail = 'Großbauwerk an falscher Stelle in Etappe ' + etappe; }
          letzterTyp = typ;
          if (Math.random() < 0.2) S.stufeWaehlen(z, stufen[Math.floor(Math.random() * 3)]);
          const gebautVorher = z.gebaut.length;
          loese(z, uhr, Math.random() < 0.3 ? 1 : 0);
          if (z.gebaut.length !== gebautVorher + 1) bautempoOk = false;
        }
        for (let e = 1; e <= 10; e++) {
          const t = typenJeEtappe[e].filter(x => x !== 'grossbauwerk');
          const soll = B.etappe(e).normal;
          if (t.length !== soll || new Set(t).size !== soll) { rotationOk = false; detail = 'Etappe ' + e + ': ' + t.join(', '); }
          if ((typenJeEtappe[e].length !== soll + (B.etappe(e).gross ? 1 : 0))) zaehlerOk = false;
          if (e < 10) {
            const zwei = new Set(t.concat(typenJeEtappe[e + 1].filter(x => x !== 'grossbauwerk')));
            if (zwei.size !== 7) { paarOk = false; detail = 'Etappen ' + e + '+' + (e + 1) + ' ohne alle 7 Typen'; }
          }
        }
      }
      pruefe('Etappen', '200 simulierte Spiele: jede Etappe hat lauter verschiedene Typen (5 bzw. 6)', rotationOk, detail);
      pruefe('Etappen', 'Je zwei aufeinanderfolgende Etappen enthalten alle sieben Typen', paarOk, detail);
      pruefe('Etappen', 'Typ der letzten Aufgabe wird nie direkt wiederholt (ohne Lösungskarte)', wiederholungOk, detail);
      pruefe('Etappen', 'Etappe 1–4: 5 Aufgaben; Etappe 5–7 und Endlos-Blöcke: 6 Aufgaben + Großbauwerk', grossOk && zaehlerOk, detail);
      pruefe('Etappen', 'Jede gelöste Aufgabe baut genau einen Abschnitt – auf jeder Stufe', bautempoOk);

      const uhr = { t: 0 };
      const z = spielImGang(0);
      let ev = [];
      while (z.etappe <= 7) ev = ev.concat(loese(z, uhr, 0));
      pruefe('Etappen', 'Nach Etappe 4 Meldung „Mindestziel", nach Etappe 7 Endlosmodus', hat(ev, 'mindestziel') && hat(ev, 'endlos') && z.etappe === 8);
      const namen = z.gebaut.filter(g => g.e === 6 || g.e === 7).map(g => B.abschnitt(g.e, g.s).name);
      pruefe('Etappen', 'Bauplan: Anzeigetafel (Etappe 6) und Zugbrücke (Etappe 7) werden gebaut', namen.indexOf('Anzeigetafel') >= 0 && namen.indexOf('Zugbrücke') >= 0);
      ev = [];
      for (let i = 0; i < 36; i++) ev = ev.concat(loese(z, uhr, 0));
      const wachstum = ev.filter(e => e.art === 'wachstum').map(e => e.name);
      pruefe('Etappen', 'Endlosmodus: neue Wachstumsstufe alle 12 Aufgaben', wachstum.join(',') === 'Kleinstadt,Stadt,Metropole', wachstum.join(', '));
    })();

    // ------------------------------------------------------------ Speicherung (7)
    (function () {
      const uhr = { t: 0 };
      const z = spielImGang(0);
      for (let i = 0; i < 12; i++) loese(z, uhr, i % 4 === 0 ? 1 : 0);
      const speicher = speicherImSpeicher();
      S.speichern(z, speicher);
      const neu = S.laden(speicher);
      pruefe('Speicherung', 'Kompletter Spielstand übersteht Speichern und Laden unverändert', JSON.stringify(neu.zustand) === JSON.stringify(z));
      pruefe('Speicherung', 'Schlüssel mit Präfix „zahlenstadt."', S.SCHLUESSEL.indexOf('zahlenstadt.') === 0 && speicher.getItem('zahlenstadt.spielstand') !== null);
      const alt = JSON.parse(speicher.getItem(S.SCHLUESSEL));
      alt.version = 0;
      speicher.setItem(S.SCHLUESSEL, JSON.stringify(alt));
      const ergebnis = S.laden(speicher);
      pruefe('Speicherung', 'Stand mit anderer Version wird erkannt und verworfen', ergebnis.zustand === null && ergebnis.verworfen);
      speicher.setItem(S.SCHLUESSEL, '{kaputt');
      pruefe('Speicherung', 'Beschädigter Stand blockiert das Spiel nicht', S.laden(speicher).zustand === null);
    })();

    // --------------------------------------------------------- Abschlusscode (8)
    (function () {
      if (typeof codeLesen !== 'function') {
        pruefe('Abschlusscode', 'codeLesen verfügbar', false, 'codeLesen fehlt');
        return;
      }
      const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let rundOk = true, formOk = true, detail = '';
      const codes = [];
      for (let i = 0; i < 5000; i++) {
        const z = S.neuerZustand(0);
        z.grundstein = Math.random() < 0.95;
        z.etappe = 1 + Math.floor(Math.random() * 12);
        z.endlosGeloest = z.etappe > 7 ? Math.floor(Math.random() * 120) : 0;
        z.stufe = ['G', 'H', 'E'][Math.floor(Math.random() * 3)];
        z.richtig = Math.floor(Math.random() * 400);
        z.falsch = Math.floor(Math.random() * 400);
        const code = S.abschlusscode(z);
        codes.push(code);
        if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(code)) formOk = false;
        const l = codeLesen(code);
        const etappeSoll = !z.grundstein ? 0 : z.etappe <= 7 ? z.etappe : 8 + Math.min(7, Math.floor(z.endlosGeloest / 12));
        if (!l.gueltig || l.etappe !== etappeSoll || l.stufe !== z.stufe || l.richtig !== Math.min(255, z.richtig) || l.falsch !== Math.min(255, z.falsch)) {
          rundOk = false;
          detail = code + ' → ' + JSON.stringify(l);
        }
      }
      pruefe('Abschlusscode', '6 Zeichen aus Großbuchstaben und Ziffern (ohne 0, O, 1, I)', formOk);
      pruefe('Abschlusscode', '5 000 Zufallsstände: codeLesen liefert Etappe, Stufe, richtig, falsch zurück', rundOk, detail);
      const z255 = S.neuerZustand(0);
      z255.grundstein = true; z255.richtig = 999; z255.falsch = 300;
      const l255 = codeLesen(S.abschlusscode(z255));
      pruefe('Abschlusscode', 'Zähler werden bei 255 gedeckelt', l255.richtig === 255 && l255.falsch === 255);

      let einzelOk = true;
      codes.slice(0, 300).forEach(code => {
        for (let pos = 0; pos < 6; pos++) {
          for (const c of ALPHABET) {
            if (c === code[pos]) continue;
            if (codeLesen(code.slice(0, pos) + c + code.slice(pos + 1)).gueltig) einzelOk = false;
          }
        }
      });
      pruefe('Abschlusscode', 'Jedes falsch abgeschriebene Einzelzeichen fällt auf (300 Codes × 6 Stellen × 31 Zeichen)', einzelOk);

      let angenommen = 0;
      const versuche = 100000;
      for (let i = 0; i < versuche; i++) {
        let c = '';
        for (let k = 0; k < 6; k++) c += ALPHABET[Math.floor(Math.random() * 32)];
        if (codeLesen(c).gueltig) angenommen++;
      }
      const quote = angenommen / versuche;
      pruefe('Abschlusscode', 'Ausgedachte Codes fallen auf (von 100 000 Zufallscodes gültig: ' + angenommen + ')', quote < 0.01, (quote * 100).toFixed(2) + ' %');
    })();

    // ------------------------------------------------ Anstieg über die Etappen
    (function () {
      const uhr = { t: 0 };
      const z = S.neuerZustand(0);
      S.starten(z, 0);
      const tutorial = z.aufgabe.niveau;
      S.eingabe(z, richtigeZahl(z.aufgabe), 0);
      const jeEtappe = {};
      while (z.etappe <= 9) {
        (jeEtappe[z.etappe] = jeEtappe[z.etappe] || new Set()).add(z.aufgabe.niveau);
        loese(z, uhr, 0);
      }
      const nur = (e, n) => jeEtappe[e].size === 1 && jeEtappe[e].has(n);
      pruefe('Anstieg', 'Tutorial und Etappe 1–3 auf Niveau 1 (Einstieg)', tutorial === 1 && nur(1, 1) && nur(2, 1) && nur(3, 1));
      pruefe('Anstieg', 'Etappe 4–5 auf Niveau 2 (Aufbau)', nur(4, 2) && nur(5, 2));
      pruefe('Anstieg', 'Ab Etappe 6 und im Endlosmodus: Niveau 3 (voller Zahlenraum)', [6, 7, 8, 9].every(e => nur(e, 3)));
    })();

    // ------------------------------------------------------------ 9.5 Simulation
    const simulation = {};
    (function () {
      // Schneller Schüler: 100 % richtig, 100 s je Aufgabe (Tutorial eingeschlossen)
      let t = 0;
      const z = S.neuerZustand(t);
      S.starten(z, t);
      t += 100000;
      S.eingabe(z, richtigeZahl(z.aufgabe), t);
      let minutenEtappe4 = null, aufgaben = 0;
      while (z.etappe <= 4) {
        t += 100000;
        S.eingabe(z, richtigeZahl(z.aufgabe), t);
        aufgaben++;
      }
      minutenEtappe4 = t / 60000;
      simulation.schnell = { aufgaben, minuten: minutenEtappe4, stufe: z.stufe };
      pruefe('9.5 Simulation', 'Schneller Schüler, Obergrenze 100 s je Aufgabe (Pflichtenheft 9.5): Etappe 4 fertig nach ' +
        minutenEtappe4.toFixed(1).replace('.', ',') + ' min (≤ 35 min, inkl. Tutorial)', minutenEtappe4 <= 35, aufgaben + ' Aufgaben + Tutorial');

      // Schneller Schüler mit geschätzter Zeit je Aufgabe (10–100 s, aus den Rechenschritten)
      const minutenBis4 = [], minutenBis7 = [];
      for (let spiel = 0; spiel < 300; spiel++) {
        let t2 = 0;
        const s2 = S.neuerZustand(0);
        S.starten(s2, 0);
        t2 += s2.aufgabe.sekunden * 1000;
        S.eingabe(s2, richtigeZahl(s2.aufgabe), t2);
        while (s2.etappe <= 7) {
          t2 += s2.aufgabe.sekunden * 1000;
          S.eingabe(s2, richtigeZahl(s2.aufgabe), t2);
          if (s2.etappe === 5 && minutenBis4.length === spiel) minutenBis4.push(t2 / 60000);
        }
        minutenBis7.push(t2 / 60000);
      }
      const stat = liste => {
        const l = liste.slice().sort((a, b) => a - b);
        return { min: l[0], median: l[Math.floor(l.length / 2)], max: l[l.length - 1] };
      };
      const f = v => v.toFixed(1).replace('.', ',');
      simulation.realistisch = { bis4: stat(minutenBis4), bis7: stat(minutenBis7) };
      const r4 = simulation.realistisch.bis4, r7 = simulation.realistisch.bis7;
      pruefe('9.5 Simulation', 'Schneller Schüler mit geschätzter Zeit je Aufgabe (300 Spiele): Etappe 4 fertig nach ' + f(r4.median) +
        ' min (Median; ' + f(r4.min) + '–' + f(r4.max) + ' min)', r4.max <= 35,
        'Etappe 7 fertig nach ' + f(r7.median) + ' min (Median; ' + f(r7.min) + '–' + f(r7.max) + ' min), danach Endlosmodus');

      // Schwacher Schüler: Muster je Aufgabe R, R, F, F, R, F, F, R, F, F …
      // „F" = erste Eingabe falsch, nach der Sperre richtig → 3 von 5 Eingaben richtig (60 %).
      const muster = i => i === 1 || (i - 2) % 3 === 0;
      const uhr = { t: 0 };
      const w = spielImGang(0);
      const verlauf = [];
      for (let i = 1; i <= 40; i++) {
        uhr.t += 100000;
        loese(w, uhr, muster(i) ? 0 : 1);
        verlauf.push({ i, stufe: w.stufe, etappe: w.etappe, geloest: w.geloest });
      }
      const nach4 = verlauf[3].stufe;
      const abDa = verlauf.slice(3).every(v => v.stufe === 'G');
      const quote = w.richtig / (w.richtig + w.falsch);
      simulation.schwach = { verlauf, quote, etappe: w.etappe, geloest: w.geloest };
      pruefe('9.5 Simulation', 'Schwacher Schüler (Muster R R F F R F F …): nach Aufgabe 4 auf Grundstufe', nach4 === 'G',
        'Stufen: ' + verlauf.slice(0, 6).map(v => v.stufe).join(' '));
      pruefe('9.5 Simulation', 'Bleibt danach stabil auf G (Aufgaben 4–40)', abDa);
      pruefe('9.5 Simulation', 'Kommt auf G voran: 40 Aufgaben → 40 Bauabschnitte, Etappe ' + w.etappe + ' erreicht', w.geloest === 40 && w.etappe >= 7,
        'Richtigquote je Eingabe ' + Math.round(quote * 100) + ' % (ohne Tutorial)');
    })();

    return { tests, simulation, bestanden: tests.every(t => t.ok) };
  }

  function alsText(p) {
    const z = ['', '── Spielablauf (Schritt 2) ──'];
    let bereich = '';
    p.tests.forEach(t => {
      if (t.bereich !== bereich) { bereich = t.bereich; z.push('  [' + bereich + ']'); }
      z.push('  ' + (t.ok ? 'OK    ' : 'FEHLER') + ' ' + t.name + (t.detail ? '  (' + t.detail + ')' : ''));
    });
    return z.join('\n');
  }

  root.Spieltest = { laufen, alsText };
})(typeof globalThis !== 'undefined' ? globalThis : this);
