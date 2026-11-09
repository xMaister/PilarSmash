"""
Recorta las caras de foto.jpg y las guarda como PNG circulares con fondo
transparente en faces/1.png ... faces/N.png (ordenadas de izquierda a derecha).

Uso:
    pip install "opencv-python-headless==4.10.0.84" numpy
    python tools/recortar_caras.py [foto.jpg] [ruta/a/yunet.onnx]

Detector: YuNet (red neuronal de OpenCV, muy fiable con caras inclinadas).
Modelo: https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet
Si no se pasa el modelo, se usa el clasificador Haar clásico (menos preciso).
"""
import os
import sys

import cv2
import numpy as np

FOTO = sys.argv[1] if len(sys.argv) > 1 else "foto.jpg"
MODELO = sys.argv[2] if len(sys.argv) > 2 else None
SALIDA = "faces"
TAM = 256          # tamaño final de cada PNG (cuadrado)
LADO_OJOS = 4.3   # lado del recorte = distancia entre ojos x LADO_OJOS
BAJAR_OJOS = 0.50 # centro del recorte = punto medio de los ojos + BAJAR_OJOS x distancia (hacia la boca)
MARGEN = 1.3      # (solo Haar) cuánto ampliamos la caja de la cara


def detectar_yunet(img):
    """Devuelve lista de (x, y, w, h, ojo_izq, ojo_der) usando YuNet."""
    h, w = img.shape[:2]
    det = cv2.FaceDetectorYN.create(MODELO, "", (w, h), score_threshold=0.7)
    _, caras = det.detect(img)
    res = []
    for c in (caras if caras is not None else []):
        x, y, cw, ch = c[:4]
        ojo_d = (c[4], c[5])   # ojo derecho de la persona (izquierda en la imagen)
        ojo_i = (c[6], c[7])
        res.append((x, y, cw, ch, ojo_d, ojo_i))
    return res


def detectar_haar(img):
    """Alternativa sin modelo externo: Haar cascade (sin ojos -> sin enderezar)."""
    gris = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clf = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    caras = clf.detectMultiScale(gris, 1.1, 6, minSize=(80, 80))
    return [(x, y, w, h, None, None) for (x, y, w, h) in caras]


def recortar(img, cara):
    """Endereza la cara (ojos horizontales), la recorta en cuadrado y aplica máscara circular."""
    x, y, w, h, ojo_a, ojo_b = cara
    angulo = 0.0
    if ojo_a is not None:
        # Con ojos: el tamaño y el centro salen de la posición de los ojos (más estable que la caja)
        dx, dy = ojo_b[0] - ojo_a[0], ojo_b[1] - ojo_a[1]
        d = np.hypot(dx, dy)
        angulo = np.degrees(np.arctan2(dy, dx))      # inclinación de la cabeza
        nx, ny = -dy / d, dx / d                     # dirección perpendicular (hacia la barbilla)
        cx = (ojo_a[0] + ojo_b[0]) / 2 + nx * d * BAJAR_OJOS
        cy = (ojo_a[1] + ojo_b[1]) / 2 + ny * d * BAJAR_OJOS
        lado = d * LADO_OJOS
    else:
        cx, cy = x + w / 2, y + h / 2
        lado = max(w, h) * MARGEN

    # Rotamos alrededor del centro de la cara y trasladamos para que quede centrada en el recorte
    escala = TAM / lado
    M = cv2.getRotationMatrix2D((cx, cy), angulo, escala)
    M[0, 2] += TAM / 2 - cx
    M[1, 2] += TAM / 2 - cy
    # BORDER_REPLICATE evita bordes negros si la cara está pegada al borde de la foto
    cuadro = cv2.warpAffine(img, M, (TAM, TAM), flags=cv2.INTER_CUBIC,
                            borderMode=cv2.BORDER_REPLICATE)

    # Máscara circular suavizada (antialias) -> canal alfa
    S = 4  # supermuestreo para un borde limpio
    mascara = np.zeros((TAM * S, TAM * S), np.uint8)
    cv2.circle(mascara, (TAM * S // 2, TAM * S // 2), TAM * S // 2 - S * 2, 255, -1, cv2.LINE_AA)
    mascara = cv2.resize(mascara, (TAM, TAM), interpolation=cv2.INTER_AREA)

    bgra = cv2.cvtColor(cuadro, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = mascara
    # Devolvemos también dónde estaba el círculo en la foto (para la animación de la intro)
    return bgra, (cx, cy, lado, angulo)


def main():
    img = cv2.imread(FOTO)
    if img is None:
        sys.exit(f"No encuentro {FOTO}")

    caras = detectar_yunet(img) if MODELO else detectar_haar(img)
    caras.sort(key=lambda c: c[0])  # de izquierda a derecha
    print(f"Caras detectadas: {len(caras)}")

    os.makedirs(SALIDA, exist_ok=True)
    alto, ancho = img.shape[:2]
    posiciones = []
    for i, cara in enumerate(caras, 1):
        ruta = os.path.join(SALIDA, f"{i}.png")
        recorte, (cx, cy, lado, angulo) = recortar(img, cara)
        cv2.imwrite(ruta, recorte)
        # Posición relativa (0-1) para que el juego la escale al tamaño de pantalla
        posiciones.append(f"  {{ x: {cx / ancho:.4f}, y: {cy / alto:.4f}, d: {lado / ancho:.4f}, giro: {angulo:.1f} }},")
        print(f"  {ruta}  centro=({int(cx)},{int(cy)}) lado={int(lado)} giro={angulo:.1f}")

    # faces/caras.js: el juego lo carga con <script> (funciona sin servidor, a diferencia de un .json)
    with open(os.path.join(SALIDA, "caras.js"), "w") as f:
        f.write("// Generado por tools/recortar_caras.py: posición de cada cara en foto.jpg\n")
        f.write("// x, y = centro (fracción del ancho/alto), d = diámetro (fracción del ancho), giro = grados\n")
        f.write("window.CARAS_FOTO = [\n" + "\n".join(posiciones) + "\n];\n")
    print(f"  {SALIDA}/caras.js")


if __name__ == "__main__":
    main()
