import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Правила кода из CLAUDE.md, которые можно проверить автоматически.
const userFacingAttributes = '/^(title|placeholder|alt|aria-label|aria-description)$/';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'src-tauri'] },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],

      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],

      // Тексты интерфейса только через t('ключ').
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/[A-Za-zА-Яа-яЁё]/]',
          message: 'Текст в JSX запрещён: используйте t("область.ключ").',
        },
        {
          selector: `JSXAttribute[name.name=${userFacingAttributes}] > Literal`,
          message: 'Текст в атрибуте запрещён: используйте t("область.ключ").',
        },
      ],
    },
  },

  // Компонент может быть длиннее обычной функции, но не больше 200 строк.
  {
    files: ['**/*.tsx'],
    rules: {
      'max-lines-per-function': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },

  {
    files: ['**/*.test.{ts,tsx}'],
    rules: { 'max-lines-per-function': 'off' },
  },

  // Конфиги в корне проекта работают в Node и не входят в tsconfig приложения.
  {
    files: ['*.config.{js,ts,cjs}', '.dependency-cruiser.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
);
