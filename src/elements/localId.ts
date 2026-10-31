/** Id пункта внутри элемента (пункт чек-листа, строка и столбец таблицы): 16 случайных символов. */
export function newLocalId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 16);
}
