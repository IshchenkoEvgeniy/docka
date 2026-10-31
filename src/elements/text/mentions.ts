import Mention from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { MENTION_NODE, TAG_MENTION_CHAR } from '../../core';

/**
 * Упоминания сущностей в тексте (ADR 0004): `@` или `[[` открывает список сущностей,
 * выбор вставляет узел mention с id и названием на момент вставки. `#` — тег (ADR 0006).
 */
export interface MentionItem {
  readonly id: string;
  readonly label: string;
  /** Подсказка справа (тип сущности). */
  readonly hint: string;
  /** Пункт «создать новый» (тег по набранному тексту). */
  readonly create?: boolean;
}

export interface MentionPopup {
  readonly items: readonly MentionItem[];
  readonly index: number;
  readonly rect: DOMRect | null;
  readonly select: ((item: MentionItem) => void) | null;
}

const CLOSED: MentionPopup = { items: [], index: 0, rect: null, select: null };
const MAX_ITEMS = 8;

export function createMentionPopup(): StoreApi<MentionPopup> {
  return createStore<MentionPopup>(() => CLOSED);
}

export interface MentionSource {
  /** Сущности, подходящие к набранному тексту. */
  readonly find: (query: string) => readonly MentionItem[];
  /** Актуальное название (null — сущность удалена). */
  readonly labelOf: (id: string) => string | null;
  /** Создать по набранному тексту (тег); null — не создан. */
  readonly create?: (label: string) => string | null;
}

function onKey(popup: StoreApi<MentionPopup>, { event }: SuggestionKeyDownProps): boolean {
  const state = popup.getState();
  const count = state.items.length;
  if (event.key === 'Escape') {
    popup.setState(CLOSED);
    return true;
  }
  if (count === 0) return false;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const step = event.key === 'ArrowDown' ? 1 : -1;
    popup.setState({ index: (state.index + step + count) % count });
    return true;
  }
  if (event.key !== 'Enter' && event.key !== 'Tab') return false;
  const item = state.items[state.index];
  if (item !== undefined) state.select?.(item);
  return true;
}

function suggestion(
  char: string,
  key: string,
  source: MentionSource,
  popup: StoreApi<MentionPopup>,
) {
  const show = (props: SuggestionProps<MentionItem>): void => {
    popup.setState({
      items: props.items,
      index: 0,
      rect: props.clientRect?.() ?? null,
      select: (item) => {
        const id = item.create === true ? (source.create?.(item.label) ?? null) : item.id;
        if (id !== null) props.command({ id, label: item.label });
      },
    });
  };
  return {
    char,
    pluginKey: new PluginKey(key),
    allowSpaces: true,
    items: ({ query }: { query: string }) => source.find(query).slice(0, MAX_ITEMS),
    render: () => ({
      onStart: show,
      onUpdate: show,
      onKeyDown: (props: SuggestionKeyDownProps) => onKey(popup, props),
      onExit: () => {
        popup.setState(CLOSED);
      },
    }),
  };
}

function attr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function mentionExtension(
  sources: { readonly entities: MentionSource; readonly tags: MentionSource },
  popup: StoreApi<MentionPopup>,
  chipClass: string,
) {
  const text = (attrs: Record<string, unknown>) => {
    const tag = attrs.mentionSuggestionChar === TAG_MENTION_CHAR;
    const source = tag ? sources.tags : sources.entities;
    return `${tag ? TAG_MENTION_CHAR : '@'}${source.labelOf(attr(attrs.id)) ?? attr(attrs.label)}`;
  };
  return Mention.extend({ name: MENTION_NODE }).configure({
    HTMLAttributes: { class: chipClass },
    suggestions: [
      suggestion('@', 'mention-at', sources.entities, popup),
      suggestion('[[', 'mention-brackets', sources.entities, popup),
      suggestion(TAG_MENTION_CHAR, 'mention-tag', sources.tags, popup),
    ],
    renderText: ({ node }) => text(node.attrs),
    renderHTML: ({ node }) => [
      'span',
      { class: chipClass, 'data-type': MENTION_NODE },
      text(node.attrs),
    ],
  });
}
