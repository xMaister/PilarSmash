/* ==========================================================
   PILAR SMASH — FASE BOSS: ¡el cumple de Laura!
   1. ¡ALERTA! ¡ALERTA!  (a los BOSS_EN segundos de topos)
   2. Elige a tu campeón (todas las cabezas menos la de Laura)
   3. Misión: cae una tarta en manos del campeón
   4. Carrera tipo "dinosaurio sin conexión": saltar palomas y
      pivotes hasta llegar a Laura (la barra de distancia baja)
   5. ¡Fiesta! Todas las cabezas celebran el cumple juntas
   Usa variables y funciones de game.js (se carga después).
   ========================================================== */

const b$ = (id) => document.getElementById(id);
const boss = {
  alert: b$("screen-alert"), alertSub: b$("alert-sub"),
  choose: b$("screen-choose"), champGrid: b$("champ-grid"), champMsg: b$("champ-msg"),
  mission: b$("screen-mission"), missionChamp: b$("mission-champ"), missionCake: b$("mission-cake"),
  run: b$("screen-run"), canvas: b$("run-canvas"), distFill: b$("dist-fill"), distNum: b$("dist-num"),
  hint: b$("run-hint"),
  party: b$("screen-party"), confetti: b$("confetti"), partyCake: b$("party-cake"), partyRow: b$("party-row"),
  partyEnd: b$("party-end"), partyTopos: b$("party-topos"), partyTrips: b$("party-trips"),
  partyRecord: b$("party-record"),
};
let campeon = 0;          // número de cara elegida
let tropiezosTotales = 0; // tropiezos de la última carrera (se enseñan en la fiesta)
let timersBoss = [];      // para poder cancelar la secuencia si se sale a la foto
const despues = (ms, fn) => timersBoss.push(setTimeout(fn, ms));

// Imágenes de las caras para dibujarlas en el canvas
const imgCara = [];
for (let i = 1; i <= NUM_CARAS; i++) {
  imgCara[i] = new Image();
  imgCara[i].src = `faces/${i}.png`;
}
// Laura en todos los sitios donde sale
["mission-laura", "dist-laura", "party-laura"].forEach((id) => (b$(id).src = `faces/${LAURA}.png`));

/* ---------- Sonidos extra (usa tono() y ruido() de game.js) ---------- */
function sirena() {
  if (!audio) return;
  const t = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const filtro = audio.createBiquadFilter();
  osc.type = "sawtooth";
  filtro.type = "lowpass";
  filtro.frequency.value = 2200;
  for (let k = 0; k < 6; k++) {
    osc.frequency.setValueAtTime(620, t + k * 0.42);
    osc.frequency.linearRampToValueAtTime(1050, t + k * 0.42 + 0.21);
    osc.frequency.linearRampToValueAtTime(620, t + k * 0.42 + 0.42);
  }
  gain.gain.setValueAtTime(0.13, t);
  gain.gain.setValueAtTime(0.13, t + 2.4);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
  osc.connect(filtro).connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + 2.65);
}
const sonidoBoss = {
  aparece(i) { tono("square", 400 + i * 90, 700 + i * 90, 0.1, 0.12); },
  elegir()   { [523, 659, 784, 1047].forEach((f, i) => tono("square", f, f, 0.12, 0.15, i * 0.08)); },
  noLaura()  { tono("square", 200, 120, 0.25, 0.2); },
  tarta()    { [1568, 2093, 2637, 3136].forEach((f, i) => tono("triangle", f, f, 0.12, 0.12, i * 0.06)); },
  salto()    { tono("square", 280, 620, 0.12, 0.1); },
  choque()   { ruido(0.2, 400, 0.5, "lowpass"); tono("sawtooth", 160, 60, 0.3, 0.2); },
  entrega()  { [784, 988, 1175, 1568].forEach((f, i) => tono("square", f, f, 0.16, 0.16, i * 0.1)); },
  // "Cumpleaños feliz" en chiptune: [nota en Hz, duración en tiempos]
  cumple() {
    const G4 = 392, A4 = 440, B4 = 493.9, C5 = 523.3, D5 = 587.3, E5 = 659.3, F5 = 698.5, G5 = 784;
    const notas = [
      [G4, .75], [G4, .25], [A4, 1], [G4, 1], [C5, 1], [B4, 2],
      [G4, .75], [G4, .25], [A4, 1], [G4, 1], [D5, 1], [C5, 2],
      [G4, .75], [G4, .25], [G5, 1], [E5, 1], [C5, 1], [B4, 1], [A4, 2],
      [F5, .75], [F5, .25], [E5, 1], [C5, 1], [D5, 1], [C5, 3],
    ];
    const TIEMPO = 0.33;
    let t = 0.2;
    notas.forEach(([f, d]) => {
      tono("square", f, f, d * TIEMPO * 0.95, 0.11, t);
      tono("triangle", f / 2, f / 2, d * TIEMPO * 0.95, 0.12, t);
      t += d * TIEMPO;
    });
  },
};

