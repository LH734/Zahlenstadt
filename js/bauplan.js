/*
 * Zahlenstadt – Bauplan (Pflichtenheft 6.1)
 *
 * Schritt 2: Namen und Leitmaterial je Bauabschnitt (für die Platzhalterfläche).
 * Schritt 3 ergänzt hier die Blockgruppen {x, y, z, material}.
 */
(function (root) {
  'use strict';

  const ETAPPEN = [
    { viertel: 'Dorfkern', abschnitte: [['Haus', 'haus'], ['Weg', 'erde'], ['Brunnen', 'wasser'], ['Bäume', 'blaetter'], ['Zweites Haus', 'haus']] },
    { viertel: 'Marktviertel', abschnitte: [['Marktstände', 'bretter'], ['Bäckerei', 'haus'], ['Pflaster', 'stein'], ['Laternen', 'laterne'], ['Kirche mit Turm', 'stein']] },
    { viertel: 'Am Fluss', abschnitte: [['Ufer', 'sand'], ['Brücke', 'holz'], ['Mühle', 'bretter'], ['Bootssteg', 'bretter'], ['Fischerhütte', 'haus']] },
    { viertel: 'Wohnviertel', abschnitte: [['Reihenhaus', 'haus'], ['Reihenhaus', 'haus'], ['Reihenhaus', 'haus'], ['Spielplatz', 'sand'], ['Straße', 'stein']] },
    { viertel: 'Zentrum', abschnitte: [['Rathausvorplatz', 'stein'], ['Stadthaus', 'haus'], ['Stadthaus', 'haus'], ['Stadthaus', 'haus'], ['Park', 'gras'], ['Ampeln', 'glas']], grossbauwerk: ['Rathaus', 'ziegel'] },
    { viertel: 'Sportpark', abschnitte: [['Rasen', 'gras'], ['Tribünen', 'bretter'], ['Flutlicht', 'laterne'], ['Bahn', 'ziegel'], ['Halle', 'glas'], ['Anzeigetafel', 'glas']], grossbauwerk: ['Stadion', 'stein'] },
    { viertel: 'Burgberg', abschnitte: [['Berg', 'stein'], ['Mauerringe', 'stein'], ['Tore', 'holz'], ['Türme', 'stein'], ['Fahnen', 'fahne'], ['Zugbrücke', 'holz']], grossbauwerk: ['Burg', 'stein'] }
  ];

  const ENDLOS_ABSCHNITTE = [['Hochhaus', 'glas'], ['Bahnhof', 'ziegel'], ['Windrad', 'bretter'], ['Hafenbecken', 'wasser'],
    ['Straßenbahn', 'stein'], ['Schule', 'haus'], ['Markthalle', 'dachziegel'], ['Leuchtturm', 'laterne'],
    ['Parkhaus', 'stein'], ['Museum', 'ziegel'], ['Sternwarte', 'glas'], ['Hafenkran', 'holz']];
  const ENDLOS_GROSSBAUWERKE = [['Fernsehturm', 'glas'], ['Hauptbahnhof', 'ziegel'], ['Hafen', 'wasser'], ['Windpark', 'bretter'], ['Riesenrad', 'holz']];
  const ENDLOS_NORMAL = 6;                 // je Block 6 Aufgaben + 1 Großbauwerk
  const WACHSTUM = ['Dorf', 'Kleinstadt', 'Stadt', 'Metropole'];
  const WACHSTUM_ALLE = 12;                // neue Wachstumsstufe alle 12 Aufgaben im Endlosmodus
  const GRUNDSTEIN = { name: 'Grundstein', material: 'stein' };
  const LETZTE_ETAPPE = ETAPPEN.length;    // 7; ab Etappe 8 Endlosmodus

  const alsAbschnitt = ([name, material]) => ({ name, material });

  /** Beschreibung einer Etappe; ab Nummer 8 ist jede „Etappe" ein Block des Endlosmodus. */
  function etappe(nr) {
    if (nr <= LETZTE_ETAPPE) {
      const e = ETAPPEN[nr - 1];
      return {
        nr, endlos: false, viertel: e.viertel,
        normal: e.abschnitte.length,
        gross: !!e.grossbauwerk,
        abschnitt: i => alsAbschnitt(e.abschnitte[i]),
        grossbauwerk: e.grossbauwerk ? alsAbschnitt(e.grossbauwerk) : null
      };
    }
    const block = nr - LETZTE_ETAPPE - 1;
    return {
      nr, endlos: true, viertel: 'Stadtwachstum',
      normal: ENDLOS_NORMAL,
      gross: true,
      abschnitt: i => alsAbschnitt(ENDLOS_ABSCHNITTE[(block * ENDLOS_NORMAL + i) % ENDLOS_ABSCHNITTE.length]),
      grossbauwerk: alsAbschnitt(ENDLOS_GROSSBAUWERKE[block % ENDLOS_GROSSBAUWERKE.length])
    };
  }

  /** Bauabschnitt aus Etappe und Schritt (Schritt = normal → Großbauwerk). */
  function abschnitt(nr, schritt) {
    const e = etappe(nr);
    return schritt >= e.normal ? Object.assign({ gross: true }, e.grossbauwerk) : Object.assign({ gross: false }, e.abschnitt(schritt));
  }

  /** Wachstumsstufe im Endlosmodus: Dorf → Kleinstadt → Stadt → Metropole → Metropole 2 … */
  function wachstum(endlosGeloest) {
    const index = Math.floor(endlosGeloest / WACHSTUM_ALLE);
    const name = index < WACHSTUM.length ? WACHSTUM[index] : WACHSTUM[WACHSTUM.length - 1] + ' ' + (index - WACHSTUM.length + 2);
    return { index, name };
  }

  root.Bauplan = { ETAPPEN, LETZTE_ETAPPE, WACHSTUM_ALLE, GRUNDSTEIN, etappe, abschnitt, wachstum };
})(typeof globalThis !== 'undefined' ? globalThis : this);
