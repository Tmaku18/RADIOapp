import { loadAudioBuffer, startMixedRecording } from '@/lib/social-share';

export type ArtistCreditStyle = 'words' | 'glass' | 'neon' | 'ticket' | 'stamp';

export const ARTIST_CREDIT_STYLES: { id: ArtistCreditStyle; label: string }[] = [
  { id: 'words', label: 'Words' },
  { id: 'glass', label: 'Glass' },
  { id: 'neon', label: 'Neon' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'stamp', label: 'Stamp' },
];

const CYAN = '#22d3ee';

export type ArtistCreditPlacement = {
  style: ArtistCreditStyle;
  x: number;
  y: number;
  scale: number;
  title: string;
  artist: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function songLine(title: string) {
  const trimmed = title.trim();
  return trimmed || 'This song';
}

function artistLine(artist: string) {
  const trimmed = artist.trim();
  return trimmed || 'Networx Radio';
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function drawArtistCredit(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  credit: ArtistCreditPlacement,
) {
  if (width < 8 || height < 8) return;
  const song = songLine(credit.title);
  const name = artistLine(credit.artist);
  const centerX = width * clamp(credit.x, 0.08, 0.92);
  const centerY = height * clamp(credit.y, 0.08, 0.92);
  const unit = clamp(Math.min(width, height) * 0.042 * credit.scale, 11, 46);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  switch (credit.style) {
    case 'words':
      drawWords(ctx, centerX, centerY, unit, width, song, name);
      break;
    case 'glass':
      drawCard(ctx, centerX, centerY, unit, width, song, {
        fill: 'rgba(10,10,12,0.76)',
        kicker: 'NETWORX',
        kickerColor: CYAN,
        credit: name,
      });
      break;
    case 'neon':
      drawCard(ctx, centerX, centerY, unit, width, song, {
        fill: 'rgba(5,7,10,0.55)',
        stroke: CYAN,
        kicker: 'NOW PLAYING',
        kickerColor: CYAN,
        credit: `by ${name}`,
        creditColor: CYAN,
      });
      break;
    case 'ticket':
      drawTicket(ctx, centerX, centerY, unit, width, song, name);
      break;
    case 'stamp':
      drawStamp(ctx, centerX, centerY, unit, Math.min(width, height), song, name);
      break;
    default:
      break;
  }
  ctx.restore();
}

function drawWords(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  unit: number,
  width: number,
  song: string,
  name: string,
) {
  ctx.font = `800 ${unit * 1.15}px sans-serif`;
  const title = fitText(ctx, song, width * 0.78);
  ctx.font = `600 ${unit * 0.78}px sans-serif`;
  const artist = fitText(ctx, name, width * 0.78);
  const titleSize = unit * 1.15;
  const artistSize = unit * 0.78;
  const gap = unit * 0.28;
  const block = titleSize + gap + artistSize;
  const top = cy - block / 2;
  ctx.font = `800 ${titleSize}px sans-serif`;
  shadowed(ctx, title, cx, top);
  ctx.font = `600 ${artistSize}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  shadowed(ctx, artist, cx, top + titleSize + gap, 'rgba(255,255,255,0.78)');
}

function shadowed(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color = '#fff',
) {
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillText(text, x, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  unit: number,
  width: number,
  song: string,
  look: {
    fill: string;
    stroke?: string;
    kicker: string;
    kickerColor: string;
    credit: string;
    creditColor?: string;
  },
) {
  const max = width * 0.7;
  ctx.font = `700 ${unit * 0.48}px sans-serif`;
  const kicker = fitText(ctx, look.kicker, max);
  const kickerW = ctx.measureText(kicker).width;
  ctx.font = `800 ${unit * 0.95}px sans-serif`;
  const title = fitText(ctx, song, max);
  const titleW = ctx.measureText(title).width;
  ctx.font = `600 ${unit * 0.68}px sans-serif`;
  const credit = fitText(ctx, look.credit, max);
  const creditW = ctx.measureText(credit).width;
  const padX = unit * 0.85;
  const padY = unit * 0.55;
  const gap = unit * 0.16;
  const boxW = Math.max(kickerW, titleW, creditW) + padX * 2;
  const boxH = padY * 2 + unit * 0.48 + unit * 0.95 + unit * 0.68 + gap * 2;
  const x = cx - boxW / 2;
  const y = cy - boxH / 2;
  roundRect(ctx, x, y, boxW, boxH, unit * 0.7);
  ctx.fillStyle = look.fill;
  ctx.fill();
  if (look.stroke) {
    ctx.strokeStyle = look.stroke;
    ctx.lineWidth = clamp(unit * 0.08, 1.5, 3.5);
    ctx.stroke();
  }
  let line = y + padY;
  ctx.font = `700 ${unit * 0.48}px sans-serif`;
  ctx.fillStyle = look.kickerColor;
  ctx.fillText(kicker, cx, line);
  line += unit * 0.48 + gap;
  ctx.font = `800 ${unit * 0.95}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.fillText(title, cx, line);
  line += unit * 0.95 + gap;
  ctx.font = `600 ${unit * 0.68}px sans-serif`;
  ctx.fillStyle = look.creditColor ?? 'rgba(255,255,255,0.78)';
  ctx.fillText(credit, cx, line);
}

function drawTicket(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  unit: number,
  width: number,
  song: string,
  name: string,
) {
  const max = width * 0.62;
  ctx.font = `800 ${unit * 0.95}px sans-serif`;
  const title = fitText(ctx, song, max);
  const titleW = ctx.measureText(title).width;
  ctx.font = `600 ${unit * 0.62}px sans-serif`;
  const credit = fitText(ctx, `${name} · Networx Radio`, max);
  const creditW = ctx.measureText(credit).width;
  const bar = unit * 0.28;
  const padX = unit * 0.7;
  const padY = unit * 0.55;
  const gap = unit * 0.18;
  const boxW = bar + padX * 2 + Math.max(titleW, creditW);
  const boxH = padY * 2 + unit * 0.95 + unit * 0.62 + gap;
  const x = cx - boxW / 2;
  const y = cy - boxH / 2;
  roundRect(ctx, x, y, boxW, boxH, unit * 0.45);
  ctx.fillStyle = 'rgba(8,8,12,0.9)';
  ctx.fill();
  roundRect(ctx, x, y, bar + unit * 0.2, boxH, unit * 0.45);
  ctx.fillStyle = CYAN;
  ctx.fill();
  ctx.textAlign = 'left';
  const textX = x + bar + padX;
  ctx.font = `800 ${unit * 0.95}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.fillText(title, textX, y + padY);
  ctx.font = `600 ${unit * 0.62}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.fillText(credit, textX, y + padY + unit * 0.95 + gap);
  ctx.textAlign = 'center';
}

function drawStamp(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  unit: number,
  shortest: number,
  song: string,
  name: string,
) {
  const max = shortest * 0.42;
  ctx.font = `800 ${unit * 0.46}px sans-serif`;
  const kicker = fitText(ctx, 'ON AIR', max);
  const kickerW = ctx.measureText(kicker).width;
  ctx.font = `800 ${unit * 0.78}px sans-serif`;
  const title = fitText(ctx, song, max);
  const titleW = ctx.measureText(title).width;
  ctx.font = `600 ${unit * 0.55}px sans-serif`;
  const artist = fitText(ctx, name, max);
  const artistW = ctx.measureText(artist).width;
  const radius = clamp(
    Math.max(kickerW, titleW, artistW) / 2 + unit * 0.9,
    unit * 2.4,
    shortest * 0.34,
  );
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8,8,12,0.72)';
  ctx.fill();
  ctx.lineWidth = clamp(unit * 0.09, 1.5, 3);
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, radius - unit * 0.22, 0, Math.PI * 2);
  ctx.lineWidth = clamp(unit * 0.045, 1, 2);
  ctx.strokeStyle = CYAN;
  ctx.stroke();
  const block = unit * 0.46 + unit * 0.78 + unit * 0.55 + unit * 0.2;
  let y = cy - block / 2;
  ctx.font = `800 ${unit * 0.46}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.fillText(kicker, cx, y);
  y += unit * 0.46 + unit * 0.08;
  ctx.font = `800 ${unit * 0.78}px sans-serif`;
  ctx.fillStyle = CYAN;
  ctx.fillText(title, cx, y);
  y += unit * 0.78 + unit * 0.06;
  ctx.font = `600 ${unit * 0.55}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.fillText(artist, cx, y);
}

