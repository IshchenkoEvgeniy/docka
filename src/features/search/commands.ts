import { searchTerm, tokenize } from '../../core';

/** Команда в окне Ctrl+K: «новая доска», «тёмная тема»… (ТЗ, раздел 7). */
export interface PaletteCommand {
  readonly id: string;
  readonly label: string;
  readonly run: () => void;
}

const stems = (text: string) =>
  tokenize(text).flatMap((token) => {
    const term = searchTerm(token);
    return term === null ? [] : [term];
  });

/** Команды, где каждое слово запроса — начало какого-то слова подписи (с учётом словоформ). */
export function matchCommands(
  commands: readonly PaletteCommand[],
  query: string,
): PaletteCommand[] {
  const wanted = stems(query);
  if (wanted.length === 0) return [];
  return commands.filter((command) => {
    const words = stems(command.label);
    return wanted.every((term) =>
      words.some((word) => word.startsWith(term) || term.startsWith(word)),
    );
  });
}
