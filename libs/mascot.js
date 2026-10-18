export const COLORS = [
  '#2f6bff',
  '#7a3dff',
  '#ff3b8d',
  '#ff4d2e',
  '#ff9100',
  '#ffc400',
  '#19d38a',
  '#00c2d1',
  '#d63bff',
  '#1c1c24',
  '#ffffff',
];

export const BODIES = ['circle', 'rectangle', 'drop', 'cloud', 'flower', 'triangle', 'hexagon', 'pebble'];

export const EYES = ['pill', 'oval', 'happy', 'sleepy'];

export const MOUTHS = ['none', 'smile', 'flat', 'open'];

export const LOOKS = ['none', 'antenna', 'cap', 'sprout'];

export const FINISHES = ['glossy', 'matte', 'duo'];

export const EYE_COLORS = ['auto', '#17171c', '#ffffff'];

export const DEFAULT_MASCOT = {
  color: '#2f6bff',
  accent: null,
  body: 'circle',
  look: 'none',
  finish: 'glossy',
  eyes: 'pill',
  mouth: 'none',
  eyeColor: 'auto',
  blink: false,
};

const LEGACY_EYES = { pills: 'pill', boxes: 'pill', triangles: 'pill', dots: 'oval', wide: 'oval' };
const LEGACY_FINISH = { shine: 'glossy', flat: 'matte' };

// ey/g = eye y / half gap, top = top of body, hl = specular spot
const LAYOUT = {
  circle: { ey: 104, g: 20, top: 42, hl: [72, 72] },
  rectangle: { ey: 103, g: 22, top: 42, hl: [64, 68] },
  drop: { ey: 128, g: 18, top: 34, hl: [78, 104] },
  cloud: { ey: 106, g: 20, top: 44, hl: [80, 80] },
  flower: { ey: 106, g: 18, top: 36, hl: [80, 86] },
  triangle: { ey: 124, g: 16, top: 46, hl: [90, 96] },
  hexagon: { ey: 106, g: 22, top: 42, hl: [70, 78] },
  pebble: { ey: 104, g: 21, top: 40, hl: [66, 74] },
};

function roundPoly(pts, r) {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const toward = (q) => {
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(r, len / 2) / len;
      return [p[0] + dx * k, p[1] + dy * k];
    };
    const s = toward(a);
    const e = toward(b);
    d += `${i === 0 ? 'M' : 'L'}${s[0].toFixed(1)} ${s[1].toFixed(1)}Q${p[0]} ${p[1]} ${e[0].toFixed(1)} ${e[1].toFixed(1)}`;
  }
  return d + 'Z';
}

const TRIANGLE = roundPoly([[100, 44], [160, 152], [40, 152]], 22);
const HEXAGON = roundPoly(
  [[100, 42], [153.7, 73], [153.7, 135], [100, 166], [46.3, 135], [46.3, 73]],
  16
);
const DROP = 'M100 34C112 52 156 92 156 126A56 56 0 0 1 44 126C44 92 88 52 100 34Z';
const PEBBLE =
  'M100 40C140 38 170 70 164 112C158 150 130 168 96 166C58 164 36 138 40 98C44 62 66 42 100 40Z';
const CLOUD = [
  [100, 106, 44],
  [68, 74, 30],
  [132, 74, 30],
  [68, 138, 30],
  [132, 138, 30],
];
const FLOWER = [
  [100, 106, 40],
  [100, 64, 28],
  [100, 148, 28],
  [58, 106, 28],
  [142, 106, 28],
];

function safeHex(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const mix = (v) => Math.round((target - v) * p + v);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// grow > 0 inflates the shape (used for the outline on white bodies)
function bodyMarkup(type, fill, grow = 0) {
  const a = grow ? `fill="${fill}" stroke="${fill}" stroke-width="${grow}" stroke-linejoin="round"` : `fill="${fill}"`;
  switch (type) {
    case 'rectangle':
      return `<rect x="38" y="42" width="124" height="124" rx="42" ${a}/>`;
    case 'drop':
      return `<path d="${DROP}" ${a}/>`;
    case 'pebble':
      return `<path d="${PEBBLE}" ${a}/>`;
    case 'triangle':
      return `<path d="${TRIANGLE}" ${a}/>`;
    case 'hexagon':
      return `<path d="${HEXAGON}" ${a}/>`;
    case 'cloud':
      return CLOUD.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${a}/>`).join('');
    case 'flower':
      return FLOWER.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${a}/>`).join('');
    default:
      return `<circle cx="100" cy="104" r="62" ${a}/>`;
  }
}

