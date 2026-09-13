/*
 * Zahlenstadt – Selbsttest der Aufgabengeneratoren (Pflichtenheft Abschnitt 9)
 *
 * Prüft jede Aufgabe unabhängig vom Generator:
 *  – eigener strenger Auswerter für die Termbäume (negativ, Division durch 0, Rest),
 *  – eigener Parser, der die angezeigte Aufgabe nach den Vorrangregeln neu einliest,
 *  – Grenzen und Nebenbedingungen stehen hier noch einmal separat aus dem Pflichtenheft.
 * Wird von test/test.html geladen (klassisches Skript, läuft auch über file://).
 */
(function (root) {
  'use strict';

  const A = root.Aufgaben;
  const SCHMAL = '\u202F', MINUS = '\u2212', MAL = '\u00B7';
  const PH = 'Pflichtenheft', FEST = 'Absprache';

  // ------------------------------------------------------------ Hilfen

  const fmt = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, SCHMAL);
  const reinText = html => html.replace(/<sup>/g, ' ').replace(/<[^>]+>/g, ' ');
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function enthaeltZahl(text, v) {
    return new RegExp('(^|[^\\d' + SCHMAL + '])' + escRe(fmt(v)) + '(?!\\d|' + SCHMAL + '\\d)').test(text);
  }

  const istNatuerlich = v => Number.isSafeInteger(v) && v >= 0;

  /** Strenger Auswerter. Befunde: negativ, div0, rest, zahl, variable, knoten (unbekannte Rechenart, z. B. Division mit Rest) */
  function auswerten(e, belegung, befund) {
    const w = k => auswerten(k, belegung, befund);
    switch (e && e.t) {
      case 'n':
        if (!istNatuerlich(e.v)) befund.add('zahl');
        return e.v;
      case 'x':
        if (!belegung || !(e.name in belegung)) { befund.add('variable'); return NaN; }
        return belegung[e.name];
      case '()': return w(e.a);
      case '+': return w(e.a) + w(e.b);
      case '-': {
        const r = w(e.a) - w(e.b);
        if (r < 0) befund.add('negativ');
        return r;
      }
      case '*': return w(e.a) * w(e.b);
      case ':': {
        const a = w(e.a), b = w(e.b);
        if (b === 0) { befund.add('div0'); return NaN; }
        if (a % b !== 0) befund.add('rest');
        return a / b;
      }
      case '^': {
        const a = w(e.a), b = w(e.b);
        if (a === 0 && b === 0) befund.add('zahl');
        return Math.pow(a, b);
      }
    }
    befund.add('knoten');
    return NaN;
  }

  function besucheBaum(e, fn, imExponent) {
    if (!e) return;
    fn(e, !!imExponent);
    if (e.t === '()') besucheBaum(e.a, fn, imExponent);
    else if (e.a) {
      besucheBaum(e.a, fn, imExponent);
      besucheBaum(e.b, fn, imExponent || e.t === '^');
    }
  }

  function hatPotenz(e) {
    let ja = false;
    besucheBaum(e, k => { if (k.t === '^') ja = true; });
    return ja;
  }

  /** Blattzahlen (ohne Exponenten) */
  function zahlenIn(e) {
    const liste = [];
    besucheBaum(e, (k, imExp) => { if (k.t === 'n' && !imExp) liste.push(k.v); });
    return liste;
  }

  const gleich = (a, b) => a === b;

  // ------------------------------------------------------------ Parser
  // Liest einen angezeigten Term (HTML) nach Lehrbuch-Vorrangregeln ein.

  function parse(html, belegung) {
    const s = html.replace(/<sup>(.*?)<\/sup>/g, '^($1)').replace(/<i>([a-z])<\/i>/g, '$1');
    if (/[<>]/.test(s)) throw new Error('Unerwartetes HTML im Term');
    const tokens = [];
    const re = /(\s+)|(\d{1,3}(?:\u202F\d{3})+|\d+)|([a-z])|([+\u2212\u00B7:()^])/y;
    let pos = 0;
    while (pos < s.length) {
      re.lastIndex = pos;
      const m = re.exec(s);
      if (!m) throw new Error('Unerwartetes Zeichen „' + s[pos] + '" im Term');
      pos = re.lastIndex;
      if (m[2]) tokens.push({ z: parseInt(m[2].replace(/\u202F/g, ''), 10) });
      else if (m[3]) tokens.push({ v: m[3] });
      else if (m[4]) tokens.push({ o: m[4] });
    }
    const befund = new Set();
    let i = 0;
    const blick = () => tokens[i] || {};

    function summe() {
      let w = produkt();
      while (blick().o === '+' || blick().o === MINUS) {
        const o = tokens[i++].o, r = produkt();
        w = o === '+' ? w + r : w - r;
        if (w < 0) befund.add('negativ');
      }
      return w;
    }
    function produkt() {
      let w = potenz();
      while (blick().o === MAL || blick().o === ':') {
        const o = tokens[i++].o, r = potenz();
        if (o === MAL) w = w * r;
        else {
          if (r === 0) befund.add('div0');
          else if (w % r !== 0) befund.add('rest');
          w = w / r;
        }
      }
      return w;
    }
    function potenz() {
      const b = grundwert();
      if (blick().o === '^') { i++; return Math.pow(b, grundwert()); }
      return b;
    }
    function grundwert() {
      const t = tokens[i++];
      if (!t) throw new Error('Term endet unerwartet');
      if ('z' in t) return t.z;
      if ('v' in t) {
        if (!belegung || !(t.v in belegung)) throw new Error('Variable ' + t.v + ' ohne Wert');
        return belegung[t.v];
      }
      if (t.o === '(') {
        const w = summe();
        if ((tokens[i++] || {}).o !== ')') throw new Error('Klammer nicht geschlossen');
        return w;
      }
      throw new Error('Unerwartetes Zeichen „' + t.o + '"');
    }
    const wert = summe();
    if (i !== tokens.length) throw new Error('Unerwarteter Rest im Term');
    return { wert, befund };
  }

  // ------------------------------------------------------- Schreibweise

  function schreibweise(html) {
    const probleme = [];
    if (/\^/.test(html)) probleme.push('„^" statt Hochstellung');
    if (/[²³⁴⁵⁶⁷⁸⁹⁰¹ⁿᵐ]/.test(html)) probleme.push('Hochzahl-Zeichen statt <sup>');
    const s = html.replace(/<sup>(.*?)<\/sup>/g, '^$1').replace(/<[^>]+>/g, ' ');
    if (/\d{4,}/.test(s)) probleme.push('Zahl ohne Tausendertrennung');
    if (/\d[ \u00A0\u2009]\d{3}(?!\d)/.test(s)) probleme.push('falsches Leerzeichen als Tausendertrenner');
    if (/\d{4}\u202F|\u202F\d{1,2}(?!\d)|\u202F\d{4}/.test(s)) probleme.push('Tausendertrennung falsch gesetzt');
    if (/[\d)]\s*[*×]\s*[\d(]/.test(s)) probleme.push('„*" oder „×" statt „·"');
    if (/[\d)]\s*-\s*[\d(]/.test(s)) probleme.push('Bindestrich statt „−"');
    if (/[\d)]\s*[/÷]\s*[\d(]/.test(s)) probleme.push('„/" oder „÷" statt „:"');
    return probleme;
  }

  // ------------------------------------------------- Grenzen je Typ/Stufe

  const nie = () => [];
  const bed = liste => liste.filter(([ok]) => !ok).map(([, text]) => text);

  const GRENZEN = {
    vorrang: {
      G: { maxErg: 500, maxZahl: 100, quelle: PH, extra: nie },
      H: { maxErg: 5000, maxZahl: 1000, quelle: PH, extra: nie },
      E: { maxErg: 20000, quelle: PH, extra: a => bed([[hatPotenz(a.meta.term), 'Term enthält keine Potenz']]) }
    },
    potenz: {
      G: { maxErg: 10000, quelle: PH, extra: a => {
        const { basis, exponent } = a.meta.werte;
        return bed([[(exponent === 2 && basis <= 12) || (exponent === 3 && basis <= 6) || (basis === 10 && exponent <= 4),
          'nur a² (a ≤ 12), a³ (a ≤ 6), 10ⁿ (n ≤ 4) erlaubt']]);
      } },
      H: { maxErg: 20736, quelle: PH, extra: a => {
        const { basis, exponent } = a.meta.werte;
        return exponent <= 1
          ? bed([[basis <= 999, 'a¹ und a⁰: a ≤ 999']])
          : bed([[basis <= 12 && exponent <= 4, 'a ≤ 12 und n ≤ 4']]);
      } },
      E: { maxErg: 20000, quelle: FEST, extra: a => bed([[hatPotenz(a.meta.term), 'Term enthält keine Potenz']]) }
    },
    vorteilhaft: {
      G: { maxErg: 99000, quelle: FEST, extra: a => {
        const w = a.meta.werte, [x, y] = w.paar, z = zahlenIn(a.meta.term).sort((p, q) => p - q);
        const erlaubt = [[25, 4], [5, 20], [2, 50], [8, 125]].some(([p, q]) => p === x && q === y);
        return bed([[w.a <= 99, 'a ≤ 99'], [erlaubt, 'Faktorpaar nicht aus der Vorgabe'],
          [z.join() === [w.a, x, y].sort((p, q) => p - q).join(), 'Term passt nicht zu a und Faktorpaar']]);
      } },
      H: { maxErg: 99000, quelle: FEST, extra: a => {
        const w = a.meta.werte, m = a.meta.muster;
        if (m.startsWith('a · (b + c)')) return bed([[w.b + w.c === 100 || w.b + w.c === 1000, 'b + c = 100 oder 1 000']]);
        if (m.startsWith('a · b + c · a')) return bed([[w.b + w.c === 100, 'b + c = 100']]);
        return bed([[w.a % w.c === 0 && w.b % w.c === 0, 'a und b Vielfache von c']]);
      } },
      E: { maxErg: 99000, quelle: FEST, extra: a => {
        const w = a.meta.werte, m = a.meta.muster;
        if (m.startsWith('a · b − a · c')) return bed([[w.b - w.c + w.d === 100, 'b − c + d = 100']]);
        if (m.startsWith('a : c − b : c')) return bed([[w.a % w.c === 0 && w.b % w.c === 0, 'a und b Vielfache von c']]);
        const z = zahlenIn(a.meta.term);
        return bed([[[100, 1000].indexOf(w.x * w.y) >= 0, 'verstecktes Paar ergibt 100 oder 1 000'],
          [z.indexOf(w.x) >= 0 && z.indexOf(w.y * w.k) >= 0 && z.length === 3, 'drei Faktoren, Paar versteckt']]);
      } }
    },
    termtext: {
      G: { maxErg: 2000, quelle: FEST, extra: a => textPasstZuTerm(a) },
      H: { maxErg: 5000, quelle: FEST, extra: a => textPasstZuTerm(a) },
      E: { maxErg: 20000, quelle: FEST, extra: a => textPasstZuTerm(a).concat(bed([[hatPotenz(a.meta.term), 'Term enthält keine Potenz']])) }
    },
    gleichung: {
      G: { maxErg: 12, quelle: PH, extra: a => bed([[a.meta.werte.faktor <= 9, 'a ≤ 9'], [a.meta.werte.rechts <= 100, 'c ≤ 100'], [a.loesung <= 12, 'x ≤ 12']]) },
      H: { maxErg: 270, quelle: FEST, extra: a => {
        const w = a.meta.werte, gemeinsam = [[w.faktor <= 9, 'a ≤ 9'], [w.rechts <= 500, 'c ≤ 500']];
        return a.meta.muster === 'x : a + b = c'
          ? bed(gemeinsam.concat([[a.loesung % w.a === 0 && a.loesung / w.a >= 2 && a.loesung / w.a <= 30, 'x = a · k mit k von 2 bis 30']]))
          : bed(gemeinsam.concat([[a.loesung <= 25, 'x ≤ 25']]));
      } },
      E: { maxErg: 500, quelle: FEST, extra: a => bed([[a.meta.werte.faktor <= 9, 'Faktor ≤ 9']]) }
    },
    sachaufgabe: {
      G: { maxErg: 100000, quelle: FEST, extra: a => sachBedingungen(a) },
      H: { maxErg: 100000, quelle: FEST, extra: a => sachBedingungen(a) },
      E: { maxErg: 1000000, quelle: FEST, extra: a => sachBedingungen(a) }
    },
    fehlersuche: {
      G: { maxErg: 500, maxFalsch: 1000, quelle: FEST, extra: nie },
      H: { maxErg: 5000, maxFalsch: 5000, quelle: FEST, extra: nie },
      E: { maxErg: 20000, maxFalsch: 20000, quelle: FEST, extra: nie }
    },
    grossbauwerk: {
      G: { maxErg: 5000, quelle: FEST, ziel: 'H', extra: nie },
      H: { maxErg: 20000, quelle: FEST, ziel: 'E', extra: nie },
      E: { maxErg: 20000, quelle: FEST, ziel: 'E', extra: nie }
    }
  };

  /** Jede Zahl des Terms (außer Exponenten und dem Faktor 2 aus „verdoppeln/halbieren/Doppelte/Hälfte") steht im Text. */
  function textPasstZuTerm(a) {
    const text = reinText(a.anzeige);
    const fehlend = zahlenIn(a.meta.term).filter(v => v !== 2 && !enthaeltZahl(text, v));
    return fehlend.length ? ['Zahl ' + fehlend.join(', ') + ' steht nicht im Text'] : [];
  }

  // --------------------------------------------- Sachaufgaben-Schablonen

  const SCHABLONEN = {
    bus:            { stufe: 'G', formel: w => w.a - w.b, bedingungen: w => [[w.a <= 80, 'a ≤ 80'], [w.b <= w.a, 'b ≤ a']] },
    klassenfahrt:   { stufe: 'G', formel: w => w.a * w.b, bedingungen: () => [] },
    lager:          { stufe: 'G', formel: w => w.a + w.b, bedingungen: () => [] },
    buecherei:      { stufe: 'G', formel: w => w.a - w.b, bedingungen: w => [[w.b <= w.a, 'b ≤ a']] },
    aepfel:         { stufe: 'G', formel: w => w.a / w.b, bedingungen: w => [[w.a % w.b === 0, 'Division geht auf'], [w.b <= 99, 'Divisor ein- oder zweistellig']] },
    gueterzug:      { stufe: 'G', formel: w => w.a * w.b, bedingungen: () => [] },
    tankwagen:      { stufe: 'H', formel: w => w.a - w.b - w.c - w.d, bedingungen: w => [[w.a >= 9000 && w.a <= 20000, 'a zwischen 9 000 und 20 000'], [w.b + w.c + w.d < w.a, 'b + c + d < a']] },
    sitzreihen:     { stufe: 'H', formel: w => w.a * w.b + w.c, bedingungen: () => [] },
    baeume:         { stufe: 'H', formel: w => w.c - w.a * w.b, bedingungen: w => [[w.c > w.a * w.b, 'c > a · b']] },
    flaschen:       { stufe: 'H', formel: w => (w.a + w.b) / w.c, bedingungen: w => [[(w.a + w.b) % w.c === 0, 'a + b Vielfaches von c'], [w.c <= 99, 'Divisor ein- oder zweistellig']] },
    ladung:         { stufe: 'H', formel: w => (w.a - w.b) / w.c, bedingungen: w => [[w.b < w.a, 'b < a'], [(w.a - w.b) % w.c === 0, 'Division geht auf'], [w.c <= 99, 'Divisor ein- oder zweistellig']] },
    kino:           { stufe: 'H', formel: w => w.a * w.b - w.c, bedingungen: w => [[w.c <= w.a * w.b, 'c ≤ a · b']] },
    sparen:         { stufe: 'H', formel: w => w.a * w.b - w.c, bedingungen: w => [[w.c <= w.a * w.b, 'c ≤ a · b']] },
    wanderung:      { stufe: 'H', formel: w => w.a - w.b * w.c, bedingungen: w => [[w.b * w.c < w.a, 'b · c < a']] },
    rettungsboote:  { stufe: 'E', formel: w => (w.a + w.c) / w.b, bedingungen: w => [[(w.a + w.c) % w.b === 0, 'Personenzahl Vielfaches der Bootsgröße'], [w.b <= 99, 'Divisor ein- oder zweistellig']] },
    schulfest:      { stufe: 'E', formel: w => w.a + w.b + w.c - w.d - w.e, bedingungen: w => [[w.d + w.e < w.a + w.b + w.c, 'Ausgaben < Einnahmen']] },
    lieferung:      { stufe: 'E', formel: w => w.a * w.b * w.c * w.d + w.a * w.e, bedingungen: (w, a) => [[/in Cent/.test(a.anzeige), 'Anzeige verlangt „in Cent"']] },
    baustelle:      { stufe: 'E', formel: w => (w.a * w.b - w.c) / w.a, bedingungen: w => [[w.c < w.a * w.b, 'c < a · b'], [w.c % w.a === 0, 'verbrauchte Steine sind volle Paletten'], [w.a <= 99, 'Divisor ein- oder zweistellig']] },
    jugendherberge: { stufe: 'E', formel: w => w.b * w.d + w.a / w.c, bedingungen: w => [[w.a % w.c === 0, 'Buskosten teilbar durch Kinderzahl'], [w.c <= 99, 'Divisor ein- oder zweistellig']] },
    druckerei:      { stufe: 'E', formel: w => w.a * w.b * w.c / w.d, bedingungen: w => [[(w.a * w.b * w.c) % w.d === 0, 'Division geht auf'], [w.d <= 99, 'Divisor ein- oder zweistellig']] }
  };

  function sachBedingungen(a) {
    const s = SCHABLONEN[a.meta.muster];
    if (!s) return ['unbekannte Schablone ' + a.meta.muster];
    const w = a.meta.werte, text = reinText(a.anzeige);
    const probleme = bed(s.bedingungen(w, a));
    if (s.stufe !== a.stufe) probleme.push('Schablone gehört zu Stufe ' + s.stufe);
    if (!gleich(s.formel(w), a.loesung)) probleme.push('Lösung ≠ Formel der Schablone');
    const fehlend = Object.keys(w).filter(k => !enthaeltZahl(text, w[k]));
    if (fehlend.length) probleme.push('Wert ' + fehlend.join(', ') + ' fehlt im Text');
    return probleme;
  }

  // ------------------------------------------------------- Generatortest

  const PRUEFUNGEN = [
    'Erzeugung ohne Programmfehler',
    'Pflichtfelder vollständig',
    'Lösung ist natürliche Zahl',
    'Lösung im Zahlenraum',
    'Zahlen der Aufgabe im Zahlenraum',
    'Kein negatives Zwischenergebnis',
    'Keine Division durch 0',
    'Alle Divisionen gehen auf',
    'Keine Division mit Rest',
    'Anzeige neu eingelesen = Lösung',
    'Rechenweg rechnet richtig',
    'Rechenweg enthält das Ergebnis',
    'Keine direkte Wiederholung der Anzeige',
    'Schreibweise (· : − Hochstellung, Tausender)',
    'Tipp verrät keinen Rechenweg',
    'Vorgaben des Musters / der Schablone',
    'Fehlersuche: falsches ≠ richtiges Ergebnis',
    'Fehlersuche: falsches Ergebnis plausibel',
    'Großbauwerk: Stufe + 1',
    'Muster passt zum Niveau',
    'Zeitschätzung zwischen 10 und 100 s'
  ];

  const NIVEAU_NAME = { 1: 'Niveau 1 · Etappe 1–2', 2: 'Niveau 2 · Etappe 3–4', 3: 'Niveau 3 · ab Etappe 5' };
  const median = liste => {
    if (!liste.length) return NaN;
    const l = liste.slice().sort((a, b) => a - b);
    return l.length % 2 ? l[(l.length - 1) / 2] : (l[l.length / 2 - 1] + l[l.length / 2]) / 2;
  };
  /** größte Zahl, die in der Aufgabe steht (ohne Hochzahlen) */
  function groessteZahl(anzeige) {
    const text = anzeige.replace(/<sup>.*?<\/sup>/g, ' ').replace(/<[^>]+>/g, ' ');
    const zahlen = (text.match(/\d+(?:\u202F\d{3})*/g) || []).map(t => parseInt(t.replace(/\u202F/g, ''), 10));
    return zahlen.length ? Math.max.apply(null, zahlen) : 0;
  }

  const BEFUND_ZU_PRUEFUNG = {
    negativ: 'Kein negatives Zwischenergebnis',
    zahl: 'Kein negatives Zwischenergebnis',
    div0: 'Keine Division durch 0',
    rest: 'Alle Divisionen gehen auf',
    variable: 'Rechenweg rechnet richtig',
    knoten: 'Keine Division mit Rest'
  };

  function testeGenerator(typ, stufe, laeufe, niveau) {
    niveau = niveau || 3;
    const grenzen = GRENZEN[typ][stufe];
    const zahlen = [], sekunden = [];
    const ergebnis = {
      typ, stufe, niveau, laeufe, quelle: grenzen.quelle, maxErg: grenzen.maxErg, maxZahl: grenzen.maxZahl,
      pruefungen: {}, muster: {}, verschiedene: 0, min: Infinity, max: -Infinity, beispiele: [], dauerMs: 0
    };
    const start = Date.now();
    const anzeigen = new Set();
    const verlauf = [];
    let letzteAnzeige = null;

    const relevant = new Set(PRUEFUNGEN.filter(name =>
      !(name.startsWith('Fehlersuche') && typ !== 'fehlersuche') &&
      !(name.startsWith('Großbauwerk') && typ !== 'grossbauwerk') &&
      !(name === 'Zahlen der Aufgabe im Zahlenraum' && !grenzen.maxZahl)));
    relevant.forEach(name => { ergebnis.pruefungen[name] = { ok: 0, fehler: 0, beispiel: null }; });

    for (let lauf = 0; lauf < laeufe; lauf++) {
      const fehlerDieserLauf = new Map();
      const melde = (name, ok, detail) => {
        if (!relevant.has(name)) return;
        if (!ok && !fehlerDieserLauf.has(name)) fehlerDieserLauf.set(name, detail || '');
      };

      let a;
      try {
        a = A.erzeuge(typ, stufe, { verlauf, niveau });
      } catch (err) {
        const p = ergebnis.pruefungen['Erzeugung ohne Programmfehler'];
        p.fehler++;
        if (!p.beispiel) p.beispiel = { detail: err.message };
        continue;
      }

      try {
        pruefeAufgabe(a, typ, stufe, grenzen, melde, letzteAnzeige);
        melde('Muster passt zum Niveau', a.meta.niveau === niveau && A.abNiveau(typ, stufe, a.meta.musterIndex) <= niveau,
          'Muster „' + a.meta.muster + '" erst ab Niveau ' + A.abNiveau(typ, stufe, a.meta.musterIndex));
        melde('Zeitschätzung zwischen 10 und 100 s', Number.isFinite(a.meta.sekunden) && a.meta.sekunden >= 10 && a.meta.sekunden <= 100,
          'geschätzt ' + a.meta.sekunden + ' s');
      } catch (err) {
        melde('Rechenweg rechnet richtig', false, 'Ausnahme im Test: ' + err.message);
      }

      relevant.forEach(name => {
        const p = ergebnis.pruefungen[name];
        if (fehlerDieserLauf.has(name)) {
          p.fehler++;
          if (!p.beispiel) p.beispiel = { detail: fehlerDieserLauf.get(name), anzeige: a.anzeige, rechenweg: a.rechenweg, loesung: a.loesung };
        } else p.ok++;
      });

      letzteAnzeige = a.anzeige;
      anzeigen.add(a.anzeige);
      zahlen.push(Math.max(groessteZahl(a.anzeige), a.loesung));
      sekunden.push(a.meta.sekunden);
      ergebnis.muster[a.meta.muster] = (ergebnis.muster[a.meta.muster] || 0) + 1;
      ergebnis.min = Math.min(ergebnis.min, a.loesung);
      ergebnis.max = Math.max(ergebnis.max, a.loesung);
      if (ergebnis.beispiele.length < 4 && !ergebnis.beispiele.some(b => b.muster === a.meta.muster)) {
        ergebnis.beispiele.push({ muster: a.meta.muster, anzeige: a.anzeige, loesung: a.loesung, rechenweg: a.rechenweg, tipp: a.tipp, sekunden: a.meta.sekunden });
      }
    }

    ergebnis.verschiedene = anzeigen.size;
    ergebnis.musterSoll = A.anzahlMuster(typ, stufe, niveau);
    ergebnis.medianZahl = median(zahlen);
    ergebnis.medianSekunden = median(sekunden);
    ergebnis.musterIst = Object.keys(ergebnis.muster).length;
    ergebnis.dauerMs = Date.now() - start;
    ergebnis.bestanden = Object.values(ergebnis.pruefungen).every(p => p.fehler === 0) && ergebnis.musterIst === ergebnis.musterSoll;
    return ergebnis;
  }

  function pruefeAufgabe(a, typ, stufe, grenzen, melde, letzteAnzeige) {
    const meta = a.meta || {};

    // Pflichtfelder
    const felder = ['typ', 'stufe', 'anzeige', 'loesung', 'rechenweg', 'tipp'].filter(f => a[f] === undefined || a[f] === '');
    melde('Pflichtfelder vollständig', felder.length === 0 && a.typ === typ && a.stufe === stufe, 'fehlt/falsch: ' + felder.join(', '));

    // Lösung
    melde('Lösung ist natürliche Zahl', istNatuerlich(a.loesung), 'Lösung ' + JSON.stringify(a.loesung));
    melde('Lösung im Zahlenraum', a.loesung <= grenzen.maxErg, 'Lösung ' + JSON.stringify(a.loesung) + ' > ' + fmt(grenzen.maxErg));
    melde('Keine Division mit Rest', typeof a.loesung === 'number' && !/Rest/.test(a.anzeige + a.rechenweg) && !/aufrunden|runde auf/i.test(a.anzeige + a.rechenweg + a.tipp),
      'Rest oder Aufrunden in der Aufgabe');

    // Alle Termbäume streng auswerten
    const baeume = [];
    if (meta.term) baeume.push([meta.term, null]);
    (meta.kette || []).forEach(k => baeume.push([k, null]));
    (meta.zeilen || []).forEach(k => baeume.push([k, null]));
    (meta.falschKette || []).forEach(k => baeume.push([k, null]));
    if (meta.links) baeume.push([meta.links, { x: a.loesung }], [meta.rechts, null]);
    if (meta.termMitN) baeume.push([meta.termMitN, { n: meta.teil1, x: meta.teil1 }]);
    melde('Rechenweg rechnet richtig', baeume.length > 0, 'keine Rechnung in meta');
    baeume.forEach(([baum, belegung]) => {
      const befund = new Set();
      const w = auswerten(baum, belegung, befund);
      befund.forEach(b => melde(BEFUND_ZU_PRUEFUNG[b], false, b + ' in ' + A.intern.zeige(baum)));
      // Darstellung des Baums neu einlesen (prüft Klammern und Vorrang)
      try {
        const p = parse(A.intern.zeige(baum), belegung);
        melde('Anzeige neu eingelesen = Lösung', p.wert === w, 'Darstellung ' + A.intern.zeige(baum) + ' ergibt ' + p.wert + ' statt ' + w);
        p.befund.forEach(b => melde(BEFUND_ZU_PRUEFUNG[b], false, b + ' beim Einlesen von ' + A.intern.zeige(baum)));
      } catch (err) {
        melde('Anzeige neu eingelesen = Lösung', false, err.message + ': ' + A.intern.zeige(baum));
      }
    });

    // Zahlen der Aufgabe
    if (grenzen.maxZahl) {
      const zu = zahlenIn(meta.term).filter(v => v > grenzen.maxZahl);
      melde('Zahlen der Aufgabe im Zahlenraum', zu.length === 0, 'Zahl ' + zu.join(', ') + ' > ' + fmt(grenzen.maxZahl));
    }

    const leseEin = (html, belegung, erwartet, beschreibung) => {
      try {
        const p = parse(html, belegung);
        melde('Anzeige neu eingelesen = Lösung', gleich(p.wert, erwartet), beschreibung + ': ' + html + ' ergibt ' + p.wert + ' statt ' + erwartet);
        p.befund.forEach(b => melde(BEFUND_ZU_PRUEFUNG[b], false, b + ' in ' + html));
        return p.wert;
      } catch (err) {
        melde('Anzeige neu eingelesen = Lösung', false, err.message + ': ' + html);
        return NaN;
      }
    };
    const inAnzeige = html => melde('Anzeige neu eingelesen = Lösung', a.anzeige.indexOf(html) >= 0, 'Term steht nicht in der Anzeige');

    // Angezeigte Aufgabe neu einlesen
    if (typ === 'gleichung') {
      const teile = meta.gleichungAnzeige.split(' = ');
      melde('Anzeige neu eingelesen = Lösung', teile.length === 2, 'Gleichung hat nicht genau ein „="');
      const rechts = leseEin(teile[1], {}, auswerten(meta.rechts, null, new Set()), 'rechte Seite');
      leseEin(teile[0], { x: a.loesung }, rechts, 'linke Seite mit x = ' + a.loesung);
      inAnzeige(meta.gleichungAnzeige);
      const letzte = meta.zeilen[meta.zeilen.length - 1];
      melde('Rechenweg rechnet richtig', auswerten(letzte, null, new Set()) === a.loesung, 'Rückwärtsrechnung endet nicht bei x');
    } else if (typ === 'grossbauwerk') {
      const variable = /<i>x<\/i>/.test(meta.termMitNAnzeige) ? 'x' : 'n';
      leseEin(meta.termMitNAnzeige, { [variable]: meta.teil1 }, a.loesung, 'Term aus Schritt 2');
      inAnzeige(meta.termMitNAnzeige);
      const letzte = meta.zeilen[meta.zeilen.length - 1];
      melde('Rechenweg rechnet richtig', auswerten(letzte, null, new Set()) === meta.teil1, 'Schritt 1 endet nicht beim eingesetzten Wert');
    } else if (typ === 'fehlersuche') {
      const glieder = meta.falschAnzeige.split(' = ');
      const werte = glieder.map((g, i) => leseEin(g, {}, i === 0 ? a.loesung : auswerten(meta.falschKette[i], null, new Set()), 'Glied ' + (i + 1)));
      inAnzeige(meta.falschAnzeige);
      const falsch = werte[werte.length - 1];
      melde('Fehlersuche: falsches ≠ richtiges Ergebnis', falsch !== a.loesung && meta.falsch !== a.loesung, 'falsch ' + falsch + ' = richtig ' + a.loesung);
      melde('Fehlersuche: falsches Ergebnis plausibel', istNatuerlich(falsch) && falsch <= grenzen.maxFalsch, 'falsches Ergebnis ' + falsch);
      melde('Rechenweg rechnet richtig', /Fehler:/.test(a.rechenweg), 'Rechenweg benennt den Fehler nicht');
    } else if (meta.termAnzeige) {
      leseEin(meta.termAnzeige, {}, a.loesung, 'angezeigter Term');
      if (typ !== 'termtext') inAnzeige(meta.termAnzeige);
    }

    if (typ === 'grossbauwerk') {
      melde('Großbauwerk: Stufe + 1', meta.zielstufe === grenzen.ziel, 'Zielstufe ' + meta.zielstufe);
    }

    // Rechenweg-Kette: jedes Glied hat den Wert der Lösung
    if (meta.kette) {
      const falsch = meta.kette.filter(k => auswerten(k, null, new Set()) !== a.loesung);
      melde('Rechenweg rechnet richtig', falsch.length === 0 && meta.kette[meta.kette.length - 1].t === 'n',
        'Glied ' + (falsch[0] ? A.intern.zeige(falsch[0]) : '') + ' ≠ Lösung');
    }
    if (typ === 'sachaufgabe') {
      const letzte = auswerten(meta.zeilen[meta.zeilen.length - 1], null, new Set());
      melde('Rechenweg rechnet richtig', gleich(letzte, a.loesung), 'letzte Zeile ≠ Lösung');
    }

    // Ergebnis im Rechenweg
    const rwText = reinText(a.rechenweg);
    const drin = enthaeltZahl(rwText, a.loesung);
    melde('Rechenweg enthält das Ergebnis', drin, 'Ergebnis ' + JSON.stringify(a.loesung) + ' fehlt');

    // Wiederholung
    melde('Keine direkte Wiederholung der Anzeige', a.anzeige !== letzteAnzeige, 'gleiche Anzeige wie zuvor');

    // Schreibweise
    const sw = schreibweise(a.anzeige).concat(schreibweise(a.rechenweg));
    melde('Schreibweise (· : − Hochstellung, Tausender)', sw.length === 0, sw.join('; '));

    // Tipp
    // Tipp = allgemeine Regel: kein „=", keine Zahlen außer den Regelzahlen 0, 1, 10, 100, 1 000
    const tippZahlen = (a.tipp.replace(/Schritt \d/g, "").match(/\d+(?:\u202F\d{3})*/g) || []).map(t => t.replace(/\u202F/g, ''));
    const tippVerraet = /=/.test(a.tipp) || tippZahlen.some(t => ['0', '1', '10', '100', '1000'].indexOf(t) < 0);
    melde('Tipp verrät keinen Rechenweg', !tippVerraet, 'Tipp: ' + a.tipp);

    // Rückwärtsrechnen ohne Potenzen (Absprache): Gleichungen und Gleichungsteil der Großbauwerke
    const gleichungsBaeume = typ === 'gleichung' ? [meta.links, meta.rechts].concat(meta.zeilen)
      : (typ === 'grossbauwerk' && /^Gleichung/.test(meta.muster)) ? meta.zeilen : [];
    melde('Vorgaben des Musters / der Schablone', !gleichungsBaeume.some(hatPotenz) && !/<sup>/.test(typ === 'gleichung' ? a.anzeige : ''),
      'Potenz beim Rückwärtsrechnen');

    // Typ-spezifische Vorgaben
    const extra = grenzen.extra(a);
    melde('Vorgaben des Musters / der Schablone', extra.length === 0, extra.join('; '));
  }

  // -------------------------------------------- Weitere Prüfungen

  function pruefeEingabe() {
    const rows = [];
    const fall = (name, ok) => rows.push({ name, ok });
    const zahlAufgabe = { loesung: 7 };
    fall('„7" wird als richtig erkannt', A.pruefe(zahlAufgabe, '7') === true);
    fall('Führende Nullen werden ignoriert („007")', A.pruefe(zahlAufgabe, '007') === true);
    fall('Leere Eingabe wird nicht bewertet', A.pruefe(zahlAufgabe, '') === null);
    fall('„8" wird als falsch erkannt', A.pruefe(zahlAufgabe, '8') === false);
    fall('„0" ist eine gültige Eingabe', A.pruefe({ loesung: 0 }, '0') === true);
    fall('„000" wird als 0 gelesen', A.pruefe({ loesung: 0 }, '000') === true);
    fall('Nur Ziffern werden angenommen („1 2", „-3")', A.pruefe(zahlAufgabe, '1 2') === null && A.pruefe(zahlAufgabe, '-3') === null);
    return rows;
  }

  function schablonenUebersicht(ergebnisse) {
    const zeilen = Object.keys(SCHABLONEN).map(id => {
      const s = SCHABLONEN[id];
      const anzahl = ergebnisse.filter(e => e.typ === 'sachaufgabe' && e.stufe === s.stufe)
        .reduce((summe, e) => summe + (e.muster[id] || 0), 0);
      return { id, stufe: s.stufe, anzahl };
    });
    return { zeilen, gesamt: zeilen.length };
  }

  // ------------------------------------------------------- Gesamtlauf

  const OFFEN = [
    { nr: '9.4', name: 'Sperrlogik – zusätzlicher Handtest am Gerät', schritt: 'manuell',
      beschreibung: 'Automatisch geprüft unter „Spielablauf". Am iPad zusätzlich: falsche Eingabe machen, Countdown läuft. Seite neu laden, Tab schließen und neu öffnen. Die Sperre muss mit der verbleibenden Zeit weiterlaufen, die Tastatur bleibt gesperrt.' },
    { nr: '9.6', name: 'Performance 15 000 Blöcke ≥ 50 fps', schritt: 'Schritt 3', beschreibung: 'Benötigt die 3D-Welt (js/welt.js).' },
    { nr: '9.7', name: 'Manuelle Checkliste (Hochformat, iOS-Tastatur, Textgrößen, Endlosmodus, Neuanfang)', schritt: 'Schritt 2–4', beschreibung: 'Erste Punkte ab Schritt 2 im Browser prüfbar, abschließend am iPad.' }
  ];

  function alleAufgaben() {
    const liste = [];
    A.TYPEN.concat(['grossbauwerk']).forEach(typ => A.STUFEN.forEach(stufe => A.NIVEAUS.forEach(niveau => liste.push({ typ, stufe, niveau }))));
    return liste;
  }

  /**
   * Anstieg über die Etappen: Median der größten Zahl (in der Aufgabe oder als Ergebnis) und Median der
   * geschätzten Zeit je Niveau. Gefordert: Niveau 1 ≤ Niveau 2 ≤ Niveau 3 (10 % Toleranz für Zufallsschwankung)
   * und Niveau 1 < Niveau 3. Großbauwerke laufen im Spiel immer auf Niveau 3.
   */
  function steigerung(ergebnisse) {
    const zeilen = [];
    A.TYPEN.forEach(typ => A.STUFEN.forEach(stufe => {
      const je = A.NIVEAUS.map(n => ergebnisse.find(e => e.typ === typ && e.stufe === stufe && e.niveau === n));
      const z = je.map(e => e.medianZahl), t = je.map(e => e.medianSekunden);
      const steigt = liste => liste[0] <= liste[1] * 1.1 && liste[1] <= liste[2] * 1.1;
      const ok = steigt(z) && z[0] < z[2] && steigt(t);
      zeilen.push({ typ, stufe, zahlen: z, sekunden: t, muster: je.map(e => e.musterSoll), ok });
    }));
    return zeilen;
  }

  /** Führt alle Generatortests aus; fortschritt(ergebnis, index, gesamt) nach jedem Generator. */
  async function laufen(laeufe, fortschritt) {
    const liste = alleAufgaben();
    const ergebnisse = [];
    const beginn = new Date();
    for (let i = 0; i < liste.length; i++) {
      await new Promise(r => setTimeout(r, 0));
      const e = testeGenerator(liste[i].typ, liste[i].stufe, laeufe, liste[i].niveau);
      ergebnisse.push(e);
      if (fortschritt) fortschritt(e, i + 1, liste.length);
    }
    const eingabe = pruefeEingabe();
    const schablonen = schablonenUebersicht(ergebnisse);
    const anstieg = steigerung(ergebnisse);
    return {
      beginn, laeufe, ergebnisse, eingabe, schablonen, anstieg, offen: OFFEN,
      bestanden: ergebnisse.every(e => e.bestanden) && eingabe.every(r => r.ok) && anstieg.every(a => a.ok) &&
        schablonen.gesamt >= 15 && schablonen.zeilen.every(z => z.anzahl > 0)
    };
  }

  function alsText(p) {
    const z = [];
    const ok = b => (b ? 'OK    ' : 'FEHLER');
    z.push('ZAHLENSTADT – SELBSTTEST DER AUFGABENGENERATOREN');
    z.push('Datum: ' + p.beginn.toLocaleString('de-DE'));
    z.push('Umgebung: ' + (root.navigator ? root.navigator.userAgent : 'unbekannt'));
    z.push('Läufe je Generator, Stufe und Niveau: ' + p.laeufe);
    z.push('GESAMTERGEBNIS: ' + (p.bestanden ? 'BESTANDEN' : 'NICHT BESTANDEN'));
    z.push('');
    p.ergebnisse.forEach(e => {
      z.push('── ' + A.NAMEN_TYP[e.typ] + ' · ' + A.NAMEN_STUFE[e.stufe] + ' · ' + NIVEAU_NAME[e.niveau] + ' ── ' + (e.bestanden ? 'bestanden' : 'NICHT bestanden') +
        '  (Lösung ' + e.min + '…' + e.max + ', Grenze ' + e.maxErg + ' [' + e.quelle + '], ' + e.verschiedene + ' verschiedene Anzeigen, ' +
        e.musterIst + '/' + e.musterSoll + ' Muster, Median größte Zahl ' + e.medianZahl + ', Median Zeit ' + e.medianSekunden + ' s, ' + e.dauerMs + ' ms)');
      Object.keys(e.pruefungen).forEach(name => {
        const pr = e.pruefungen[name];
        z.push('  ' + ok(pr.fehler === 0) + ' ' + name + ': ' + pr.ok + ' ok, ' + pr.fehler + ' Fehler' +
          (pr.beispiel ? '  → z. B. ' + pr.beispiel.detail : ''));
      });
      z.push('  Muster: ' + Object.keys(e.muster).map(m => m + ' ×' + e.muster[m]).join(' | '));
    });
    z.push('');
    z.push('── Sachaufgaben-Schablonen (' + p.schablonen.gesamt + ', gefordert ≥ 15) ──');
    p.schablonen.zeilen.forEach(s => z.push('  ' + ok(s.anzahl > 0) + ' ' + s.id + ' [' + s.stufe + '] kam ' + s.anzahl + '× vor'));
    z.push('');
    z.push('── Anstieg über die Etappen (Median größte Zahl in Aufgabe oder Ergebnis | Median geschätzte Zeit je Niveau 1 / 2 / 3) ──');
    p.anstieg.forEach(a => z.push('  ' + ok(a.ok) + ' ' + A.NAMEN_TYP[a.typ] + ' · ' + A.NAMEN_STUFE[a.stufe] + ': Zahl ' + a.zahlen.join(' / ') +
      ' | Zeit ' + a.sekunden.join(' / ') + ' s | Muster ' + a.muster.join(' / ')));
    z.push('');
    z.push('── Eingabeprüfung ──');
    p.eingabe.forEach(r => z.push('  ' + ok(r.ok) + ' ' + r.name));
    z.push('');
    z.push('── Noch offen (folgt in späteren Schritten) ──');
    p.offen.forEach(o => z.push('  OFFEN  ' + o.nr + ' ' + o.name + ' – ' + o.schritt + '. ' + o.beschreibung));
    return z.join('\n');
  }

  root.Selbsttest = { laufen, alsText, testeGenerator, parse, auswerten, GRENZEN, SCHABLONEN, PRUEFUNGEN, NIVEAU_NAME };
})(typeof globalThis !== 'undefined' ? globalThis : this);
