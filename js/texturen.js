/*
 * Zahlenstadt – selbst gezeichnete Blocktexturen (16 × 16 Pixel-Art, Canvas).
 * Keine fremden Texturen. Deterministisch: dieselbe Textur sieht auf jedem Gerät gleich aus.
 * Wird in Schritt 2 für die Platzhalterfläche und in Schritt 3 für Three.js genutzt.
 */
(function (root) {
  'use strict';

  const N = 16;

  // Wandfarben der Häuser je Farbvariante (aus dem Codenamen)
  const HAUSFARBEN = [
    ['#efe3c8', '#e2d3b2', '#f5ecd8'],
    ['#e9c27b', '#dcb068', '#f0cf91'],
    ['#b9d3e3', '#a6c3d6', '#c9deeb'],
    ['#c6d7af', '#b4c89b', '#d4e2c0'],
    ['#e8bbb0', '#dba89c', '#f0cbc2'],
    ['#dcd6cc', '#cbc4b8', '#e8e3db']
  ];

  function zahlAus(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function zufallAus(saat) {
    let s = saat >>> 0 || 1;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function zeichne(material, variante) {
    const leinwand = document.createElement('canvas');
    leinwand.width = leinwand.height = N;
    const g = leinwand.getContext('2d');
    const r = zufallAus(zahlAus(material) + (variante || 0) * 7919);
    const px = (x, y, farbe) => { g.fillStyle = farbe; g.fillRect(x, y, 1, 1); };
    const flaeche = (x, y, b, h, farbe) => { g.fillStyle = farbe; g.fillRect(x, y, b, h); };
    const aus = liste => liste[Math.floor(r() * liste.length)];
    const rauschen = (farben, x0, y0, b, h) => {
      for (let y = y0 || 0; y < (y0 || 0) + (h || N); y++) for (let x = x0 || 0; x < (x0 || 0) + (b || N); x++) px(x, y, aus(farben));
    };

    switch (material) {
      case 'gras':
        rauschen(['#5d9b3a', '#67a843', '#528f33', '#72b24b']);
        for (let i = 0; i < 10; i++) px(Math.floor(r() * N), Math.floor(r() * N), '#8cc65e');
        break;
      case 'erde':
        rauschen(['#7a5536', '#6b4a2f', '#86603e', '#5e412a']);
        for (let i = 0; i < 8; i++) px(Math.floor(r() * N), Math.floor(r() * N), '#a0805e');
        break;
      case 'stein':
        rauschen(['#8d8f8c', '#999b97', '#838580', '#a3a5a0']);
        for (let x = 0; x < N; x++) if (r() < 0.8) px(x, 7, '#6f716d');
        for (let y = 0; y < 7; y++) px(5, y, '#6f716d');
        for (let y = 8; y < N; y++) px(11, y, '#6f716d');
        break;
      case 'holz':
        for (let x = 0; x < N; x++) {
          const basis = x % 5 === 0 ? '#6a4526' : aus(['#8a5e34', '#93663a', '#7f5530']);
          for (let y = 0; y < N; y++) px(x, y, r() < 0.12 ? '#6f4a28' : basis);
        }
        break;
      case 'bretter':
        for (let reihe = 0; reihe < 4; reihe++) {
          const basis = ['#b8864f', '#c49358', '#ad7c47', '#bf8d53'][reihe];
          rauschen([basis, basis, '#a87744', '#c99a60'], 0, reihe * 4, N, 3);
          flaeche(0, reihe * 4 + 3, N, 1, '#6e4b2a');
          const fuge = (reihe % 2 ? 4 : 11);
          flaeche(fuge, reihe * 4, 1, 3, '#7c5530');
        }
        break;
      case 'glas':
        flaeche(0, 0, N, N, '#6f8f9c');
        flaeche(1, 1, 14, 14, '#bfe3f0');
        for (let i = 0; i < 5; i++) px(3 + i, 7 - i, '#ffffff');
        for (let i = 0; i < 3; i++) px(9 + i, 12 - i, '#e8f6fb');
        flaeche(7, 1, 1, 14, '#8fb3c1');
        flaeche(1, 7, 14, 1, '#8fb3c1');
        break;
      case 'ziegel':
        flaeche(0, 0, N, N, '#d9cbb8');
        for (let reihe = 0; reihe < 4; reihe++) {
          const verschub = reihe % 2 ? 4 : 0;
          for (let k = -1; k < 3; k++) {
            const x = k * 8 + verschub;
            const farbe = aus(['#a8452f', '#b5523a', '#9b3d29', '#ad4a33']);
            for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 7; xx++) {
              const xa = x + xx;
              if (xa >= 0 && xa < N) px(xa, reihe * 4 + yy, r() < 0.15 ? '#8e3825' : farbe);
            }
          }
        }
        break;
      case 'dachziegel':
        for (let reihe = 0; reihe < 4; reihe++) {
          rauschen(['#8f3a2d', '#9c4333', '#833326'], 0, reihe * 4, N, 3);
          for (let x = 0; x < N; x++) px(x, reihe * 4 + 3, (x + reihe * 2) % 4 === 0 ? '#8f3a2d' : '#5f2019');
        }
        break;
      case 'wasser':
        rauschen(['#3f7fc0', '#4a8ccc', '#3a78b8']);
        [3, 9, 14].forEach((y, i) => { for (let x = 0; x < N; x++) if ((x + i * 3) % 6 < 3) px(x, y + ((x + i) % 6 < 2 ? 0 : -1), '#8cc1ec'); });
        break;
      case 'sand':
        rauschen(['#e3d19a', '#d9c589', '#ecdcab', '#d2be82']);
        break;
      case 'blaetter':
        rauschen(['#3e7a2a', '#2f6420', '#4b8c33', '#285a1b']);
        for (let i = 0; i < 12; i++) px(Math.floor(r() * N), Math.floor(r() * N), '#63ab48');
        break;
      case 'laterne':
        flaeche(0, 0, N, N, '#2d2a26');
        flaeche(3, 3, 10, 10, '#f3c43f');
        flaeche(5, 5, 6, 6, '#fff0a8');
        flaeche(7, 3, 2, 10, '#3a342c');
        flaeche(3, 7, 10, 2, '#3a342c');
        break;
      case 'fahne':
        flaeche(0, 0, N, N, '#8fc3e6');
        flaeche(1, 0, 2, N, '#6b4a2f');
        flaeche(3, 2, 12, 4, '#c43d2f');
        flaeche(3, 6, 12, 4, '#f2ead8');
        flaeche(3, 10, 12, 2, '#c43d2f');
        break;
      case 'haus': {
        const wand = HAUSFARBEN[(variante || 0) % HAUSFARBEN.length];
        rauschen(wand);
        rauschen(['#8f3a2d', '#7e2f25'], 0, 0, N, 3);
        flaeche(0, 3, N, 1, '#5f2019');
        flaeche(4, 6, 8, 7, '#5a3d25');
        flaeche(5, 7, 6, 5, '#9fd0e6');
        flaeche(7, 7, 2, 5, '#5a3d25');
        flaeche(5, 9, 6, 1, '#5a3d25');
        px(5, 7, '#e6f5fb');
        break;
      }
      default:
        rauschen(['#ff00ff', '#000000']);
    }
    return leinwand;
  }

  const cache = {};
  function dataUrl(material, variante) {
    const schluessel = material + '/' + (variante || 0);
    if (!cache[schluessel]) cache[schluessel] = zeichne(material, variante).toDataURL();
    return cache[schluessel];
  }

  root.Texturen = { zeichne, dataUrl, MATERIALIEN: ['gras', 'erde', 'stein', 'holz', 'bretter', 'glas', 'ziegel', 'dachziegel', 'wasser', 'sand', 'blaetter', 'laterne', 'fahne', 'haus'] };
})(typeof globalThis !== 'undefined' ? globalThis : this);