/* ==========================================================
   DIBUJOS EN CANVAS (tarta, paloma, pivote, gorro)
   ========================================================== */
function elipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Tarta de cumpleaños con 3 velas. (cx, base) = centro abajo; w = ancho; t = tiempo (llamas)
function dibujarTarta(ctx, cx, base, w, t = 0) {
  const h = w * 0.42;
  const izq = cx - w / 2;
  ctx.fillStyle = "#dfe3f0";                         // plato
  elipse(ctx, cx, base, w * 0.62, w * 0.08);
  ctx.fillStyle = "#ff7eb6";                         // bizcocho
  ctx.fillRect(izq, base - h, w, h);
  ctx.fillStyle = "#c2185b";                         // sombra lateral
  ctx.fillRect(izq + w * 0.86, base - h, w * 0.14, h);
  ctx.fillStyle = "#ffd23f";                         // franja de relleno
  ctx.fillRect(izq, base - h * 0.48, w, h * 0.13);
  ctx.fillStyle = "#fff";                            // glaseado con chorretones
  ctx.fillRect(izq, base - h, w, h * 0.24);
  for (let k = 0; k < 5; k++) elipse(ctx, izq + w * (0.1 + k * 0.2), base - h * 0.74, w * 0.06, h * 0.13);
  const colores = ["#2ef2ff", "#3dff7a", "#ffd23f", "#ff2e88"]; // virutas
  for (let k = 0; k < 8; k++) {
    ctx.fillStyle = colores[k % 4];
    ctx.fillRect(izq + w * (0.08 + k * 0.11), base - h * (0.3 + (k % 3) * 0.08), w * 0.04, w * 0.02);
  }
  [-0.26, 0, 0.26].forEach((k, i) => {               // velas
    const x = cx + k * w;
    const vh = w * 0.22;
    ctx.fillStyle = i === 1 ? "#ffd23f" : "#2ef2ff";
    ctx.fillRect(x - w * 0.03, base - h - vh, w * 0.06, vh);
    const llama = 1 + 0.25 * Math.sin(t * 18 + i * 2);
    ctx.fillStyle = "#ff9f1c";
    elipse(ctx, x, base - h - vh - w * 0.06 * llama, w * 0.045, w * 0.08 * llama);
    ctx.fillStyle = "#fff6a0";
    elipse(ctx, x, base - h - vh - w * 0.05 * llama, w * 0.02, w * 0.04 * llama);
  });
}

