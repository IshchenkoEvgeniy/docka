import type { LinkedBoardPreviewProps } from '../../elements';
import { BoardPreview, type PreviewSource } from './BoardPreview';

/** Один компонент для всех ссылок проекта; сами миниатюры не получают его в свой runtime. */
export function createLinkedBoardPreview(source: PreviewSource) {
  return function LinkedBoardPreview(props: LinkedBoardPreviewProps) {
    return <BoardPreview source={source} {...props} />;
  };
}
