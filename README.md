# Pilar Smash 🔨

Minijuego "machaca al topo" con las caras del grupo. HTML, CSS y JS puros, pensado para jugar en el móvil en vertical.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura: marcador, tablero y pantallas de inicio (la foto), cuenta atrás y final |
| `style.css` | Estética arcade, agujeros, animaciones (aplastado, martillo, estrellas) |
| `game.js` | Lógica de los topos, intro de la foto, sonidos (Web Audio API), récord en `localStorage` |
| `boss.js` | Fase boss: ¡alerta!, elige campeón, carrera con la tarta hasta Laura y fiesta de cumpleaños |
| `foto.jpg` | Foto original: es la pantalla de inicio, de ella salen volando las caras |
| `faces/1-6.png` | Caras recortadas (círculo con fondo transparente) |
| `faces/caras.js` | Posición de cada cara en la foto (para la animación de la intro) |
| `tools/recortar_caras.py` | Script que genera `faces/` (PNGs y `caras.js`) a partir de `foto.jpg` |
| `vercel.json`, `.vercelignore` | Configuración del despliegue en Vercel |

## Probarlo

- **En el ordenador:** doble clic en `index.html`. No hace falta servidor.
- **En el móvil, en la misma wifi:** `python3 -m http.server 8000` en esta carpeta y abre `http://IP-DE-TU-ORDENADOR:8000` en el móvil.

## Desplegar en Vercel

Opción A, desde la web: en vercel.com, *Add New → Project*, importa este repositorio de GitHub. Framework preset: **Other**. Sin comando de build ni directorio de salida. Deploy.

Opción B, desde la terminal:

```bash
npm i -g vercel
vercel          # primera vez: crea el proyecto y da una URL de preview
vercel --prod   # publica en producción
```

## Cómo es una partida

1. Pantalla de inicio con la foto. Al pulsar JUGAR las caras salen volando de la foto a los agujeros.
2. Topos: machaca las caras. El marcador dice 30 s, pero...
3. A los 10 s: **¡ALERTA! ¡ALERTA!** Fase boss: elige a tu campeón (todas las cabezas menos la de Laura).
4. Misión: es el cumple de Laura. Cae una tarta en manos de tu campeón y hay que llevársela saltando palomas y pivotes (toca la pantalla, o espacio en el ordenador). Tropezar te hace perder unos metros, pero nunca pierdes.
5. Tarta entregada: ¡fiesta con todas las cabezas y "Cumpleaños feliz" en chiptune!

## Ajustar el juego

Al principio de `game.js`: `LAURA` (número de su cara), `BOSS_EN` (segundos hasta la alerta; 0 la desactiva y la partida dura los 30 s), `DURACION`, `MAX_A_LA_VEZ`, `ESPERA_INICIO` / `ESPERA_FINAL` (ritmo de apariciones) y `VISIBLE_MIN` / `VISIBLE_MAX` (tiempo que se queda cada cara). En `boss.js`, el objeto `RUN` controla la carrera: metros hasta Laura, retroceso al tropezar, etc.

## Regenerar las caras

```bash
pip install "opencv-python-headless==4.10.0.84"
# Modelo YuNet: https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet
python tools/recortar_caras.py foto.jpg face_detection_yunet_2023mar.onnx
```

`LADO_OJOS` en el script controla lo abierto o cerrado del recorte.

## Tarjeta para compartir

`og-v3.jpg` es la imagen que sale al pegar el enlace en WhatsApp. Se genera desde `tools/tarjeta.html`: ábrelo en Chrome a 1200x630 y haz una captura. Lo importante va en el cuadrado central (WhatsApp a veces recorta la imagen en cuadrado). Si la cambias, guárdala con otro nombre (`og-v4.jpg`...) y actualiza `og:image` en `index.html`: WhatsApp guarda en caché las imágenes por su URL.
