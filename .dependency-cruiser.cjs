/**
 * Правила слоёв из CLAUDE.md.
 * Направление: app → features → elements → canvas → data → core.
 * ui → core, platform → core, i18n ни от кого не зависит.
 */

const layerRule = (name, from, forbiddenTargets, comment) => ({
  name,
  comment,
  severity: 'error',
  from: { path: `^src/${from}/` },
  to: { path: `^src/(${forbiddenTargets.join('|')})/` },
});

/** Внутрь чужой папки features/* или elements/* — только через её index.ts. */
const publicApiRules = (group) => [
  {
    name: `${group}-public-api-from-sibling`,
    comment: `Импорт из другой папки ${group}/* только через её index.ts`,
    severity: 'error',
    from: { path: `^src/${group}/([^/]+)/` },
    to: {
      path: `^src/${group}/[^/]+/.+`,
      pathNot: [`^src/${group}/$1/`, `^src/${group}/[^/]+/index\\.tsx?$`],
    },
  },
  {
    name: `${group}-public-api-from-outside`,
    comment: `Импорт в ${group}/* извне только через index.ts`,
    severity: 'error',
    from: { pathNot: `^src/${group}/` },
    to: { path: `^src/${group}/[^/]+/.+`, pathNot: `^src/${group}/[^/]+/index\\.tsx?$` },
  },
];

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Циклические зависимости запрещены',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    layerRule(
      'core-is-independent',
      'core',
      ['app', 'features', 'elements', 'canvas', 'data', 'platform', 'ui', 'i18n'],
      'core не зависит ни от чего в проекте',
    ),
    layerRule(
      'data-only-core',
      'data',
      ['app', 'features', 'elements', 'canvas', 'platform', 'ui', 'i18n'],
      'data зависит только от core',
    ),
    layerRule(
      'canvas-down-only',
      'canvas',
      ['app', 'features', 'elements', 'platform'],
      'canvas не знает про элементы, сценарии и платформу',
    ),
    layerRule(
      'elements-down-only',
      'elements',
      ['app', 'features', 'platform'],
      'elements не зависят от сценариев и платформы',
    ),
    layerRule(
      'features-down-only',
      'features',
      ['app', 'platform'],
      'features не зависят от app и platform',
    ),
    layerRule(
      'ui-only-core',
      'ui',
      ['app', 'features', 'elements', 'canvas', 'data', 'platform'],
      'ui — дизайн-система без бизнес-логики',
    ),
    layerRule(
      'platform-only-core',
      'platform',
      ['app', 'features', 'elements', 'canvas', 'data', 'ui', 'i18n'],
      'platform реализует порты core и больше ничего не знает',
    ),
    layerRule(
      'i18n-is-independent',
      'i18n',
      ['app', 'features', 'elements', 'canvas', 'data', 'core', 'platform', 'ui'],
      'i18n не зависит от других слоёв',
    ),
    ...publicApiRules('features'),
    ...publicApiRules('elements'),
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    includeOnly: '^src/',
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