// Paloma de la plaza del Pilar (mira a la izquierda, hacia el jugador)
function dibujarPaloma(ctx, x, base, w, t) {
  const cab = Math.sin(t * 12) * w * 0.05;            // cabeceo
  ctx.strokeStyle = "#ff8c42";                       // patas
  ctx.lineWidth = Math.max(2, w * 0.05);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.45, base - w * 0.12); ctx.lineTo(x + w * 0.42, base);
  ctx.moveTo(x + w * 0.6, base - w * 0.12);  ctx.lineTo(x + w * 0.63, base);
  ctx.stroke();
  ctx.fillStyle = "#6b7188";                         // cola
  ctx.beginPath();
  ctx.moveTo(x + w * 0.8, base - w * 0.35);
  ctx.lineTo(x + w, base - w * 0.2);
  ctx.lineTo(x + w * 0.75, base - w * 0.18);
  ctx.fill();
  ctx.fillStyle = "#9aa0b8";                         // cuerpo
  elipse(ctx, x + w * 0.52, base - w * 0.3, w * 0.33, w * 0.2);
  ctx.fillStyle = "#7d849d";                         // ala
  elipse(ctx, x + w * 0.6, base - w * 0.3, w * 0.2, w * 0.11);
  ctx.fillStyle = "#4fb08a";                         // cuello tornasolado
  elipse(ctx, x + w * 0.27, base - w * 0.42 + cab / 2, w * 0.1, w * 0.12);
  ctx.fillStyle = "#9aa0b8";                         // cabeza
  elipse(ctx, x + w * 0.2, base - w * 0.56 + cab, w * 0.12, w * 0.11);
  ctx.fillStyle = "#ff8c42";                         // pico
  ctx.beginPath();
  ctx.moveTo(x + w * 0.09, base - w * 0.57 + cab);
  ctx.lineTo(x - w * 0.02, base - w * 0.53 + cab);
  ctx.lineTo(x + w * 0.09, base - w * 0.51 + cab);
  ctx.fill();
  ctx.fillStyle = "#fff";                            // ojo
  elipse(ctx, x + w * 0.17, base - w * 0.59 + cab, w * 0.035, w * 0.035);
  ctx.fillStyle = "#000";
  elipse(ctx, x + w * 0.165, base - w * 0.59 + cab, w * 0.018, w * 0.018);
}

// Pivote (bolardo) de calle
function dibujarPivote(ctx, x, base, w, h) {
  ctx.fillStyle = "#3a3f55";
  ctx.fillRect(x, base - h + w * 0.3, w, h - w * 0.3);
  elipse(ctx, x + w / 2, base - h + w * 0.3, w / 2, w * 0.3);
  ctx.fillStyle = "#ffd23f";
  ctx.fillRect(x, base - h * 0.62, w, h * 0.12);
  ctx.fillStyle = "rgba(255,255,255,.25)";
  ctx.fillRect(x + w * 0.15, base - h + w * 0.3, w * 0.15, h - w * 0.4);
}

// Gorro de fiesta encima de una cabeza de radio r centrada en (x, y)
function dibujarGorro(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y - r * 0.8);
  ctx.rotate(-0.18);
  ctx.fillStyle = "#ff2e88";
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, 0);
  ctx.lineTo(r * 0.45, 0);
  ctx.lineTo(0, -r * 1.1);
  ctx.fill();
  ctx.fillStyle = "#ffd23f";
  ctx.fillRect(-r * 0.3, -r * 0.42, r * 0.6, r * 0.14);
  ctx.fillStyle = "#2ef2ff";
  elipse(ctx, 0, -r * 1.12, r * 0.16, r * 0.16);
  ctx.restore();
}

// Cabeza con borde blanco y anillo de color
function dibujarCabeza(ctx, n, x, y, r, anillo) {
  ctx.fillStyle = anillo;
  elipse(ctx, x, y, r + 5, r + 5);
  ctx.fillStyle = "#fff";
  elipse(ctx, x, y, r + 2.5, r + 2.5);
  if (imgCara[n].complete) ctx.drawImage(imgCara[n], x - r, y - r, r * 2, r * 2);
}

// Pinta una tarta estática en un <canvas> del DOM (misión y fiesta)
function tartaEnCanvas(canvas, t = 0) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  dibujarTarta(ctx, canvas.width / 2, canvas.height - 14, canvas.width * 0.72, t);
}

/* ==========================================================
   1. ¡ALERTA!
   ========================================================== */
