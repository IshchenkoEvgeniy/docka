/** Склеивает CSS-классы, пропуская пустые значения: cx(styles.card, isActive && styles.active). */
export function cx(...names: readonly (string | false | null | undefined)[]): string {
  return names.filter((name): name is string => typeof name === 'string' && name !== '').join(' ');
}
