/* ==========================================================
   PILAR SMASH — BANDA SONORA (chiptune generado con Web Audio)
   Un secuenciador sencillo: cada tema son compases de 16 pasos
   (semicorcheas) con bajo, melodía y batería. Se programan las
   notas con un poco de antelación para que suenen a tiempo.
   Usa la variable `audio` (AudioContext) de game.js.
   ========================================================== */

// Nota MIDI -> frecuencia (69 = La 440 Hz)
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const _ = null; // silencio

/* ---------- Temas (composiciones originales) ---------- */

// Topos: La menor, tenso y con prisa. El tempo sube hasta la alerta.
const TEMA_TOPOS = {
  bpm: () => 150 + 22 * Math.min(1, (performance.now() - inicio) / ((BOSS_EN || DURACION) * 1000)),
  bajos: [45, 41, 48, 43],              // La, Fa, Do, Sol (un compás cada uno)
  bajo: "octavas",
  melodia: [
    [69, _, 72, _, 76, _, 72, 76, 81, _, 79, _, 76, _, 74, _],
    [77, _, 76, _, 72, _, 69, _, 72, _, 74, 76, _, _, 74, _],
    [72, _, 76, _, 79, _, 76, 79, 84, _, 83, _, 79, _, 76, _],
    [79, _, 77, _, 74, _, 71, _, 74, _, 76, _, 79, _, 83, _],
  ],
  onda: "square",
  bombo: [0, 8],
  caja: [4, 12],
  charles: [2, 6, 10, 14],
};

// Carrera: Do mayor, alegre y saltarina (¡es una misión de cumpleaños!)
const TEMA_CARRERA = {
  bpm: () => 172,
  bajos: [48, 43, 45, 41],              // Do, Sol, La, Fa
  bajo: "galope",
  melodia: [
    [72, _, 72, 76, _, 79, _, 76, 84, _, 79, _, 76, _, 79, _],
    [79, _, 79, 83, _, 86, _, 83, 79, _, 74, _, 71, _, 74, _],
    [76, _, 76, 81, _, 84, _, 81, 88, _, 84, _, 81, _, 76, _],
    [77, _, 81, _, 84, _, 81, _, 79, _, 76, _, 74, _, 72, _],
  ],
  onda: "square",
  bombo: [0, 6, 8, 14],
  caja: [4, 12],
  charles: [0, 2, 4, 6, 8, 10, 12, 14],
};

/* ---------- Motor ---------- */
const musica = { tema: null, gain: null, timer: null, paso: 0, siguiente: 0, ruido: null };

function empezarMusica(tema) {
  pararMusica();
  if (!audio) return;
  musica.tema = tema;
  musica.gain = audio.createGain();
  musica.gain.gain.value = 0.55;       // la música por debajo de los efectos
  musica.gain.connect(audio.destination);
  if (!musica.ruido) {                 // un buffer de ruido reutilizable para la batería
    const n = audio.sampleRate * 0.3;
    musica.ruido = audio.createBuffer(1, n, audio.sampleRate);
    const d = musica.ruido.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  musica.paso = 0;
  musica.siguiente = audio.currentTime + 0.06;
  musica.timer = setInterval(programarMusica, 25);
}

function pararMusica() {
  clearInterval(musica.timer);
  musica.timer = null;
  if (musica.gain && audio) {
    const g = musica.gain;
    g.gain.setTargetAtTime(0, audio.currentTime, 0.04); // fundido rápido
    setTimeout(() => g.disconnect(), 300);
  }
  musica.gain = null;
  musica.tema = null;
}

// Programa las notas de los próximos ~120 ms
function programarMusica() {
  const T = musica.tema;
  if (!T || !audio) return;
  while (musica.siguiente < audio.currentTime + 0.12) {
    const paso16 = 60 / T.bpm() / 4;
    tocarPaso(T, musica.paso, musica.siguiente, paso16);
    musica.siguiente += paso16;
    musica.paso = (musica.paso + 1) % (T.melodia.length * 16);
  }
}

function tocarPaso(T, paso, t, p16) {
  const compas = Math.floor(paso / 16);
  const i = paso % 16;

  // Melodía: cada nota dura hasta la siguiente (máx. 2 pasos), con un toque de staccato
  const fila = T.melodia[compas];
  if (fila[i] !== null) {
    let largo = 1;
    while (largo < 2 && fila[(i + largo) % 16] === null) largo++;
    notaMusica(T.onda, hz(fila[i]), t, p16 * largo * 0.85, 0.07);
  }

  // Bajo
  const raiz = T.bajos[compas];
  if (T.bajo === "octavas" && i % 2 === 0) {
    notaMusica("triangle", hz(i % 4 === 0 ? raiz : raiz + 12), t, p16 * 1.7, 0.2);
  } else if (T.bajo === "galope" && [0, 3, 4, 7, 8, 11, 12, 15].includes(i)) {
    notaMusica("triangle", hz(i % 4 === 0 ? raiz : raiz + 7), t, p16 * 0.9, 0.2);
  }

  // Batería
  if (T.bombo.includes(i)) bombo(t);
  if (T.caja.includes(i)) golpeRuido(t, 0.09, "bandpass", 1800, 0.22);
  if (T.charles.includes(i)) golpeRuido(t, 0.03, "highpass", 7000, 0.07);
}

function notaMusica(tipo, f, t, dur, vol) {
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = tipo;
  osc.frequency.value = f;
  g.gain.setValueAtTime(vol, t);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(musica.gain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function bombo(t) {
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.55, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(g).connect(musica.gain);
  osc.start(t);
  osc.stop(t + 0.16);
}

function golpeRuido(t, dur, tipoFiltro, frecuencia, vol) {
  const src = audio.createBufferSource();
  src.buffer = musica.ruido;
  const filtro = audio.createBiquadFilter();
  filtro.type = tipoFiltro;
  filtro.frequency.value = frecuencia;
  const g = audio.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filtro).connect(g).connect(musica.gain);
  src.start(t);
  src.stop(t + dur + 0.02);
}
