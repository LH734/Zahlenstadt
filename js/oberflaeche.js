/*
 * Zahlenstadt – Oberfläche: verbindet Spielkern (spiel.js), Bildschirmtastatur,
 * Stadtansicht und alle Dialoge. Hier steht nur Darstellung, keine Spielregel.
 */
(function () {
  'use strict';

  const A = window.Aufgaben, S = window.Spiel, B = window.Bauplan, P = window.Pixelschrift;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ERFOLG_MS = 1500;

  // ------------------------------------------------------------ Speicher

  let speicher = null;
  try {
    localStorage.setItem('zahlenstadt.probe', '1');
    localStorage.removeItem('zahlenstadt.probe');
    speicher = localStorage;
  } catch (err) { /* ohne Speicher spielbar, aber ohne Fortschritt über Neuladen */ }

  const geladen = speicher ? S.laden(speicher) : { zustand: null, verworfen: false };
  let z = geladen.zustand || S.neuerZustand(Date.now());
  const sichern = () => { if (speicher) S.speichern(z, speicher); };
  sichern();

  // -------------------------------------------------------- Oberflächen-Zustand

  let erfolg = null;            // kurze Erfolgsanzeige: { aufgabe, abschnitt }
  let sperreWarAktiv = S.istGesperrt(z, Date.now());
  let feldZustand = sperreWarAktiv ? 'fehler' : '';   // '' | 'fehler' | 'richtig'
  let spaetereMeldungen = [];   // Meldungen, die nach der Lösungskarte erscheinen
  let gezeigteAnzeige = null;

  const welt = window.Platzhalter.erstelle($('welt'));
  const tastatur = window.Tastatur.erstelle({
    feld: $('tastatur'),
    anzeige: $('eingabefeld'),
    maxStellen: 7,
    darfTippen: eingabeFrei,
    beiBestaetigen: bestaetigen,
    beiAenderung: () => { if (feldZustand) { feldZustand = ''; zeichneFeld(); } }
  });

  // ------------------------------------------------------------------ Ton

  const ton = (function () {
    let ctx = null;
    function freischalten() {
      const Kontext = window.AudioContext || window.webkitAudioContext;
      if (!ctx && Kontext) ctx = new Kontext();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    }
    // Audio erst nach Berührung entsperren (Safari)
    document.addEventListener('pointerdown', freischalten, { passive: true });
    function spiele(noten) {
      if (!z.ton || !ctx) return;
      let t = ctx.currentTime + 0.01;
      noten.forEach(([frequenz, dauer]) => {
        const osz = ctx.createOscillator(), laut = ctx.createGain();
        osz.type = 'square';
        osz.frequency.value = frequenz;
        laut.gain.setValueAtTime(0.0001, t);
        laut.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
        laut.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
        osz.connect(laut).connect(ctx.destination);
        osz.start(t);
        osz.stop(t + dauer + 0.02);
        t += dauer * 0.9;
      });
    }
    return {
      bau: () => spiele([[330, 0.06], [440, 0.06], [587, 0.1]]),
      erfolg: () => spiele([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.22]])
    };
  })();

  // ------------------------------------------------------ Statische Teile

  const WUERFEL = ['#########', '#.......#', '#.#...#.#', '#.......#', '#...#...#', '#.......#', '#.#...#.#', '#.......#', '#########'];
  const ZAHNRAD = ['...#.#...', '.#######.', '.##...##.', '##.....##', '.#.....#.', '##.....##', '.##...##.', '.#######.', '...#.#...'];
  const WARNUNG = ['....#....', '...###...', '...#.#...', '..##.##..', '..#...#..', '.##.#.##.', '.#.....#.', '##..#..##', '#########'];
  function bitmap(zeilen) {
    let r = '';
    zeilen.forEach((zeile, y) => { for (let x = 0; x < zeile.length; x++) if (zeile[x] === '#') r += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>'; });
    return '<svg viewBox="0 0 ' + zeilen[0].length + ' ' + zeilen.length + '" shape-rendering="crispEdges" aria-hidden="true"><g fill="currentColor">' + r + '</g></svg>';
  }

  $('logo').innerHTML = P.svg('Zahlenstadt', { farbe: '#8a5e34', grasblock: true, schatten: 'rgba(43, 36, 28, 0.3)' });
  $('marke').innerHTML = P.svg('ZS', { farbe: '#8a5e34', grasblock: true, schatten: '#0e1210' });
  $('wuerfelSymbol').innerHTML = bitmap(WUERFEL);
  $('menueKnopf').innerHTML = bitmap(ZAHNRAD);
  $('haengtSymbol').innerHTML = bitmap(WARNUNG);
  $('titelLoesung').innerHTML = P.svg('So wird gerechnet', { farbe: '#2b241c' });
  $('titelMenue').innerHTML = P.svg('Menü', { farbe: '#2b241c' });
  $('titelEnde').innerHTML = P.svg('Gut gebaut!', { farbe: '#8a5e34', grasblock: true, schatten: 'rgba(43, 36, 28, 0.3)' });
  $('stufenwahl').innerHTML = S.STUFEN.map(s =>
    '<button type="button" class="stufe-knopf" data-stufe="' + s + '"><b>' + A.NAMEN_STUFE[s] + '</b></button>').join('');

  // --------------------------------------------------------------- Regeln der Oberfläche

  function dialogOffen() {
    return ['menue', 'rueckfrage', 'tippkarte'].some(id => !$(id).hidden);
  }

  function eingabeFrei() {
    return (z.phase === 'spiel' || z.phase === 'tutorial') && !dialogOffen() && !erfolg &&
      !z.loesungskarteSeit && !S.istGesperrt(z, Date.now());
  }

  // -------------------------------------------------------------- Aktionen

  function bestaetigen(text) {
    if (!eingabeFrei()) return;
    if (text === '') {
      rueckmeldung('Tippe zuerst dein Ergebnis ein.', 'hinweis');
      wackeln($('eingabefeld'));
      return;
    }
    const alteAufgabe = z.aufgabe;
    const ereignisse = S.eingabe(z, text, Date.now());
    sichern();
    const arten = ereignisse.map(e => e.art);

    if (arten.indexOf('richtig') >= 0) {
      const gebaut = ereignisse.find(e => e.art === 'gebaut');
      erfolg = { aufgabe: alteAufgabe, abschnitt: gebaut && gebaut.abschnitt };
      feldZustand = 'richtig';
      if (gebaut) welt.baue(gebaut.abschnitt, z);
      ton.bau();
      ereignisse.forEach(meldeEreignis);
      zeichne();
      setTimeout(() => {
        erfolg = null;
        feldZustand = '';
        tastatur.leeren();
        zeichne();
      }, ERFOLG_MS);
    } else if (arten.indexOf('sperre') >= 0) {
      feldZustand = 'fehler';
      sperreWarAktiv = true;
      wackeln($('eingabefeld'));
      zeichne();
    } else if (arten.indexOf('loesungskarte') >= 0) {
      feldZustand = '';
      tastatur.leeren();
      spaetereMeldungen = ereignisse.filter(e => e.art === 'stufe');
      zeichne();
    }
  }

  function meldeEreignis(e) {
    if (e.art === 'stufe') meldung(e.text, e.richtung === 'hoch' ? 'stufe' : 'neutral');
    if (e.art === 'tutorialFertig') meldung('Grundstein gelegt! Jetzt beginnt Etappe 1: Dorfkern.', 'erfolg');
    if (e.art === 'etappeFertig' && !e.endlos) { meldung('Etappe ' + e.etappe + ' fertig: ' + e.viertel, 'erfolg'); ton.erfolg(); }
    if (e.art === 'etappeFertig' && e.endlos) ton.erfolg();
    if (e.art === 'mindestziel') meldung('Mindestziel geschafft! Ab jetzt baust du Bonus-Viertel.', 'erfolg');
    if (e.art === 'endlos') meldung('Alle sieben Etappen gebaut! Deine Stadt wächst jetzt immer weiter.', 'erfolg');
    if (e.art === 'wachstum') meldung('Neue Wachstumsstufe: ' + e.name, 'erfolg');
    if (e.art === 'gebaut' && e.abschnitt.gross) meldung('Großbauwerk fertig: ' + e.abschnitt.name, 'erfolg');
  }

  function loesungskarteWeiter() {
    const ereignisse = S.loesungskarteSchliessen(z, Date.now());
    if (!ereignisse.some(e => e.art === 'neueAufgabe')) return;
    sichern();
    tastatur.leeren();
    spaetereMeldungen.forEach(meldeEreignis);
    spaetereMeldungen = [];
    zeichne();
  }

  function frage(titel, text, jaText, beiJa, gefahr) {
    $('rueckfrageTitel').textContent = titel;
    $('rueckfrageText').textContent = text;
    $('rueckfrageJa').textContent = jaText;
    $('rueckfrageJa').className = 'knopf ' + (gefahr ? 'gefahr' : 'gras');
    $('rueckfrage').hidden = false;
    $('rueckfrageJa').onclick = () => { $('rueckfrage').hidden = true; beiJa(); };
  }

  // ------------------------------------------------------ Rückmeldungen

  function meldung(text, art) {
    const el = document.createElement('div');
    el.className = 'meldung ' + (art || 'neutral');
    el.textContent = text;
    $('meldungen').appendChild(el);
    setTimeout(() => el.classList.add('weg'), 3600);
    setTimeout(() => el.remove(), 4100);
  }

  function rueckmeldung(text, art) {
    const el = $('rueckmeldung');
    el.textContent = text;
    el.className = 'rueckmeldung ' + (art || '');
  }

  function wackeln(el) {
    el.classList.remove('wackeln');
    void el.offsetWidth;
    el.classList.add('wackeln');
  }

  // ------------------------------------------------------------ Zeichnen

  function zeichneStatus() {
    const st = S.status(z);
    $('stCodename').textContent = st.codename;
    $('stStufe').textContent = st.stufe;
    $('stEtappe').textContent = st.etappe.replace(/^Etappe /, '');
    $('stRichtig').textContent = st.richtig;
    $('stFalsch').textContent = st.falsch;
    $('stTyp').textContent = erfolg ? A.NAMEN_TYP[erfolg.aufgabe.typ] : st.typ;
    $('stHaengt').hidden = !st.haengt;
  }

  function zeichneFeld() {
    const f = $('eingabefeld');
    f.classList.toggle('fehler', feldZustand === 'fehler');
    f.classList.toggle('richtig', feldZustand === 'richtig');
  }

  function zeichneAufgabe() {
    const aufgabe = erfolg ? erfolg.aufgabe : z.aufgabe;
    if (!aufgabe) return;
    if (gezeigteAnzeige !== aufgabe.anzeige) {
      $('aufgabe').innerHTML = aufgabe.anzeige;
      gezeigteAnzeige = aufgabe.anzeige;
      passeSchriftAn();
    }
    const gross = aufgabe.typ === 'grossbauwerk';
    const f = S.fortschritt(z);
    const naechster = B.abschnitt(z.etappe, z.schritt);
    $('typChip').textContent = gross ? 'Großbauwerk' : A.NAMEN_TYP[aufgabe.typ];
    $('typChip').classList.toggle('gross', gross);
    $('bauziel').innerHTML = z.phase === 'tutorial' ? 'Baut: <b>Grundstein</b>'
      : erfolg && erfolg.abschnitt ? 'Gebaut: <b>' + esc(erfolg.abschnitt.name) + '</b>'
        : 'Baut: <b>' + esc(naechster.name) + '</b>';
    $('pips').innerHTML = z.phase === 'tutorial' ? '' : Array.from({ length: f.gesamt }, (_, i) => {
      const istGross = B.etappe(z.etappe).gross && i === f.gesamt - 1;
      const klasse = i < f.erledigt ? 'fertig' : i === f.erledigt ? 'jetzt' : '';
      return '<i class="pip ' + klasse + (istGross ? ' gross' : '') + '"></i>';
    }).join('');
    $('werkbank').classList.toggle('grossbauwerk', gross);
  }

  /** Aufgabentext so groß wie möglich (mind. 22 px), ohne dass die Karte überläuft */
  function passeSchriftAn() {
    const karte = $('aufgabenkarte'), inhalt = $('aufgabe');
    const stufen = [[36, 26], [32, 25], [29, 24], [26, 23], [24, 22]];
    for (let i = 0; i < stufen.length; i++) {
      inhalt.style.setProperty('--term', stufen[i][0] + 'px');
      inhalt.style.setProperty('--text', stufen[i][1] + 'px');
      if (inhalt.scrollHeight <= karte.clientHeight - 8) break;
    }
  }

  function zeichneSperre(jetzt) {
    const rest = S.sperreRest(z, jetzt);
    const aktiv = rest > 0;
    $('sperre').hidden = !aktiv;
    if (aktiv) {
      const sekunden = Math.ceil(rest / 1000);
      if ($('sperre').getAttribute('data-sek') !== String(sekunden)) {
        $('sperreZahl').innerHTML = P.svg(String(sekunden), { farbe: '#fffdf6', schatten: 'rgba(0,0,0,.35)' });
        $('sperre').setAttribute('data-sek', sekunden);
      }
      $('sperreBalken').style.transform = 'scaleX(' + (rest / S.SPERRE_MS).toFixed(3) + ')';
    }
  }

  function zeichneLoesungskarte(jetzt) {
    const offen = !!z.loesungskarteSeit;
    $('loesungskarte').hidden = !offen;
    if (!offen) return;
    if ($('lkAufgabe').getAttribute('data-anzeige') !== z.aufgabe.anzeige) {
      $('lkAufgabe').innerHTML = z.aufgabe.anzeige;
      $('lkAufgabe').setAttribute('data-anzeige', z.aufgabe.anzeige);
      $('lkLoesung').textContent = A.zahl(z.aufgabe.loesung);
      $('lkRechenweg').innerHTML = z.aufgabe.rechenweg;
    }
    const rest = S.karteRest(z, jetzt);
    $('lkWeiter').disabled = rest > 0;
    $('lkWarten').textContent = rest > 0 ? ' (' + Math.ceil(rest / 1000) + ')' : '';
  }

  function zeichneCode(el) {
    const code = S.abschlusscode(z);
    el.innerHTML = P.svg(code.slice(0, 3) + ' ' + code.slice(3), { farbe: '#2b241c' });
    el.setAttribute('aria-label', 'Abschlusscode ' + code.split('').join(' '));
    el.setAttribute('data-code', code);
  }

  function zeichne() {
    const jetzt = Date.now();
    const app = $('app');
    app.className = 'app phase-' + z.phase;

    $('startschirm').hidden = z.phase !== 'start';
    if (z.phase === 'start') {
      $('startCodename').textContent = S.codenameText(z.codename);
      $('startWarnung').hidden = !geladen.verworfen;
    }

    zeichneStatus();

    const spielt = z.phase === 'spiel' || z.phase === 'tutorial';
    $('coach').hidden = z.phase !== 'tutorial';
    if (spielt) {
      zeichneAufgabe();
      zeichneFeld();
      zeichneSperre(jetzt);
      const gesperrt = S.istGesperrt(z, jetzt);
      if (erfolg) rueckmeldung('Richtig! ' + (erfolg.abschnitt ? 'Gebaut: ' + erfolg.abschnitt.name : ''), 'richtig');
      else if (gesperrt) rueckmeldung('Leider falsch – rechne noch einmal nach.', 'fehler');
      else if (z.aufgabeFehler === 1) rueckmeldung('Neuer Versuch: gleiche Aufgabe, gleiche Zahlen.', 'hinweis');
      else rueckmeldung('Rechne im Hefter. Tippe nur das Ergebnis.', 'hinweis');
      tastatur.sperren(!!erfolg || gesperrt || !!z.loesungskarteSeit);
      $('tippKnopf').hidden = !S.tippSichtbar(z) || !!erfolg;
    } else {
      $('sperre').hidden = true;
    }
    zeichneLoesungskarte(jetzt);

    $('endkarte').hidden = z.phase !== 'ende';
    if (z.phase === 'ende') {
      const st = S.status(z);
      $('endCodename').textContent = st.codename;
      $('endEtappe').textContent = st.etappe;
      $('endStufe').textContent = st.stufe;
      $('endRichtig').textContent = st.richtig;
      $('endFalsch').textContent = st.falsch;
      $('endBauten').textContent = z.geloest + (z.grundstein ? 1 : 0);
      zeichneCode($('endCode'));
    }

    if (!$('menue').hidden) zeichneMenue();
  }

  function zeichneMenue() {
    document.querySelectorAll('.stufe-knopf').forEach(k => {
      const aktiv = k.getAttribute('data-stufe') === z.stufe;
      k.classList.toggle('aktiv', aktiv);
      k.setAttribute('aria-pressed', aktiv);
    });
    $('menueAutomatik').textContent = z.automatikPause > 0
      ? 'Automatik pausiert noch ' + z.automatikPause + (z.automatikPause === 1 ? ' Aufgabe.' : ' Aufgaben.')
      : 'Die Stufe passt sich automatisch an. Nach deiner Wahl pausiert die Automatik 5 Aufgaben lang.';
    zeichneCode($('menueCode'));
    $('tonSchalter').setAttribute('aria-checked', z.ton);
    $('tonSchalter').querySelector('span').textContent = z.ton ? 'an' : 'aus';
    $('stundeBeenden').disabled = z.phase === 'start' || z.phase === 'ende';
  }

  // ------------------------------------------------------------ Ereignisse

  $('wuerfeln').addEventListener('click', () => {
    S.codenameWuerfeln(z);
    sichern();
    const n = $('startCodename');
    n.classList.remove('neu');
    void n.offsetWidth;
    n.classList.add('neu');
    zeichne();
  });

  $('losGehts').addEventListener('click', () => {
    S.starten(z, Date.now());
    sichern();
    gezeigteAnzeige = null;
    welt.zeichne(z);
    zeichne();
  });

  $('lkWeiter').addEventListener('click', loesungskarteWeiter);

  $('menueKnopf').addEventListener('click', () => {
    $('menue').hidden = false;
    zeichneMenue();
  });

  document.querySelectorAll('[data-schliessen]').forEach(k => k.addEventListener('click', () => {
    k.closest('.modal-huelle').hidden = true;
    zeichne();
  }));

  $('stufenwahl').addEventListener('click', e => {
    const k = e.target.closest('[data-stufe]');
    if (!k) return;
    const ereignisse = S.stufeWaehlen(z, k.getAttribute('data-stufe'));
    sichern();
    if (ereignisse.some(ev => ev.art === 'neueAufgabe')) tastatur.leeren();
    meldung('Stufe gewählt: ' + A.NAMEN_STUFE[z.stufe], 'neutral');
    zeichne();
  });

  $('tonSchalter').addEventListener('click', () => {
    S.tonUmschalten(z);
    sichern();
    zeichneMenue();
    ton.bau();
  });

  $('stundeBeenden').addEventListener('click', () => {
    frage('Stunde beenden?', 'Du siehst deine Stadt und deinen Abschlusscode. Danach kannst du weiterspielen.', 'Stunde beenden', () => {
      $('menue').hidden = true;
      S.stundeBeenden(z);
      sichern();
      zeichne();
    });
  });

  $('neuAnfangen').addEventListener('click', () => {
    frage('Wirklich neu anfangen?', 'Deine Stadt, deine Zähler und deine Stufe werden gelöscht. Das lässt sich nicht rückgängig machen.', 'Ja, alles löschen', () => {
      $('menue').hidden = true;
      z = S.neuerZustand(Date.now());
      erfolg = null;
      feldZustand = '';
      gezeigteAnzeige = null;
      tastatur.leeren();
      rueckmeldung('', '');
      sichern();
      welt.zeichne(z);
      zeichne();
    }, true);
  });

  $('weiterspielen').addEventListener('click', () => {
    S.weiterspielen(z);
    sichern();
    gezeigteAnzeige = null;
    zeichne();
  });

  $('tippKnopf').addEventListener('click', () => {
    const aufgabe = z.aufgabe;
    if (!aufgabe) return;
    $('tippText').textContent = aufgabe.tipp;
    $('tippkarte').hidden = false;
  });

  // Uhr: Countdown, Ablauf der Sperre, Lösungskarte
  setInterval(() => {
    const jetzt = Date.now();
    const gesperrt = S.istGesperrt(z, jetzt);
    if (gesperrt) zeichneSperre(jetzt);
    if (sperreWarAktiv && !gesperrt) {
      sperreWarAktiv = false;
      feldZustand = '';
      tastatur.leeren();
      zeichne();
    }
    if (z.loesungskarteSeit) zeichneLoesungskarte(jetzt);
  }, 200);

  // Beim Zurückkehren in den Tab sofort aktualisieren
  document.addEventListener('visibilitychange', () => { if (!document.hidden) zeichne(); });
  window.addEventListener('resize', () => { welt.groesse(); gezeigteAnzeige = null; zeichne(); });

  // iOS: :active-Zustand der Tasten sichtbar machen
  document.addEventListener('touchstart', () => {}, { passive: true });

  welt.zeichne(z);
  zeichne();
  window.ZAHLENSTADT_BEREIT = true;   // für die Ladeprüfung in index.html
})();
