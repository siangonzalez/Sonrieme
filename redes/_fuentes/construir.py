"""Optimiza los PNG, arma los GIF de GIPHY y genera las hojas de revisión.

Uso (desde la raíz del repo, después de render.js):
    python3 redes/_fuentes/construir.py <carpeta-cuadros-stickers>

GIF: transparencia de 1 bit con umbral de alfa en 128, una paleta común de 255 colores
para todos los cuadros, disposal=2, loop=0 y 30 cuadros a 15 fps (70/60 ms que suman 2 s).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

REDES = Path(__file__).resolve().parent.parent
REPO = REDES.parent
FUENTES = REDES / '_fuentes'
FONT = FUENTES / 'fonts' / 'Montserrat.ttf'
TRANSPARENTE = 255
MAX_GIF = 2 * 1024 * 1024


# ---------- PNG ----------

def optimizar_png(path):
    im = Image.open(path)
    if im.mode == 'RGBA' and im.getchannel('A').getextrema() == (255, 255):
        im = im.convert('RGB')          # las piezas son opacas: sin canal alfa pesan menos
    im.save(path, optimize=True)


# ---------- GIF ----------

def duraciones(n, total_ms=2000):
    cs, out, acc = total_ms // 10, [], 0
    for i in range(n):
        nxt = round(cs * (i + 1) / n)
        out.append((nxt - acc) * 10)
        acc = nxt
    return out


def armar_gif(frames_dir, out_path):
    rgba = [np.asarray(Image.open(p).convert('RGBA')) for p in sorted(frames_dir.glob('*.png'))]
    opaco = [f[..., 3] >= 128 for f in rgba]

    muestra = np.concatenate([f[..., :3][m][::3] for f, m in zip(rgba, opaco)])
    lado = int(np.ceil(np.sqrt(len(muestra))))
    relleno = np.repeat(muestra[:1], lado * lado - len(muestra), axis=0)
    pal_img = Image.fromarray(np.concatenate([muestra, relleno]).reshape(lado, lado, 3)).quantize(
        colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    paleta = pal_img.getpalette()[:255 * 3] + [255, 0, 255]   # índice 255 = transparente
    pal_img.putpalette(paleta)

    cuadros = []
    for f, m in zip(rgba, opaco):
        idx = np.asarray(Image.fromarray(f[..., :3]).quantize(palette=pal_img, dither=Image.Dither.NONE)).copy()
        idx[~m] = TRANSPARENTE
        p = Image.fromarray(idx, 'P')
        p.putpalette(paleta)
        p.info['transparency'] = TRANSPARENTE
        cuadros.append(p)

    cuadros[0].save(out_path, save_all=True, append_images=cuadros[1:], loop=0, duration=duraciones(len(cuadros)),
                    disposal=2, transparency=TRANSPARENTE, optimize=False)
    peso, vacio = out_path.stat().st_size, 1 - opaco[0].mean()
    print(f'{out_path.name}: {len(cuadros)} cuadros, {peso / 1024:.0f} KB, {vacio:.0%} transparente en el 1.er cuadro')
    assert peso < MAX_GIF, f'{out_path.name} supera 2 MB'
    assert vacio >= 0.20, f'{out_path.name} tiene menos de 20 % transparente'
    assert len(set(p.tobytes() for p in cuadros)) > 1, f'{out_path.name} no está animado'


# ---------- Hojas de revisión ----------

def fuente(size):
    f = ImageFont.truetype(str(FONT), size)
    f.set_variation_by_axes([600])
    return f


def hoja(titulo, grupos, out_path, alto_miniatura):
    """grupos: lista de (nombre, [rutas]); una fila por grupo."""
    pad, gap, cab, rot = 40, 24, 90, 44
    filas = []
    for nombre, rutas in grupos:
        thumbs = []
        for r in rutas:
            im = Image.open(r).convert('RGB')
            w = round(im.width * alto_miniatura / im.height)
            thumbs.append((r.stem, im.resize((w, alto_miniatura), Image.LANCZOS)))
        filas.append((nombre, thumbs))
    ancho = max(sum(t.width for _, t in th) + gap * (len(th) - 1) for _, th in filas) + 2 * pad
    alto = cab + sum(rot + alto_miniatura + 34 + gap for _ in filas) + pad
    sheet = Image.new('RGB', (ancho, alto), '#EEF3F8')
    d = ImageDraw.Draw(sheet)
    d.text((pad, 30), titulo, fill='#1F3A5F', font=fuente(34))
    y = cab
    for nombre, thumbs in filas:
        d.text((pad, y + 6), nombre, fill='#8A6A24', font=fuente(24))
        y += rot
        x = pad
        for stem, t in thumbs:
            sheet.paste(t, (x, y))
            d.rectangle((x, y, x + t.width - 1, y + t.height - 1), outline='#D9E2EC')
            d.text((x, y + t.height + 6), stem, fill='#5B6B7F', font=fuente(20))
            x += t.width + gap
        y += alto_miniatura + 34 + gap
    sheet.save(out_path, optimize=True)
    print(f'revisión: {out_path.relative_to(REDES)}')


def revision_stickers(gifs, out_path):
    """3 cuadros de cada sticker sobre la foto de la doctora y sobre un fondo oscuro."""
    foto = Image.open(REPO / 'img' / 'dra-paula.jpg').convert('RGB')
    foto = foto.resize((560, round(foto.height * 560 / foto.width)), Image.LANCZOS)
    oscuro = Image.new('RGB', (560, 560), '#1E1E22')
    celda, gap, pad, rot = 560, 16, 32, 40
    sheet = Image.new('RGB', (pad * 2 + 6 * celda + 5 * gap, pad + len(gifs) * (rot + celda + gap)), 'white')
    d = ImageDraw.Draw(sheet)
    y = pad
    for gif in gifs:
        g = Image.open(gif)
        cuadros, inicios, t = [], [], 0
        for i in range(g.n_frames):
            g.seek(i)
            cuadros.append(g.convert('RGBA'))
            inicios.append(t)
            t += g.info['duration']
        en = lambda ms: cuadros[max(i for i, s in enumerate(inicios) if s <= ms)]
        muestras = [en(ms) for ms in (250, 800, 1450)]
        d.text((pad, y + 4), f'{gif.name} · t = 0,25 s / 0,8 s / 1,45 s sobre foto y sobre fondo oscuro',
               fill='#1F3A5F', font=fuente(24))
        y += rot
        for k, fondo in enumerate([foto.crop((0, 260, 560, 820))] * 3 + [oscuro] * 3):
            c = fondo.copy()
            m = muestras[k % 3]
            c.paste(m.resize((480, 480), Image.LANCZOS), (40, 40), m.resize((480, 480), Image.LANCZOS))
            sheet.paste(c, (pad + k * (celda + gap), y))
        y += celda + gap
    sheet.save(out_path, optimize=True)
    print(f'revisión: {out_path.relative_to(REDES)}')


def main():
    frames_root = Path(sys.argv[1])

    for carpeta in ('feed', 'stories', 'portadas-reels', 'revision'):
        for png in sorted((REDES / carpeta).glob('*.png')):
            if not png.name.startswith('hoja-'):
                optimizar_png(png)

    gifs = []
    for frames in sorted(p for p in frames_root.iterdir() if p.is_dir()):
        out = REDES / 'stickers-giphy' / f'{frames.name}.gif'
        armar_gif(frames, out)
        gifs.append(out)

    feed = sorted((REDES / 'feed').glob('*.png'))
    orden = lambda p: [int(x) for x in p.stem[1:].split('-')]
    grupos = {}
    for p in sorted(feed, key=orden):
        grupos.setdefault(p.stem.split('-')[0], []).append(p)
    nombres = {'P2': 'P2 · Carrusel “2016 vs. 2026”', 'P5': 'P5 · Carrusel “Nuestros mejores antes y después”',
               'P7': 'P7 · Post testimonio', 'P10': 'P10 · Carrusel “5 señales…”'}
    hoja('Feed · 1080×1350', [(nombres[k], v) for k, v in grupos.items()], REDES / 'revision' / 'hoja-feed.png', 380)

    st = REDES / 'stories'
    rev = REDES / 'revision'
    codigos = ['S1', 'S3', 'S5', 'S7', 'S13']
    hoja('Stories · 1080×1920', [
        ('Finales (hueco del sticker vacío)', [st / f'{c}.png' for c in codigos]),
        ('Guías de revisión (hueco y zonas de interfaz marcados)', [rev / f'{c}-guia.png' for c in codigos]),
        ('S10 · plantilla de respuesta (vacía y ejemplo)', [st / 'S10.png', st / 'S10-ejemplo.png']),
    ], rev / 'hoja-stories.png', 520)

    portadas = sorted((REDES / 'portadas-reels').glob('*.png'), key=lambda p: int(p.stem[1:].split('-')[0]))
    hoja('Portadas de reels · 1080×1920', [('', portadas[:5]), ('', portadas[5:])], rev / 'hoja-portadas.png', 520)
    revision_stickers(gifs, rev / 'hoja-stickers.png')


if __name__ == '__main__':
    main()
