import { Extension } from '@tiptap/core';
import type { Plugin } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useRef, useState } from 'react';
import { ySyncPlugin, ySyncPluginKey } from 'y-prosemirror';
import type * as Y from 'yjs';
import { useEntityLinks, type EntityLinks } from '../entityLinks';
import type { ElementRuntime } from '../runtime';
import { MentionPopupView } from './MentionPopupView';
import { createMentionPopup, mentionExtension } from './mentions';
import { entitySource, tagSource } from './mentionSources';
import styles from './Text.module.css';

/** Что редактору нужно от места, где он открыт (доска или панель сущности). */
export type TextEditorHost = Pick<ElementRuntime, 'undo' | 'redo' | 'stopEditing'>;

/** Источник правок редактора в Yjs: история доски склеивает их в шаги по паузам. */
export const TEXT_EDIT_ORIGIN: unknown = ySyncPluginKey;

function boardBindings(fragment: Y.XmlFragment, runtime: TextEditorHost) {
  return Extension.create({
    name: 'doskaBoard',
    addProseMirrorPlugins: () => [ySyncPlugin(fragment) as Plugin],
    // Отмена — общая с доской: одна история на перемещения и текст.
    addKeyboardShortcuts: () => ({
      'Mod-z': () => {
        runtime.undo();
        return true;
      },
      'Mod-Shift-z': () => {
        runtime.redo();
        return true;
      },
      'Mod-y': () => {
        runtime.redo();
        return true;
      },
      Escape: () => {
        runtime.stopEditing();
        return true;
      },
    }),
  });
}

interface TextEditorProps {
  readonly fragment: Y.XmlFragment;
  readonly runtime: TextEditorHost;
}

/** Редактор форматированного текста поверх Yjs (TipTap + y-prosemirror). */
export function TextEditor({ fragment, runtime }: TextEditorProps) {
  const links = useRef<EntityLinks | null>(null);
  links.current = useEntityLinks();
  const [popup] = useState(createMentionPopup);
  const [mentions] = useState(() =>
    mentionExtension(
      { entities: entitySource(links), tags: tagSource(links) },
      popup,
      styles.mention ?? '',
    ),
  );
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          undoRedo: false,
          codeBlock: false,
          link: { openOnClick: false, autolink: true },
        }),
        boardBindings(fragment, runtime),
        mentions,
      ],
      autofocus: 'end',
      editorProps: { attributes: { class: styles.editor ?? '' } },
    },
    [fragment, runtime],
  );
  return (
    <>
      <EditorContent editor={editor} className={styles.editorHost} />
      <MentionPopupView popup={popup} />
    </>
  );
}
