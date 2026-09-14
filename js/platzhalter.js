/*
 * Zahlenstadt – Platzhalterfläche statt 3D-Welt (nur Schritt 2).
 * Zeigt den Bauplan als Terrassen: je Viertel eine Reihe Bauplätze; jede
 * gelöste Aufgabe setzt sichtbar einen Block mit selbst gezeichneter Textur.
 * Wird in Schritt 3 durch js/welt.js (Three.js) ersetzt – gleiche Schnittstelle:
 *   erstelle(wurzel) → { zeichne(zustand), baue(abschnitt, zustand), groesse() }
 * Vorgabe für welt.js: Bedienung mit Touch UND Maus/Trackpad –
 *   ein Finger / Maus ziehen = drehen, zwei Finger / Scrollrad bzw. Trackpad-Pinch = zoomen,
 *   Doppeltipp / Doppelklick = zentrieren (Pointer Events + wheel).
 */
(function (root) {
  'use strict';

  const B = root.Bauplan, S = root.Spiel, T = root.Texturen, P = root.Pixelschrift;
  const ENDLOS_FENSTER = 7;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function erstelle(wurzel) {
    wurzel.innerHTML =
      '<div class="welt-wolken" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="welt-kopf">' +
        '<div class="welt-titel">' + P.svg('Deine Stadt', { farbe: '#fffdf6', schatten: 'rgba(22,40,60,.45)' }) + '</div>' +
        '<div class="welt-info" id="weltInfo"></div>' +
      '</div>' +
      '<div class="welt-plan" id="weltPlan"></div>' +
      '<div class="welt-hinweis">Platzhalter · die 3D-Stadt folgt in Schritt 3</div>';
    const plan = wurzel.querySelector('#weltPlan');
    const info = wurzel.querySelector('#weltInfo');

    function textur(abschnitt, z) {
      return T.dataUrl(abschnitt.material, abschnitt.material === 'haus' ? S.farbvariante(z.codename) : 0);
    }

    function block(abschnitt, z, klassen) {
      return '<div class="platz gebaut ' + (abschnitt.gross ? 'gross ' : '') + (klassen || '') + '" title="' + esc(abschnitt.name) + '">' +
        '<i class="block" style="background-image:url(' + textur(abschnitt, z) + ')"></i>' +
        '<span class="platz-name">' + esc(abschnitt.name) + '</span></div>';
    }

    function leer(abschnitt, jetzt) {
      return '<div class="platz frei ' + (abschnitt.gross ? 'gross ' : '') + (jetzt ? 'jetzt' : '') + '">' +
        '<i class="block"></i><span class="platz-name">' + esc(abschnitt.name) + '</span></div>';
    }

    function reihe(nr, z, neu) {
      const e = B.etappe(nr);
      const spielLaeuft = z.grundstein;
      const fertig = spielLaeuft && (z.etappe > nr);
      const aktiv = spielLaeuft && z.etappe === nr;
      const plaetze = [];
      const anzahl = e.normal + (e.gross ? 1 : 0);
      for (let s = 0; s < anzahl; s++) {
        const a = B.abschnitt(nr, s);
        const gebaut = fertig || (aktiv && s < z.schritt);
        const istNeu = neu && neu.etappe === nr && neu.schritt === s;
        plaetze.push(gebaut ? block(a, z, istNeu ? 'neu' : '') : leer(a, aktiv && s === z.schritt && z.phase !== 'start'));
      }
      return '<section class="viertel ' + (fertig ? 'fertig' : aktiv ? 'aktiv' : 'zukunft') + (nr >= 5 ? ' bonus' : '') + '" data-etappe="' + nr + '">' +
        '<header><span class="viertel-nr">' + P.svg(String(nr)) + '</span><span class="viertel-name">' + esc(e.viertel) +
        (nr === 5 ? '<small>Bonus</small>' : '') + '</span></header>' +
        '<div class="bauplaetze">' + plaetze.join('') + '</div></section>';
    }

    function endlosReihe(z, neu) {
      const aktiv = z.etappe > B.LETZTE_ETAPPE;
      const gebaut = z.gebaut.filter(g => g.e > B.LETZTE_ETAPPE);
      const zeigen = gebaut.slice(-ENDLOS_FENSTER + 1);
      const plaetze = zeigen.map((g, i) => block(B.abschnitt(g.e, g.s), z, neu && i === zeigen.length - 1 && neu.etappe === g.e && neu.schritt === g.s ? 'neu' : ''));
      if (aktiv) plaetze.push(leer(B.abschnitt(z.etappe, z.schritt), true));
      const w = B.wachstum(z.endlosGeloest);
      return '<section class="viertel endlos ' + (aktiv ? 'aktiv' : 'zukunft') + '">' +
        '<header><span class="viertel-nr">' + P.svg('+') + '</span><span class="viertel-name">Wachstum' +
        '<small>' + (aktiv ? esc(w.name) + ' · ' + gebaut.length + ' Bauten' : 'ab Etappe 8') + '</small></span></header>' +
        '<div class="bauplaetze">' + (plaetze.join('') || '<span class="endlos-leer">Endlosmodus: Hochhäuser, Bahnhof, Windräder, Hafen …</span>') + '</div></section>';
    }

    function zeichne(z, neu) {
      const reihen = [];
      for (let nr = 1; nr <= B.LETZTE_ETAPPE; nr++) reihen.push(reihe(nr, z, neu));
      reihen.push(endlosReihe(z, neu));
      plan.innerHTML = reihen.join('');
      const gs = B.GRUNDSTEIN;
      info.innerHTML = z.grundstein
        ? '<span class="grundstein' + (neu && neu.grundstein ? ' neu' : '') + '"><i class="block" style="background-image:url(' + T.dataUrl(gs.material) + ')"></i>Grundstein gelegt</span>' +
          '<span class="bauzahl">' + (z.geloest) + ' Bauabschnitte</span>'
        : '<span class="grundstein offen"><i class="block"></i>Grundstein folgt</span>';
      groesse();
      if (neu) {
        const neuerBlock = plan.querySelector('.platz.neu');
        if (neuerBlock) staub(neuerBlock);
      }
    }

    function staub(element) {
      for (let i = 0; i < 8; i++) {
        const k = document.createElement('i');
        k.className = 'staub';
        k.style.setProperty('--dx', (Math.random() * 2 - 1).toFixed(2));
        k.style.setProperty('--verz', (0.32 + Math.random() * 0.08).toFixed(2) + 's');
        element.appendChild(k);
      }
      const funkeln = document.createElement('i');
      funkeln.className = 'funkeln';
      element.appendChild(funkeln);
    }

    /** Blockgröße so wählen, dass alle Reihen ohne Scrollen passen */
    function groesse() {
      const hoehe = plan.clientHeight, breite = plan.clientWidth;
      if (!hoehe || !breite) return;
      const reihen = B.LETZTE_ETAPPE + 1;
      const kopfBreite = Math.min(150, Math.max(96, breite * 0.2));
      const nachHoehe = hoehe / reihen - 24;
      // breiteste Reihe: 6 Blöcke + Großbauwerk (1,55) + 6 Lücken (0,22) + Rand
      const nachBreite = (breite - kopfBreite - 28) / 9.3;
      const blockPx = Math.max(22, Math.floor(Math.min(nachHoehe, nachBreite, 64)));
      wurzel.style.setProperty('--block', blockPx + 'px');
      wurzel.style.setProperty('--kopf', Math.round(kopfBreite) + 'px');
    }

    return {
      zeichne: z => zeichne(z, null),
      baue: (abschnitt, z) => zeichne(z, abschnitt),
      groesse
    };
  }

  root.Platzhalter = { erstelle };
})(typeof globalThis !== 'undefined' ? globalThis : this);
