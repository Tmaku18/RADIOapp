// Ensures only one short "preview" media element (clip / sample trimmers) plays
// at a time across the app. Without this, a Discover-clip preview and a
// Sample-clip preview (or two clip windows on the upload page) can play over
// each other. Any registered preview that starts playing pauses the others.

let currentPreview: HTMLMediaElement | null = null;

/**
 * Register [el] as an exclusive preview. Whenever it starts playing, any other
 * registered preview that is currently playing is paused. Returns a cleanup
 * function that unbinds the listener and forgets the element.
 */
export function bindExclusivePreview(el: HTMLMediaElement): () => void {
  const onPlay = () => {
    if (currentPreview && currentPreview !== el && !currentPreview.paused) {
      try {
        currentPreview.pause();
      } catch {
        /* ignore */
      }
    }
    currentPreview = el;
  };

  el.addEventListener('play', onPlay);

  return () => {
    el.removeEventListener('play', onPlay);
    if (currentPreview === el) currentPreview = null;
  };
}
