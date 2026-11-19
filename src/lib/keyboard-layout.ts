export interface KeyDef {
  code: string;
  label: string;
  subLabel?: string;
  width?: number;
  colSpan?: number;
  rowSpan?: number;
}

export type KeySlot =
  | { kind: "key"; key: KeyDef }
  | { kind: "spacer"; width: number };

const k = (
  code: string,
  label: string,
  opts?: Omit<KeyDef, "code" | "label">
): KeySlot => ({
  kind: "key",
  key: { code, label, ...opts },
});

const sp = (width: number): KeySlot => ({ kind: "spacer", width });

// Main ANSI block: 6 rows, 15u total width per row, 74 keys total
export const MAIN_BLOCK_ROWS: KeySlot[][] = [
  // Row 1 (13 keys)
  [
    k("Escape", "Esc"),
    sp(1),
    k("F1", "F1"),
    k("F2", "F2"),
    k("F3", "F3"),
    k("F4", "F4"),
    sp(0.5),
    k("F5", "F5"),
    k("F6", "F6"),
    k("F7", "F7"),
    k("F8", "F8"),
    sp(0.5),
    k("F9", "F9"),
    k("F10", "F10"),
    k("F11", "F11"),
    k("F12", "F12"),
  ],
  // Row 2 (14 keys)
  [
    k("Backquote", "`", { subLabel: "~" }),
    k("Digit1", "1", { subLabel: "!" }),
    k("Digit2", "2", { subLabel: "@" }),
    k("Digit3", "3", { subLabel: "#" }),
    k("Digit4", "4", { subLabel: "$" }),
    k("Digit5", "5", { subLabel: "%" }),
    k("Digit6", "6", { subLabel: "^" }),
    k("Digit7", "7", { subLabel: "&" }),
    k("Digit8", "8", { subLabel: "*" }),
    k("Digit9", "9", { subLabel: "(" }),
    k("Digit0", "0", { subLabel: ")" }),
    k("Minus", "-", { subLabel: "_" }),
    k("Equal", "=", { subLabel: "+" }),
    k("Backspace", "Back", { width: 2 }),
  ],
  // Row 3 (14 keys)
  [
    k("Tab", "Tab", { width: 1.5 }),
    k("KeyQ", "Q"),
    k("KeyW", "W"),
    k("KeyE", "E"),
    k("KeyR", "R"),
    k("KeyT", "T"),
    k("KeyY", "Y"),
    k("KeyU", "U"),
    k("KeyI", "I"),
    k("KeyO", "O"),
    k("KeyP", "P"),
    k("BracketLeft", "[", { subLabel: "{" }),
    k("BracketRight", "]", { subLabel: "}" }),
    k("Backslash", "\\", { subLabel: "|", width: 1.5 }),
  ],
  // Row 4 (13 keys)
  [
    k("CapsLock", "Caps", { width: 1.75 }),
    k("KeyA", "A"),
    k("KeyS", "S"),
    k("KeyD", "D"),
    k("KeyF", "F"),
    k("KeyG", "G"),
    k("KeyH", "H"),
    k("KeyJ", "J"),
    k("KeyK", "K"),
    k("KeyL", "L"),
    k("Semicolon", ";", { subLabel: ":" }),
    k("Quote", "'", { subLabel: '"' }),
    k("Enter", "Enter", { width: 2.25 }),
  ],
  // Row 5 (12 keys)
  [
    k("ShiftLeft", "Shift", { width: 2.25 }),
    k("KeyZ", "Z"),
    k("KeyX", "X"),
    k("KeyC", "C"),
    k("KeyV", "V"),
    k("KeyB", "B"),
    k("KeyN", "N"),
    k("KeyM", "M"),
    k("Comma", ",", { subLabel: "<" }),
    k("Period", ".", { subLabel: ">" }),
    k("Slash", "/", { subLabel: "?" }),
    k("ShiftRight", "Shift", { width: 2.75 }),
  ],
  // Row 6 (8 keys)
  [
    k("ControlLeft", "Ctrl", { width: 1.25 }),
    k("MetaLeft", "Win", { width: 1.25 }),
    k("AltLeft", "Alt", { width: 1.25 }),
    k("Space", "SPACE", { width: 6.25 }),
    k("AltRight", "Alt", { subLabel: "한/영", width: 1.25 }),
    k("MetaRight", "Win", { width: 1.25 }),
    k("ContextMenu", "Menu", { width: 1.25 }),
    k("ControlRight", "Ctrl", { subLabel: "한자", width: 1.25 }),
  ],
];

