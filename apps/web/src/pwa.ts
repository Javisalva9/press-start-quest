/** True when running as the installed app (home screen icon), not in a browser tab. */
export function isInstalledApp(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Older iPhones only report it this way.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** True on phones and tablets (a finger, not a mouse, is the main pointer). */
export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}