function eyesMarkup(style, L, ink, blink, dx) {
  const xs = [100 - L.g + dx, 100 + L.g + dx];
  const ey = L.ey;
  const glint = lum(ink) < 0.5;
  const spark = (x, y, r) => (glint ? `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="0.92"/>` : '');

  if (style === 'happy') {
    return xs
      .map(
        (x) =>
          `<path d="M${x - 9} ${ey + 5}Q${x} ${ey - 10} ${x + 9} ${ey + 5}" fill="none" stroke="${ink}" stroke-width="5.5" stroke-linecap="round"/>`
      )
      .join('');
  }
  if (blink) {
    return xs
      .map((x) => `<rect x="${x - 8.5}" y="${ey - 2.5}" width="17" height="5" rx="2.5" fill="${ink}"/>`)
      .join('');
  }
  if (style === 'sleepy') {
    return xs
      .map((x) => `<path d="M${x - 9} ${ey - 2}A9 9.5 0 0 0 ${x + 9} ${ey - 2}Z" fill="${ink}"/>`)
      .join('');
  }
  if (style === 'oval') {
    return xs
      .map(
        (x) =>
          `<ellipse cx="${x}" cy="${ey}" rx="9" ry="12.5" fill="${ink}"/>` + spark(x - 2.8, ey - 5.5, 2.8)
      )
      .join('');
  }
  return xs
    .map(
      (x) =>
        `<g transform="rotate(7 ${x} ${ey})">` +
        `<rect x="${x - 5.5}" y="${ey - 13}" width="11" height="26" rx="5.5" fill="${ink}"/>` +
        spark(x - 1.4, ey - 7, 2.4) +
        `</g>`
    )
    .join('');
}

function mouthMarkup(style, L, ink, dx) {
  const y = L.ey + 25;
  const x = 100 + dx;
  if (style === 'smile') {
    return `<path d="M${x - 8} ${y}Q${x} ${y + 9} ${x + 8} ${y}" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (style === 'flat') {
    return `<rect x="${x - 7}" y="${y - 2}" width="14" height="4" rx="2" fill="${ink}"/>`;
  }
  if (style === 'open') {
    return `<path d="M${x - 7} ${y - 2}H${x + 7}A7 7 0 0 1 ${x - 7} ${y - 2}Z" fill="${ink}"/>`;
  }
  return '';
}

function lookMarkup(type, L, color, accent) {
  const t = L.top;
  if (type === 'antenna') {
    const stem = shade(color, -0.45);
    return (
      `<path d="M100 ${t + 4}V${t - 20}" fill="none" stroke="${stem}" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="100" cy="${t - 28}" r="8.5" fill="${accent}"/>` +
      `<circle cx="97.5" cy="${t - 30.5}" r="2.6" fill="#ffffff" opacity="0.85"/>`
    );
  }
  if (type === 'cap') {
    const dark = lum(color) < 0.2;
    const board = dark ? '#ececf2' : '#22222a';
    const band = dark ? '#c9c9d2' : '#3a3a42';
    return (
      `<g transform="rotate(-10 100 ${t})">` +
      `<path d="M78 ${t + 2}v14c0 7 44 7 44 0v-14z" fill="${band}"/>` +
      `<path d="M100 ${t - 20}L152 ${t - 2}L100 ${t + 14}L48 ${t - 2}Z" fill="${board}" stroke="${board}" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="M140 ${t + 1}V${t + 20}" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="140" cy="${t + 22}" r="4" fill="${accent}"/>` +
      `</g>`
    );
  }
  if (type === 'sprout') {
    return (
      `<path d="M100 ${t + 4}V${t - 16}" fill="none" stroke="#2fb36a" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M100 ${t - 16}Q80 ${t - 34} 64 ${t - 22}Q80 ${t - 10} 100 ${t - 16}Z" fill="#3ddc84"/>` +
      `<path d="M100 ${t - 16}Q120 ${t - 34} 136 ${t - 22}Q120 ${t - 10} 100 ${t - 16}Z" fill="#3ddc84"/>`
    );
  }
  return '';
}

