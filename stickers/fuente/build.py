"""Arma los GIF de GIPHY a partir de los cuadros PNG de render.js.

Uso: python3 build.py <carpeta-cuadros> <carpeta-salida>

- Transparencia de 1 bit: alfa >= 128 es opaco (la base sólida con borde dorado
  deja el borde limpio), el resto va al índice transparente.
- Una sola paleta de 255 colores para todos los cuadros (sin parpadeo de color).
- 30 cuadros a 15 fps: duraciones de 70/60 ms alternadas que suman exactamente 2 s.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

STICKERS = {
    '01-10-anos': 'sonrieme-01-10-anos.gif',
    '02-isotipo': 'sonrieme-02-isotipo.gif',
    '03-creando-sonrisas': 'sonrieme-03-creando-sonrisas.gif',
    '04-tu-sonrisa-nos-inspira': 'sonrieme-04-tu-sonrisa-nos-inspira.gif',
    '05-instagram': 'sonrieme-05-instagram.gif',
}
TRANSPARENT = 255
MAX_BYTES = 2 * 1024 * 1024


def durations(n, total_ms=2000):
    # GIF mide en centésimas: reparte 200 cs entre los cuadros (7,7,6,7,7,6,…)
    cs, out, acc = total_ms // 10, [], 0
    for i in range(n):
        nxt = round(cs * (i + 1) / n)
        out.append((nxt - acc) * 10)
        acc = nxt
    return out


def build(frames_dir, out_path):
    rgba = [np.asarray(Image.open(p).convert('RGBA')) for p in sorted(frames_dir.glob('*.png'))]
    opaque = [f[..., 3] >= 128 for f in rgba]

    # Paleta común a partir de una muestra de los píxeles opacos de todos los cuadros
    sample = np.concatenate([f[..., :3][m][::3] for f, m in zip(rgba, opaque)])
    side = int(np.ceil(np.sqrt(len(sample))))
    pad = np.zeros((side * side - len(sample), 3), np.uint8) + sample[:1]
    sample_img = Image.fromarray(np.concatenate([sample, pad]).reshape(side, side, 3))
    pal_img = sample_img.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    palette = pal_img.getpalette()[:255 * 3]
    palette += [255, 0, 255]  # índice 255 reservado a la transparencia (magenta, nunca elegido)
    pal_img.putpalette(palette)

    out = []
    for f, m in zip(rgba, opaque):
        q = Image.fromarray(f[..., :3]).quantize(palette=pal_img, dither=Image.Dither.NONE)
        idx = np.asarray(q).copy()
        idx[~m] = TRANSPARENT
        p = Image.fromarray(idx, 'P')
        p.putpalette(palette)
        p.info['transparency'] = TRANSPARENT
        out.append(p)

    out[0].save(out_path, save_all=True, append_images=out[1:], loop=0,
                duration=durations(len(out)), disposal=2, transparency=TRANSPARENT,
                optimize=False)

    size = out_path.stat().st_size
    first_transparent = 1 - opaque[0].mean()
    print(f'{out_path.name}: {len(out)} cuadros, {size / 1024:.0f} KB, '
          f'{first_transparent:.0%} transparente en el 1.er cuadro')
    assert size < MAX_BYTES, 'supera 2 MB'
    assert first_transparent >= 0.20, 'menos de 20 % transparente'


def main():
    frames_root, out_root = Path(sys.argv[1]), Path(sys.argv[2])
    out_root.mkdir(parents=True, exist_ok=True)
    for src, dst in STICKERS.items():
        build(frames_root / src, out_root / dst)


if __name__ == '__main__':
    main()
