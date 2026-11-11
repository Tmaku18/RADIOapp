export type HeadphoneDetection =
  | { kind: 'headphones'; deviceId: string | null; label: string }
  | { kind: 'speakers'; label: string }
  | { kind: 'unknown' };

const SPEAKER_RE =
  /speaker|built-?in|macbook|imac|internal|display audio|hdmi|homepod|soundbar|television|\btv\b/i;
const HEADPHONE_RE =
  /headphone|headset|airpod|earpod|earbud|buds|hands-?free/i;

/** Classify an output-device label. Speaker wins when both patterns match. */
export function classifyAudioOutputLabel(
  label: string,
): 'headphones' | 'speakers' | 'unknown' {
  const text = label.replace(/^default\s*-\s*/i, '').trim();
  if (!text || /^default$/i.test(text) || /^communications$/i.test(text)) {
    return 'unknown';
  }
  const speaker = SPEAKER_RE.test(text);
  const headphone = HEADPHONE_RE.test(text);
  if (speaker && !headphone) return 'speakers';
  if (headphone) return 'headphones';
  if (speaker) return 'speakers';
  return 'unknown';
}

type SelectAudioOutput = (options?: {
  deviceId?: string;
}) => Promise<MediaDeviceInfo>;

export function canSelectAudioOutput(): boolean {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) return false;
  const devices = navigator.mediaDevices as MediaDevices & {
    selectAudioOutput?: SelectAudioOutput;
  };
  return typeof devices.selectAudioOutput === 'function';
}

function audioOutputs(devices: MediaDeviceInfo[]): MediaDeviceInfo[] {
  return devices.filter((device) => device.kind === 'audiooutput');
}

/**
 * Read the current audio output. Prompts for the microphone when [prompt] is
 * set so browsers that hide device labels can reveal them.
 */
export async function detectHeadphoneOutput(options?: {
  prompt?: boolean;
}): Promise<HeadphoneDetection> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return { kind: 'unknown' };
  }
  if (options?.prompt) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      return { kind: 'unknown' };
    }
  }
  const outputs = audioOutputs(await navigator.mediaDevices.enumerateDevices());
  const labeled = outputs.filter((device) => device.label.trim().length > 0);
  if (labeled.length === 0) return { kind: 'unknown' };

  const fallback =
    labeled.find((device) => device.deviceId === 'default') ??
    labeled.find((device) => device.deviceId === 'communications');
  if (fallback) {
    const kind = classifyAudioOutputLabel(fallback.label);
    if (kind === 'headphones') {
      return {
        kind: 'headphones',
        deviceId: fallback.deviceId,
        label: fallback.label,
      };
    }
    if (kind === 'speakers') return { kind: 'speakers', label: fallback.label };
  }

  const headphone = labeled.find(
    (device) => classifyAudioOutputLabel(device.label) === 'headphones',
  );
  const speaker = labeled.find(
    (device) => classifyAudioOutputLabel(device.label) === 'speakers',
  );
  if (headphone && !speaker) {
    return {
      kind: 'headphones',
      deviceId: headphone.deviceId,
      label: headphone.label,
    };
  }
  if (speaker && !headphone) return { kind: 'speakers', label: speaker.label };
  return { kind: 'unknown' };
}

/** Ask the DJ to pick an output. A speaker choice is rejected. */
export async function chooseHeadphoneOutput(): Promise<HeadphoneDetection> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return { kind: 'unknown' };
  }
  const devices = navigator.mediaDevices as MediaDevices & {
    selectAudioOutput?: SelectAudioOutput;
  };
  if (typeof devices.selectAudioOutput !== 'function') {
    return { kind: 'unknown' };
  }
  try {
    const device = await devices.selectAudioOutput();
    const kind = classifyAudioOutputLabel(device.label);
    if (kind === 'speakers') return { kind: 'speakers', label: device.label };
    return {
      kind: 'headphones',
      deviceId: device.deviceId,
      label: device.label || 'Headphones',
    };
  } catch {
    return { kind: 'unknown' };
  }
}