export function buildMascotSvg(config, size = 256) {
  const c = { ...DEFAULT_MASCOT, ...(config || {}) };
  const color = safeHex(c.color, DEFAULT_MASCOT.color);
  const body = BODIES.includes(c.body) ? c.body : 'circle';

  const rawLook = (config && (config.look ?? config.accessory)) ?? 'none';
  const look = LOOKS.includes(rawLook) ? rawLook : 'none';
  const rawFinish = LEGACY_FINISH[c.finish] || c.finish;
  const finish = FINISHES.includes(rawFinish) ? rawFinish : 'glossy';

  const rawEyes = LEGACY_EYES[c.eyes] || c.eyes;
  const eyeStyle = EYES.includes(rawEyes) ? rawEyes : 'pill';
  const mouthStyle = MOUTHS.includes(c.mouth) ? c.mouth : 'none';

  const light = lum(color);
  const autoInk = light > 0.55 ? '#17171c' : '#ffffff';
  const ink = c.eyeColor === 'auto' ? autoInk : safeHex(c.eyeColor, autoInk);
  const accent = safeHex(c.accent, '#ffb020');

  const px = Math.max(16, Math.min(1024, Math.round(Number(size) || 256)));
  const L = LAYOUT[body];
  const dx = Math.max(-8, Math.min(8, Number(c.gaze) || 0)) * 0.7;
  const id = `m${body}${color.slice(1)}${finish}`;
  const glossy = finish !== 'matte';
  const t = L.top;

  const defs =
    `<defs>` +
    `<linearGradient id="${id}b" gradientUnits="userSpaceOnUse" x1="0" y1="34" x2="0" y2="170">` +
    `<stop offset="0" stop-color="${shade(color, 0.2)}"/>` +
    `<stop offset="0.5" stop-color="${color}"/>` +
    `<stop offset="1" stop-color="${shade(color, -0.2)}"/>` +
    `</linearGradient>` +
    `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0.85"/>` +
    `<stop offset="1" stop-color="#ffffff" stop-opacity="0.04"/>` +
    `</linearGradient>` +
    `<clipPath id="${id}c">${bodyMarkup(body, '#000')}</clipPath>` +
    `</defs>`;

  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -12 208 208" width="${px}" height="${px}">`, defs];

  parts.push(lookMarkup(look === 'cap' ? 'none' : look, L, color, accent));

  if (finish === 'duo') {
    parts.push(`<g transform="translate(5 7)">${bodyMarkup(body, shade(color, -0.3))}</g>`);
  }
  if (light > 0.88) {
    parts.push(bodyMarkup(body, '#d9d9e4', 5));
  }
  parts.push(bodyMarkup(body, glossy ? `url(#${id}b)` : color));

  if (glossy) {
    const [hx, hy] = L.hl;
    parts.push(
      `<g clip-path="url(#${id}c)">` +
        `<ellipse cx="100" cy="${t + 2}" rx="66" ry="40" fill="url(#${id}g)"/>` +
        `</g>` +
        `<ellipse cx="${hx}" cy="${hy}" rx="11" ry="6" fill="#ffffff" opacity="0.95" transform="rotate(-40 ${hx} ${hy})"/>` +
        `<circle cx="${hx + 15}" cy="${hy + 12}" r="2.8" fill="#ffffff" opacity="0.9"/>`
    );
  }

  parts.push(eyesMarkup(eyeStyle, L, ink, !!c.blink, dx));
  parts.push(mouthMarkup(mouthStyle, L, ink, dx));

  if (look === 'cap') parts.push(lookMarkup('cap', L, color, accent));

  parts.push('</svg>');
  return parts.join('');
}