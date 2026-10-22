# Stickers animados Sonrieme (GIPHY)

| Archivo | Sticker |
|---|---|
| `sonrieme-01-10-anos.gif` | 10 años: disco blanco, aro dorado con brillo que lo recorre y destellos |
| `sonrieme-02-isotipo.gif` | Isotipo (diente con implante) con reflejo de luz y destello |
| `sonrieme-03-creando-sonrisas.gif` | "Creando sonrisas, construyendo historias" con subrayado dorado que se dibuja |
| `sonrieme-04-tu-sonrisa-nos-inspira.gif` | "Tu sonrisa nos inspira": palabras una a una e isotipo dorado |
| `sonrieme-05-instagram.gif` | @odontologiapaulaquiroz con corazón dorado latiendo |

GIF animado de 500×500 px con fondo transparente, loop de 2 s a 15 fps (30 cuadros) y menos de 2 MB.
Cada sticker va sobre una base sólida con borde dorado para que el borde no se vea dentado con la transparencia de 1 bit del GIF.

## Regenerar

Requiere Node con Playwright (Chromium) y Python con Pillow y NumPy.

```sh
cd stickers/fuente
mkdir -p fonts
curl -sSfL -o fonts/Cinzel.ttf     "https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf"
curl -sSfL -o fonts/Montserrat.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf"
NODE_PATH="$(npm root -g)" node render.js /tmp/cuadros   # cuadros PNG transparentes
python3 build.py /tmp/cuadros ..                          # arma los GIF en stickers/
```
