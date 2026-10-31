import { useMemo } from 'react';
import { t, type TranslationKey } from '../../i18n';
import { formatCombo, isMacPlatform, parseCombo } from './combo';
import type { HotkeyDefinition } from './registry';
import styles from './HotkeyList.module.css';

/** Список горячих клавиш по группам — для окна подсказки и экрана настроек. */
export function HotkeyList({ definitions }: { readonly definitions: readonly HotkeyDefinition[] }) {
  const groups = useMemo(() => {
    const byGroup = new Map<TranslationKey, HotkeyDefinition[]>();
    for (const definition of definitions) {
      const list = byGroup.get(definition.group) ?? [];
      list.push(definition);
      byGroup.set(definition.group, list);
    }
    return [...byGroup];
  }, [definitions]);
  const isMac = isMacPlatform();
  return (
    <div className={styles.list}>
      {groups.map(([group, items]) => (
        <section key={group}>
          <h3 className={styles.group}>{t(group)}</h3>
          <dl className={styles.rows}>
            {items.map((item) => (
              <div key={item.id} className={styles.row}>
                <dt>{t(item.label)}</dt>
                <dd className={styles.keys}>
                  {item.combos.map((combo) => (
                    <kbd key={combo} className={styles.key}>
                      {formatCombo(parseCombo(combo), isMac)}
                    </kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
