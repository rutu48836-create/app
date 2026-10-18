
import {
  DEFAULT_MASCOT,
  COLORS,
  BODIES,
  EYES,
  LOOKS,
  FINISHES,
} from './mascot';

const pick = (value, list, fallback) => (list.includes(value) ? value : fallback);

export function normalizeMascot(raw) {
  let cfg = raw;

  if (typeof cfg === 'string') {
    try {
      cfg = JSON.parse(cfg);
    } catch {
      cfg = null;
    }
  }

  if (!cfg || typeof cfg !== 'object') return { ...DEFAULT_MASCOT };

  return {
    ...DEFAULT_MASCOT,
    ...cfg,
    body: pick(cfg.body, BODIES, DEFAULT_MASCOT.body),
    color: pick(cfg.color, COLORS, DEFAULT_MASCOT.color),
    eyes: pick(cfg.eyes, EYES, DEFAULT_MASCOT.eyes),
    look: pick(cfg.look, LOOKS, DEFAULT_MASCOT.look),
    finish: pick(cfg.finish, FINISHES, DEFAULT_MASCOT.finish),
  };
}