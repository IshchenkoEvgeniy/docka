import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { compareStacking } from '../../core';
import { useInteraction, type CameraControls } from '../../canvas';
import { t } from '../../i18n';
import { Button } from '../../ui';
import type { BoardModel } from './model';
import { focusElement } from './view';
import styles from './Board.module.css';

/** Найденные на доске элементы по порядку: сверху вниз, слева направо. */
function matchesInOrder(model: BoardModel, highlight: ReadonlySet<string>): string[] {
  const elements = model.elements.getSnapshot();
  return [...highlight]
    .map((id) => elements.get(id))
    .filter((element) => element !== undefined)
    .sort((a, b) => a.y - b.y || a.x - b.x || compareStacking(a, b))
    .map((element) => element.id);
}

/** Ctrl+F: поиск по тексту текущей доски — найденное подсвечено, Enter — к следующему. */
export function FindBar({
  model,
  controls,
}: {
  readonly model: BoardModel;
  readonly controls: CameraControls;
}) {
  const find = useStore(model.settings, (state) => state.find);
  const highlight = useInteraction(model.interaction, (state) => state.highlight);
  const [position, setPosition] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (find !== null) input.current?.focus();
  }, [find]);
  if (find === null) return null;
  const matches = find.trim() === '' || highlight === null ? [] : matchesInOrder(model, highlight);
  const go = (step: number): void => {
    if (matches.length === 0) return;
    const next = (position + step + matches.length) % matches.length;
    setPosition(next);
    const id = matches[next];
    if (id !== undefined) focusElement(model, controls, id);
  };
  const close = (): void => {
    model.settings.setState({ find: null });
  };
  return (
    <div className={styles.findBar} role="search">
      <input
        ref={input}
        className={styles.findInput}
        value={find}
        placeholder={t('board.find.placeholder')}
        aria-label={t('board.find.placeholder')}
        onChange={(event) => {
          setPosition(-1);
          model.settings.setState({ find: event.target.value });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') go(event.shiftKey ? -1 : 1);
          else if (event.key === 'Escape') close();
          else return;
          event.preventDefault();
        }}
      />
      <span className={styles.findCount}>
        {find.trim() === '' ? '' : t('board.find.count', { count: matches.length })}
      </span>
      <Button
        variant="ghost"
        aria-label={t('board.find.previous')}
        onClick={() => {
          go(-1);
        }}
      >
        {t('board.find.previousIcon')}
      </Button>
      <Button
        variant="ghost"
        aria-label={t('board.find.next')}
        onClick={() => {
          go(1);
        }}
      >
        {t('board.find.nextIcon')}
      </Button>
      <Button variant="ghost" aria-label={t('common.close')} onClick={close}>
        {t('board.find.closeIcon')}
      </Button>
    </div>
  );
}
