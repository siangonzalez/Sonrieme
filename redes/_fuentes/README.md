# Fuentes de las piezas de redes · Sonrieme (oct–nov 2026)

Cada pieza es un HTML de tamaño fijo que comparte `marca.css` (colores, tipografías y componentes de la línea gráfica).
Para cambiar un texto o una foto, edita el HTML de la pieza y vuelve a renderizar.

| Carpeta | Contenido | Salida |
| --- | --- | --- |
| `feed/` | Carruseles P2, P5, P10 y post P7 (1080×1350) | `redes/feed/` |
| `stories/` | S1, S3, S5, S7, S10, S13 (1080×1920) | `redes/stories/` y guías en `redes/revision/` |
| `portadas/` | Portadas de reels (1080×1920) | `redes/portadas-reels/` |
| `stickers/` | Stickers GIPHY, animados con `setT(t)` | `redes/stickers-giphy/` |
| `fonts/` | Cinzel y Montserrat (Google Fonts, licencia OFL) | — |

## Renderizar

Requiere Node con Playwright (usa el Chromium de `/opt/pw-browsers/`) y Python con Pillow y NumPy.

```sh
# desde la raíz del repo
NODE_PATH="$(npm root -g)" node redes/_fuentes/render.js /tmp/cuadros-stickers
python3 redes/_fuentes/construir.py /tmp/cuadros-stickers
```

`render.js` falla si algún texto o recuadro se sale de los márgenes (96 px), de la zona segura de las stories
(250 px arriba y abajo) o del recuadro 4:5 de las portadas, o si choca con el contador o el isotipo.
`construir.py` optimiza los PNG, arma los GIF (verifica peso, transparencia y animación) y genera las hojas de revisión.

## Espacios pendientes

Los recuadros grises punteados con "FOTO PENDIENTE" están en `feed/P2-02.html` y `feed/P2-03.html`.
Para reemplazarlos, cambia el `<div class="pendiente">…</div>` por
`<div class="foto"><img src="../../../img/NOMBRE.jpg" alt=""></div>` y vuelve a renderizar.