function iniciarBoss() {
  jugando = false;
  clearTimeout(timerAparicion);
  agujeros.forEach(esconder);
  ui.time.classList.remove("hurry");
  timersBoss.forEach(clearTimeout);
  timersBoss = [];

  boss.alertSub.textContent = " ";
  boss.alertSub.classList.remove("show");
  pararMusica();
  mostrar(boss.alert);
  sirena();
  if (navigator.vibrate) try { navigator.vibrate([200, 100, 200, 100, 200]); } catch { /* nada */ }

  despues(1500, () => {
    boss.alertSub.textContent = "¡FASE BOSS!";
    boss.alertSub.classList.add("show");
  });
  despues(3000, elegirCampeon);
}

/* ==========================================================
   2. ELIGE A TU CAMPEÓN
   ========================================================== */
function elegirCampeon() {
  mostrar(boss.choose);
  boss.champMsg.textContent = "Toca una cabeza";
  boss.champGrid.innerHTML = "";
  campeon = 0;

  const candidatos = [];
  for (let i = 1; i <= NUM_CARAS; i++) if (i !== LAURA) candidatos.push(i);

  candidatos.forEach((n, k) => {
    const btn = document.createElement("button");
    btn.className = "champ";
    btn.innerHTML = `<img src="faces/${n}.png" alt="Cabeza ${n}" draggable="false">`;
    btn.addEventListener("click", () => escogido(n, btn));
    boss.champGrid.appendChild(btn);
    // Las cabezas van saliendo una a una
    despues(250 + k * 180, () => { btn.classList.add("in"); sonidoBoss.aparece(k); });
  });
}

function escogido(n, btn) {
  if (campeon || !btn.classList.contains("in")) return;
  campeon = n;
  sonidoBoss.elegir();
  boss.champGrid.querySelectorAll(".champ").forEach((b) => b.classList.add(b === btn ? "chosen" : "out"));
  boss.champMsg.textContent = "¡CAMPEON ELEGIDO!";
  despues(1300, mision);
}

/* ==========================================================
   3. MISIÓN: aparece la tarta
   ========================================================== */
function mision() {
  boss.missionChamp.src = `faces/${campeon}.png`;
  tartaEnCanvas(boss.missionCake);
  boss.missionCake.classList.remove("drop");
  mostrar(boss.mission);
  void boss.missionCake.offsetWidth;
  despues(700, () => boss.missionCake.classList.add("drop"));
  despues(1250, () => sonidoBoss.tarta());
}

/* ==========================================================
   4. CARRERA CON LA TARTA
   Coordenadas: W x H = tamaño del canvas en px CSS; suelo en H*0.82.
   ========================================================== */
const RUN = {
  METROS: 120,        // distancia hasta Laura
  M_POR_ANCHO: 6,     // metros que avanza al recorrer un ancho de pantalla
  LAURA_VISIBLE: 16,  // metros a los que Laura aparece por la derecha
  RETROCESO: 5,       // metros que pierdes al tropezar
};
let run = null;       // estado de la carrera (null = no hay carrera)

function empezarCarrera() {
  mostrar(boss.run);
  const cv = boss.canvas;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const r = Math.min(W * 0.085, H * 0.075);  // radio de la cabeza
  run = {
    ctx, W, H, r,
    suelo: H * 0.82,
    px: W * 0.2,              // x del jugador
    alto: 0, vy: 0,           // altura del salto (hacia arriba) y velocidad
    g: H * 6.5, salto: H * 2.05,
    vel: W * 0.85, velMax: W * 1.35, velBase: W * 0.85,
    restante: RUN.METROS,
    obst: [], hueco: W * 0.9, // distancia hasta el siguiente obstáculo
    t: 0, invul: 0, temblor: 0, aviso: 0,
    tropiezos: 0, ultimoToque: -1,
    estado: "corriendo", entregaT: 0,
    cielo: crearSkyline(W, H, H * 0.82),
    ultimo: performance.now(),
  };
  boss.hint.style.visibility = "";
  empezarMusica(TEMA_CARRERA);
  requestAnimationFrame(bucleCarrera);
}

