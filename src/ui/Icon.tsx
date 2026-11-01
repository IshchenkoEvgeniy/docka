/**
 * Значки интерфейса: линии 24×24 цветом текста (currentColor), без своих подписей —
 * подпись или aria-label даёт кнопка.
 */
const PATHS = {
  plus: 'M12 5v14M5 12h14',
  note: 'M5 6h14M5 10h14M5 14h14M5 18h9',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  todo: 'M4 7l2 2 3-3M4 15l2 2 3-3M12 8h8M12 16h8',
  line: 'M5 19L19 5M19 5h-6M19 5v6',
  board: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  column: 'M5 3h14v18H5zM5 8h14',
  frame: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 11v2M11 4h2M20 11v2M11 20h2',
  title: 'M5 6V4h14v2M12 4v16M9 20h6',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 8.5h.01',
  upload: 'M7 3h7l5 5v13H7zM14 3v5h5M13 18v-6M10 14l3-3 3 3',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  pin: 'M9 4h6M10 4v6l-3 3h10l-3-3V4M12 13v7',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  restore: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  shape: 'M12 3l9 9-9 9-9-9z',
  swatch: 'M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2 2 0 0 0-1.5 3.3A1.8 1.8 0 0 1 12 21z',
  entity: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24 }: { readonly name: IconName; readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
