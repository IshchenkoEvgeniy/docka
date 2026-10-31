import { t } from '../i18n';
import styles from './ElementPlaceholder.module.css';

/** Заглушка: тип из более новой версии приложения или данные, не прошедшие проверку. */
export function ElementPlaceholder({ reason }: { readonly reason: 'broken' | 'unknown' }) {
  return (
    <div className={styles.placeholder}>
      {reason === 'broken' ? t('elements.broken') : t('elements.unknown')}
    </div>
  );
}
