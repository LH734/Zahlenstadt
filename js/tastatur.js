/*
 * Zahlenstadt – Bildschirmtastatur (Pflichtenheft Abschnitt 4)
 *
 * Eigene Tasten 0–9, Löschen, Bestätigen. Das Eingabefeld ist ein reines
 * Anzeige-Element (kein <input>), damit die iOS-Tastatur nie erscheint.
 * Am Rechner funktionieren zusätzlich die Zifferntasten, Rücktaste und Enter.
 */
(function (root) {
  'use strict';

  const TASTEN = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'loeschen', 'ok'];

  // Pixel-Symbole („#" = Pixel)
  const LOESCHEN = ['....#########', '...#........#', '..#..#...#..#', '.#....#.#...#', '#......#....#', '.#....#.#...#', '..#..#...#..#', '...#........#', '....#########'];
  const HAKEN = ['........#', '.......##', '#.....##.', '##...##..', '.##.##...', '..###....', '...#.....'];

  function bitmap(zeilen) {
    let rechtecke = '';
    zeilen.forEach((zeile, y) => {
      for (let x = 0; x < zeile.length; x++) if (zeile[x] === '#') rechtecke += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    });
    return '<svg viewBox="0 0 ' + zeilen[0].length + ' ' + zeilen.length + '" shape-rendering="crispEdges" aria-hidden="true"><g fill="currentColor">' + rechtecke + '</g></svg>';
  }

  /**
   * optionen: { feld, anzeige, maxStellen, beiBestaetigen(text), darfTippen() }
   */
  function erstelle(optionen) {
    const maxStellen = optionen.maxStellen || 7;
    let wert = '';
    let gesperrt = false;

    optionen.feld.innerHTML = TASTEN.map(t => {
      if (t === 'loeschen') return '<button type="button" class="taste taste-loeschen" data-taste="loeschen" aria-label="Löschen">' + bitmap(LOESCHEN) + '</button>';
      if (t === 'ok') return '<button type="button" class="taste taste-ok" data-taste="ok" aria-label="Bestätigen">' + bitmap(HAKEN) + '<span>Prüfen</span></button>';
      return '<button type="button" class="taste" data-taste="' + t + '">' + t + '</button>';
    }).join('');

    function zeige() {
      optionen.anzeige.textContent = wert;
      optionen.anzeige.classList.toggle('leer', wert === '');
    }

    function tippe(taste) {
      if (gesperrt || (optionen.darfTippen && !optionen.darfTippen())) return;
      if (taste === 'loeschen') {
        wert = wert.slice(0, -1);
      } else if (taste === 'ok') {
        if (optionen.beiBestaetigen) optionen.beiBestaetigen(wert);
        return;
      } else if (wert === '0') {
        wert = taste;                       // führende Null ersetzen
      } else if (wert.length < maxStellen) {
        wert += taste;
      }
      zeige();
      if (optionen.beiAenderung) optionen.beiAenderung(wert);
    }

    optionen.feld.addEventListener('click', e => {
      const knopf = e.target.closest('[data-taste]');
      if (knopf) tippe(knopf.getAttribute('data-taste'));
    });

    // Physische Tastatur (MacBook): Ziffern 0–9, Rücktaste/Entf und Enter wirken wie die Bildschirmtasten.
    // Nur wenn die Eingabe gerade erlaubt ist – sonst bleibt z. B. Enter auf einem Dialogknopf wirksam.
    document.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const ziel = e.target && e.target.tagName;
      if (ziel === 'INPUT' || ziel === 'TEXTAREA' || ziel === 'SELECT') return;
      let taste = null;
      if (/^[0-9]$/.test(e.key)) taste = e.key;
      else if (e.key === 'Backspace' || e.key === 'Delete') taste = 'loeschen';
      else if (e.key === 'Enter' || e.key === 'NumpadEnter') taste = 'ok';
      if (!taste || gesperrt || (optionen.darfTippen && !optionen.darfTippen())) return;
      e.preventDefault();
      tippe(taste);
      const knopf = optionen.feld.querySelector('[data-taste="' + taste + '"]');
      if (knopf) { knopf.classList.add('gedrueckt'); setTimeout(() => knopf.classList.remove('gedrueckt'), 120); }
    });

    zeige();

    return {
      wert: () => wert,
      leeren() { wert = ''; zeige(); },
      sperren(an) {
        gesperrt = !!an;
        optionen.feld.classList.toggle('gesperrt', gesperrt);
        optionen.feld.querySelectorAll('button').forEach(b => { b.disabled = gesperrt; });
      }
    };
  }

  root.Tastatur = { erstelle };
})(typeof globalThis !== 'undefined' ? globalThis : this);