// Silueta del Pilar y edificios, en un canvas aparte que se repite en horizontal
function crearSkyline(W, H, suelo) {
  const c = document.createElement("canvas");
  const ancho = Math.round(W * 1.6);
  c.width = ancho;
  c.height = Math.round(suelo);
  const x = c.getContext("2d");
  x.fillStyle = "#3d1f6d";
  for (let i = 0; i < ancho; i += 22 + Math.random() * 18) {   // edificios
    const h = suelo * (0.12 + Math.random() * 0.14);
    x.fillRect(i, suelo - h, 20 + Math.random() * 16, h);
  }
  // Basílica: 4 torres, cúpula central y cupulitas
  const base = suelo - suelo * 0.18;
  const cx = ancho * 0.5, esc = suelo * 0.0045;
  x.fillStyle = "#4a2785";
  x.fillRect(cx - 60 * esc, base - 30 * esc, 120 * esc, 30 * esc);                 // nave
  elipse(x, cx, base - 30 * esc, 22 * esc, 26 * esc);                              // cúpula
  x.fillRect(cx - 2 * esc, base - 70 * esc, 4 * esc, 16 * esc);                     // linterna
  [-40, 40].forEach((d) => elipse(x, cx + d * esc, base - 30 * esc, 10 * esc, 13 * esc));
  [-110, -75, 75, 110].forEach((d) => {                                             // torres
    const h = 95 * esc;
    x.fillRect(cx + d * esc - 9 * esc, base - h, 18 * esc, h + 2);
    elipse(x, cx + d * esc, base - h, 7 * esc, 9 * esc);
    x.fillRect(cx + d * esc - 1.5 * esc, base - h - 22 * esc, 3 * esc, 14 * esc);
  });
  x.fillRect(cx - 120 * esc, base - 2, 240 * esc, suelo * 0.18 + 2);
  // Ventanitas encendidas
  x.fillStyle = "rgba(255,210,63,.55)";
  for (let i = 0; i < 70; i++) {
    const vx = Math.random() * ancho, vy = suelo - Math.random() * suelo * 0.2;
    x.fillRect(vx, vy, 3, 4);
  }
  return c;
}

function saltar() {
  if (!run || run.estado !== "corriendo") return;
  run.ultimoToque = run.t;
  if (run.alto <= 0) {
    run.vy = run.salto;
    sonidoBoss.salto();
    boss.hint.style.visibility = "hidden";
  }
}

function bucleCarrera(ahora) {
  if (!run) return;
  const dt = Math.min(0.05, (ahora - run.ultimo) / 1000);  // evita saltos si la pestaña se pausa
  run.ultimo = ahora;
  actualizarCarrera(dt);
  if (!run) return; // la carrera acaba de terminar
  dibujarCarrera();
  requestAnimationFrame(bucleCarrera);
}

