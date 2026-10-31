import { Fragment, createElement, type ReactNode } from 'react';
import type { RichNode } from '../../core';
import styles from './Text.module.css';

/**
 * Показ текста без редактора: на доске может быть тысяча заметок, а редактор нужен одной.
 * Только известные узлы и пометки; ссылки — без перехода (иначе окно приложения уйдёт со страницы).
 */
const BLOCK_TAGS: Readonly<Record<string, string>> = {
  paragraph: 'p',
  bulletList: 'ul',
  orderedList: 'ol',
  listItem: 'li',
  blockquote: 'blockquote',
  horizontalRule: 'hr',
  hardBreak: 'br',
};

const MARK_TAGS: Readonly<Record<string, string>> = {
  bold: 'strong',
  italic: 'em',
  strike: 's',
  underline: 'u',
  code: 'code',
};

function headingTag(attrs: Readonly<Record<string, unknown>> | undefined): string {
  const level = typeof attrs?.level === 'number' ? Math.min(3, Math.max(1, attrs.level)) : 1;
  return `h${String(level)}`;
}

function renderText(node: Extract<RichNode, { type: 'text' }>, key: number): ReactNode {
  let content: ReactNode = node.text;
  for (const mark of Object.keys(node.marks ?? {})) {
    const tag = MARK_TAGS[mark];
    if (tag !== undefined) content = createElement(tag, null, content);
    else if (mark === 'link') content = createElement('span', { className: styles.link }, content);
  }
  return createElement(Fragment, { key }, content);
}

function renderNodes(nodes: readonly RichNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === 'text') return renderText(node, index);
    const tag = node.name === 'heading' ? headingTag(node.attrs) : BLOCK_TAGS[node.name];
    if (tag === undefined)
      return createElement(Fragment, { key: index }, renderNodes(node.children));
    if (tag === 'br' || tag === 'hr') return createElement(tag, { key: index });
    return createElement(tag, { key: index }, ...renderNodes(node.children));
  });
}

export function RichTextView({ nodes }: { readonly nodes: readonly RichNode[] }) {
  return <div className={styles.text}>{renderNodes(nodes)}</div>;
}
