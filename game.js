/* ==========================================================
   PILAR SMASH — lógica del juego "machaca al topo"
   JavaScript puro, sin dependencias. Funciona abriendo index.html.
   ========================================================== */

// ---------- Configuración ----------
const DURACION = 30;          // segundos por partida
const MAX_A_LA_VEZ = 2;       // caras visibles como máximo
const NUM_CARAS = 6;          // faces/1.png ... faces/6.png
const NUM_AGUJEROS = 9;       // tablero 3x3
const CLAVE_RECORD = "pilarsmash-record";
const LAURA = 2;              // faces/2.png es Laura: no se puede elegir de campeona y recibe la tarta
const BOSS_EN = 10;           // segundos de topos antes de la ¡ALERTA! (fase boss en boss.js). 0 = sin boss

// Dificultad: valores al principio (p=0) y al final (p=1) de la partida
const ESPERA_INICIO = 950;    // ms entre apariciones al empezar
const ESPERA_FINAL = 380;     // ms entre apariciones al acabar
const VISIBLE_MIN = 600;      // una cara se queda entre 0,6 s...
const VISIBLE_MAX = 1200;     // ...y 1,2 s (al final, el máximo baja hacia 0,75 s)

// ---------- Referencias al DOM ----------
const $ = (id) => document.getElementById(id);
const app = $("app");
const board = $("board");
const hammer = $("hammer");
const ui = {
  score: $("score"), best: $("best"), time: $("time"), timebar: $("timebar"),
  start: $("screen-start"), count: $("screen-count"), end: $("screen-end"),
  countdown: $("countdown"), finalScore: $("final-score"), newRecord: $("new-record"),
  bestStart: $("best-start"), bestEnd: $("best-end"),
  photo: $("photo"), photoFrame: $("photo-frame"), scanline: $("scanline"),
  banner: $("photo-banner"), introBottom: $("intro-bottom"), flyLayer: $("fly-layer"),
};

// ---------- Estado ----------
let agujeros = [];       // [{ el, img, ocupado, golpeado, cara, timer }]
let puntos = 0;
let record = leerRecord();
let jugando = false;
let inicio = 0;          // performance.now() al empezar
let timerAparicion = null;
let ultimoSegundo = DURACION;
let bossLanzado = false;

/* ==========================================================
   SONIDOS (Web Audio API, todo sintetizado)
   ========================================================== */
let audio = null;

// El navegador solo permite crear/activar el audio tras un toque del usuario
function iniciarAudio() {
  if (!audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audio = new Ctx();
  }
  if (audio && audio.state === "suspended") audio.resume();
}

// Tono simple con envolvente: tipo de onda, frecuencia inicial y final, duración, volumen
function tono(tipo, f1, f2, dur, vol = 0.3, retraso = 0) {
  if (!audio) return;
  const t = audio.currentTime + retraso;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(f1, t);
  osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// Ráfaga de ruido filtrado (para el impacto y el "fiu" del fallo)
function ruido(dur, frecuencia, vol = 0.4, tipoFiltro = "bandpass") {
  if (!audio) return;
  const t = audio.currentTime;
  const muestras = Math.floor(audio.sampleRate * dur);
  const buffer = audio.createBuffer(1, muestras, audio.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < muestras; i++) datos[i] = Math.random() * 2 - 1;
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const filtro = audio.createBiquadFilter();
  filtro.type = tipoFiltro;
  filtro.frequency.value = frecuencia;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filtro).connect(gain).connect(audio.destination);
  src.start(t);
}

const sonido = {
  // ¡BONK! golpe grave + chasquido + chirrido de martillo de juguete
  golpe() {
    tono("sine", 220, 45, 0.18, 0.9);
    ruido(0.07, 1800, 0.6);
    tono("square", 1200, 1700, 0.07, 0.08, 0.02);
  },
  fallo()    { ruido(0.12, 600, 0.15, "lowpass"); },
  asoma()    { tono("triangle", 300, 520, 0.08, 0.08); },
  tic()      { tono("square", 880, 880, 0.06, 0.1); },
  cuenta(n)  { tono("square", n ? 440 : 880, n ? 440 : 880, n ? 0.12 : 0.35, 0.2); },
  fin() {
    [523, 392, 330, 262].forEach((f, i) => tono("square", f, f * 0.98, 0.18, 0.18, i * 0.16));
  },
  record() {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tono("square", f, f, 0.14, 0.18, 0.5 + i * 0.11));
  },
  // Intro
  detecta(i) { tono("square", 500 + i * 110, 500 + i * 110, 0.09, 0.12); },
  alarma() {
    [880, 660, 880, 660].forEach((f, i) => tono("square", f, f, 0.12, 0.12, i * 0.14));
  },
  vuela()    { tono("sine", 300, 1200, 0.25, 0.12); },
  plop()     { tono("sine", 650, 140, 0.14, 0.35); },
};

