// Renderiza las piezas de redes a PNG con Playwright y el Chromium preinstalado.
// Uso (desde la raíz del repo): NODE_PATH="$(npm root -g)" node redes/_fuentes/render.js [cuadros-stickers]
//
// - Cada HTML declara su salida en <body data-out="feed/P2-01.png">; las stories de interacción
//   además en data-guia (versión de revisión con el hueco del sticker marcado).
// - Verifica que ningún texto ni recuadro se salga de los márgenes ni de las zonas seguras.
// - Los stickers se renderizan cuadro a cuadro llamando a setT(t) con fondo transparente.
// Sirve el repo por HTTP local porque Chromium no aplica mask-image a recursos file://.
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');

const SRC = __dirname;
const REDES = path.resolve(SRC, '..');
const REPO = path.resolve(REDES, '..');
const EXECUTABLE = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
                '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };
// Zonas donde debe caber todo el contenido, por formato (x0, y0, x1, y1)
const ZONAS = {
  feed:  [96, 96, 984, 1254],
  story: [96, 250, 984, 1670],   // 250 px libres arriba y abajo para la interfaz
  reel:  [96, 285, 984, 1635],   // recuadro central 4:5 que se ve en el feed
};
const STICKER_FPS = 15, STICKER_MS = 2000;

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(REPO, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end();
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

async function ready(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {
    throw new Error('imagen sin cargar: ' + i.src);
  }))));
}

// Devuelve los textos/recuadros que se salen de la zona permitida
function revisarZona(page, zona) {
  return page.evaluate(([x0, y0, x1, y1]) => {
    const fuera = [];
    const t = 1;  // tolerancia de 1 px por antialiasing
    const check = (r, what) => {
      if (r.width === 0 || r.height === 0) return;
      if (r.left < x0 - t || r.right > x1 + t || r.top < y0 - t || r.bottom > y1 + t)
        fuera.push(`${what} [${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}]`);
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!n.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      for (const r of range.getClientRects()) check(r, `"${n.textContent.trim().slice(0, 40)}"`);
    }
    const cajas = [...document.querySelectorAll('.foto, .pendiente, .hueco, .isotipo, .pregunta, .respuesta, svg, .m img')];
    for (const el of cajas) check(el.getBoundingClientRect(), el.className.baseVal ?? el.className ?? el.tagName);

    // Contador, "Desliza" e isotipo del pie no pueden tocar ningún otro texto ni recuadro
    const cruza = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const pies = [...document.querySelectorAll('.contador, .desliza, .isotipo')];
    const otros = [];
    const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w2.nextNode()) {
      const n = w2.currentNode;
      if (!n.textContent.trim() || pies.some(p => p.contains(n))) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      for (const r of range.getClientRects()) otros.push([r, `"${n.textContent.trim().slice(0, 30)}"`]);
    }
    for (const el of cajas) if (!pies.includes(el) && !pies.some(p => p.contains(el)))
      otros.push([el.getBoundingClientRect(), el.className.baseVal ?? el.className]);
    for (const p of pies)
      for (const [r, what] of otros)
        if (cruza(p.getBoundingClientRect(), r)) fuera.push(`${p.className} choca con ${what}`);
    return fuera;
  }, zona);
}

async function piezas(page, base) {
  const errores = [];
  for (const folder of ['feed', 'stories', 'portadas']) {
    for (const file of fs.readdirSync(path.join(SRC, folder)).filter(f => f.endsWith('.html')).sort()) {
      await page.setViewportSize({ width: 1080, height: 1920 });
      await page.goto(`${base}/redes/_fuentes/${folder}/${file}`);
      const fmt = await page.evaluate(() =>
        document.body.classList.contains('story') ? 'story' : document.body.classList.contains('reel') ? 'reel' : 'feed');
      await page.setViewportSize({ width: 1080, height: fmt === 'feed' ? 1350 : 1920 });
      await ready(page);
      const fuera = await revisarZona(page, ZONAS[fmt]);
      if (fuera.length) errores.push(`${file}: fuera de zona → ${fuera.join('; ')}`);
      const { out, guia } = await page.evaluate(() => ({ out: document.body.dataset.out, guia: document.body.dataset.guia }));
      fs.mkdirSync(path.dirname(path.join(REDES, out)), { recursive: true });
      await page.screenshot({ path: path.join(REDES, out) });
      if (guia) {
        await page.evaluate(() => document.body.classList.add('guia'));
        await page.screenshot({ path: path.join(REDES, guia) });
      }
      console.log(`${folder}/${file} → ${out}${guia ? ' + ' + guia : ''}`);
    }
  }
  return errores;
}

async function stickers(page, base, outRoot) {
  await page.setViewportSize({ width: 500, height: 500 });
  const frames = (STICKER_MS / 1000) * STICKER_FPS;
  for (const file of fs.readdirSync(path.join(SRC, 'stickers')).filter(f => f.endsWith('.html')).sort()) {
    const name = path.basename(file, '.html');
    const dir = path.join(outRoot, name);
    fs.mkdirSync(dir, { recursive: true });
    await page.goto(`${base}/redes/_fuentes/stickers/${file}`);
    await ready(page);
    for (let i = 0; i < frames; i++) {
      await page.evaluate(t => window.setT(t), (i * STICKER_MS) / frames / 1000);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.screenshot({ path: path.join(dir, String(i).padStart(2, '0') + '.png'), omitBackground: true });
    }
    console.log(`stickers/${file} → ${frames} cuadros`);
  }
}

(async () => {
  const framesDir = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'sonrieme-stickers'));
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  try {
    const errores = await piezas(page, base);
    await stickers(page, base, framesDir);
    if (errores.length) {
      console.error('\nREVISAR:\n' + errores.join('\n'));
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    server.close();
  }
})();
