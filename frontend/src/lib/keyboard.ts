const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Display label for the platform's primary modifier key. */
export const MOD_KEY_LABEL = isMac ? "⌘" : "Ctrl";

/** True for ⌘ on macOS and Ctrl elsewhere. */
export const isModKey = (event: KeyboardEvent | React.KeyboardEvent): boolean => (isMac ? event.metaKey : event.ctrlKey);

/** True when the event target accepts text input, where plain-key shortcuts must not fire. */
export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
};
