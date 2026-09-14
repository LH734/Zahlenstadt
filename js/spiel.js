/*
 * Zahlenstadt – Spielkern: Ablauf, Zustand, Sperre, Differenzierung, Speicherung
 * (Pflichtenheft Abschnitte 2, 4, 5, 8)
 *
 * Reine Logik ohne DOM. Jede Aktion verändert den Zustand direkt und gibt eine
 * Liste von Ereignissen zurück, auf die die Oberfläche reagiert. Die Uhrzeit
 * wird immer übergeben (`jetzt` in ms), damit Sperre und Simulation ohne echte
 * Wartezeit getestet werden können (test/test.html).
 *
 * ── Abschlusscode (Abschnitt 8) ────────────────────────────────────────────
 * 6 Zeichen aus dem Alphabet 23456789ABCDEFGHJKLMNPQRSTUVWXYZ (32 Zeichen,
 * ohne die verwechselbaren 0, O, 1, I).
 *  1. Nutzdaten, 22 Bit:
 *       Etappe (4 Bit) | Stufe (2 Bit) | richtig (8 Bit) | falsch (8 Bit)
 *     Etappe 0 = noch nicht gestartet, 1–7 = Etappe, 8–15 = Endlosmodus mit
 *     Wachstumsstufe 0–7 (größere Stufen werden als 15 gespeichert).
 *     Stufe 0 = G, 1 = H, 2 = E. Die Zähler werden bei 255 gedeckelt.
 *  2. x = Nutzdaten · 8 + 5            (25 Bit; die unteren 3 Bit „101" sind eine Marke)
 *  3. y = x · 11 400 713 mod 2²⁵       (ungerader Faktor → umkehrbar; ähnliche
 *                                       Stände ergeben völlig verschiedene Codes)
 *  4. y als 5 Stellen zur Basis 32 (höchste Stelle zuerst)
 *  5. Prüfziffer = (1·s₁ + 3·s₂ + 5·s₃ + 7·s₄ + 9·s₅) mod 32 als 6. Zeichen.
 *     Ungerade Gewichte → jede Änderung eines einzelnen Zeichens fällt auf.
 * Ein ausgedachter Code besteht die Prüfung nur mit etwa 1 : 340
 * (Prüfziffer 1 : 32, Marke 1 : 8, gültige Stufe 3 : 4).
 * Entschlüsseln: codeLesen(code) in test/test.html.
 */
