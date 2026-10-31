import { useEffect, useMemo, useState } from 'react';
import type { CommandEnvironment } from '../../core';
import type { OpenProject } from '../../data';
import { createProjectTags, type ProjectTags } from './projectTags';

/** Теги открытого проекта на время показа экрана; null — ещё создаются (в эффекте). */
export function useProjectTags(
  project: OpenProject,
  environment: CommandEnvironment,
): ProjectTags | null {
  const [tags, setTags] = useState<ProjectTags | null>(null);
  useEffect(() => {
    const created = createProjectTags(project.projectDoc.doc, environment);
    setTags(created);
    return () => {
      created.destroy();
    };
  }, [project, environment]);
  return tags;
}

/** То, что нужно элементам: живые теги и создание тега из «#» в тексте. */
export function useTagLinks(tags: ProjectTags | null) {
  return useMemo(
    () =>
      tags === null ? null : { tags: tags.live, createTag: (name: string) => tags.ensure(name) },
    [tags],
  );
}
