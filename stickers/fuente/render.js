// Renderiza los cuadros PNG (fondo transparente) de cada sticker con Playwright/Chromium.
// Uso: NODE_PATH="$(npm root -g)" node render.js <carpeta-salida>
// Congela las animaciones CSS y las posiciona en cada instante del loop (2 s a 15 fps = 30 cuadros).
// Sirve el repo por HTTP local: Chromium no aplica mask-image a recursos file://.
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');

const FPS = 15;
const LOOP_MS = 2000;
const FRAMES = (LOOP_MS / 1000) * FPS;
const REPO = path.resolve(__dirname, '..', '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf' };
const STICKERS = [
  '01-10-anos',
  '02-isotipo',
  '03-creando-sonrisas',
  '04-tu-sonrisa-nos-inspira',
  '05-instagram',
];

(async () => {
  const outRoot = path.resolve(process.argv[2] || 'cuadros');
  const server = http.createServer((req, res) => {
    const file = path.join(REPO, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/stickers/fuente/`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 500, height: 500 }, deviceScaleFactor: 1 });
  for (const name of STICKERS) {
    const outDir = path.join(outRoot, name);
    fs.mkdirSync(outDir, { recursive: true });
    await page.goto(base + name + '.html');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
    // Ningún texto puede salirse de su caja (evita textos recortados contra el borde)
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.text, .handle, .num, .anos')]
      .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className));
    if (overflow.length) throw new Error(`${name}: texto desbordado en ${overflow}`);
    for (let i = 0; i < FRAMES; i++) {
      const t = (i * LOOP_MS) / FRAMES;
      await page.evaluate(t => {
        for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; }
      }, t);
      // Dos frames de pintura para asegurar que el estado sembrado ya está en pantalla
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.screenshot({
        path: path.join(outDir, String(i).padStart(2, '0') + '.png'),
        omitBackground: true,
        clip: { x: 0, y: 0, width: 500, height: 500 },
      });
    }
    console.log(`${name}: ${FRAMES} cuadros`);
  }
  await browser.close();
  server.close();
})();
