# Pilar Smash 🔨

Minijuego "machaca al topo" con las caras del grupo. HTML, CSS y JS puros, pensado para jugar en el móvil en vertical.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura: marcador, tablero y pantallas de inicio (la foto), cuenta atrás y final |
| `style.css` | Estética arcade, agujeros, animaciones (aplastado, martillo, estrellas) |
| `game.js` | Lógica del juego, sonidos (Web Audio API), récord en `localStorage` |
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

## Ajustar el juego

Al principio de `game.js`: `DURACION`, `MAX_A_LA_VEZ`, `ESPERA_INICIO` / `ESPERA_FINAL` (ritmo de apariciones) y `VISIBLE_MIN` / `VISIBLE_MAX` (tiempo que se queda cada cara).

## Regenerar las caras

```bash
pip install "opencv-python-headless==4.10.0.84"
# Modelo YuNet: https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet
python tools/recortar_caras.py foto.jpg face_detection_yunet_2023mar.onnx
```

`LADO_OJOS` en el script controla lo abierto o cerrado del recorte.
