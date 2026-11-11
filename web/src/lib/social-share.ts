const CLIP_SECONDS = 15;

export const SOCIAL_TARGETS = [
  { id: 'instagram_story', label: 'Instagram Story' },
  { id: 'instagram_post', label: 'Instagram Post' },
  { id: 'snapchat_story', label: 'Snapchat Story' },
  { id: 'snapchat_chat', label: 'Snapchat friends' },
  { id: 'tiktok_story', label: 'TikTok Story' },
  { id: 'tiktok_post', label: 'TikTok Post' },
] as const;

export type SocialTargetId = (typeof SOCIAL_TARGETS)[number]['id'];

export function pickRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export async function loadAudioBuffer(url: string): Promise<AudioBuffer> {
  if (url.toLowerCase().includes('.m3u8')) {
    throw new Error('This live stream cannot be saved into a clip.');
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not download the song.');
  const bytes = await response.arrayBuffer();
  const head = new TextDecoder().decode(bytes.slice(0, 7));
  if (head.startsWith('#EXTM3U')) {
    throw new Error('This live stream cannot be saved into a clip.');
  }
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(bytes.slice(0));
  } catch {
    throw new Error('Could not read that song.');
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

function blobToFile(blob: Blob): File {
  const type = blob.type || 'video/mp4';
  const ext = type.includes('webm') ? 'webm' : type.includes('quicktime') ? 'mov' : 'mp4';
  return new File([blob], `networx-clip.${ext}`, { type });
}

export async function startMixedRecording(input: {
  videoTrack: MediaStreamTrack;
  audioBuffer: AudioBuffer;
  offsetSeconds: number;
  durationSeconds: number;
  audible?: boolean;
  /** Live microphone. Mixed into the file and kept off the speakers. */
  micStream?: MediaStream | null;
}): Promise<{ stop: () => Promise<File>; cancel: () => void }> {
  const ctx = new AudioContext();
  await ctx.resume();
  const dest = ctx.createMediaStreamDestination();
  const source = ctx.createBufferSource();
  source.buffer = input.audioBuffer;
  const micTracks =
    input.micStream?.getAudioTracks().filter((track) => track.readyState === 'live') ?? [];
  const songGain = ctx.createGain();
  songGain.gain.value = micTracks.length > 0 ? 0.55 : 1;
  source.connect(songGain);
  songGain.connect(dest);
  if (input.audible !== false) source.connect(ctx.destination);
  if (micTracks.length > 0) {
    const mic = ctx.createMediaStreamSource(new MediaStream(micTracks));
    mic.connect(dest);
  }
  let offset = input.offsetSeconds;
  if (offset >= input.audioBuffer.duration - 0.25) {
    offset = Math.max(0, input.audioBuffer.duration - input.durationSeconds);
  }
  const duration = Math.min(
    input.durationSeconds,
    Math.max(0.5, input.audioBuffer.duration - offset),
  );
  source.start(0, Math.max(0, offset), duration);

  const mime = pickRecorderMime();
  const stream = new MediaStream([
    input.videoTrack,
    ...dest.stream.getAudioTracks(),
  ]);
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: recorder.mimeType || mime || 'video/webm' }));
    recorder.onerror = () => reject(new Error('Recording failed.'));
  });
  recorder.start(250);

  let stopped = false;
  const stop = async () => {
    if (!stopped) {
      stopped = true;
      if (recorder.state !== 'inactive') recorder.stop();
      try {
        source.stop();
      } catch {
        // The slice already ended.
      }
    }
    const blob = await done;
    await ctx.close().catch(() => undefined);
    return blobToFile(blob);
  };
  const cancel = () => {
    if (stopped) return;
    stopped = true;
    if (recorder.state !== 'inactive') recorder.stop();
    try {
      source.stop();
    } catch {
      // Already stopped.
    }
    void ctx.close().catch(() => undefined);
  };
  return { stop, cancel };
}

function coverRect(
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const w = sourceWidth * scale;
  const h = sourceHeight * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}

