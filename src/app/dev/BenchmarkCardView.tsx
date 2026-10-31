import { memo } from 'react';
import { cx } from '../../ui';
import type { BenchmarkCard } from './benchmarkCards';
import styles from './CanvasBenchmark.module.css';

const toneClass = {
  plain: styles.tonePlain,
  yellow: styles.toneYellow,
  blue: styles.toneBlue,
  green: styles.toneGreen,
};

/**
 * Карточка-заглушка: заголовок и несколько строк текста, как у типичной заметки.
 * Рисуется только в детальном виде; в обзоре её заменяет картинка OverviewCanvas.
 */
export const BenchmarkCardView = memo(function BenchmarkCardView({
  card,
}: {
  card: BenchmarkCard;
}) {
  return (
    <article
      className={cx(styles.card, toneClass[card.tone])}
      style={{
        transform: `translate(${String(card.x)}px, ${String(card.y)}px)`,
        width: card.width,
      }}
    >
      <h3 className={styles.cardTitle}>{card.title}</h3>
      {card.lines.map((line, index) => (
        <p key={index} className={styles.cardLine}>
          {line}
        </p>
      ))}
    </article>
  );
});