function actualizarCarrera(dt) {
  const R = run;
  R.t += dt;
  R.invul = Math.max(0, R.invul - dt);
  R.temblor = Math.max(0, R.temblor - dt);
  R.aviso = Math.max(0, R.aviso - dt);

  // Física del salto
  if (R.alto > 0 || R.vy > 0) {
    R.vy -= R.g * dt;
    R.alto += R.vy * dt;
    if (R.alto <= 0) {
      R.alto = 0;
      R.vy = 0;
      // Si se tocó justo antes de aterrizar, salta otra vez (más cómodo)
      if (R.estado === "corriendo" && R.t - R.ultimoToque < 0.12) { R.vy = R.salto; sonidoBoss.salto(); }
    }
  }

  if (R.estado === "corriendo") {
    R.vel = Math.min(R.velMax, R.vel + R.W * 0.025 * dt);
    R.restante = Math.max(0, R.restante - (R.vel / R.W) * RUN.M_POR_ANCHO * dt);

    // Obstáculos: se mueven a la izquierda y aparecen nuevos mientras Laura no esté cerca
    R.obst.forEach((o) => (o.x -= R.vel * dt));
    R.obst = R.obst.filter((o) => o.x + o.w > -20);
    R.hueco -= R.vel * dt;
    if (R.hueco <= 0 && R.restante > RUN.LAURA_VISIBLE + 2) {
      nuevoObstaculo();
      R.hueco = R.vel * (0.85 + Math.random() * 0.75);
    }

    // Choques (caja del jugador = cabeza + tarta, un poco más pequeña para ser justos)
    if (R.invul <= 0) {
      const pieY = R.suelo - R.alto;
      const caja = { x1: R.px - R.r * 0.7, x2: R.px + R.r * 1.7, y1: pieY - R.r * 2.6, y2: pieY };
      for (const o of R.obst) {
        const m = o.w * 0.18;
        if (caja.x2 > o.x + m && caja.x1 < o.x + o.w - m && caja.y2 > R.suelo - o.h * 0.85) {
          tropezar();
          break;
        }
      }
    }

    if (R.restante <= 0) {
      R.estado = "entrega";
      R.obst = [];
      pararMusica();
      sonidoBoss.entrega();
    }
  } else if (R.estado === "entrega") {
    R.entregaT += dt;
    if (R.entregaT > 1.6) {
      tropiezosTotales = R.tropiezos;
      run = null;
      fiesta();
      return;
    }
  }

  // Barra de distancia
  boss.distFill.style.transform = `scaleX(${R.restante / RUN.METROS})`;
  boss.distNum.textContent = Math.ceil(R.restante) + " m";
}

function nuevoObstaculo() {
  const R = run;
  const tipo = Math.random();
  if (tipo < 0.45) {
    R.obst.push({ tipo: "paloma", x: R.W + 10, w: R.r * 1.6, h: R.r * 1.1 });
  } else if (tipo < 0.7 && R.restante < RUN.METROS * 0.7) {
    // Dos palomas juntas (solo a partir de la segunda parte)
    R.obst.push({ tipo: "paloma", x: R.W + 10, w: R.r * 1.6, h: R.r * 1.1 });
    R.obst.push({ tipo: "paloma", x: R.W + 10 + R.r * 1.5, w: R.r * 1.6, h: R.r * 1.1 });
  } else {
    R.obst.push({ tipo: "pivote", x: R.W + 10, w: R.r * 0.75, h: R.r * (1.5 + Math.random() * 0.5) });
  }
}

function tropezar() {
  const R = run;
  R.tropiezos++;
  R.invul = 1.3;
  R.temblor = 0.3;
  R.aviso = 1;
  R.restante = Math.min(RUN.METROS, R.restante + RUN.RETROCESO);
  R.vel = Math.max(R.velBase, R.vel * 0.8);
  sonidoBoss.choque();
  if (navigator.vibrate) try { navigator.vibrate(120); } catch { /* nada */ }
}