(function (root) {
  'use strict';

  const A = root.Aufgaben;
  const B = root.Bauplan;

  const VERSION = 1;
  const SCHLUESSEL = 'zahlenstadt.spielstand';
  const SPERRE_MS = 15000;
  const KARTE_MS = 8000;
  // Absprache mit der Lehrkraft (abweichend von Pflichtenheft 5: dort 3): langsamerer Aufstieg
  const RICHTIG_FUER_HOCH = 5;
  const EXPERTE_AB_ETAPPE = 3;       // Automatik vergibt die Expertenstufe frühestens ab Etappe 3
  const FEHLERHAFT_FUER_RUNTER = 2;
  const AUTOMATIK_PAUSE = 5;
  const TIPP_AB_FEHLERN = 2;
  const HAENGT_AB_FEHLERN = 3;
  const STUFEN = ['G', 'H', 'E'];

  const MELDUNG_HOCH = { H: 'Du bist jetzt in der Hauptstufe!', E: 'Du bist jetzt in der Expertenstufe!' };
  const MELDUNG_RUNTER = 'Wir nehmen ein etwas kleineres Baumaß.';

  function mischen(liste) {
    for (let i = liste.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [liste[i], liste[j]] = [liste[j], liste[i]];
    }
    return liste;
  }

  // ------------------------------------------------------------ Codename

  const TIERE = [
    ['Fuchs', 'm'], ['Dachs', 'm'], ['Luchs', 'm'], ['Biber', 'm'], ['Falke', 'm'], ['Igel', 'm'], ['Otter', 'm'],
    ['Adler', 'm'], ['Hirsch', 'm'], ['Wal', 'm'], ['Kranich', 'm'], ['Marder', 'm'],
    ['Eule', 'f'], ['Möwe', 'f'], ['Robbe', 'f'], ['Libelle', 'f'], ['Gämse', 'f'], ['Krähe', 'f'], ['Hummel', 'f'], ['Elster', 'f'],
    ['Reh', 'n'], ['Wiesel', 'n'], ['Zebra', 'n'], ['Lama', 'n'], ['Erdmännchen', 'n'], ['Eichhörnchen', 'n']
  ];
  const FARBEN = ['Blau', 'Rot', 'Grün', 'Gelb', 'Weiß', 'Schwarz', 'Grau', 'Braun', 'Golden', 'Silbern', 'Kupfern', 'Bunt'];
  const ENDUNG = { m: 'er', f: 'e', n: 'es' };

  function wuerfleCodename(alt) {
    let c;
    do {
      c = {
        tier: Math.floor(Math.random() * TIERE.length),
        farbe: Math.floor(Math.random() * FARBEN.length),
        zahl: 10 + Math.floor(Math.random() * 90)
      };
    } while (alt && c.tier === alt.tier && c.farbe === alt.farbe);
    return c;
  }

  function codenameText(c) {
    const [tier, geschlecht] = TIERE[c.tier];
    return FARBEN[c.farbe] + ENDUNG[geschlecht] + ' ' + tier + ' ' + c.zahl;
  }

  /** Farbvariante der Häuser (0–5), aus dem Codenamen abgeleitet (Pflichtenheft 6.1) */
  function farbvariante(c) {
    return (c.tier * 7 + c.farbe * 3 + c.zahl) % 6;
  }

  // -------------------------------------------------------------- Zustand

  function neuerZustand(jetzt) {
    return {
      version: VERSION,
      erstellt: jetzt,
      phase: 'start',            // start | tutorial | spiel | ende
      phaseVorEnde: null,
      codename: wuerfleCodename(),
      stufe: 'H',
      automatikPause: 0,         // so viele Aufgaben bleibt die Automatik nach manueller Wahl aus
      serieRichtig: 0,           // Aufgaben in Folge ohne Fehler gelöst
      serieFehlerhaft: 0,        // Aufgaben in Folge mit mindestens einem Fehler
      fehlerInFolge: 0,          // falsche Eingaben in Folge („hängt")
      richtig: 0,
      falsch: 0,
      geloest: 0,                // gelöste Aufgaben ohne Tutorial
      etappe: 1,
      schritt: 0,                // Position in der Etappe; = normal → Großbauwerk
      endlosGeloest: 0,
      plan: [],
      vorigerPlan: [],
      typNutzung: {},
      letzterTyp: null,
      grundstein: false,
      gebaut: [],                // [{ e: Etappe, s: Schritt }]
      aufgabe: null,
      aufgabeFehler: 0,
      sperreBis: 0,              // Unix-Zeit in ms
      loesungskarteSeit: 0,      // Unix-Zeit in ms, 0 = keine Karte
      verlaeufe: {},             // „typ/stufe" → { anzeigen, letztesMuster }
      fehlerJeTyp: {},           // über den ganzen Spielstand (Tipp-Knopf)
      ton: false
    };
  }

  // ------------------------------------------------ Etappen und Typrotation

  /**
   * Plant die Aufgabentypen einer Etappe:
   *  – lauter verschiedene Typen (5 bzw. 6),
   *  – alle Typen, die in der vorigen Etappe fehlten, kommen jetzt vor
   *    → je zwei aufeinanderfolgende Etappen enthalten alle sieben Typen,
   *  – danach die bisher am seltensten genutzten Typen,
   *  – der erste Typ ist nie der Typ der letzten Aufgabe.
   */
  function planeEtappe(z) {
    const anzahl = B.etappe(z.etappe).normal;
    const pflicht = z.vorigerPlan.length ? A.TYPEN.filter(t => z.vorigerPlan.indexOf(t) < 0) : [];
    const uebrige = mischen(A.TYPEN.filter(t => pflicht.indexOf(t) < 0))
      .sort((a, b) => (z.typNutzung[a] || 0) - (z.typNutzung[b] || 0));
    const plan = mischen(pflicht.concat(uebrige).slice(0, anzahl));
    if (plan[0] === z.letzterTyp) {
      const j = 1 + Math.floor(Math.random() * (plan.length - 1));
      [plan[0], plan[j]] = [plan[j], plan[0]];
    }
    plan.forEach(t => { z.typNutzung[t] = (z.typNutzung[t] || 0) + 1; });
    z.plan = plan;
    z.vorigerPlan = plan.slice();
  }

  /** Anstieg über die Etappen: Niveau 1 = Tutorial und Etappe 1–3, 2 = Etappe 4–5, 3 = ab Etappe 6 */
  function niveau(z) {
    if (z.phase === 'tutorial' || z.etappe <= 3) return 1;
    return z.etappe <= 5 ? 2 : 3;
  }

  function erzeugeAufgabe(z, typ, stufe) {
    stufe = stufe || z.stufe;
    const schluessel = typ + '/' + stufe;
    const bisher = z.verlaeufe[schluessel] || { anzeigen: [] };
    const anzeigen = bisher.anzeigen.slice();
    const a = A.erzeuge(typ, stufe, { verlauf: anzeigen, letztesMuster: bisher.letztesMuster, niveau: niveau(z) });
    z.verlaeufe[schluessel] = { anzeigen, letztesMuster: a.meta.musterIndex };
    z.aufgabe = {
      typ: a.typ, stufe: a.stufe, anzeige: a.anzeige, loesung: a.loesung,
      rechenweg: a.rechenweg, tipp: a.tipp, muster: a.meta.muster,
      niveau: a.meta.niveau, sekunden: a.meta.sekunden
    };
    z.aufgabeFehler = 0;
    z.sperreBis = 0;
    z.loesungskarteSeit = 0;
  }

  function naechsteAufgabe(z) {
    const e = B.etappe(z.etappe);
    erzeugeAufgabe(z, z.schritt >= e.normal ? 'grossbauwerk' : z.plan[z.schritt]);
  }

  // ------------------------------------------------------------ Aktionen

  function starten(z, jetzt) {
    if (z.phase !== 'start') return [];
    z.phase = 'tutorial';
    z.erstellt = jetzt;
    erzeugeAufgabe(z, 'vorrang', 'G');
    return [{ art: 'neueAufgabe' }];
  }

  function codenameWuerfeln(z) {
    if (z.phase !== 'start') return [];
    z.codename = wuerfleCodename(z.codename);
    return [{ art: 'codename' }];
  }

  const istGesperrt = (z, jetzt) => z.sperreBis > jetzt;
  const sperreRest = (z, jetzt) => Math.max(0, z.sperreBis - jetzt);
  const karteRest = (z, jetzt) => z.loesungskarteSeit ? Math.max(0, z.loesungskarteSeit + KARTE_MS - jetzt) : 0;
  const tippSichtbar = z => !!z.aufgabe && (z.fehlerJeTyp[z.aufgabe.typ] || 0) >= TIPP_AB_FEHLERN;
  const haengt = z => z.fehlerInFolge >= HAENGT_AB_FEHLERN;

  /** Eingabe bewerten. text = Ziffernfolge von der Bildschirmtastatur. */
  function eingabe(z, text, jetzt) {
    if (!z.aufgabe || (z.phase !== 'spiel' && z.phase !== 'tutorial')) return [{ art: 'ignoriert' }];
    if (z.loesungskarteSeit) return [{ art: 'ignoriert' }];
    if (istGesperrt(z, jetzt)) return [{ art: 'gesperrt', rest: sperreRest(z, jetzt) }];
    const ok = A.pruefe(z.aufgabe, text);
    if (ok === null) return [{ art: 'leer' }];

    const ereignisse = [];
    const typ = z.aufgabe.typ;

    if (!ok) {
      z.falsch++;
      z.fehlerInFolge++;
      z.aufgabeFehler++;
      z.fehlerJeTyp[typ] = (z.fehlerJeTyp[typ] || 0) + 1;
      ereignisse.push({ art: 'falsch' });
      if (z.aufgabeFehler === 1) {
        z.sperreBis = jetzt + SPERRE_MS;
        ereignisse.push({ art: 'sperre', bis: z.sperreBis });
      } else {
        z.sperreBis = 0;
        z.loesungskarteSeit = jetzt;
        ereignisse.push({ art: 'loesungskarte' });
        aufgabeBeendet(z, true, ereignisse);
      }
      return ereignisse;
    }

    z.richtig++;
    z.fehlerInFolge = 0;
    z.sperreBis = 0;
    ereignisse.push({ art: 'richtig', mitFehler: z.aufgabeFehler > 0 });

    if (z.phase === 'tutorial') {
      z.grundstein = true;
      z.phase = 'spiel';
      z.letzterTyp = typ;
      ereignisse.push({ art: 'gebaut', abschnitt: Object.assign({ gross: false, grundstein: true }, B.GRUNDSTEIN) });
      ereignisse.push({ art: 'tutorialFertig' });
      planeEtappe(z);
    } else {
      aufgabeBeendet(z, z.aufgabeFehler > 0, ereignisse);
      bauen(z, ereignisse);
    }
    naechsteAufgabe(z);
    ereignisse.push({ art: 'neueAufgabe' });
    return ereignisse;
  }

  /** Stufenautomatik (Abschnitt 5). Wird am Ende jeder Aufgabe aufgerufen. */
  function aufgabeBeendet(z, hatteFehler, ereignisse) {
    if (z.phase !== 'spiel') return;
    if (z.automatikPause > 0) {
      z.automatikPause--;
      z.serieRichtig = 0;
      z.serieFehlerhaft = 0;
      return;
    }
    if (hatteFehler) {
      z.serieRichtig = 0;
      z.serieFehlerhaft++;
    } else {
      z.serieFehlerhaft = 0;
      z.serieRichtig++;
    }
    const i = STUFEN.indexOf(z.stufe);
    const hochErlaubt = i < STUFEN.length - 1 && !(STUFEN[i + 1] === 'E' && z.etappe < EXPERTE_AB_ETAPPE);
    if (z.serieRichtig >= RICHTIG_FUER_HOCH && hochErlaubt) {
      z.stufe = STUFEN[i + 1];
      z.serieRichtig = 0;
      ereignisse.push({ art: 'stufe', richtung: 'hoch', stufe: z.stufe, text: MELDUNG_HOCH[z.stufe] });
    } else if (z.serieFehlerhaft >= FEHLERHAFT_FUER_RUNTER && i > 0) {
      z.stufe = STUFEN[i - 1];
      z.serieFehlerhaft = 0;
      ereignisse.push({ art: 'stufe', richtung: 'runter', stufe: z.stufe, text: MELDUNG_RUNTER });
    }
  }

  /** Genau ein Bauabschnitt je gelöster Aufgabe (Abschnitt 5, stufenunabhängig). */
  function bauen(z, ereignisse) {
    const e = B.etappe(z.etappe);
    const abschnitt = B.abschnitt(z.etappe, z.schritt);
    z.gebaut.push({ e: z.etappe, s: z.schritt });
    z.geloest++;
    if (!abschnitt.gross) z.letzterTyp = z.plan[z.schritt];
    ereignisse.push({ art: 'gebaut', abschnitt: Object.assign({ etappe: z.etappe, schritt: z.schritt }, abschnitt) });

    if (e.endlos) {
      const vorher = B.wachstum(z.endlosGeloest);
      z.endlosGeloest++;
      const nachher = B.wachstum(z.endlosGeloest);
      if (nachher.index > vorher.index) ereignisse.push({ art: 'wachstum', name: nachher.name });
    }

    z.schritt++;
    if (z.schritt >= e.normal + (e.gross ? 1 : 0)) {
      ereignisse.push({ art: 'etappeFertig', etappe: z.etappe, viertel: e.viertel, endlos: e.endlos });
      if (z.etappe === 4) ereignisse.push({ art: 'mindestziel' });
      if (z.etappe === B.LETZTE_ETAPPE) ereignisse.push({ art: 'endlos' });
      z.etappe++;
      z.schritt = 0;
      planeEtappe(z);
    }
  }

  function loesungskarteSchliessen(z, jetzt) {
    if (!z.loesungskarteSeit) return [];
    const rest = karteRest(z, jetzt);
    if (rest > 0) return [{ art: 'nochNicht', rest }];
    // derselbe Aufgabentyp mit neuen Zahlen (Tutorial: wieder eine leichte Aufgabe)
    if (z.phase === 'tutorial') erzeugeAufgabe(z, 'vorrang', 'G');
    else erzeugeAufgabe(z, z.aufgabe.typ);
    return [{ art: 'neueAufgabe' }];
  }

  function stufeWaehlen(z, stufe) {
    if (STUFEN.indexOf(stufe) < 0) return [];
    const geaendert = stufe !== z.stufe;
    z.stufe = stufe;
    z.automatikPause = AUTOMATIK_PAUSE;
    z.serieRichtig = 0;
    z.serieFehlerhaft = 0;
    const ereignisse = [{ art: 'stufeGewaehlt', stufe, geaendert }];
    // Noch unberührte Aufgabe passend zur neuen Stufe austauschen (nie während Sperre oder Fehlversuch)
    if (geaendert && z.phase === 'spiel' && z.aufgabe && z.aufgabeFehler === 0 && !z.loesungskarteSeit) {
      erzeugeAufgabe(z, z.aufgabe.typ);
      ereignisse.push({ art: 'neueAufgabe' });
    }
    return ereignisse;
  }

  function stundeBeenden(z) {
    if (z.phase === 'ende' || z.phase === 'start') return [];
    z.phaseVorEnde = z.phase;
    z.phase = 'ende';
    return [{ art: 'ende' }];
  }

  function weiterspielen(z) {
    if (z.phase !== 'ende') return [];
    z.phase = z.phaseVorEnde || 'spiel';
    z.phaseVorEnde = null;
    return [{ art: 'weiter' }];
  }

  function tonUmschalten(z) {
    z.ton = !z.ton;
    return [{ art: 'ton', an: z.ton }];
  }

  // ------------------------------------------------------ Anzeige-Hilfen

  function status(z) {
    const e = B.etappe(z.etappe);
    return {
      codename: codenameText(z.codename),
      stufe: A.NAMEN_STUFE[z.stufe],
      etappe: z.phase === 'start' || z.phase === 'tutorial' ? 'Tutorial'
        : e.endlos ? 'Endlos · ' + B.wachstum(z.endlosGeloest).name
          : 'Etappe ' + z.etappe + ' · ' + e.viertel,
      richtig: z.richtig,
      falsch: z.falsch,
      typ: z.aufgabe ? A.NAMEN_TYP[z.aufgabe.typ] : '–',
      haengt: haengt(z)
    };
  }

  /** Fortschritt in der aktuellen Etappe: { erledigt, gesamt } */
  function fortschritt(z) {
    const e = B.etappe(z.etappe);
    return { erledigt: z.schritt, gesamt: e.normal + (e.gross ? 1 : 0), grossbauwerkJetzt: z.schritt >= e.normal };
  }

  // ------------------------------------------------------- Speicherung

  function speichern(z, speicher, schluessel) {
    try {
      speicher.setItem(schluessel || SCHLUESSEL, JSON.stringify(z));
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Lädt den Spielstand. Rückgabe { zustand, verworfen }.
   * Version 1 ist die erste; Stände mit anderer Version werden verworfen
   * (hier später Migrationen ergänzen).
   */
  function laden(speicher, schluessel) {
    let roh = null;
    try { roh = speicher.getItem(schluessel || SCHLUESSEL); } catch (err) { return { zustand: null, verworfen: false }; }
    if (!roh) return { zustand: null, verworfen: false };
    try {
      const z = JSON.parse(roh);
      if (!z || z.version !== VERSION || !z.codename) return { zustand: null, verworfen: true };
      return { zustand: z, verworfen: false };
    } catch (err) {
      return { zustand: null, verworfen: true };
    }
  }

  function loeschen(speicher, schluessel) {
    try { speicher.removeItem(schluessel || SCHLUESSEL); } catch (err) { /* nichts zu tun */ }
  }

  // ---------------------------------------------------- Abschlusscode

  const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const MOD = 33554432;          // 2^25
  const FAKTOR = 11400713;       // ungerade
  const GEWICHTE = [1, 3, 5, 7, 9];

  function etappenWert(z) {
    if (!z.grundstein) return 0;
    if (z.etappe <= B.LETZTE_ETAPPE) return z.etappe;
    return 8 + Math.min(7, B.wachstum(z.endlosGeloest).index);
  }

  function abschlusscode(z) {
    const nutzdaten = etappenWert(z) * 262144 + STUFEN.indexOf(z.stufe) * 65536 +
      Math.min(255, z.richtig) * 256 + Math.min(255, z.falsch);
    const y = ((nutzdaten * 8 + 5) * FAKTOR) % MOD;
    const stellen = [];
    let rest = y;
    for (let i = 0; i < 5; i++) {
      stellen.unshift(rest % 32);
      rest = Math.floor(rest / 32);
    }
    const pruefziffer = stellen.reduce((summe, w, i) => summe + GEWICHTE[i] * w, 0) % 32;
    return stellen.concat([pruefziffer]).map(w => ALPHABET[w]).join('');
  }

  root.Spiel = {
    VERSION, SCHLUESSEL, SPERRE_MS, KARTE_MS, AUTOMATIK_PAUSE, STUFEN, RICHTIG_FUER_HOCH, EXPERTE_AB_ETAPPE,
    neuerZustand, starten, codenameWuerfeln, eingabe, loesungskarteSchliessen, stufeWaehlen,
    stundeBeenden, weiterspielen, tonUmschalten,
    istGesperrt, sperreRest, karteRest, tippSichtbar, haengt, status, fortschritt,
    codenameText, farbvariante, abschlusscode, niveau,
    speichern, laden, loeschen
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
