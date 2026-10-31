import { COLOR_NAMES, plainToRichText, type NewElement } from '../../core';

/** Пример содержимого доски для запуска в браузере (жесты, выделение, буфер обмена). */
const SAMPLE_TEXTS = [
  'Таверна «Сытый гусь»',
  'Кузнец Борис — продаёт мечи, знает про пещеру',
  'Квест: найти пропавшую козу',
  'Локация: Старый мост',
  'Идея: погода влияет на цены',
  'Босс второй главы',
  '',
  'Список предметов:\n— зелье лечения\n— ключ от склепа\n— карта',
];

const COLUMNS = 8;
const ROWS = 6;

export function sampleElements(): NewElement[] {
  const elements: NewElement[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const index = row * COLUMNS + column;
      elements.push({
        type: 'note',
        placement: {
          x: column * 288,
          y: row * 192,
          width: 240,
          height: 48,
        },
        color: COLOR_NAMES[index % COLOR_NAMES.length] ?? 'default',
        data: {},
        richText: plainToRichText(SAMPLE_TEXTS[index % SAMPLE_TEXTS.length] ?? ''),
      });
    }
  }
  return elements;
}
