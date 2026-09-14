/*
 * Zahlenstadt – eigene Pixelschrift (5 × 7) als Display-Schrift.
 * Wird als SVG gezeichnet: gestochen scharf in jeder Größe, offline, ohne Schriftdatei.
 */
(function (root) {
  'use strict';

  // Jede Glyphe: 7 Zeilen zu je 5 Zeichen, „#" = Pixel
  const G = {
    A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.',
    C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
    E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
    G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
    I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.', J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
    K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
    M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
    O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
    Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
    S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
    U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
    W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
    Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
    'Ä': '.#.#.|.....|.###.|#...#|#####|#...#|#...#', 'Ö': '.#.#.|.....|.###.|#...#|#...#|#...#|.###.',
    'Ü': '.#.#.|.....|#...#|#...#|#...#|#...#|.###.',
    0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', 1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
    2: '.###.|#...#|....#|...#.|..#..|.#...|#####', 3: '####.|....#|....#|.###.|....#|....#|####.',
    4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.',
    6: '.###.|#....|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|..#..|..#..|..#..',
    8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.', 9: '.###.|#...#|#...#|.####|....#|....#|.###.',
    ' ': '.....|.....|.....|.....|.....|.....|.....', '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
    '?': '.###.|#...#|....#|...#.|..#..|.....|..#..', '.': '.....|.....|.....|.....|.....|.....|..#..',
    ':': '.....|..#..|.....|.....|.....|..#..|.....', '-': '.....|.....|.....|#####|.....|.....|.....',
    '/': '....#|....#|...#.|..#..|.#...|#....|#....', '+': '.....|..#..|..#..|#####|..#..|..#..|.....'
  };

  /**
   * text → SVG-Zeichenkette.
   * optionen: farbe, schatten (Farbe oder false), grasblock (obere 2 Zeilen grün), abstand (Pixel zwischen Zeichen)
   */
  function svg(text, optionen) {
    optionen = optionen || {};
    const zeichen = String(text).toUpperCase().replace(/ß/g, 'SS').split('');
    const abstand = optionen.abstand === undefined ? 1 : optionen.abstand;
    const breite = zeichen.length * (5 + abstand) - abstand;
    const versatz = optionen.schatten ? 1 : 0;
    const farbe = optionen.farbe || 'currentColor';
    const reihen = { oben: '', unten: '', schatten: '' };

    zeichen.forEach((c, i) => {
      const glyphe = (G[c] || G['?']).split('|');
      const x0 = i * (5 + abstand);
      glyphe.forEach((zeile, y) => {
        // zusammenhängende Pixel einer Zeile als ein Rechteck
        let start = -1;
        for (let x = 0; x <= 5; x++) {
          const an = zeile[x] === '#';
          if (an && start < 0) start = x;
          if (!an && start >= 0) {
            const r = '<rect x="' + (x0 + start) + '" y="' + y + '" width="' + (x - start) + '" height="1"/>';
            if (optionen.grasblock && y < 2) reihen.oben += r; else reihen.unten += r;
            if (optionen.schatten) reihen.schatten += r;
            start = -1;
          }
        }
      });
    });

    const schatten = optionen.schatten
      ? '<g fill="' + optionen.schatten + '" transform="translate(' + versatz + ' ' + versatz + ')">' + reihen.schatten + '</g>' : '';
    const oben = optionen.grasblock ? '<g fill="' + (optionen.grasfarbe || '#6fb34a') + '">' + reihen.oben + '</g>' : '';
    return '<svg class="pixeltext" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (breite + versatz) + ' ' + (7 + versatz) +
      '" shape-rendering="crispEdges" role="img" aria-label="' + String(text).replace(/"/g, '') + '">' +
      schatten + '<g fill="' + farbe + '">' + reihen.unten + '</g>' + oben + '</svg>';
  }

  root.Pixelschrift = { svg };
})(typeof globalThis !== 'undefined' ? globalThis : this);