function dibujarCarrera() {
  const R = run;
  const { ctx, W, H, r, suelo } = R;
  ctx.save();
  if (R.temblor > 0) ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6);

  // Cielo de atardecer + estrellas
  const grad = ctx.createLinearGradient(0, 0, 0, suelo);
  grad.addColorStop(0, "#1a0b2e");
  grad.addColorStop(0.6, "#5b1f6e");
  grad.addColorStop(1, "#ff6f91");
  ctx.fillStyle = grad;
  ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.fillStyle = "rgba(255,255,255,.7)";
  for (let i = 0; i < 25; i++) ctx.fillRect((i * 97) % W, (i * 53) % (suelo * 0.45), 2, 2);

  // Skyline con parallax (avanza más despacio que el suelo)
  const recorrido = (RUN.METROS - R.restante) / RUN.M_POR_ANCHO * W;
  const sw = R.cielo.width;
  const off = -((recorrido * 0.2) % sw);
  ctx.drawImage(R.cielo, off, 0, sw, suelo);
  ctx.drawImage(R.cielo, off + sw, 0, sw, suelo);

  // Suelo (adoquines que se desplazan)
  ctx.fillStyle = "#2d1457";
  ctx.fillRect(-10, suelo, W + 20, H - suelo + 10);
  ctx.fillStyle = "#ffd23f";
  ctx.fillRect(-10, suelo, W + 20, 3);
  ctx.fillStyle = "#4a2785";
  const paso = 34;
  for (let x = -(recorrido % paso); x < W; x += paso) {
    ctx.fillRect(x, suelo + 10, paso * 0.6, 4);
    ctx.fillRect(x + paso * 0.3, suelo + 24, paso * 0.6, 4);
  }

  // Obstáculos
  R.obst.forEach((o) => {
    if (o.tipo === "paloma") dibujarPaloma(ctx, o.x, suelo, o.w, R.t + o.x * 0.01);
    else dibujarPivote(ctx, o.x, suelo, o.w, o.h);
  });

  // Laura esperando al final (con gorro, saludando)
  if (R.restante < RUN.LAURA_VISIBLE || R.estado !== "corriendo") {
    const frac = R.restante / RUN.LAURA_VISIBLE;
    const lx = R.px + r * 3.4 + frac * W * 0.95;
    dibujarPersonaje(ctx, LAURA, lx, suelo, r * 1.15, R.t, { gorro: true, saluda: true, anillo: "#ff2e88" });
  }

  // Jugador (parpadea si acaba de tropezar)
  const visible = R.invul <= 0 || Math.floor(R.t * 12) % 2 === 0;
  if (visible) {
    const pie = suelo - R.alto;
    const corre = R.estado === "corriendo" && R.alto === 0;
    dibujarPersonaje(ctx, campeon, R.px, pie, r, corre ? R.t : 0, { anillo: "#ffd23f" });

    // La tarta: en las manos o pasando a las de Laura
    let tx = R.px + r * 1.25, ty = pie - r * 0.75;
    if (R.estado === "entrega") {
      // Pasa en arco hasta delante de Laura (que está en px + 3.4r)
      const k = Math.min(1, R.entregaT / 0.6);
      tx += (r * 3.4 - r * 1.4 - r * 1.25) * k;
      ty -= Math.sin(k * Math.PI) * r * 1.2;
    }
    dibujarTarta(ctx, tx, ty, r * 1.3, R.t);
  }

  // Mensajes
  ctx.textAlign = "center";
  ctx.font = `${Math.round(W * 0.042)}px "Press Start 2P", monospace`;
  if (R.aviso > 0) {
    ctx.fillStyle = "#ff2e88";
    ctx.fillText("¡CUIDADO CON LA TARTA!", W / 2, H * 0.18);
  }
  if (R.estado === "entrega") {
    ctx.fillStyle = "#ffd23f";
    ctx.fillText("¡TARTA ENTREGADA!", W / 2, H * 0.18);
  }
  ctx.restore();
}

// Una cabeza con piernecitas (y brazos si saluda). (x, pie) = centro abajo
function dibujarPersonaje(ctx, n, x, pie, r, t, op = {}) {
  const pierna = r * 0.55;
  const fase = t ? Math.sin(t * 22) : 0;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(3, r * 0.14);
  ctx.lineCap = "round";
  ctx.beginPath();                                   // piernas
  ctx.moveTo(x - r * 0.25, pie - pierna); ctx.lineTo(x - r * 0.25 + fase * r * 0.3, pie);
  ctx.moveTo(x + r * 0.25, pie - pierna); ctx.lineTo(x + r * 0.25 - fase * r * 0.3, pie);
  ctx.stroke();
  const cy = pie - pierna - r * 0.9 + (t ? Math.abs(fase) * r * -0.08 : 0);
  if (op.saluda) {                                   // brazos arriba
    const ola = Math.sin(t * 8) * r * 0.25;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.8, cy + r * 0.3); ctx.lineTo(x - r * 1.35, cy - r * 0.5 + ola);
    ctx.moveTo(x + r * 0.8, cy + r * 0.3); ctx.lineTo(x + r * 1.35, cy - r * 0.5 - ola);
    ctx.stroke();
  } else {                                           // brazos hacia la tarta
    ctx.beginPath();
    ctx.moveTo(x + r * 0.6, cy + r * 0.55); ctx.lineTo(x + r * 1.0, cy + r * 0.95);
    ctx.stroke();
  }
  dibujarCabeza(ctx, n, x, cy, r, op.anillo || "#ff2e88");
  if (op.gorro) dibujarGorro(ctx, x, cy, r);
}