/* ==========================================================
   MARTILLO (SVG dibujado a mano)
   El mango va hacia abajo-derecha; el extremo inferior-izquierdo
   de la cabeza es el que golpea (aprox. en x=11%, y=45%).
   ========================================================== */
const HAMMER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <line x1="90" y1="90" x2="30" y2="30" stroke="#000" stroke-width="13" stroke-linecap="round"/>
  <line x1="90" y1="90" x2="30" y2="30" stroke="#ffd23f" stroke-width="8" stroke-linecap="round"/>
  <g transform="translate(28 28) rotate(-45)">
    <rect x="-26" y="-14" width="52" height="28" rx="6" fill="#000"/>
    <rect x="-23" y="-11" width="46" height="22" rx="4" fill="#ff2e88"/>
    <rect x="-23" y="-11" width="10" height="22" rx="3" fill="#2ef2ff"/>
    <rect x="13" y="-11" width="10" height="22" rx="3" fill="#2ef2ff"/>
    <rect x="-10" y="-8" width="20" height="5" rx="2" fill="#fff" opacity=".6"/>
  </g>
</svg>`;
const GOLPE_X = 0.11, GOLPE_Y = 0.45; // punto de impacto dentro del dibujo

function prepararMartillo() {
  hammer.innerHTML = HAMMER_SVG;
  // Cursor de escritorio: el mismo dibujo a 56 px, con el punto activo en la cabeza
  const svgCursor = HAMMER_SVG.trim().replace(/\s+/g, " ").replace("<svg ", '<svg width="56" height="56" ');
  const url = "data:image/svg+xml," + encodeURIComponent(svgCursor);
  const hx = Math.round(56 * GOLPE_X), hy = Math.round(56 * GOLPE_Y);
  document.documentElement.style.setProperty("--hammer-cursor", `url("${url}") ${hx} ${hy}, pointer`);
}

// Muestra la animación del martillazo en las coordenadas del toque
function martillazo(clientX, clientY) {
  const r = app.getBoundingClientRect();
  const tam = hammer.offsetWidth;
  hammer.style.left = clientX - r.left - tam * GOLPE_X + "px";
  hammer.style.top = clientY - r.top - tam * GOLPE_Y + "px";
  // Reiniciar la animación aunque se pulse muy rápido
  hammer.classList.remove("swing");
  void hammer.offsetWidth;
  hammer.classList.add("swing");
  board.classList.add("swinging");
  clearTimeout(martillazo.t);
  martillazo.t = setTimeout(() => board.classList.remove("swinging"), 250);
}

/* ==========================================================
   TABLERO
   ========================================================== */
function crearTablero() {
  for (let i = 0; i < NUM_AGUJEROS; i++) {
    const el = document.createElement("div");
    el.className = "hole";
    // .target y .dale: diana y cartelito que indican dónde dar (solo se ven con la cara fuera)
    el.innerHTML = `<div class="mask"><div class="mole"><img src="faces/1.png" alt="" draggable="false">` +
      `<div class="target"></div><div class="dale">¡DALE!</div></div></div>`;
    const agujero = { el, img: el.querySelector("img"), ocupado: false, golpeado: false, cara: 0, timer: null };
    agujeros.push(agujero);
    board.appendChild(el);
  }

  // Un único listener para todo el tablero. pointerdown responde al instante
  // (sin esperar al "click") y funciona igual con dedo y con ratón.
  board.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!jugando) return;
    martillazo(e.clientX, e.clientY);
    const hole = e.target.closest(".hole");
    const agujero = agujeros.find((a) => a.el === hole);
    if (agujero && agujero.ocupado && !agujero.golpeado) golpear(agujero);
    else sonido.fallo();
  });
}

// Precarga las caras para que no parpadeen la primera vez que salen
function cargarCaras() {
  for (let i = 1; i <= NUM_CARAS; i++) new Image().src = `faces/${i}.png`;
}

/* ==========================================================
   INTRO: DE LA FOTO AL TABLERO
   1. Un escáner barre la foto y marca cada cara al pasar.
   2. La foto se oscurece: "¡6 TOPOS DETECTADOS!".
   3. Cada cara sale volando de la foto a un agujero y se mete dentro.
   4. Empieza la cuenta atrás.
   Las posiciones de las caras vienen de faces/caras.js (las genera el script de recorte).
   ========================================================== */
const DUR_ESCANER = 1500;   // ms que tarda el escáner en bajar (igual que en style.css)
const DUR_VUELO = 700;      // ms de vuelo de cada cara
const RETRASO_VUELO = 120;  // ms entre una cara y la siguiente
let animandoIntro = false;

function introAnimada() {
  if (animandoIntro) return;
  animandoIntro = true;
  iniciarAudio();
  resetearMarcador();

  const caras = window.CARAS_FOTO || [];
  if (!caras.length) { animandoIntro = false; cuentaAtras(); return; } // sin datos: directo al juego

  ui.introBottom.style.visibility = "hidden";
  ui.scanline.classList.add("run");

  // Coordenadas relativas a #app, que es donde se posicionan las caras voladoras
  const appR = app.getBoundingClientRect();
  const fotoR = ui.photo.getBoundingClientRect();

  // Creamos una cara encima de cada cara de la foto, en su sitio exacto y con su inclinación
  const voladoras = caras.map((c, i) => {
    const d = c.d * fotoR.width;
    const cx = fotoR.left - appR.left + c.x * fotoR.width;
    const cy = fotoR.top - appR.top + c.y * fotoR.height;
    const el = document.createElement("img");
    el.src = `faces/${i + 1}.png`;
    el.className = "flyer";
    el.alt = "";
    Object.assign(el.style, {
      width: d + "px", height: d + "px",
      left: cx - d / 2 + "px", top: cy - d / 2 + "px",
      transform: `rotate(${c.giro}deg)`, opacity: 0,
    });
    ui.flyLayer.appendChild(el);

    // Aparece cuando la línea del escáner pasa por su centro
    setTimeout(() => {
      el.style.opacity = 1;
      el.animate([
        { transform: `rotate(${c.giro}deg) scale(.6)` },
        { transform: `rotate(${c.giro}deg) scale(1.15)` },
        { transform: `rotate(${c.giro}deg) scale(1)` },
      ], { duration: 300, easing: "ease-out" });
      sonido.detecta(i);
    }, c.y * DUR_ESCANER);

    return { el, giro: c.giro, cx, cy, d };
  });

  // Foto oscurecida + cartel
  setTimeout(() => {
    ui.photoFrame.classList.add("dim");
    ui.banner.classList.remove("hidden");
    sonido.alarma();
  }, DUR_ESCANER + 100);

  setTimeout(() => volarAlTablero(voladoras, appR), DUR_ESCANER + 1300);
}

function volarAlTablero(voladoras, appR) {
  // La foto se desvanece y deja ver el tablero (las caras siguen encima, en su capa)
  ui.start.classList.add("fade");
  setTimeout(() => ui.start.classList.add("hidden"), 450);

  // 6 agujeros distintos al azar
  const destinos = agujeros.slice().sort(() => Math.random() - 0.5).slice(0, voladoras.length);

  // Medimos dónde queda cada cara cuando está fuera del agujero, para aterrizar justo ahí
  const rects = destinos.map((a, i) => {
    a.img.src = `faces/${i + 1}.png`;
    a.el.classList.add("instant", "up");
    const r = a.el.querySelector(".mole").getBoundingClientRect();
    a.el.classList.remove("up");
    return r;
  });
  void board.offsetWidth;
  destinos.forEach((a) => a.el.classList.remove("instant"));

  voladoras.forEach((v, i) => {
    const r = rects[i];
    const dx = r.left - appR.left + r.width / 2 - v.cx;
    const dy = r.top - appR.top + r.height / 2 - v.cy;
    const escala = r.width / v.d;
    const retraso = i * RETRASO_VUELO;

    // Vuelo en arco: sube, gira y baja hasta el agujero
    const anim = v.el.animate([
      { transform: `translate(0, 0) rotate(${v.giro}deg) scale(1)` },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 90}px) rotate(${v.giro + 200}deg) scale(${Math.max(escala, 1) * 1.1})`, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) rotate(360deg) scale(${escala})` },
    ], { duration: DUR_VUELO, delay: retraso, easing: "cubic-bezier(.5, 0, .5, 1)", fill: "forwards" });
    setTimeout(() => sonido.vuela(), retraso);

    // Al llegar: la cambiamos por la cara del agujero y se mete dentro
    anim.onfinish = () => {
      const a = destinos[i];
      a.el.classList.add("instant", "up");
      void a.el.offsetWidth;
      a.el.classList.remove("instant");
      v.el.remove();
      sonido.plop();
      setTimeout(() => a.el.classList.remove("up"), 350);
    };
  });

  // Cuando se han escondido todas, cuenta atrás
  const total = DUR_VUELO + (voladoras.length - 1) * RETRASO_VUELO + 350 + 400;
  setTimeout(() => {
    animandoIntro = false;
    cuentaAtras();
  }, total);
}

// Vuelve a dejar la pantalla de la foto como al principio
function mostrarIntro() {
  pararMusica();
  ui.start.classList.remove("fade");
  ui.photoFrame.classList.remove("dim");
  ui.banner.classList.add("hidden");
  ui.scanline.classList.remove("run");
  ui.introBottom.style.visibility = "";
  ui.flyLayer.innerHTML = "";
  mostrar(ui.start);
}

/* ==========================================================
   APARICIÓN DE CARAS
   ========================================================== */
const azar = (min, max) => min + Math.random() * (max - min);
const mezcla = (a, b, p) => a + (b - a) * p;

// Progreso de la partida de 0 (inicio) a 1 (final)
function progreso() {
  return Math.min(1, (performance.now() - inicio) / (DURACION * 1000));
}

function programarAparicion(ms) {
  timerAparicion = setTimeout(() => {
    if (!jugando) return;
    asomar();
    // Cada vez más rápido, con algo de variación para que no sea monótono
    programarAparicion(mezcla(ESPERA_INICIO, ESPERA_FINAL, progreso()) * azar(0.7, 1.2));
  }, ms);
}

function asomar() {
  const visibles = agujeros.filter((a) => a.ocupado);
  if (visibles.length >= MAX_A_LA_VEZ) return;

  // Agujero libre al azar
  const libres = agujeros.filter((a) => !a.ocupado);
  const agujero = libres[Math.floor(Math.random() * libres.length)];

  // Cara al azar que no esté ya fuera
  const enUso = visibles.map((a) => a.cara);
  const caras = [];
  for (let i = 1; i <= NUM_CARAS; i++) if (!enUso.includes(i)) caras.push(i);
  agujero.cara = caras[Math.floor(Math.random() * caras.length)];
  agujero.img.src = `faces/${agujero.cara}.png`;

  agujero.ocupado = true;
  agujero.golpeado = false;
  agujero.el.classList.remove("hit");
  agujero.el.classList.add("up");
  sonido.asoma();

  // Tiempo visible: entre 0,6 y 1,2 s al principio; el máximo baja a 0,75 s al final
  const p = progreso();
  const visible = azar(VISIBLE_MIN, mezcla(VISIBLE_MAX, 750, p));
  agujero.timer = setTimeout(() => esconder(agujero), visible);
}

function esconder(agujero) {
  clearTimeout(agujero.timer);
  agujero.el.classList.remove("up");
  // Esperamos a que termine de bajar antes de liberar el agujero
  agujero.timer = setTimeout(() => {
    agujero.ocupado = false;
    agujero.el.classList.remove("hit");
  }, 160);
}

function golpear(agujero) {
  agujero.golpeado = true;
  clearTimeout(agujero.timer);
  agujero.el.classList.add("hit");

  puntos++;
  ui.score.textContent = puntos;
  sonido.golpe();
  try { navigator.vibrate && navigator.vibrate(30); } catch { /* sin vibración */ }
  efectos(agujero.el);

  // Se queda aplastada un momento y se esconde
  agujero.timer = setTimeout(() => esconder(agujero), 330);
}

// "+1" y estrellas saliendo del golpe
function efectos(el) {
  const pop = document.createElement("div");
  pop.className = "pop";
  pop.textContent = "+1";
  el.appendChild(pop);
  setTimeout(() => pop.remove(), 650);

  for (let i = 0; i < 6; i++) {
    const s = document.createElement("div");
    s.className = "star";
    const ang = (Math.PI * 2 * i) / 6 + azar(-0.3, 0.3);
    const dist = azar(35, 60);
    s.style.setProperty("--dx", Math.cos(ang) * dist + "px");
    s.style.setProperty("--dy", Math.sin(ang) * dist + "px");
    el.appendChild(s);
    setTimeout(() => s.remove(), 550);
  }
}

/* ==========================================================
   FLUJO DE LA PARTIDA
   ========================================================== */
function mostrar(pantalla) {
  document.querySelectorAll(".screen").forEach((p) => p.classList.toggle("hidden", p !== pantalla));
}

// Cuenta atrás 3, 2, 1, ¡YA! y empieza
function cuentaAtras() {
  iniciarAudio();
  pararMusica();
  resetearMarcador();
  mostrar(ui.count);
  let n = 3;
  const paso = () => {
    ui.countdown.textContent = n > 0 ? n : "¡YA!";
    // Reiniciar la animación de zoom
    ui.countdown.style.animation = "none";
    void ui.countdown.offsetWidth;
    ui.countdown.style.animation = "";
    sonido.cuenta(n);
    if (n === 0) setTimeout(empezar, 500);
    else setTimeout(paso, 700);
    n--;
  };
  paso();
}

function resetearMarcador() {
  puntos = 0;
  ultimoSegundo = DURACION;
  ui.score.textContent = 0;
  ui.time.textContent = DURACION;
  ui.time.classList.remove("hurry");
  ui.timebar.style.transform = "scaleX(1)";
  ui.timebar.style.backgroundPosition = "0% 0";
}

function empezar() {
  mostrar(null);
  jugando = true;
  bossLanzado = false;
  empezarMusica(TEMA_TOPOS);
  // Cartel "¡DALE EN LA CABEZA!" sobre el tablero al empezar
  const cartel = $("hit-banner");
  cartel.classList.remove("hidden");
  setTimeout(() => cartel.classList.add("hidden"), 1900);
  inicio = performance.now();
  programarAparicion(300);
  requestAnimationFrame(actualizarTiempo);
}

// Bucle del temporizador (se ejecuta en cada fotograma)
function actualizarTiempo() {
  if (!jugando) return;
  const p = progreso();
  const restante = Math.ceil(DURACION * (1 - p));

  ui.timebar.style.transform = `scaleX(${1 - p})`;
  ui.timebar.style.backgroundPosition = `${p * 100}% 0`; // verde -> amarillo -> rosa

  if (restante !== ultimoSegundo) {
    ultimoSegundo = restante;
    ui.time.textContent = restante;
    if (restante <= 5 && restante > 0) {
      ui.time.classList.add("hurry");
      sonido.tic();
    }
  }

  // A los BOSS_EN segundos, ¡sorpresa!: la partida se interrumpe y empieza la fase boss (boss.js)
  if (BOSS_EN && !bossLanzado && performance.now() - inicio >= BOSS_EN * 1000) {
    bossLanzado = true;
    iniciarBoss();
    return;
  }

  if (p >= 1) terminar();
  else requestAnimationFrame(actualizarTiempo);
}

function terminar() {
  jugando = false;
  pararMusica();
  clearTimeout(timerAparicion);
  agujeros.forEach(esconder);
  ui.time.textContent = 0;

  const nuevoRecord = puntos > record;
  if (nuevoRecord) {
    record = puntos;
    guardarRecord(record);
  }
  pintarRecord();

  ui.finalScore.textContent = puntos;
  ui.newRecord.classList.toggle("hidden", !nuevoRecord);
  sonido.fin();
  if (nuevoRecord) sonido.record();

  setTimeout(() => mostrar(ui.end), 600);
}

/* ==========================================================
   RÉCORD (localStorage, protegido por si está bloqueado)
   ========================================================== */
function leerRecord() {
  try { return parseInt(localStorage.getItem(CLAVE_RECORD), 10) || 0; }
  catch { return 0; }
}
function guardarRecord(valor) {
  try { localStorage.setItem(CLAVE_RECORD, String(valor)); } catch { /* modo privado: no pasa nada */ }
}
function pintarRecord() {
  ui.best.textContent = record;
  ui.bestStart.textContent = record;
  ui.bestEnd.textContent = record;
}

/* ==========================================================
   ARRANQUE
   ========================================================== */
prepararMartillo();
crearTablero();
cargarCaras();
pintarRecord();

$("btn-play").addEventListener("click", introAnimada);
$("btn-again").addEventListener("click", cuentaAtras);
$("btn-photo").addEventListener("click", mostrarIntro);

// Evitar gestos de zoom de iOS (pellizcar) y el menú contextual al mantener pulsado
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("contextmenu", (e) => e.preventDefault());
// Bloquea el zoom por doble toque en navegadores que ignoran touch-action
let ultimoToque = 0;
document.addEventListener("touchend", (e) => {
  const ahora = Date.now();
  if (ahora - ultimoToque < 350 && !e.target.closest("button")) e.preventDefault();
  ultimoToque = ahora;
}, { passive: false });