// Navigation & Arrow cluster: 6 rows, 3u total width per row, 13 keys total (74 + 13 = 87 keys TKL)
export const NAV_BLOCK_ROWS: KeySlot[][] = [
  [
    k("PrintScreen", "PrtSc"),
    k("ScrollLock", "ScrLk"),
    k("Pause", "Pause"),
  ],
  [
    k("Insert", "Ins"),
    k("Home", "Home"),
    k("PageUp", "PgUp"),
  ],
  [
    k("Delete", "Del"),
    k("End", "End"),
    k("PageDown", "PgDn"),
  ],
  [sp(3)],
  [sp(1), k("ArrowUp", "↑"), sp(1)],
  [
    k("ArrowLeft", "←"),
    k("ArrowDown", "↓"),
    k("ArrowRight", "→"),
  ],
];

// Numpad cluster: 4 columns x 5 rows CSS grid, 17 keys total (87 + 17 = 104 keys Full)
export const NUMPAD_KEYS: KeyDef[] = [
  { code: "NumLock", label: "Num" },
  { code: "NumpadDivide", label: "/" },
  { code: "NumpadMultiply", label: "*" },
  { code: "NumpadSubtract", label: "-" },
  { code: "Numpad7", label: "7" },
  { code: "Numpad8", label: "8" },
  { code: "Numpad9", label: "9" },
  { code: "NumpadAdd", label: "+", rowSpan: 2 },
  { code: "Numpad4", label: "4" },
  { code: "Numpad5", label: "5" },
  { code: "Numpad6", label: "6" },
  { code: "Numpad1", label: "1" },
  { code: "Numpad2", label: "2" },
  { code: "Numpad3", label: "3" },
  { code: "NumpadEnter", label: "Ent", rowSpan: 2 },
  { code: "Numpad0", label: "0", colSpan: 2 },
  { code: "NumpadDecimal", label: "." },
];

export const TKL_KEY_CODES: string[] = [
  ...MAIN_BLOCK_ROWS.flatMap((row) =>
    row.filter((slot) => slot.kind === "key").map((slot) => slot.key.code)
  ),
  ...NAV_BLOCK_ROWS.flatMap((row) =>
    row.filter((slot) => slot.kind === "key").map((slot) => slot.key.code)
  ),
];

export const FULL_KEY_CODES: string[] = [
  ...TKL_KEY_CODES,
  ...NUMPAD_KEYS.map((key) => key.code),
];

const KEY_LABEL_MAP = new Map<string, string>();
for (const row of [...MAIN_BLOCK_ROWS, ...NAV_BLOCK_ROWS]) {
  for (const slot of row) {
    if (slot.kind === "key") {
      const display = slot.key.subLabel
        ? `${slot.key.label} (${slot.key.subLabel})`
        : slot.key.label;
      KEY_LABEL_MAP.set(slot.key.code, display);
    }
  }
}
for (const key of NUMPAD_KEYS) {
  KEY_LABEL_MAP.set(key.code, `Num ${key.label}`);
}

export function getKeyDisplayLabel(code: string): string {
  return KEY_LABEL_MAP.get(code) ?? code;
}

/**
 * Normalizes Korean Windows IME codes (`Lang1`/`HangulMode` -> `AltRight`,
 * `Lang2`/`HanjaMode` -> `ControlRight`) so standard 104/87-key ANSI layouts
 * light up reliably.
 */
export function normalizeKeyEvent(e: KeyboardEvent): {
  code: string;
  isImeKey: boolean;
} {
  if (
    e.code === "Lang1" ||
    e.code === "KanaMode" ||
    e.key === "HangulMode"
  ) {
    return { code: "AltRight", isImeKey: true };
  }
  if (e.code === "Lang2" || e.key === "HanjaMode") {
    return { code: "ControlRight", isImeKey: true };
  }
  return {
    code: e.code || e.key || "Unidentified",
    isImeKey: false,
  };
}
