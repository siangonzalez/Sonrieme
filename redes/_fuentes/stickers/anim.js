// Utilidades de animación: cada sticker define setT(t) con t en segundos dentro del loop de 2 s.
const LOOP = 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));           // avance 0..1 de t dentro de [a, b]
const ease = {
  out: p => 1 - Math.pow(1 - p, 3),
  in: p => p * p * p,
  inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
};

// Destello de cuatro puntas: crece, gira y desaparece en `dur` segundos desde `start`
function twinkle(el, t, start, dur = 0.6) {
  const p = (((t - start) % LOOP) + LOOP) % LOOP / dur;
  if (p >= 1) { el.style.transform = 'scale(0)'; return; }
  const s = p < 0.47 ? ease.out(p / 0.47) : 1 - ease.in((p - 0.47) / 0.53);
  el.style.transform = `scale(${s}) rotate(${90 * p}deg)`;
}

// Coloca un destello (centro x, y; tamaño s) e inserta su SVG
function sparkle(x, y, s) {
  const el = document.createElement('div');
  el.className = 'sparkle';
  Object.assign(el.style, { left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px` });
  const id = 'sg' + document.querySelectorAll('.sparkle').length;
  el.innerHTML = `<svg viewBox="-12 -12 24 24"><defs><radialGradient id="${id}">
      <stop offset="0" stop-color="#FFF4D2"/><stop offset="0.45" stop-color="#C9A84C"/><stop offset="1" stop-color="#B8913F"/>
    </radialGradient></defs>
    <path d="M0-12C1.2-3.2 3.2-1.2 12 0C3.2 1.2 1.2 3.2 0 12C-1.2 3.2-3.2 1.2-12 0C-3.2-1.2-1.2-3.2 0-12Z" fill="url(#${id})"/></svg>`;
  document.querySelector('.stage').appendChild(el);
  return el;
}