function waitFor(video: HTMLVideoElement, event: string) {
  return new Promise<void>((resolve, reject) => {
    const ok = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error('Could not add the artist credit.'));
    };
    const cleanup = () => {
      video.removeEventListener(event, ok);
      video.removeEventListener('error', fail);
    };
    video.addEventListener(event, ok, { once: true });
    video.addEventListener('error', fail, { once: true });
  });
}

/// Draws the credit onto a copy of the clip and keeps the song audio.
export async function burnArtistCredit(file: File, credit: ArtistCreditPlacement): Promise<File> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  try {
    await waitFor(video, 'loadedmetadata');
    const width = video.videoWidth || 720;
    const height = video.videoHeight || 1280;
    const duration = Math.min(
      15,
      Number.isFinite(video.duration) && video.duration > 0.4 ? video.duration : 15,
    );
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof canvas.captureStream !== 'function') {
      throw new Error('Could not add the artist credit.');
    }
    const buffer = await loadAudioBuffer(url);
    let frame = 0;
    const draw = () => {
      ctx.drawImage(video, 0, 0, width, height);
      drawArtistCredit(ctx, width, height, credit);
      frame = requestAnimationFrame(draw);
    };
    draw();
    const track = canvas.captureStream(30).getVideoTracks()[0];
    if (!track) throw new Error('Could not add the artist credit.');
    const recordingPromise = startMixedRecording({
      videoTrack: track,
      audioBuffer: buffer,
      offsetSeconds: 0,
      durationSeconds: duration,
      audible: false,
    });
    const playPromise = video.play();
    const [recording] = await Promise.all([recordingPromise, playPromise]);
    await new Promise((resolve) => window.setTimeout(resolve, duration * 1000 + 200));
    cancelAnimationFrame(frame);
    video.pause();
    try {
      return await recording.stop();
    } finally {
      track.stop();
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
