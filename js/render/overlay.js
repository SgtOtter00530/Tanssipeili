// Tikku-ukon piirto canvasiin videon tai kamerakuvan päälle.
import { SEGMENTS, DRAW_EXTRA, LM, point } from '../core/skeleton.js';
import { MIN_VIS } from '../core/compare.js';

export const COLORS = Object.freeze({
  green: '#2ecc71',
  yellow: '#f1c40f',
  red: '#e74c3c',
  unknown: '#9aa0a6',
  ghost: 'rgba(80,160,255,0.75)',
});

const NEUTRAL = '#ffffff';
const OUTLINE = 'rgba(0,0,0,0.4)';
// Väri ei ole ainoa vihje: mitä suurempi ero, sitä paksumpi viiva.
const WIDTH_FACTOR = { green: 1, yellow: 1.3, red: 1.6, unknown: 1 };
const SEVERITY = { green: 1, yellow: 2, red: 3 };
const GHOST_WIDTH = 3;

const JOINTS = [
  LM.NOSE, LM.L_SHOULDER, LM.R_SHOULDER, LM.L_ELBOW, LM.R_ELBOW, LM.L_WRIST, LM.R_WRIST,
  LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE,
];
const JOINT_SEGMENTS = new Map(JOINTS.map((j) => [j, SEGMENTS.filter((s) => s.from === j || s.to === j).map((s) => s.id)]));

function line(ctx, a, b, color, width, dashed) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = dashed ? 'butt' : 'round';
  ctx.stroke();
}

function disc(ctx, p, r, color) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../core/skeleton.js').Landmark[]} lm
 * @param {{width: number, height: number, levels?: Record<string, import('../core/skeleton.js').Level>|null, variant: 'user'|'ghost'}} opts
 */
export function drawSkeleton(ctx, lm, opts) {
  const { width, height, variant } = opts;
  const levels = opts.levels || null;
  const base = Math.max(3, width / 120);
  const toPx = (p) => ({ x: p.x * width, y: p.y * height, v: p.v });
  const ghost = variant === 'ghost';
  ctx.save();

  const drawSegment = (seg, level) => {
    const a = toPx(point(lm, seg.from));
    const b = toPx(point(lm, seg.to));
    const visible = a.v >= MIN_VIS && b.v >= MIN_VIS;
    if (ghost) {
      // Malli piirretään leveänä nauhana, jotta se näkyy oman ukon takaa silloinkin, kun asennot osuvat kohdakkain.
      if (visible) line(ctx, a, b, COLORS.ghost, base * GHOST_WIDTH, false);
      return;
    }
    // Oma ukko: epävarma tai arvioimaton segmentti on aina harmaa katkoviiva.
    const effective = !visible ? 'unknown' : level;
    if (effective === 'unknown') {
      ctx.setLineDash([base * 2, base * 2]);
      line(ctx, a, b, COLORS.unknown, base, true);
      ctx.setLineDash([]);
      return;
    }
    const w = base * (effective ? WIDTH_FACTOR[effective] : 1);
    line(ctx, a, b, OUTLINE, w + 3, false);
    line(ctx, a, b, effective ? COLORS[effective] : NEUTRAL, w, false);
  };

  for (const seg of DRAW_EXTRA) drawSegment(seg, null);
  for (const seg of SEGMENTS) drawSegment(seg, levels ? levels[seg.id] || 'unknown' : null);

  for (const j of JOINTS) {
    const p = toPx(lm[j]);
    const r = base * (j === LM.NOSE ? 2.2 : 1.2);
    if (ghost) {
      if (p.v >= MIN_VIS && j === LM.NOSE) disc(ctx, p, r * 1.5, COLORS.ghost);
      continue;
    }
    let level = null;
    if (p.v < MIN_VIS) {
      level = 'unknown';
    } else if (levels) {
      let worst = 0;
      for (const id of JOINT_SEGMENTS.get(j)) worst = Math.max(worst, SEVERITY[levels[id]] || 0);
      level = worst === 3 ? 'red' : worst === 2 ? 'yellow' : worst === 1 ? 'green' : 'unknown';
    }
    if (level !== 'unknown') disc(ctx, p, r + 1.5, OUTLINE);
    disc(ctx, p, r, level ? COLORS[level] : NEUTRAL);
    if (level === 'red') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + base, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = Math.max(1.5, base * 0.5);
      ctx.stroke();
    }
  }
  ctx.restore();
}
