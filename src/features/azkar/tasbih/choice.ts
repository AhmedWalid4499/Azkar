import type { Dhikr } from '../data'

/** Arabic-Indic and Persian digits as typed on an Arabic keyboard, read as Western ones. */
export function westernDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
}

/**
 * The preset the counter counts: the one last chosen while the dataset still offers it,
 * otherwise the first. `null` for a free count, chosen or because there are no presets.
 */
export function chosenPreset(presets: readonly Dhikr[], chosenId: string | null, free: boolean): Dhikr | null {
  if (free) return null
  return presets.find((preset) => preset.id === chosenId) ?? presets[0] ?? null
}
