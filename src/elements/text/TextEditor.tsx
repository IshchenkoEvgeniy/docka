import { Extension } from '@tiptap/core';
import type { Plugin } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ySyncPlugin, ySyncPluginKey } from 'y-prosemirror';
import type * as Y from 'yjs';
import { t } from '../../i18n';
import type { ElementRuntime } from '../runtime';
import styles from './Text.module.css';

/** Источник правок редактора в Yjs: история доски склеивает их в шаги по паузам. */
export const TEXT_EDIT_ORIGIN: unknown = ySyncPluginKey;

function boardBindings(fragment: Y.XmlFragment, runtime: ElementRuntime) {
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
  readonly runtime: ElementRuntime;
  readonly placeholder?: string;
}

/** Телефон: правка на весь экран с кнопкой «Готово»; клавиатура не закрывает текст. */
export function FullscreenEditor({ fragment, runtime }: TextEditorProps) {
  return (
    <div className={styles.fullscreen} role="dialog" aria-modal="true">
      <div className={styles.fullscreenBar}>
        <button type="button" className={styles.done} onClick={runtime.stopEditing}>
          {t('elements.text.done')}
        </button>
      </div>
      <div className={styles.fullscreenBody}>
        <TextEditor fragment={fragment} runtime={runtime} />
      </div>
    </div>
  );
}

/** Редактор форматированного текста поверх Yjs (TipTap + y-prosemirror). */
export function TextEditor({ fragment, runtime }: TextEditorProps) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          undoRedo: false,
          codeBlock: false,
          link: { openOnClick: false, autolink: true },
        }),
        boardBindings(fragment, runtime),
      ],
      autofocus: 'end',
      editorProps: { attributes: { class: styles.editor ?? '' } },
    },
    [fragment, runtime],
  );
  return <EditorContent editor={editor} className={styles.editorHost} />;
}
