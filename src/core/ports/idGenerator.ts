/** Генератор идентификаторов. Тип id задаёт вызывающая сторона (BoardId, ElementId…). */
export interface IdGenerator {
  readonly next: () => string;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 16;
/** Наибольшее кратное длине алфавита, меньшее 256: байты выше отбрасываются, чтобы символы были равновероятны. */
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length);

/**
 * Случайные id из 16 символов латиницы и цифр (≈95 бит): совпадение на двух устройствах,
 * создающих элементы офлайн, практически невозможно.
 */
export function createRandomIdGenerator(): IdGenerator {
  return {
    next: () => {
      let id = '';
      while (id.length < ID_LENGTH) {
        for (const byte of crypto.getRandomValues(new Uint8Array(ID_LENGTH * 2))) {
          if (byte < UNBIASED_LIMIT && id.length < ID_LENGTH)
            id += ALPHABET.charAt(byte % ALPHABET.length);
        }
      }
      return id;
    },
  };
}

/** Предсказуемые id для тестов: prefix-00000001, prefix-00000002… */
export function createSequentialIdGenerator(prefix = 'id'): IdGenerator {
  let counter = 0;
  return {
    next: () => {
      counter += 1;
      return `${prefix}-${String(counter).padStart(8, '0')}`;
    },
  };
}