export function startMirrorLoop(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;
  canvas.width = 720;
  canvas.height = 1280;
  let frame = 0;
  const draw = () => {
    const sw = video.videoWidth || 720;
    const sh = video.videoHeight || 1280;
    const fitted = coverRect(sw, sh, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, fitted.x, fitted.y, fitted.w, fitted.h);
    ctx.restore();
    frame = requestAnimationFrame(draw);
  };
  draw();
  return () => cancelAnimationFrame(frame);
}

async function drawStill(
  canvas: HTMLCanvasElement,
  imageUrl: string | null,
  title: string,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the photo.');
  canvas.width = 720;
  canvas.height = 1280;
  ctx.fillStyle = '#07070a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(0, 0, canvas.width, 8);
  if (imageUrl) {
    try {
      const response = await fetch(imageUrl);
      if (response.ok) {
        const bitmap = await createImageBitmap(await response.blob());
        const fitted = coverRect(bitmap.width, bitmap.height, canvas.width, canvas.height);
        ctx.drawImage(bitmap, fitted.x, fitted.y, fitted.w, fitted.h);
        bitmap.close();
      }
    } catch {
      // A title card is enough when the picture cannot be fetched.
    }
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 36px sans-serif';
  ctx.fillText(title || 'NETWORX Radio', 48, 1180, 624);
}

export async function recordStillWithAudio(input: {
  imageUrl: string | null;
  audioUrl: string;
  title: string;
  durationSeconds?: number;
}): Promise<File> {
  const canvas = document.createElement('canvas');
  await drawStill(canvas, input.imageUrl, input.title);
  if (typeof canvas.captureStream !== 'function') {
    throw new Error('This browser cannot save the song into a clip.');
  }
  const buffer = await loadAudioBuffer(input.audioUrl);
  const track = canvas.captureStream(30).getVideoTracks()[0];
  if (!track) throw new Error('Could not prepare the photo.');
  const seconds = Math.min(CLIP_SECONDS, input.durationSeconds ?? CLIP_SECONDS);
  const secondsToKeep = Math.max(1, seconds);
  const recording = await startMixedRecording({
    videoTrack: track,
    audioBuffer: buffer,
    offsetSeconds: 0,
    durationSeconds: secondsToKeep,
    audible: false,
  });
  await new Promise((resolve) => window.setTimeout(resolve, secondsToKeep * 1000));
  try {
    return await recording.stop();
  } finally {
    track.stop();
  }
}

async function fetchAsFile(url: string, fallbackName: string): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not download this clip.');
  const blob = await response.blob();
  const ext = blob.type.includes('webm')
    ? 'webm'
    : blob.type.includes('png')
      ? 'png'
      : blob.type.includes('jpeg')
        ? 'jpg'
        : blob.type.includes('quicktime')
          ? 'mov'
          : fallbackName.split('.').pop() || 'mp4';
  const base = fallbackName.replace(/\.[a-z0-9]+$/i, '');
  return new File([blob], `${base}.${ext}`, { type: blob.type || 'application/octet-stream' });
}

export async function buildClipFile(input: {
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio';
  audioUrl?: string | null;
  title?: string;
}): Promise<File> {
  const media = input.mediaUrl.trim();
  const audio = input.audioUrl?.trim() || '';
  if (!media && !audio) throw new Error('Nothing to share.');
  if (input.mediaType === 'video' && media) {
    const video = await fetchAsFile(media, 'networx-clip.mp4');
    if (!audio) return video;
    return video;
  }
  if (audio) {
    return recordStillWithAudio({
      imageUrl: media || null,
      audioUrl: audio,
      title: input.title || 'NETWORX Radio',
    });
  }
  return fetchAsFile(media, 'networx-photo.jpg');
}

export async function shareMediaFile(
  file: File,
  text: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const payload: ShareData = { files: [file], text, title: 'NETWORX Radio' };
  if (typeof navigator.canShare === 'function' && navigator.canShare(payload)) {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 15000);
  return 'downloaded';
}
