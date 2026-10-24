import { useEffect, useRef } from "react";
import { isEditableTarget, isModKey } from "@/lib/keyboard";

interface Hotkey {
  /** KeyboardEvent.key, matched case-insensitively (e.g. "Enter", "Escape", "a"). */
  key: string;
  /** Require ⌘ (macOS) / Ctrl (elsewhere). */
  mod?: boolean;
}

interface HotkeyOptions {
  enabled?: boolean;
  /** Fire while focus is in a text field. Defaults to true for mod combos and Escape. */
  allowInInputs?: boolean;
}

/**
 * Window-level keyboard shortcut. Handled events are preventDefault()-ed so a focused
 * button doesn't also activate on the same keypress.
 */
export function useHotkey(hotkeys: Hotkey | Hotkey[], handler: (event: KeyboardEvent) => void, options: HotkeyOptions = {}) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const { enabled = true } = options;
  const keys = (Array.isArray(hotkeys) ? hotkeys : [hotkeys]).map((h) => `${h.mod ? "mod+" : ""}${h.key.toLowerCase()}`).join(",");

  useEffect(() => {
    if (!enabled) return;
    const combos = keys.split(",");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey) return;
      const pressed = `${isModKey(event) ? "mod+" : ""}${event.key.toLowerCase()}`;
      if (!combos.includes(pressed)) return;

      const allowInInputs = options.allowInInputs ?? (pressed.startsWith("mod+") || pressed === "escape");
      if (!allowInInputs && isEditableTarget(event.target)) return;

      event.preventDefault();
      handlerRef.current(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, keys, options.allowInInputs]);
}
