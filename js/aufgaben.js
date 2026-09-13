/*
 * Zahlenstadt – Aufgabengeneratoren (Pflichtenheft Abschnitt 3)
 *
 * Reine Funktionen ohne DOM. Klassisches Skript, damit index.html auch per
 * Doppelklick (file://) läuft; stellt das globale Objekt `Aufgaben` bereit.
 *
 * Jede Aufgabe ist ein Objekt
 *   { typ, stufe, anzeige, loesung, rechenweg, tipp, meta }
 * `meta` enthält die Rechnung als Termbaum, damit der Selbsttest
 * (test/test.html) jede Aufgabe unabhängig nachrechnen kann.
 *
 * Grundsatz (Pflichtenheft 1.7): Alle Zahlen werden konstruktiv gewählt –
 * rückwärts aus Ergebnis bzw. Nebenbedingungen –, sodass kein Zwischenergebnis
 * negativ ist, jede Division aufgeht und nie durch 0 geteilt wird.
 * Neu gewürfelt wird nur, um eine direkte Wiederholung derselben Anzeige zu
 * vermeiden (Abschnitt 9.1).
 */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ Zufall

  const hatCrypto = !!(root.crypto && root.crypto.getRandomValues);
  const puffer = new Uint32Array(256);
  let pufferPos = puffer.length;

  function zufall() {
    if (!hatCrypto) return Math.random();
    if (pufferPos >= puffer.length) {
      root.crypto.getRandomValues(puffer);
      pufferPos = 0;
    }
    return puffer[pufferPos++] / 4294967296;
  }

  /** Ganze Zufallszahl, beide Grenzen einschließlich. */
  function zz(min, max) {
    if (!(max >= min)) throw new Error('Leerer Zufallsbereich ' + min + '…' + max);
    return min + Math.floor(zufall() * (max - min + 1));
  }

  function wahl(liste) {
    if (!liste.length) throw new Error('Leere Auswahlliste');
    return liste[Math.floor(zufall() * liste.length)];
  }

  /** Zufallszahl ohne Vielfache von 10 (für „krumme" Zahlen). */
  function zzKrumm(min, max) {
    const liste = [];
    for (let i = min; i <= max; i++) if (i % 10 !== 0) liste.push(i);
    return wahl(liste);
  }

  function ggt(a, b) { return b ? ggt(b, a % b) : a; }

  // ------------------------------------------ Niveau: Anstieg über die Etappen
  // 1 = Einstieg (Etappe 1–2), 2 = Aufbau (Etappe 3–4), 3 = voller Zahlenraum (ab Etappe 5).
  // Alle Bereiche bleiben Teilmengen der Vorgaben aus Abschnitt 3.
  let NIVEAU = 3;
  /** Wert je Niveau: nv(Einstieg, Aufbau, voll) */
  const nv = (einstieg, aufbau, voll) => [einstieg, aufbau, voll][NIVEAU - 1];

  function teilerVon(n) {
    const t = [];
    for (let i = 1; i <= n; i++) if (n % i === 0) t.push(i);
    return t;
  }

  // ---------------------------------------------------------- Schreibweise

  const SCHMAL = '\u202F';   // schmales Leerzeichen als Tausendertrenner
  const MINUS = '\u2212';
  const MAL = '\u00B7';

  /** 11650 → „11 650" (mit U+202F) */
  function zahl(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, SCHMAL);
  }

  // ----------------------------------------------------------- Termbäume
  // { t:'n', v }            Zahl
  // { t:'x', name }         Variable (x in Gleichungen, n in Großbauwerken)
  // { t:'()', a }           Klammer (wird immer ausdrücklich gesetzt)
  // { t:'+'|'-'|'*'|':'|'^', a, b }

  const N = v => ({ t: 'n', v });
  const knoten = w => (typeof w === 'number' ? N(w) : w);
  const op = t => (a, b) => ({ t, a: knoten(a), b: knoten(b) });
  const plus = op('+');
  const minus = op('-');
  const mal = op('*');
  const durch = op(':');
  const hoch = op('^');
  const kl = a => ({ t: '()', a: knoten(a) });
  const variable = name => ({ t: 'x', name });

  /** a · a · … · a (n Faktoren) */
  function malKette(a, n) {
    let e = N(a);
    for (let i = 1; i < n; i++) e = mal(e, a);
    return e;
  }

  /** Setzt Werte für Variablen ein. */
  function einsetzen(e, belegung) {
    if (e.t === 'n') return e;
    if (e.t === 'x') return N(belegung[e.name]);
    if (e.t === '()') return kl(einsetzen(e.a, belegung));
    return { t: e.t, a: einsetzen(e.a, belegung), b: einsetzen(e.b, belegung) };
  }

  /** Wert eines Termbaums. Wirft bei unzulässigen Rechnungen (Programmierfehler). */
  function wert(e, belegung) {
    switch (e.t) {
      case 'n': return e.v;
      case 'x':
        if (!belegung || !(e.name in belegung)) throw new Error('Variable ohne Wert: ' + e.name);
        return belegung[e.name];
      case '()': return wert(e.a, belegung);
      case '+': return wert(e.a, belegung) + wert(e.b, belegung);
      case '-': {
        const r = wert(e.a, belegung) - wert(e.b, belegung);
        if (r < 0) throw new Error('Negatives Zwischenergebnis');
        return r;
      }
      case '*': return wert(e.a, belegung) * wert(e.b, belegung);
      case ':': {
        const a = wert(e.a, belegung), b = wert(e.b, belegung);
        if (b === 0 || a % b !== 0) throw new Error('Division geht nicht auf: ' + a + ' : ' + b);
        return a / b;
      }
      case '^': return Math.pow(wert(e.a, belegung), wert(e.b, belegung));
    }
    throw new Error('Unbekannter Knoten ' + e.t);
  }

  const ZEICHEN = { '+': '+', '-': MINUS, '*': MAL, ':': ':' };

  /** Termbaum → HTML in Lehrbuch-Schreibweise */
  function zeige(e) {
    switch (e.t) {
      case 'n': return zahl(e.v);
      case 'x': return '<i>' + e.name + '</i>';
      case '()': return '(' + zeige(e.a) + ')';
      case '^': return zeige(e.a) + '<sup>' + zeige(e.b) + '</sup>';
      default: return zeige(e.a) + ' ' + ZEICHEN[e.t] + ' ' + zeige(e.b);
    }
  }

  // ------------------------------------------- Rechenweg nach Vorrangregeln

  const RANG = { '^': 3, '*': 2, ':': 2, '+': 1, '-': 1 };

  /**
   * Ein Rechenschritt wie im Heft: Es werden alle Rechnungen ausgeführt, deren
   * beide Operanden schon Zahlen sind und die nach „Klammer vor Potenz vor
   * Punkt vor Strich" jetzt dran sind. Gleichrangige unabhängige Rechnungen
   * (z. B. 4 · 5 und 12 : 3) werden im selben Schritt erledigt.
   */
  function schritt(e) {
    let beste = -1;
    (function suche(k, tiefe) {
      if (k.t === 'n' || k.t === 'x') return;
      if (k.t === '()') return suche(k.a, tiefe + 1);
      if (k.a.t === 'n' && k.b.t === 'n') {
        beste = Math.max(beste, tiefe * 10 + RANG[k.t]);
        return;
      }
      suche(k.a, tiefe);
      suche(k.b, tiefe);
    })(e, 0);

    return (function reduziere(k, tiefe) {
      if (k.t === 'n') return k;
      if (k.t === '()') {
        const innen = reduziere(k.a, tiefe + 1);
        return innen.t === 'n' ? innen : kl(innen);
      }
      if (k.a.t === 'n' && k.b.t === 'n') {
        return tiefe * 10 + RANG[k.t] === beste ? N(wert(k)) : k;
      }
      return { t: k.t, a: reduziere(k.a, tiefe), b: reduziere(k.b, tiefe) };
    })(e, 0);
  }

  function schritte(e) {
    const kette = [e];
    let aktuell = e;
    while (aktuell.t !== 'n') {
      aktuell = schritt(aktuell);
      kette.push(aktuell);
      if (kette.length > 30) throw new Error('Rechenweg bricht nicht ab');
    }
    return kette;
  }

  /** Gleichungskette als HTML; das letzte Glied (Ergebnis) wird hervorgehoben. */
  function ketteHtml(kette) {
    const letztes = kette.length - 1;
    return '<p class="kette">' + kette.map((e, i) => {
      if (i === 0) return '<span>' + zeige(e) + '</span>';
      const inhalt = i === letztes ? '<strong>' + zeige(e) + '</strong>' : zeige(e);
      return '<span>= ' + inhalt + '</span>';
    }).join('<br>') + '</p>';
  }

  function textHtml(text) { return '<p class="text">' + text + '</p>'; }
  function auftragHtml(text) { return '<p class="auftrag">' + text + '</p>'; }
  function termHtml(html) { return '<p class="term">' + html + '</p>'; }

  // ------------------------------------------------------------------ Tipps

  const TIPPS = {
    vorrang: 'Zuerst Klammern, dann Potenzen, dann Punkt vor Strich.',
    potenz: 'Die Basis wird so oft mit sich selbst multipliziert, wie der Exponent angibt. Jede Zahl hoch 0 ist 1.',
    vorteilhaft: 'Suche Zahlen, die zusammen 10, 100 oder 1' + SCHMAL + '000 ergeben. Du darfst Faktoren vertauschen und gleiche Faktoren ausklammern.',
    termtext: 'Summe heißt plus, Differenz heißt minus, Produkt heißt mal, Quotient heißt geteilt. Schreibe zuerst den Term mit Klammern auf.',
    gleichung: 'Rechne rückwärts. Mache jeden Rechenschritt mit der Umkehraufgabe rückgängig – den letzten zuerst.',
    sachaufgabe: 'Schreibe auf: Was ist gegeben? Was ist gesucht? Rechne dann Schritt für Schritt schriftlich.',
    fehlersuche: 'Prüfe jeden Schritt: Klammern, Potenzen, Punkt vor Strich. Rechne die Aufgabe dann selbst richtig.',
    grossbauwerk: 'Löse zuerst Schritt 1. Setze das Ergebnis dann in den Term von Schritt 2 ein.'
  };

  // --------------------------------------------------- Bausteine je Aufgabe

  function termAufgabe(typ, stufe, muster, term, auftrag, werte, extra) {
    extra = extra || {};
    const kette = extra.kette || schritte(term);
    const loesung = wert(term);
    if (wert(kette[kette.length - 1]) !== loesung) throw new Error('Rechenweg endet nicht beim Ergebnis');
    return {
      typ, stufe,
      anzeige: auftragHtml(auftrag) + termHtml(zeige(term)),
      loesung,
      rechenweg: (extra.vorher || '') + ketteHtml(kette) + (extra.nachher || ''),
      tipp: TIPPS[typ],
      meta: { muster, werte, term, termAnzeige: zeige(term), kette }
    };
  }

  // ======================================================= 3.1 Vorrangregeln

  const vorrang = {
    G: [
      () => {
        const b = zz(2, nv(9, 10, 12)), c = zz(2, nv(9, 15, 20)), a = zz(1, nv(30, 60, 100));
        return ['a + b · c', plus(a, mal(b, c)), { a, b, c }];
      },
      () => {
        const b = zz(2, nv(9, 10, 12)), c = zz(2, Math.min(nv(9, 15, 49), Math.floor(99 / b))), a = zz(b * c, Math.max(b * c, nv(60, 90, 100)));
        return ['a − b · c', minus(a, mal(b, c)), { a, b, c }];
      },
      () => {
        const c = zz(2, nv(5, 9, 9)), s = zz(3, Math.min(nv(30, 100, 200), Math.floor(500 / c)));
        const a = zz(Math.max(1, s - 100), Math.min(100, s - 1)), b = s - a;
        return ['(a + b) · c', mal(kl(plus(a, b)), c), { a, b, c }];
      },
      () => {
        const a = zz(2, nv(9, 12, 20)), d = zz(2, Math.min(nv(20, 50, 99), Math.floor(500 / a)));
        const c = zz(1, 100 - d), b = c + d;
        return ['a · (b − c)', mal(a, kl(minus(b, c))), { a, b, c }];
      },
      () => {
        const c = zz(2, nv(9, 10, 10)), q = zz(2, nv(9, 10, 10)), b = c * q, a = zz(1, nv(30, 60, 100));
        return ['a + b : c', plus(a, durch(b, c)), { a, b, c }];
      }
    ],
    H: [
      () => {
        const a = zz(2, nv(9, 12, 15)), s = zz(10, Math.min(nv(100, 300, 500), Math.floor(5000 / a)));
        const b = zz(1, s - 1), c = s - b, d = zz(1, Math.min(nv(100, 500, 1000), a * s));
        return ['a · (b + c) − d', minus(mal(a, kl(plus(b, c))), d), { a, b, c, d }];
      },
      () => {
        const c = zz(2, nv(9, 12, 12)), q = zz(2, nv(20, 40, 60)), diff = c * q;
        const b = zz(1, nv(200, 600, 1000) - diff), a = b + diff, d = zz(1, nv(200, 600, 1000));
        return ['(a − b) : c + d', plus(durch(kl(minus(a, b)), c), d), { a, b, c, d }];
      },
      () => {
        const b = zz(2, 25), c = zz(2, 40), e = zz(2, 12);
        const q = zz(2, Math.min(80, Math.floor(1000 / e))), d = e * q;
        const a = zz(Math.max(1, q - b * c), 1000);
        return ['a + b · c − d : e', minus(plus(a, mal(b, c)), durch(d, e)), { a, b, c, d, e }];
      },
      () => {
        const t = zz(2, nv(9, 15, 20)), s = zz(10, Math.min(nv(100, 400, 2000), Math.floor(5000 / t)));
        const a = zz(Math.max(1, s - 1000), Math.min(1000, s - 1)), b = s - a;
        const d = zz(1, nv(100, 500, 1000) - t), c = d + t;
        return ['(a + b) · (c − d)', mal(kl(plus(a, b)), kl(minus(c, d))), { a, b, c, d }];
      }
    ],
    E: [
      () => {
        const b = zz(2, nv(9, 12, 15)), a = zz(2, Math.min(nv(10, 30, 50), Math.floor(20000 / (b * b))));
        const c = zz(1, Math.min(nv(100, 500, 1000), a * b * b));
        return ['a · b² − c', minus(mal(a, hoch(b, 2)), c), { a, b, c }];
      },
      () => {
        const d = zz(2, nv(12, 20, 30)), c = wahl(teilerVon(d * d).filter(t => t >= 2 && t < d * d));
        const b = zz(1, nv(50, 100, 200)), a = b + d;
        return ['(a − b)² : c', durch(hoch(kl(minus(a, b)), 2), c), { a, b, c }];
      },
      () => {
        const d = zz(2, 9), c = zz(1, 50), b = zz(2, 12), p = b * (c + d * d);
        const a = zz(p, Math.min(20000, p + 2000));
        return ['a − b · (c + d²)', minus(a, mal(b, kl(plus(c, hoch(d, 2))))), { a, b, c, d }];
      },
      () => {
        const a = zz(1, nv(9, 18, 18)), b = zz(1, nv(9, 15, 15)), c = zz(1, nv(9, 15, 15)), d = zz(1, nv(9, 15, 15));
        const term = plus(plus(plus(mal(a, hoch(10, 3)), mal(b, hoch(10, 2))), mal(c, 10)), d);
        return ['a · 10³ + b · 10² + c · 10 + d', term, { a, b, c, d }];
      }
    ]
  };

  function baueVorrang(stufe, fn) {
    const [muster, term, werte] = fn();
    return termAufgabe('vorrang', stufe, muster, term, 'Berechne.', werte);
  }

  // ========================================================== 3.2 Potenzen

  function potenzAufgabe(stufe, muster, basis, exponent, auftrag) {
    const term = hoch(basis, exponent);
    const ergebnis = Math.pow(basis, exponent);
    let kette, nachher = '';
    if (exponent === 0) {
      kette = [term, N(1)];
      nachher = '<p class="hinweis">Jede Zahl hoch 0 ist 1.</p>';
    } else if (exponent === 1) {
      kette = [term, N(basis)];
      nachher = '<p class="hinweis">Hoch 1 ist die Zahl selbst.</p>';
    } else {
      kette = [term, malKette(basis, exponent), N(ergebnis)];
      if (basis === 10) nachher = '<p class="hinweis">10<sup>' + exponent + '</sup> ist eine 1 mit ' + exponent + ' Nullen.</p>';
    }
    return termAufgabe('potenz', stufe, muster, term, auftrag, { basis, exponent }, { kette, nachher });
  }

  /** „Schreibe als Potenz und berechne: 4 · 4 · 4" */
  function produktAlsPotenz(stufe, muster, a, n) {
    const produkt = malKette(a, n);
    return termAufgabe('potenz', stufe, muster, produkt, 'Schreibe als Potenz und berechne.',
      { basis: a, exponent: n }, { kette: [produkt, hoch(a, n), N(Math.pow(a, n))] });
  }

  // Potenzen mit Wert ≤ 1 024 für Terme der Expertenstufe
  const POTENZ_VORRAT = [];
  for (let a = 2; a <= 12; a++) {
    for (let n = 2; n <= 5; n++) if (Math.pow(a, n) <= 1024) POTENZ_VORRAT.push({ a, n, v: Math.pow(a, n) });
  }
  const potenzAus = p => hoch(p.a, p.n);

  const potenz = {
    G: [
      stufe => potenzAufgabe(stufe, 'a² (a ≤ 12)', zz(2, nv(10, 12, 12)), 2, 'Berechne.'),
      stufe => potenzAufgabe(stufe, 'a³ (a ≤ 6)', zz(2, nv(5, 6, 6)), 3, 'Berechne.'),
      stufe => potenzAufgabe(stufe, '10ⁿ (n ≤ 4)', 10, zz(1, nv(3, 4, 4)), 'Berechne.'),
      stufe => {
        const [a, n] = wahl([[zz(2, nv(10, 12, 12)), 2], [zz(2, nv(5, 6, 6)), 3], [10, zz(2, nv(3, 4, 4))]]);
        return produktAlsPotenz(stufe, 'Produkt als Potenz (G)', a, n);
      }
    ],
    H: [
      stufe => potenzAufgabe(stufe, 'aⁿ (a ≤ 12, n ≤ 4)', zz(2, nv(10, 12, 12)), zz(2, nv(3, 4, 4)), 'Berechne.'),
      stufe => potenzAufgabe(stufe, 'a¹ und a⁰ (a ≤ 999)', zz(2, 999), zz(0, 1), 'Berechne.'),
      stufe => produktAlsPotenz(stufe, 'Produkt als Potenz', zz(2, nv(6, 10, 12)), zz(3, nv(3, 4, 4)))
    ],
    E: [
      stufe => {
        const vorrat = POTENZ_VORRAT.filter(x => x.v <= nv(150, 500, 1024));
        const p = wahl(vorrat), q = wahl(vorrat.filter(x => x !== p));
        return termAufgabe('potenz', stufe, 'aⁿ + bᵐ', plus(potenzAus(p), potenzAus(q)), 'Berechne.', { p, q });
      },
      stufe => {
        const f = zz(2, 9), p = wahl(POTENZ_VORRAT.filter(x => x.v <= 1000));
        const q = wahl(POTENZ_VORRAT.filter(x => x.v < f * p.v));
        return termAufgabe('potenz', stufe, 'a · bⁿ − cᵐ', minus(mal(f, potenzAus(p)), potenzAus(q)), 'Berechne.', { f, p, q });
      },
      stufe => {
        const s = zz(3, nv(6, 9, 12)), n = s <= 6 ? zz(2, nv(2, 3, 4)) : zz(2, 3), a = zz(1, s - 1);
        const q = wahl(POTENZ_VORRAT.filter(x => x.v < Math.pow(s, n)));
        return termAufgabe('potenz', stufe, '(a + b)ⁿ − cᵐ',
          minus(hoch(kl(plus(a, s - a)), n), potenzAus(q)), 'Berechne.', { a, b: s - a, n, q });
      },
      stufe => {
        const p = wahl(POTENZ_VORRAT.filter(x => x.v >= 8)), q = wahl(POTENZ_VORRAT.filter(x => x.v < p.v));
        const c = zz(2, 9);
        return termAufgabe('potenz', stufe, '(aⁿ − bᵐ) · c', mal(kl(minus(potenzAus(p), potenzAus(q))), c), 'Berechne.', { p, q, c });
      }
    ]
  };

  // ================================================= 3.3 Vorteilhaft rechnen

  const VORTEILHAFT = 'Rechne vorteilhaft.';

  const vorteilhaft = {
    G: [
      stufe => {
        const [x, y] = wahl([[25, 4], [5, 20], [2, 50], [8, 125]]);
        const a = zz(2, nv(20, 50, 99));
        const [links, rechts] = zufall() < 0.5 ? [x, y] : [y, x];
        const term = mal(mal(links, a), rechts);
        const kette = [term, mal(mal(links, rechts), a), mal(x * y, a), N(x * y * a)];
        return termAufgabe('vorteilhaft', stufe, 'Faktoren umordnen', term, VORTEILHAFT,
          { a, paar: [x, y] }, { kette });
      }
    ],
    H: [
      stufe => {
        const summe = NIVEAU === 1 ? 100 : wahl([100, 1000]);
        const b = summe === 100 ? zz(11, 89) : zz(101, 899), c = summe - b;
        const a = summe === 100 ? zz(3, nv(20, 50, 99)) : zz(3, nv(9, 20, 49));
        const term = mal(a, kl(plus(b, c)));
        return termAufgabe('vorteilhaft', stufe, 'a · (b + c), b + c = 100 oder 1 000', term, VORTEILHAFT,
          { a, b, c }, { kette: [term, mal(a, summe), N(a * summe)] });
      },
      stufe => {
        const a = zz(11, nv(30, 60, 99)), b = zz(3, 97), c = 100 - b;
        const term = plus(mal(a, b), mal(c, a));
        return termAufgabe('vorteilhaft', stufe, 'a · b + c · a, b + c = 100', term, VORTEILHAFT,
          { a, b, c }, { kette: [term, mal(a, kl(plus(b, c))), mal(a, 100), N(100 * a)] });
      },
      stufe => {
        const c = zz(3, 9), p = zz(2, 9) * (NIVEAU === 1 ? 10 : wahl([10, 100])), q = zz(1, 9);
        const [a, b] = zufall() < 0.5 ? [c * p, c * q] : [c * q, c * p];
        const term = durch(kl(plus(a, b)), c);
        return termAufgabe('vorteilhaft', stufe, '(a + b) : c', term, VORTEILHAFT,
          { a, b, c }, { kette: [term, plus(durch(a, c), durch(b, c)), plus(a / c, b / c), N(p + q)] });
      }
    ],
    E: [
      stufe => {
        const a = zz(11, 99), d = zz(2, 60), c = zz(2, 60), b = c + (100 - d);
        const term = plus(minus(mal(a, b), mal(a, c)), mal(a, d));
        return termAufgabe('vorteilhaft', stufe, 'a · b − a · c + a · d, b − c + d = 100', term, VORTEILHAFT,
          { a, b, c, d }, { kette: [term, mal(a, kl(plus(minus(b, c), d))), mal(a, 100), N(100 * a)] });
      },
      stufe => {
        const c = zz(2, 9), schrittweite = 100 / ggt(c, 100);
        const r = schrittweite * zz(1, Math.floor(nv(100, 200, 400) / schrittweite));
        const q = zzKrumm(3, nv(30, 60, 99)), b = c * q, a = b + c * r;
        const term = minus(durch(a, c), durch(b, c));
        return termAufgabe('vorteilhaft', stufe, 'a : c − b : c', term, VORTEILHAFT,
          { a, b, c }, { kette: [term, durch(kl(minus(a, b)), c), durch(a - b, c), N(r)] });
      },
      stufe => {
        const [x, y] = wahl(nv([[25, 4], [50, 2], [20, 5]], [[25, 4], [50, 2], [20, 5], [125, 8]], [[25, 4], [50, 2], [20, 5], [125, 8], [250, 4], [500, 2]]));
        const k = zz(2, nv(4, 6, 9)), f = zzKrumm(3, Math.min(nv(12, 19, 99), Math.floor(99 / k))), versteckt = y * k;
        const term = zufall() < 0.5 ? mal(mal(x, f), versteckt) : mal(mal(versteckt, f), x);
        const kette = [
          term,
          mal(mal(mal(x, f), y), k),
          mal(kl(mal(x, y)), kl(mal(f, k))),
          mal(x * y, f * k),
          N(x * y * f * k)
        ];
        return termAufgabe('vorteilhaft', stufe, 'drei Faktoren mit verstecktem Paar', term, VORTEILHAFT,
          { x, y, k, f }, { kette, vorher: '<p class="hinweis">' + zahl(versteckt) + ' = ' + zahl(y) + ' ' + MAL + ' ' + zahl(k) + '</p>' });
      }
    ]
  };

  // ===================================================== 3.4 Term aus Text

  function textAufgabe(stufe, muster, text, term, werte) {
    const kette = schritte(term);
    return {
      typ: 'termtext', stufe,
      anzeige: auftragHtml('Stelle den Term auf und berechne.') + textHtml(text),
      loesung: wert(term),
      rechenweg: '<p>Term: ' + zeige(term) + '</p>' + ketteHtml(kette),
      tipp: TIPPS.termtext,
      meta: { muster, werte, term, termAnzeige: zeige(term), kette }
    };
  }

  const z = zahl;

  const termtext = {
    G: [
      s => { const a = zz(12, nv(99, 500, 999)), b = zz(12, nv(99, 500, 999)); return textAufgabe(s, 'Addiere', `Addiere zur Zahl ${z(a)} die Zahl ${z(b)}.`, plus(a, b), { a, b }); },
      s => { const a = zz(50, nv(99, 500, 999)), b = zz(11, a - 1); return textAufgabe(s, 'Subtrahiere', `Subtrahiere von ${z(a)} die Zahl ${z(b)}.`, minus(a, b), { a, b }); },
      s => { const a = zz(12, nv(30, 60, 99)), b = zz(3, 9); return textAufgabe(s, 'Multipliziere', `Multipliziere ${z(a)} mit ${z(b)}.`, mal(a, b), { a, b }); },
      s => { const b = zz(2, 9), a = b * zz(11, nv(30, 60, 99)); return textAufgabe(s, 'Dividiere', `Dividiere ${z(a)} durch ${z(b)}.`, durch(a, b), { a, b }); },
      s => { const a = zz(26, nv(99, 250, 499)); return textAufgabe(s, 'Verdopple', `Verdopple die Zahl ${z(a)}.`, mal(a, 2), { a }); },
      s => { const a = 2 * zz(13, nv(99, 250, 499)); return textAufgabe(s, 'Halbiere', `Halbiere die Zahl ${z(a)}.`, durch(a, 2), { a }); },
      s => { const a = zz(12, nv(30, 60, 99)), b = zz(3, 9); return textAufgabe(s, 'Produkt', `Berechne das Produkt der Zahlen ${z(a)} und ${z(b)}.`, mal(a, b), { a, b }); },
      s => { const b = zz(2, 9), a = b * zz(11, nv(30, 60, 99)); return textAufgabe(s, 'Quotient', `Berechne den Quotienten der Zahlen ${z(a)} und ${z(b)}.`, durch(a, b), { a, b }); }
    ],
    H: [
      s => {
        const a = zz(12, nv(100, 200, 300)), b = zz(12, nv(100, 200, 300)), c = zz(a + b, a + b + nv(200, 500, 700));
        return textAufgabe(s, 'Summe von c subtrahieren', `Subtrahiere die Summe der Zahlen ${z(a)} und ${z(b)} von der Zahl ${z(c)}.`, minus(c, kl(plus(a, b))), { a, b, c });
      },
      s => {
        const c = zz(2, nv(9, 12, 12)), d = c * zz(2, nv(20, 40, 60)), b = zz(1, nv(100, 300, 500)), a = b + d;
        return textAufgabe(s, 'Differenz durch c', `Dividiere die Differenz der Zahlen ${z(a)} und ${z(b)} durch die Zahl ${z(c)}.`, durch(kl(minus(a, b)), c), { a, b, c });
      },
      s => {
        const b = zz(1, nv(30, 60, 100)), a = b + zz(2, nv(9, 15, 20)), summe = zz(5, nv(20, 40, 60)), c = zz(1, summe - 1), d = summe - c;
        return textAufgabe(s, 'Differenz mal Summe', `Multipliziere die Differenz von ${z(a)} und ${z(b)} mit der Summe von ${z(c)} und ${z(d)}.`, mal(kl(minus(a, b)), kl(plus(c, d))), { a, b, c, d });
      },
      s => {
        const a = zz(3, nv(12, 20, 25)), b = zz(3, nv(20, 30, 40)), c = zz(1, nv(100, 500, 999));
        return textAufgabe(s, 'Produkt plus c', `Addiere zum Produkt der Zahlen ${z(a)} und ${z(b)} die Zahl ${z(c)}.`, plus(mal(a, b), c), { a, b, c });
      },
      s => {
        const a = zz(12, nv(100, 300, 500)), b = zz(12, nv(99, 299, 499));
        return textAufgabe(s, 'Summe verdoppeln', `Verdopple die Summe der Zahlen ${z(a)} und ${z(b)}.`, mal(kl(plus(a, b)), 2), { a, b });
      },
      s => {
        const b = zz(1, nv(100, 300, 500)), a = b + 2 * zz(2, nv(50, 100, 200));
        return textAufgabe(s, 'Differenz halbieren', `Halbiere die Differenz der Zahlen ${z(a)} und ${z(b)}.`, durch(kl(minus(a, b)), 2), { a, b });
      },
      s => {
        const c = zz(2, 9), a = c * zz(2, 20), b = zz(2, 30);
        return textAufgabe(s, 'Produkt durch c', `Dividiere das Produkt der Zahlen ${z(a)} und ${z(b)} durch die Zahl ${z(c)}.`, durch(mal(a, b), c), { a, b, c });
      }
    ],
    E: [
      s => {
        const a = zz(2, nv(12, 15, 20)), b = zz(2, nv(12, 20, 25)), c = zz(2, nv(12, 20, 25));
        return textAufgabe(s, 'Quadrat plus Produkt', `Addiere zum Quadrat der Zahl ${z(a)} das Produkt der Zahlen ${z(b)} und ${z(c)}.`, plus(hoch(a, 2), mal(b, c)), { a, b, c });
      },
      s => {
        const a = zz(3, nv(6, 10, 12)), summe = zz(2, a * a * a), b = zz(1, summe - 1), c = summe - b;
        return textAufgabe(s, 'dritte Potenz minus Summe', `Subtrahiere von der dritten Potenz der Zahl ${z(a)} die Summe von ${z(b)} und ${z(c)}.`, minus(hoch(a, 3), kl(plus(b, c))), { a, b, c });
      },
      s => {
        const b = zz(1, 80), a = b + zz(2, 15), c = zz(2, 9);
        return textAufgabe(s, 'Quadrat der Differenz mal c', `Multipliziere das Quadrat der Differenz von ${z(a)} und ${z(b)} mit der Zahl ${z(c)}.`, mal(hoch(kl(minus(a, b)), 2), c), { a, b, c });
      },
      s => {
        const b = zz(2, 6), a = b * zz(2, 3);
        return textAufgabe(s, 'dritte Potenz durch Quadrat', `Dividiere die dritte Potenz der Zahl ${z(a)} durch das Quadrat der Zahl ${z(b)}.`, durch(hoch(a, 3), hoch(b, 2)), { a, b });
      },
      s => {
        const a = 2 * zz(2, nv(6, 8, 10)), b = zz(1, nv(50, 100, 200));
        return textAufgabe(s, 'Hälfte des Quadrats plus b', `Addiere zur Hälfte des Quadrats der Zahl ${z(a)} die Zahl ${z(b)}.`, plus(durch(hoch(a, 2), 2), b), { a, b });
      },
      s => {
        const a = zz(3, 12), b = zz(1, Math.floor(a * a * a / 2));
        return textAufgabe(s, 'dritte Potenz minus Doppeltes', `Subtrahiere das Doppelte der Zahl ${z(b)} von der dritten Potenz der Zahl ${z(a)}.`, minus(hoch(a, 3), mal(2, b)), { a, b });
      }
    ]
  };

  // ============================================ 3.5 Gleichungen rückwärts

  const x = variable('x');

  /** zeilen: [[Erklärung, Termbaum], …] – jede Zeile rechnet einen Rückwärtsschritt. */
  function rueckwaertsHtml(zeilen) {
    return zeilen.map(([erklaerung, term]) =>
      '<p>' + erklaerung + ': ' + zeige(term) + ' = ' + zahl(wert(term)) + '</p>').join('');
  }

  function gleichungAufgabe(stufe, muster, links, rechts, loesung, zeilen, werte) {
    const gleichung = zeige(links) + ' = ' + zeige(rechts);
    if (wert(links, { x: loesung }) !== wert(rechts)) throw new Error('Gleichung stimmt nicht');
    if (wert(zeilen[zeilen.length - 1][1]) !== loesung) throw new Error('Rückwärtsrechnung endet nicht bei x');
    const probe = einsetzen(links, { x: loesung });
    return {
      typ: 'gleichung', stufe,
      anzeige: auftragHtml('Löse die Gleichung durch Rückwärtsrechnen. Gib <i>x</i> ein.') + termHtml(gleichung),
      loesung,
      rechenweg: '<p>' + gleichung + '</p>' + rueckwaertsHtml(zeilen) +
        '<p><strong><i>x</i> = ' + zahl(loesung) + '</strong></p>' +
        '<p class="hinweis">Probe: ' + zeige(probe) + ' = ' + zahl(wert(probe)) + ' ✓</p>',
      tipp: TIPPS.gleichung,
      meta: { muster, werte, links, rechts, gleichungAnzeige: gleichung, zeilen: zeilen.map(z => z[1]) }
    };
  }

  function axPlusB(stufe, a, xWert, b) {
    const c = a * xWert + b;
    return gleichungAufgabe(stufe, 'a · x + b = c', plus(mal(a, x), b), N(c), xWert, [
      ['„+ ' + zahl(b) + '" rückgängig', minus(c, b)],
      ['„' + MAL + ' ' + zahl(a) + '" rückgängig', durch(c - b, a)]
    ], { a, b, c, faktor: a, rechts: c });
  }

  function axMinusB(stufe, a, xWert, b) {
    const c = a * xWert - b;
    return gleichungAufgabe(stufe, 'a · x − b = c', minus(mal(a, x), b), N(c), xWert, [
      ['„' + MINUS + ' ' + zahl(b) + '" rückgängig', plus(c, b)],
      ['„' + MAL + ' ' + zahl(a) + '" rückgängig', durch(c + b, a)]
    ], { a, b, c, faktor: a, rechts: c });
  }

  const gleichung = {
    G: [
      s => { const a = zz(2, nv(5, 9, 9)), xw = zz(1, Math.min(nv(10, 12, 12), Math.floor(99 / a))); return axPlusB(s, a, xw, zz(1, 100 - a * xw)); },
      s => { const a = zz(2, nv(5, 9, 9)), xw = zz(2, nv(10, 12, 12)), p = a * xw; return axMinusB(s, a, xw, zz(Math.max(1, p - 100), p - 1)); }
    ],
    H: [
      s => { const a = zz(2, 9), xw = zz(2, nv(12, 20, 25)); return axPlusB(s, a, xw, zz(1, nv(150, 300, 500) - a * xw)); },
      s => { const a = zz(2, 9), xw = zz(2, nv(12, 20, 25)); return axMinusB(s, a, xw, zz(1, a * xw - 1)); },
      s => {
        const a = zz(2, 9), q = zz(2, 30), xw = a * q, b = zz(5, 200), c = q + b;
        return gleichungAufgabe(s, 'x : a + b = c', plus(durch(x, a), b), N(c), xw, [
          ['„+ ' + zahl(b) + '" rückgängig', minus(c, b)],
          ['„: ' + zahl(a) + '" rückgängig', mal(q, a)]
        ], { a, b, c, faktor: a, rechts: c });
      },
      s => {
        const b = zz(2, 9), xw = zz(1, nv(12, 20, 25)), a = zz(1, Math.min(nv(15, 30, 40), Math.floor(500 / b) - xw)), c = (xw + a) * b;
        return gleichungAufgabe(s, '(x + a) · b = c', mal(kl(plus(x, a)), b), N(c), xw, [
          ['„' + MAL + ' ' + zahl(b) + '" rückgängig', durch(c, b)],
          ['„+ ' + zahl(a) + '" rückgängig', minus(c / b, a)]
        ], { a, b, c, faktor: b, rechts: c });
      }
    ],
    E: [
      // drei Rückwärtsschritte, ohne Potenzen, x ≤ 500
      s => {
        const xw = zz(2, nv(20, 30, 40)), a = zz(1, nv(10, 20, 30)), b = zz(2, 9), p = (xw + a) * b, c = zz(1, p - 1), d = p - c;
        return gleichungAufgabe(s, '(x + a) · b − c = d', minus(mal(kl(plus(x, a)), b), c), N(d), xw, [
          ['„' + MINUS + ' ' + zahl(c) + '" rückgängig', plus(d, c)],
          ['„' + MAL + ' ' + zahl(b) + '" rückgängig', durch(p, b)],
          ['„+ ' + zahl(a) + '" rückgängig', minus(xw + a, a)]
        ], { a, b, c, d, faktor: b, rechts: d });
      },
      s => {
        const a = zz(2, 9), q = zz(3, Math.min(nv(20, 40, 80), Math.floor(500 / a))), b = zz(1, q - 1), c = q - b;
        return gleichungAufgabe(s, 'x : a − b = c', minus(durch(x, a), b), N(c), a * q, [
          ['„' + MINUS + ' ' + zahl(b) + '" rückgängig', plus(c, b)],
          ['„: ' + zahl(a) + '" rückgängig', mal(q, a)]
        ], { a, b, c, faktor: a, rechts: c });
      },
      s => {
        const a = zz(2, 9), xw = zz(3, 60), p = a * xw, c = zz(2, Math.min(9, p - 1)), d = zz(1, Math.floor((p - 1) / c)), b = p - c * d;
        return gleichungAufgabe(s, '(a · x − b) : c = d', durch(kl(minus(mal(a, x), b)), c), N(d), xw, [
          ['„: ' + zahl(c) + '" rückgängig', mal(d, c)],
          ['„' + MINUS + ' ' + zahl(b) + '" rückgängig', plus(c * d, b)],
          ['„' + MAL + ' ' + zahl(a) + '" rückgängig', durch(p, a)]
        ], { a, b, c, d, faktor: a, rechts: d });
      }
    ]
  };

  // ======================================================= 3.6 Sachaufgaben

  /**
   * Eine Schablone liefert { id, text, zeilen: [[Beschriftung, Term, Einheit]], antwort(ergebnis), werte, tipp? }.
   * Die letzte Zeile ist die Lösung. Alle Divisionen gehen auf.
   */
  function sachAufgabe(stufe, s) {
    const zeilenHtml = s.zeilen.map(([beschriftung, term, einheit]) =>
      '<p>' + beschriftung + ': ' + zeige(term) + ' = ' + zahl(wert(term)) + (einheit ? ' ' + einheit : '') + '</p>'
    ).join('');
    const loesung = wert(s.zeilen[s.zeilen.length - 1][1]);
    return {
      typ: 'sachaufgabe', stufe,
      anzeige: textHtml(s.text),
      loesung,
      rechenweg: zeilenHtml + '<p class="antwort"><strong>Antwort:</strong> ' + s.antwort + '</p>',
      tipp: s.tipp || TIPPS.sachaufgabe,
      meta: { muster: s.id, werte: s.werte, zeilen: s.zeilen.map(zeile => zeile[1]) }
    };
  }

  const sachaufgabe = {
    G: [
      s => {
        const a = zz(40, 80), b = zz(5, a - 1);
        return sachAufgabe(s, { id: 'bus', werte: { a, b },
          text: `Ein Bus hat ${z(a)} Sitzplätze. ${z(b)} Plätze sind besetzt. Wie viele Plätze sind frei?`,
          zeilen: [['Freie Plätze', minus(a, b)]],
          antwort: `Es sind ${z(a - b)} Plätze frei.` });
      },
      s => {
        const a = zz(45, nv(99, 199, 289)), b = zz(18, 32);
        return sachAufgabe(s, { id: 'klassenfahrt', werte: { a, b },
          text: `Für eine Klassenfahrt zahlt jedes Kind ${z(a)} €. Es fahren ${z(b)} Kinder mit. Wie viel Geld kommt zusammen?`,
          zeilen: [['Geld', mal(a, b), '€']],
          antwort: `Es kommen ${z(a * b)} € zusammen.` });
      },
      s => {
        const a = zz(1250, nv(9999, 30000, 48000)), b = zz(350, nv(2000, 5000, 9800));
        return sachAufgabe(s, { id: 'lager', werte: { a, b },
          text: `In einem Lager sind ${z(a)} Kisten. Es kommen ${z(b)} Kisten dazu. Wie viele Kisten sind jetzt im Lager?`,
          zeilen: [['Kisten', plus(a, b)]],
          antwort: `Jetzt sind ${z(a + b)} Kisten im Lager.` });
      },
      s => {
        const a = zz(2000, nv(9999, 15000, 25000)), b = zz(120, 1999);
        return sachAufgabe(s, { id: 'buecherei', werte: { a, b },
          text: `Eine Stadtbücherei hat ${z(a)} Bücher. ${z(b)} alte Bücher werden aussortiert. Wie viele Bücher bleiben?`,
          zeilen: [['Bücher', minus(a, b)]],
          antwort: `Es bleiben ${z(a - b)} Bücher.` });
      },
      s => {
        const b = zz(5, nv(9, 20, 25)), a = b * zz(40, nv(200, 500, 900));
        return sachAufgabe(s, { id: 'aepfel', werte: { a, b },
          text: `Ein Obsthof hat ${z(a)} kg Äpfel geerntet. Sie werden in Kisten zu je ${z(b)} kg verpackt. Wie viele Kisten werden voll?`,
          zeilen: [['Kisten', durch(a, b)]],
          antwort: `Es werden ${z(a / b)} Kisten voll.` });
      },
      s => {
        const a = zz(120, nv(400, 700, 980)), b = zz(12, nv(20, 28, 31));
        return sachAufgabe(s, { id: 'gueterzug', werte: { a, b },
          text: `Ein Güterzug fährt jeden Tag ${z(a)} km. Wie viele Kilometer fährt er in ${z(b)} Tagen?`,
          zeilen: [['Strecke', mal(a, b), 'km']],
          antwort: `Er fährt ${z(a * b)} km.` });
      }
    ],
    H: [
      s => {
        const a = zz(90, 200) * 100, grenze = Math.min(4800, Math.floor((a - 1) / 3));
        const b = zz(80, Math.floor(grenze / 10)) * 10, c = zz(80, Math.floor(grenze / 10)) * 10, d = zz(80, Math.floor(grenze / 10)) * 10;
        const abgabe = b + c + d;
        return sachAufgabe(s, { id: 'tankwagen', werte: { a, b, c, d },
          text: `Ein Tankwagen hat ${z(a)} Liter Heizöl geladen. Drei Haushalte erhalten ${z(b)} Liter, ${z(c)} Liter und ${z(d)} Liter. Wie viele Liter bleiben im Tank?`,
          zeilen: [['Abgegeben', plus(plus(b, c), d), 'Liter'], ['Übrig', minus(a, abgabe), 'Liter']],
          antwort: `Im Tank bleiben ${z(a - abgabe)} Liter.` });
      },
      s => {
        const a = zz(12, nv(25, 35, 45)), b = zz(18, nv(25, 32, 40)), c = zz(15, nv(100, 200, 350));
        return sachAufgabe(s, { id: 'sitzreihen', werte: { a, b, c },
          text: `In einer Halle stehen ${z(a)} Reihen mit je ${z(b)} Stühlen. Alle Stühle sind besetzt, ${z(c)} Zuschauer müssen stehen. Wie viele Zuschauer sind da?`,
          zeilen: [['Sitzplätze', mal(a, b)], ['Zuschauer', plus(a * b, c)]],
          antwort: `Es sind ${z(a * b + c)} Zuschauer da.` });
      },
      s => {
        const a = zz(12, nv(30, 60, 85)), b = zz(18, nv(60, 99, 149)), kosten = a * b;
        const c = (Math.floor(kosten / 100) + zz(1, 25)) * 100;
        return sachAufgabe(s, { id: 'baeume', werte: { a, b, c },
          text: `Die Stadt kauft ${z(a)} Bäume zu je ${z(b)} €. Es stehen ${z(c)} € zur Verfügung. Wie viel Geld bleibt übrig?`,
          zeilen: [['Kosten', mal(a, b), '€'], ['Übrig', minus(c, kosten), '€']],
          antwort: `Es bleiben ${z(c - kosten)} € übrig.` });
      },
      s => {
        const c = wahl([6, 12, 20, 24]), kaesten = zz(15, 120), gesamt = c * kaesten;
        const a = zz(Math.ceil(gesamt / 5), gesamt - Math.ceil(gesamt / 5)), b = gesamt - a;
        return sachAufgabe(s, { id: 'flaschen', werte: { a, b, c },
          text: `Für ein Sportfest werden ${z(a)} Flaschen Saft und ${z(b)} Flaschen Wasser geliefert. Sie kommen in vollen Kästen zu je ${z(c)} Flaschen. Wie viele Kästen sind das?`,
          zeilen: [['Flaschen', plus(a, b)], ['Kästen', durch(gesamt, c)]],
          antwort: `Das sind ${z(kaesten)} Kästen.` });
      },
      s => {
        const c = wahl([20, 25, 40, 50]), a = zz(20, 80) * 500;
        const n = zz(20, Math.min(300, Math.floor((a - 2000) / c))), b = a - c * n;
        return sachAufgabe(s, { id: 'ladung', werte: { a, b, c },
          text: `Ein Lkw darf ${z(a)} kg laden. Es sind schon ${z(b)} kg geladen. Wie viele Säcke zu je ${z(c)} kg passen noch darauf?`,
          zeilen: [['Freie Last', minus(a, b), 'kg'], ['Säcke', durch(a - b, c)]],
          antwort: `Es passen noch ${z(n)} Säcke darauf.` });
      },
      s => {
        const a = zz(12, nv(20, 25, 30)), b = zz(14, nv(20, 26, 32)), plaetze = a * b, c = zz(Math.ceil(plaetze * 0.4), plaetze - 1);
        return sachAufgabe(s, { id: 'kino', werte: { a, b, c },
          text: `Ein Kino hat ${z(a)} Reihen mit je ${z(b)} Plätzen. Für eine Vorstellung wurden ${z(c)} Karten verkauft. Wie viele Plätze bleiben frei?`,
          zeilen: [['Plätze', mal(a, b)], ['Frei', minus(plaetze, c)]],
          antwort: `Es bleiben ${z(plaetze - c)} Plätze frei.` });
      },
      s => {
        const a = zz(5, nv(10, 20, 25)), b = zz(20, nv(30, 40, 52)), gespart = a * b, c = zz(Math.ceil(gespart / 2), gespart);
        return sachAufgabe(s, { id: 'sparen', werte: { a, b, c },
          text: `Mia spart jede Woche ${z(a)} €. Nach ${z(b)} Wochen wird davon ein Fahrrad für ${z(c)} € gekauft. Wie viel Geld ist danach noch übrig?`,
          zeilen: [['Gespart', mal(a, b), '€'], ['Übrig', minus(gespart, c), '€']],
          antwort: `Es sind noch ${z(gespart - c)} € übrig.` });
      },
      s => {
        const b = zz(3, 6), c = zz(12, 28), geschafft = b * c, a = geschafft + zz(5, 60);
        return sachAufgabe(s, { id: 'wanderung', werte: { a, b, c },
          text: `Eine Wandergruppe will ${z(a)} km weit wandern. An ${z(b)} Tagen schafft sie je ${z(c)} km. Wie viele Kilometer fehlen noch?`,
          zeilen: [['Geschafft', mal(b, c), 'km'], ['Fehlen', minus(a, geschafft), 'km']],
          antwort: `Es fehlen noch ${z(a - geschafft)} km.` });
      }
    ],
    E: [
      s => {
        const b = wahl(NIVEAU === 1 ? [20, 25, 30, 40, 50] : [25, 35, 40, 45, 50, 60, 65, 70, 75, 80, 90]), boote = zz(15, nv(25, 45, 60)), personen = b * boote;
        const c = zz(Math.ceil(personen * 0.15), Math.floor(personen * 0.3)), a = personen - c;
        return sachAufgabe(s, { id: 'rettungsboote', werte: { a, b, c },
          text: `Auf einem Schiff sind ${z(a)} Passagiere und ${z(c)} Besatzungsmitglieder. Bei einer Übung steigen alle in Rettungsboote. Jedes Boot fasst ${z(b)} Personen, alle Boote werden voll besetzt. Wie viele Rettungsboote werden gebraucht?`,
          zeilen: [['Personen', plus(a, c)], ['Boote', durch(personen, b)]],
          antwort: `Es werden ${z(boote)} Rettungsboote gebraucht.` });
      },
      s => {
        const a = zz(350, nv(900, 1400, 1800)), b = zz(400, nv(900, 2000, 2800)), c = zz(300, nv(800, 1200, 1500)), ein = a + b + c;
        const aus = zz(Math.ceil(ein * 0.3), Math.floor(ein * 0.85));
        const d = zz(Math.ceil(aus * 0.3), Math.floor(aus * 0.7)), e = aus - d;
        return sachAufgabe(s, { id: 'schulfest', werte: { a, b, c, d, e },
          text: `Beim Schulfest nimmt die Klasse ${z(a)} € mit Kuchen, ${z(b)} € mit der Tombola und ${z(c)} € mit Getränken ein. Für Einkäufe gibt sie ${z(d)} € aus, für die Tombola-Preise ${z(e)} €. Wie viel Gewinn bleibt?`,
          zeilen: [['Einnahmen', plus(plus(a, b), c), '€'], ['Ausgaben', plus(d, e), '€'], ['Gewinn', minus(ein, aus), '€']],
          antwort: `Es bleiben ${z(ein - aus)} € Gewinn.` });
      },
      s => {
        const a = zz(10, 40), b = zz(2, 6), c = zz(8, Math.min(40, Math.floor(9999 / (a * b))));
        const d = zz(12, 95), e = zz(80, 450);
        const stueck = a * b * c, ware = stueck * d, verpackung = a * e;
        return sachAufgabe(s, { id: 'lieferung', werte: { a, b, c, d, e },
          text: `Ein Großhändler liefert ${z(a)} Kisten Äpfel. In jeder Kiste liegen ${z(b)} Lagen mit je ${z(c)} Äpfeln. Ein Apfel kostet ${z(d)} Cent. Die Verpackung kostet ${z(e)} Cent je Kiste. Was kostet die Lieferung insgesamt? Gib das Ergebnis in Cent an.`,
          zeilen: [
            ['Äpfel je Kiste', mal(b, c)],
            ['Äpfel insgesamt', mal(a, b * c)],
            ['Preis der Äpfel', mal(stueck, d), 'Cent'],
            ['Verpackung', mal(a, e), 'Cent'],
            ['Gesamt', plus(ware, verpackung), 'Cent']
          ],
          antwort: `Die Lieferung kostet ${z(ware + verpackung)} Cent.` });
      },
      s => {
        const a = wahl([36, 40, 45, 48, 50, 54, 60, 64, 72, 75, 80, 84, 90, 96]), b = zz(12, nv(20, 30, 40));
        const q = zz(1, b - 2), c = a * (b - q), uebrig = a * q;
        return sachAufgabe(s, { id: 'baustelle', werte: { a, b, c },
          text: `Auf einer Baustelle stehen ${z(b)} Paletten mit je ${z(a)} Steinen. Beim Bau werden ${z(c)} Steine verbraucht. Sie werden immer palettenweise abgeholt. Wie viele volle Paletten bleiben übrig?`,
          zeilen: [['Steine insgesamt', mal(b, a)], ['Übrige Steine', minus(a * b, c)], ['Volle Paletten', durch(uebrig, a)]],
          antwort: `Es bleiben ${z(q)} volle Paletten übrig.` });
      },
      s => {
        const c = zz(20, 30), a = c * zz(12, 40), b = zz(18, 35), d = zz(2, 5);
        return sachAufgabe(s, { id: 'jugendherberge', werte: { a, b, c, d },
          text: `Eine Klasse mit ${z(c)} Kindern fährt für ${z(d)} Nächte in eine Jugendherberge. Eine Nacht kostet ${z(b)} € pro Kind. Der Bus kostet zusammen ${z(a)} €. Die Buskosten werden gerecht aufgeteilt. Wie viel muss jedes Kind insgesamt bezahlen?`,
          zeilen: [['Übernachtungen je Kind', mal(b, d), '€'], ['Bus je Kind', durch(a, c), '€'], ['Zusammen', plus(b * d, a / c), '€']],
          antwort: `Jedes Kind bezahlt ${z(b * d + a / c)} €.` });
      },
      s => {
        const d = wahl([12, 15, 20, 25, 40, 50]), a = d * zz(4, Math.floor(1500 / d)), b = zz(4, 8), c = zz(2, 5);
        return sachAufgabe(s, { id: 'druckerei', werte: { a, b, c, d },
          text: `Eine Druckerei druckt in jeder Stunde ${z(a)} Plakate. Sie druckt ${z(b)} Stunden am Tag, ${z(c)} Tage lang. Die Plakate werden in Pakete zu je ${z(d)} Stück verpackt. Wie viele Pakete sind das?`,
          zeilen: [['Plakate pro Tag', mal(a, b)], ['Plakate insgesamt', mal(a * b, c)], ['Pakete', durch(a * b * c, d)]],
          antwort: `Das sind ${z(a * b * c / d)} Pakete.` });
      }
    ]
  };

  // ======================================================== 3.7 Fehlersuche

  const NAMEN = ['Lena', 'Tim', 'Aylin', 'Jonas', 'Mia', 'Noah', 'Emma', 'Ben', 'Lina', 'Elias', 'Hanna', 'Paul', 'Mehmet', 'Sofia', 'Luca', 'Marie'];

  /** falschKette: Rechenweg des Kindes; das erste Glied ist die richtige Aufgabe. */
  function fehlerAufgabe(stufe, muster, falschKette, fehler, werte) {
    const name = wahl(NAMEN);
    const term = falschKette[0];
    const falsch = wert(falschKette[falschKette.length - 1]);
    const anzeigeKette = falschKette.map(zeige).join(' = ');
    return {
      typ: 'fehlersuche', stufe,
      anzeige: auftragHtml(name + ' rechnet:') + termHtml(anzeigeKette) +
        auftragHtml('Finde den Fehler. Gib das richtige Ergebnis ein.'),
      loesung: wert(term),
      rechenweg: '<p><strong>Fehler:</strong> ' + name + ' ' + fehler + '</p><p>Richtig:</p>' + ketteHtml(schritte(term)),
      tipp: TIPPS.fehlersuche,
      meta: { muster, werte, term, termAnzeige: zeige(term), kette: schritte(term), falschKette, falschAnzeige: anzeigeKette, falsch }
    };
  }

  const fehlersuche = {
    G: [
      s => {
        const a = zz(2, nv(15, 20, 30)), b = zz(2, nv(9, 10, 12)), c = zz(2, 9);
        return fehlerAufgabe(s, 'a + b · c → (a + b) · c',
          [plus(a, mal(b, c)), mal(a + b, c), N((a + b) * c)],
          `hat zuerst ${z(a)} + ${z(b)} gerechnet. Es gilt aber Punkt vor Strich: Zuerst ${z(b)} ${MAL} ${z(c)} rechnen.`, { a, b, c });
      },
      s => {
        const b = zz(2, 9), c = zz(2, 9), a = zz(b * c, Math.max(b * c, nv(60, 90, 100)));
        return fehlerAufgabe(s, 'a − b · c → (a − b) · c',
          [minus(a, mal(b, c)), mal(a - b, c), N((a - b) * c)],
          `hat zuerst ${z(a)} ${MINUS} ${z(b)} gerechnet. Es gilt aber Punkt vor Strich: Zuerst ${z(b)} ${MAL} ${z(c)} rechnen.`, { a, b, c });
      },
      s => {
        const a = zz(2, 9), b = zz(2, nv(10, 15, 20)), c = zz(2, nv(15, 20, 30));
        return fehlerAufgabe(s, 'a · b + c → a · (b + c)',
          [plus(mal(a, b), c), mal(a, b + c), N(a * (b + c))],
          `hat zuerst ${z(b)} + ${z(c)} gerechnet. Es gilt aber Punkt vor Strich: Zuerst ${z(a)} ${MAL} ${z(b)} rechnen.`, { a, b, c });
      },
      s => {
        const c = zz(2, 9), m = zz(1, Math.floor(nv(50, 80, 100) / c)), q = zz(1, Math.floor(nv(50, 80, 100) / c)), a = c * m, b = c * q;
        return fehlerAufgabe(s, 'a + b : c → (a + b) : c',
          [plus(a, durch(b, c)), durch(a + b, c), N(m + q)],
          `hat zuerst ${z(a)} + ${z(b)} gerechnet. Es gilt aber Punkt vor Strich: Zuerst ${z(b)} : ${z(c)} rechnen.`, { a, b, c });
      },
      s => {
        const a = zz(2, 9), c = zz(1, nv(9, 12, 15)), b = zz(c + 1, nv(20, 25, 30));
        return fehlerAufgabe(s, 'a · b − c → a · (b − c)',
          [minus(mal(a, b), c), mal(a, b - c), N(a * (b - c))],
          `hat zuerst ${z(b)} ${MINUS} ${z(c)} gerechnet. Es gilt aber Punkt vor Strich: Zuerst ${z(a)} ${MAL} ${z(b)} rechnen.`, { a, b, c });
      }
    ],
    H: [
      s => {
        const a = zz(2, 5), b = zz(2, 9);
        return fehlerAufgabe(s, 'a · b² → (a · b)²',
          [mal(a, hoch(b, 2)), hoch(a * b, 2), N(a * a * b * b)],
          `hat zuerst ${z(a)} ${MAL} ${z(b)} gerechnet und dann quadriert. Die Potenz gehört nur zur ${z(b)}: Zuerst ${z(b)}<sup>2</sup> rechnen.`, { a, b });
      },
      s => {
        const b = zz(3, 9), n = zz(2, nv(2, 3, 3)), a = zz(5, nv(50, 100, 200));
        return fehlerAufgabe(s, 'a + bⁿ → a + b · n',
          [plus(a, hoch(b, n)), plus(a, b * n), N(a + b * n)],
          `hat ${z(b)} ${MAL} ${n} statt ${z(b)}<sup>${n}</sup> gerechnet. Die Hochzahl sagt, wie oft ${z(b)} mit sich selbst malgenommen wird.`, { a, b, n });
      },
      s => {
        const a = zz(2, nv(20, 35, 50)), b = zz(2, nv(20, 35, 50)), c = zz(2, 9);
        return fehlerAufgabe(s, '(a + b) · c → a + b · c',
          [mal(kl(plus(a, b)), c), plus(a, b * c), N(a + b * c)],
          `hat die Klammer vergessen. Zuerst die Klammer: ${z(a)} + ${z(b)} = ${z(a + b)}.`, { a, b, c });
      },
      s => {
        const b = zz(10, 200), c = zz(10, 200), a = zz(b + c, b + c + 500);
        return fehlerAufgabe(s, 'a − (b + c) → a − b + c',
          [minus(a, kl(plus(b, c))), plus(a - b, c), N(a - b + c)],
          `hat die Klammer vergessen. Zuerst die Klammer: ${z(b)} + ${z(c)} = ${z(b + c)}. Diese Summe wird abgezogen.`, { a, b, c });
      },
      s => {
        const b = zz(2, 20), c = zz(2, 9), a = zz(b * c, b * c + 300);
        return fehlerAufgabe(s, '(a − b) · c → a − b · c',
          [mal(kl(minus(a, b)), c), minus(a, b * c), N(a - b * c)],
          `hat die Klammer vergessen. Zuerst die Klammer: ${z(a)} ${MINUS} ${z(b)} = ${z(a - b)}.`, { a, b, c });
      }
    ],
    E: [
      s => {
        const a = zz(2, nv(9, 12, 15)), b = zz(2, nv(9, 12, 15)), c = zz(1, a * a + b * b);
        return fehlerAufgabe(s, '(a + b)² − c → a² + b² − c',
          [minus(hoch(kl(plus(a, b)), 2), c), minus(plus(a * a, b * b), c), minus(a * a + b * b, c), N(a * a + b * b - c)],
          `hat jede Zahl in der Klammer einzeln quadriert. Richtig ist: Zuerst die Klammer ausrechnen (${z(a)} + ${z(b)} = ${z(a + b)}), dann quadrieren.`, { a, b, c });
      },
      s => {
        const c = zz(2, 9), b = zz(c + 2, c + 15);
        // a so wählen, dass a · b ≥ c² und das falsche Ergebnis nicht zufällig stimmt
        const nenner = b - (b - c) * (b - c), gleich = nenner > 0 && (c * c) % nenner === 0 ? (c * c) / nenner : -1;
        const kandidaten = [];
        for (let i = Math.max(2, Math.ceil(c * c / b)); i <= 9; i++) if (i !== gleich) kandidaten.push(i);
        const a = wahl(kandidaten);
        return fehlerAufgabe(s, 'a · (b − c)² → a · b − c²',
          [mal(a, hoch(kl(minus(b, c)), 2)), minus(mal(a, b), hoch(c, 2)), minus(a * b, c * c), N(a * b - c * c)],
          `hat die Klammer weggelassen. Dadurch gilt das Quadrat nur noch für die ${z(c)}. Richtig: Zuerst die Klammer (${z(b)} ${MINUS} ${z(c)} = ${z(b - c)}), dann die Potenz, dann mal.`, { a, b, c });
      },
      s => {
        const c = zz(2, 9), q = zz(2, nv(12, 20, 30)), m = zz(q + 1, q + nv(20, 40, 60)), a = c * m, b = c * q;
        return fehlerAufgabe(s, 'a − b : c → (a − b) : c',
          [minus(a, durch(b, c)), durch(a - b, c), N(m - q)],
          `hat zuerst subtrahiert und dann geteilt. Die Division kommt aber vor der Subtraktion: Zuerst ${z(b)} : ${z(c)} rechnen.`, { a, b, c });
      },
      s => {
        const c = zz(2, 6), t = zz(2, 4), a = c * t, q = zz(1, c * t * t - 1), b = c * q;
        return fehlerAufgabe(s, 'a² − b : c → (a² − b) : c',
          [minus(hoch(a, 2), durch(b, c)), durch(a * a - b, c), N((a * a - b) / c)],
          `hat nach der Potenz zuerst subtrahiert. Die Division kommt aber vor der Subtraktion: Zuerst ${z(b)} : ${z(c)} rechnen.`, { a, b, c });
      }
    ]
  };

  // ============================================= 3.8 Großbauwerk (Kombi)

  const NAECHSTE_STUFE = { G: 'H', H: 'E', E: 'E' };
  const n = variable('n');

  function grossAufgabe(stufe, muster, variablenName, teil1Text, teil1Rechenweg, teil1Zeilen, nWert, termMitN, werte) {
    const termKonkret = einsetzen(termMitN, { [variablenName]: nWert });
    const kette = schritte(termKonkret);
    if (wert(teil1Zeilen[teil1Zeilen.length - 1]) !== nWert) throw new Error('Schritt 1 endet nicht bei ' + variablenName);
    return {
      typ: 'grossbauwerk', stufe,
      anzeige: '<p class="schritt"><strong>Schritt 1:</strong> ' + teil1Text + '</p>' +
        '<p class="schritt"><strong>Schritt 2:</strong> Setze <i>' + variablenName + '</i> ein und berechne:</p>' + termHtml(zeige(termMitN)),
      loesung: wert(termKonkret),
      rechenweg: '<p><strong>Schritt 1</strong></p>' + teil1Rechenweg +
        '<p><strong>Schritt 2</strong> mit <i>' + variablenName + '</i> = ' + zahl(nWert) + '</p>' + ketteHtml(kette),
      tipp: TIPPS.grossbauwerk,
      meta: { muster, werte, zielstufe: NAECHSTE_STUFE[stufe], teil1: nWert, zeilen: teil1Zeilen,
        term: termKonkret, termAnzeige: zeige(termKonkret), termMitN, termMitNAnzeige: zeige(termMitN), kette }
    };
  }

  function teilHtml(zeilen) {
    return zeilen.map(([beschriftung, term]) => '<p>' + beschriftung + ': ' + zeige(term) + ' = ' + zahl(wert(term)) + '</p>').join('');
  }

  const grossbauwerkZiel = {
    H: [
      s => {
        const nw = zz(4, 20), b = zz(12, 48), a = b * nw;
        const term = zufall() < 0.5 ? minus(hoch(n, 2), zz(1, nw * nw - 1)) : plus(mal(2, hoch(n, 2)), zz(1, 99));
        const zeilen = [['Ziegel je Dachfläche', durch(a, b)]];
        return grossAufgabe(s, 'Sachaufgabe → Potenz', 'n',
          `Für das Großbauwerk liegen ${z(a)} Dachziegel bereit. Sie werden gleichmäßig auf ${z(b)} Dachflächen verteilt. Wie viele Ziegel kommen auf eine Fläche? Das Ergebnis heißt <i>n</i>.`,
          teilHtml(zeilen), zeilen.map(zl => zl[1]), nw, term, { a, b });
      },
      s => {
        const xw = zz(2, 12), a = zz(2, 9), b = zz(1, 150), c = a * xw + b;
        const zeilen = [['„+ ' + zahl(b) + '" rückgängig', minus(c, b)], ['„' + MAL + ' ' + zahl(a) + '" rückgängig', durch(c - b, a)]];
        const term = minus(hoch(x, 3), zz(1, xw * xw * xw - 1));
        return grossAufgabe(s, 'Gleichung → Potenz', 'x',
          `Löse die Gleichung ${zeige(plus(mal(a, x), b))} = ${z(c)}.`,
          teilHtml(zeilen) + '<p><i>x</i> = ' + zahl(xw) + '</p>', zeilen.map(zl => zl[1]), xw, term, { a, b, c });
      },
      s => {
        const nw = zz(3, 15), b = zz(10, 500), a = b + nw;
        const zeilen = [['Differenz', minus(a, b)]];
        return grossAufgabe(s, 'Term aus Text → Potenz', 'n',
          `<i>n</i> ist die Differenz der Zahlen ${z(a)} und ${z(b)}.`,
          teilHtml(zeilen), zeilen.map(zl => zl[1]), nw, plus(mal(2, hoch(n, 2)), zz(1, 200)), { a, b });
      }
    ],
    E: [
      s => {
        const nw = zz(11, 30), b = zz(12, 60), a = b * nw, k = zz(2, 20);
        const zeilen = [['Sitze je Block', durch(a, b)]];
        return grossAufgabe(s, 'Sachaufgabe → Potenz', 'n',
          `Für das Großbauwerk werden ${z(a)} Sitze auf ${z(b)} gleich große Blöcke verteilt. Wie viele Sitze hat ein Block? Das Ergebnis heißt <i>n</i>.`,
          teilHtml(zeilen), zeilen.map(zl => zl[1]), nw, minus(mal(hoch(n, 2), k), zz(1, Math.min(999, nw * nw * k - 1))), { a, b, k });
      },
      s => {
        const xw = zz(3, 15), a = zz(1, 20), b = zz(2, 9), p = (xw + a) * b, c = zz(1, p - 1), d = p - c;
        const zeilen = [['„' + MINUS + ' ' + zahl(c) + '" rückgängig', plus(d, c)], ['„' + MAL + ' ' + zahl(b) + '" rückgängig', durch(p, b)], ['„+ ' + zahl(a) + '" rückgängig', minus(xw + a, a)]];
        return grossAufgabe(s, 'Gleichung → Potenz', 'x',
          `Löse die Gleichung ${zeige(minus(mal(kl(plus(x, a)), b), c))} = ${zahl(d)}.`,
          teilHtml(zeilen) + '<p><i>x</i> = ' + zahl(xw) + '</p>', zeilen.map(zl => zl[1]), xw,
          plus(hoch(x, 3), mal(zz(1, 9), hoch(10, 2))), { a, b, c, d });
      },
      s => {
        const b = zz(2, 12), nw = zz(5, 40), a = b * nw, c = zz(1, 30);
        const zeilen = [['Quotient', durch(a, b)]];
        return grossAufgabe(s, 'Term aus Text → Potenz', 'n',
          `<i>n</i> ist der Quotient der Zahlen ${z(a)} und ${z(b)}.`,
          teilHtml(zeilen), zeilen.map(zl => zl[1]), nw, minus(hoch(kl(plus(n, c)), 2), zz(1, (nw + c) * (nw + c) - 1)), { a, b, c });
      }
    ]
  };

  // Großbauwerk: Schwierigkeit = aktuelle Stufe + 1 (Expertenstufe bleibt Expertenstufe)
  const grossbauwerk = {
    G: grossbauwerkZiel.H,
    H: grossbauwerkZiel.E,
    E: grossbauwerkZiel.E
  };

  // ============================================================ Verwaltung

  const TYPEN = ['vorrang', 'potenz', 'vorteilhaft', 'termtext', 'gleichung', 'sachaufgabe', 'fehlersuche'];
  const STUFEN = ['G', 'H', 'E'];
  const NAMEN_TYP = {
    vorrang: 'Vorrangregeln', potenz: 'Potenzen', vorteilhaft: 'Vorteilhaft rechnen',
    termtext: 'Term aus Text', gleichung: 'Gleichungen', sachaufgabe: 'Sachaufgaben',
    fehlersuche: 'Fehlersuche', grossbauwerk: 'Großbauwerk'
  };
  const NAMEN_STUFE = { G: 'Grundstufe', H: 'Hauptstufe', E: 'Expertenstufe' };

  const MUSTER = { vorrang, potenz, vorteilhaft, termtext, gleichung, sachaufgabe, fehlersuche, grossbauwerk };

  /**
   * Muster, die erst ab Niveau 2 („Aufbau", Etappe 3–4) vorkommen – mehrschrittige
   * oder umfangreichere Formen. Index = Position im jeweiligen Musterfeld oben.
   */
  const AB_NIVEAU_2 = {
    vorrang: { H: [2], E: [2] },                 // a + b · c − d : e;  a − b · (c + d²)
    potenz: { E: [1, 3] },                       // a · bⁿ − cᵐ;  (aⁿ − bᵐ) · c
    vorteilhaft: { E: [0] },                     // a · b − a · c + a · d
    termtext: { H: [6], E: [2, 3, 5] },          // Produkt durch c; Quadrat der Differenz, dritte Potenz durch Quadrat, … minus Doppeltes
    gleichung: { H: [2], E: [2] },               // x : a + b = c;  (a · x − b) : c = d
    sachaufgabe: { H: [3, 4], E: [2, 4, 5] },    // Flaschen, Ladung; Lieferung, Jugendherberge, Druckerei
    fehlersuche: { H: [3, 4], E: [1, 3] }        // a − (b + c), (a − b) · c;  a · (b − c)², a² − b : c
  };

  function abNiveau(typ, stufe, index) {
    const liste = (AB_NIVEAU_2[typ] || {})[stufe] || [];
    return liste.indexOf(index) >= 0 ? 2 : 1;
  }

  function erlaubteMuster(typ, stufe, niveau) {
    return MUSTER[typ][stufe].map((_, i) => i).filter(i => abNiveau(typ, stufe, i) <= niveau);
  }

  // ------------------------------------------------------------ Zeitschätzung
  // Grobe Bearbeitungszeit einer Aufgabe im Hefter (Sekunden, 10 bis 100).
  // Summe der tatsächlichen Rechenschritte + Lesezeit + 4 s für die Eingabe.

  const stellen = v => String(v).length;
  const rund = v => /^[1-9]0*$/.test(String(v));
  const zehnerpotenz = v => /^10*$/.test(String(v));

  function schrittSekunden(art, a, b, erg) {
    const klein = Math.min(a, b), gross = Math.max(a, b);
    switch (art) {
      case '+':
      case '-':
        if (gross <= 20 || (gross <= 100 && klein <= 10)) return 3;            // Kopf
        if (gross <= 100 || (erg % 100 === 0 && gross < 10000) || (rund(klein) && gross < 10000)) return 6;
        if (gross < 1000) return 12;                                            // halbschriftlich
        return 20 + 5 * (stellen(gross) - 4);                                   // schriftlich
      case '*':
        if (klein <= 1 || erg <= 100 || zehnerpotenz(a) || zehnerpotenz(b)) return 3;   // Einmaleins, ·10, ·100
        if (rund(a) && rund(b)) return 5;
        if (klein <= 12 && (gross <= 20 || rund(gross))) return 5;
        if (klein <= 12 && gross <= 99) return 10;
        if (klein <= 12) return 12 + 5 * (stellen(gross) - 2);
        return 25 + 8 * (stellen(klein) + stellen(gross) - 4);                  // schriftlich
      case ':':
        if (b === 1 || (b <= 10 && erg <= 10)) return 3;
        if ((b <= 12 && erg <= 20) || (rund(a) && b <= 10)) return 6;
        if (b <= 12) return 10 + 5 * (stellen(erg) - 2);
        return 25 + 8 * (stellen(erg) - 1);                                     // schriftlich
      case '^':
        if (b <= 1) return 2;
        return erg <= 144 || a === 10 ? 3 : 8 + 3 * b;
    }
    return 0;
  }

  function rechenSekunden(baum) {
    if (!baum || baum.t === 'n' || baum.t === 'x') return 0;
    if (baum.t === '()') return rechenSekunden(baum.a);
    return rechenSekunden(baum.a) + rechenSekunden(baum.b) + schrittSekunden(baum.t, wert(baum.a), wert(baum.b), wert(baum));
  }

  function schaetzeSekunden(aufgabe) {
    const m = aufgabe.meta;
    const text = aufgabe.anzeige.replace(/<sup>.*?<\/sup>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    let rechnen = 0, denken = 0;
    if (aufgabe.typ === 'vorteilhaft') {
      rechnen = rechenSekunden(m.kette[m.kette.length >= 5 ? 2 : 1]);
      denken = 6;
    } else if (m.zeilen) {
      rechnen = m.zeilen.reduce((summe, baum) => summe + rechenSekunden(baum), 0) + (m.term ? rechenSekunden(m.term) : 0);
    } else {
      rechnen = rechenSekunden(m.term);
      if (aufgabe.typ === 'fehlersuche') denken = 6;
    }
    const lesen = Math.ceil(text.length / 15);
    return Math.max(10, Math.min(100, 4 + lesen + denken + rechnen));
  }

  function baue(typ, stufe, index) {
    const fn = MUSTER[typ][stufe][index];
    return typ === 'vorrang' ? baueVorrang(stufe, fn) : fn(stufe);
  }

  const VERLAUF_LAENGE = 12;
  const internerVerlauf = {};

  /**
   * Erzeugt eine Aufgabe.
   * optionen.verlauf: Array der letzten Anzeigen dieses Typs und dieser Stufe
   * (wird fortgeschrieben; so kann spiel.js ihn in localStorage sichern).
   * Das Muster wechselt nach Möglichkeit, dieselbe Anzeige wird innerhalb der
   * letzten Aufgaben nicht wiederholt – bei sehr kleinem Vorrat (z. B. a² in der
   * Grundstufe) wird mindestens die direkte Wiederholung ausgeschlossen.
   * optionen.niveau: 1 (Etappe 1–2), 2 (Etappe 3–4), 3 (ab Etappe 5, Standard).
   */
  function erzeuge(typ, stufe, optionen) {
    if (!MUSTER[typ]) throw new Error('Unbekannter Aufgabentyp: ' + typ);
    if (STUFEN.indexOf(stufe) < 0) throw new Error('Unbekannte Stufe: ' + stufe);
    optionen = optionen || {};
    const schluessel = typ + '/' + stufe;
    const verlauf = optionen.verlauf || internerVerlauf[schluessel] || (internerVerlauf[schluessel] = []);
    const letzteAnzeige = verlauf[verlauf.length - 1];
    const niveau = [1, 2, 3].indexOf(optionen.niveau) >= 0 ? optionen.niveau : 3;
    const erlaubt = erlaubteMuster(typ, stufe, niveau);
    const letztesMuster = optionen.letztesMuster !== undefined ? optionen.letztesMuster : verlauf.letztesMuster;

    let aufgabe = null, index = 0;
    NIVEAU = niveau;
    try {
      for (let versuch = 0; versuch < 60; versuch++) {
        index = wahl(erlaubt);
        if (erlaubt.length > 1 && index === letztesMuster && versuch < 30) continue;
        aufgabe = baue(typ, stufe, index);
        if (verlauf.indexOf(aufgabe.anzeige) < 0) break;
        if (versuch >= 30 && aufgabe.anzeige !== letzteAnzeige) break;
      }
    } finally {
      NIVEAU = 3;
    }
    if (aufgabe.anzeige === letzteAnzeige) throw new Error('Keine neue Anzeige gefunden: ' + schluessel);

    verlauf.push(aufgabe.anzeige);
    while (verlauf.length > VERLAUF_LAENGE) verlauf.shift();
    verlauf.letztesMuster = index;
    aufgabe.meta.musterIndex = index;
    aufgabe.meta.niveau = niveau;
    aufgabe.meta.sekunden = schaetzeSekunden(aufgabe);
    return aufgabe;
  }

  /** Eingabe prüfen: eine Zahl; führende Nullen egal, leer → null (nicht bewertet). */
  function leseZahl(text) {
    const s = String(text === undefined || text === null ? '' : text).trim();
    if (!/^\d+$/.test(s)) return null;
    return parseInt(s, 10);
  }

  function pruefe(aufgabe, eingabe) {
    const w = leseZahl(eingabe);
    if (w === null) return null;
    return w === aufgabe.loesung;
  }

  const Aufgaben = {
    TYPEN, STUFEN, NAMEN_TYP, NAMEN_STUFE, TIPPS, NAECHSTE_STUFE,
    erzeuge,
    grossbauwerk: (stufe, optionen) => erzeuge('grossbauwerk', stufe, optionen),
    pruefe, leseZahl, zahl,
    NIVEAUS: [1, 2, 3],
    anzahlMuster: (typ, stufe, niveau) => erlaubteMuster(typ, stufe, niveau || 3).length,
    abNiveau,
    intern: { zeige, wert, schritte, einsetzen, schaetzeSekunden }
  };

  root.Aufgaben = Aufgaben;
  if (typeof module === 'object' && module.exports) module.exports = Aufgaben;
})(typeof globalThis !== 'undefined' ? globalThis : this);
