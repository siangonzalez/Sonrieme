// Inserta el SVG del destello en cada .sparkle (evita repetir el marcado en cada sticker)
const SPARKLE_SVG = `
<svg viewBox="-12 -12 24 24">
  <defs>
    <radialGradient id="sg-%ID%">
      <stop offset="0" stop-color="#FFF4D2"/>
      <stop offset="0.45" stop-color="#C9A84C"/>
      <stop offset="1" stop-color="#B8913F"/>
    </radialGradient>
  </defs>
  <path d="M0-12C1.2-3.2 3.2-1.2 12 0C3.2 1.2 1.2 3.2 0 12C-1.2 3.2-3.2 1.2-12 0C-3.2-1.2-1.2-3.2 0-12Z"
        fill="url(#sg-%ID%)"/>
</svg>`;
document.querySelectorAll('.sparkle').forEach((el, i) => {
  el.innerHTML = SPARKLE_SVG.replaceAll('%ID%', i);
});
