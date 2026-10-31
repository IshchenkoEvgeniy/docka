import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type * as Y from 'yjs';
import { plainToRichText, type BoardElement } from '../../core';
import { fragmentToRich } from '../../data';
import { useElementRuntime } from '../runtime';
import { RichTextView } from './RichTextView';
import { TextEditor } from './TextEditor';
import styles from './Text.module.css';

interface TextBlockProps {
  readonly element: BoardElement;
  /** Текст старой заметки (до форматирования), если в Yjs текста нет. */
  readonly legacyText: string;
  readonly editing: boolean;
  readonly placeholder: string;
}

/** Текст элемента: показ без редактора, а во время правки — редактор. */
export function TextBlock({ element, legacyText, editing, placeholder }: TextBlockProps) {
  const runtime = useElementRuntime();
  const fragment = runtime.textOf(element.id);
  // element меняется при любой правке записи, в том числе текста, — тогда и перечитываем.
  const nodes = useMemo(
    () => (fragment === null ? plainToRichText(legacyText) : fragmentToRich(fragment)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- element — признак изменения текста
    [element, fragment, legacyText],
  );
  // Редактор нужен в том же кадре, что и вход в правку: иначе первые буквы, набранные сразу
  // после N, уходят мимо. ensureText повторно не создаёт текст, поэтому вызов при рендере безопасен.
  const editable: Y.XmlFragment | null = useMemo(
    () => (editing && !runtime.fullscreenEditing ? runtime.ensureText(element.id, nodes) : null),
    // Текст для правки создаётся один раз при входе в правку.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, runtime, element.id],
  );

  // На телефоне редактор на весь экран показывает доска: карточка может быть и не смонтирована.
  if (editable !== null) return <TextEditor fragment={editable} runtime={runtime} />;
  const empty = nodes.every((node) => node.type === 'element' && node.children.length === 0);
  if (empty) return <div className={styles.placeholder}>{placeholder}</div>;
  return <RichTextView nodes={nodes} />;
}

/** Сообщает доске высоту элемента, когда она меняется (текст растёт или ширина изменилась). */
export function useMeasuredHeight(elementId: string): RefObject<HTMLDivElement | null> {
  const runtime = useElementRuntime();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;
    const observer = new ResizeObserver(() => {
      runtime.reportHeight(elementId, node.offsetHeight);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [runtime, elementId]);
  return ref;
}
