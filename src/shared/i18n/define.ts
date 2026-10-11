/**
 * Declares one feature's strings. English is the source of truth for keys;
 * Arabic must translate every one and may add extra plural forms
 * (`.zero`, `.two`, `.few`, `.many`) that English does not need.
 */
export function defineStrings<const E extends Record<string, string>>(strings: {
  en: E
  ar: { [K in keyof E]: string } & Record<string, string>
}) {
  return strings
}
