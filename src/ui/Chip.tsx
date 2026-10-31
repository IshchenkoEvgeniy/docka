import styles from './Chip.module.css';

/** Небольшая метка с цветным фоном (тег). Цвет — значение CSS из токенов (cardColor). */
export function Chip({ label, color }: { readonly label: string; readonly color: string }) {
  return (
    <span className={styles.chip} style={{ background: color }}>
      {label}
    </span>
  );
}
