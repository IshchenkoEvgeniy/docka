/** Значок файла по расширению: документ, таблица, презентация, архив, PDF или просто файл. */
const GROUPS: readonly (readonly [string, readonly string[]])[] = [
  ['📕', ['pdf']],
  ['📝', ['doc', 'docx', 'odt', 'rtf', 'txt', 'md']],
  ['📊', ['xls', 'xlsx', 'ods', 'csv']],
  ['📽️', ['ppt', 'pptx', 'odp', 'key']],
  ['🗜️', ['zip', 'rar', '7z', 'gz', 'tar']],
];

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function fileIcon(name: string): string {
  const extension = extensionOf(name);
  return GROUPS.find(([, extensions]) => extensions.includes(extension))?.[0] ?? '📄';
}

export function isPdf(mime: string, name: string): boolean {
  return mime === 'application/pdf' || extensionOf(name) === 'pdf';
}
