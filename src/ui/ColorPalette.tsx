import { cx } from './cx';
import styles from './ColorPalette.module.css';

export interface PaletteColor<T extends string> {
  readonly value: T;
  readonly label: string;
  /** CSS-цвет кружка, например var(--color-card-yellow). */
  readonly swatch: string;
}

interface ColorPaletteProps<T extends string> {
  readonly colors: readonly PaletteColor<T>[];
  readonly value: T | null;
  readonly onPick: (value: T) => void;
}

/** Палитра кружками; крупные кнопки — удобно пальцем. */
export function ColorPalette<T extends string>({ colors, value, onPick }: ColorPaletteProps<T>) {
  return (
    <div className={styles.palette} role="radiogroup">
      {colors.map((color) => (
        <button
          key={color.value}
          type="button"
          role="radio"
          aria-checked={color.value === value}
          aria-label={color.label}
          title={color.label}
          className={cx(styles.swatch, color.value === value && styles.active)}
          style={{ background: color.swatch }}
          onClick={() => {
            onPick(color.value);
          }}
        />
      ))}
    </div>
  );
}