/* ==========================================================
   5. ¡FIESTA!
   ========================================================== */
let fiestaActiva = false;

function fiesta() {
  mostrar(boss.party);
  boss.partyEnd.classList.remove("show");

  // Récord de topos (los machacados antes de la alerta)
  const nuevo = puntos > record;
  if (nuevo) { record = puntos; guardarRecord(record); }
  pintarRecord();
  boss.partyTopos.textContent = puntos;
  boss.partyTrips.textContent = tropiezosTotales;
  boss.partyRecord.classList.toggle("hidden", !nuevo);

  // Las demás cabezas, con gorro, entran saltando
  boss.partyRow.innerHTML = "";
  for (let i = 1; i <= NUM_CARAS; i++) {
    if (i === LAURA) continue;
    const d = document.createElement("div");
    d.className = "face-hat";
    d.innerHTML = `<img src="faces/${i}.png" alt="" draggable="false"><div class="hat"></div>`;
    boss.partyRow.appendChild(d);
  }
  [...boss.partyRow.children].forEach((d, k) => despues(500 + k * 160, () => d.classList.add("in")));

  sonidoBoss.cumple();
  despues(2600, () => boss.partyEnd.classList.add("show"));
  empezarConfeti();
}

// Confeti + llamas de la tarta (un solo bucle mientras dure la fiesta)
function empezarConfeti() {
  const cv = boss.confetti;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colores = ["#ff2e88", "#ffd23f", "#2ef2ff", "#3dff7a", "#ffffff"];
  const trozos = Array.from({ length: 90 }, () => ({
    x: Math.random() * W, y: -Math.random() * H, v: 60 + Math.random() * 90,
    giro: Math.random() * 6, vg: 2 + Math.random() * 6, c: colores[Math.floor(Math.random() * 5)],
    w: 5 + Math.random() * 6, oscila: Math.random() * 6,
  }));
  fiestaActiva = true;
  let antes = performance.now();
  const t0 = antes;
  const bucle = (ahora) => {
    if (!fiestaActiva) return;
    const dt = Math.min(0.05, (ahora - antes) / 1000);
    antes = ahora;
    ctx.clearRect(0, 0, W, H);
    trozos.forEach((p) => {
      p.y += p.v * dt;
      p.giro += p.vg * dt;
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
      ctx.save();
      ctx.translate(p.x + Math.sin(p.giro + p.oscila) * 12, p.y);
      ctx.rotate(p.giro);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2);
      ctx.restore();
    });
    tartaEnCanvas(boss.partyCake, (ahora - t0) / 1000);
    requestAnimationFrame(bucle);
  };
  requestAnimationFrame(bucle);
}

// Para todo lo de la fase boss (al repetir o volver a la foto)
function pararBoss() {
  pararMusica();
  timersBoss.forEach(clearTimeout);
  timersBoss = [];
  run = null;
  fiestaActiva = false;
}

/* ---------- Botones y controles ---------- */
b$("btn-run").addEventListener("click", empezarCarrera);
b$("btn-party-again").addEventListener("click", () => { pararBoss(); cuentaAtras(); });
b$("btn-party-photo").addEventListener("click", () => { pararBoss(); mostrarIntro(); });

// Saltar: tocar en cualquier sitio de la pantalla de carrera, o espacio / flecha arriba
boss.run.addEventListener("pointerdown", (e) => { e.preventDefault(); saltar(); });
document.addEventListener("keydown", (e) => {
  if (run && (e.code === "Space" || e.code === "ArrowUp")) { e.preventDefault(); saltar(); }
});
