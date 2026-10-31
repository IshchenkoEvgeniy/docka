import { useMemo, useRef, type ReactNode, type RefObject } from 'react';
import type { CameraControls } from '../../canvas';
import type { AddPickers } from './addMenu';
import { insertFiles } from './files';
import { insertImages } from './images';
import type { BoardModel } from './model';
import { worldPoint } from './view';
import styles from './Board.module.css';

function FileInput({
  inputRef,
  accept,
  onFiles,
}: {
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly accept?: string;
  readonly onFiles: (files: File[]) => void;
}) {
  return (
    <input
      ref={inputRef}
      className={styles.fileInput}
      type="file"
      multiple
      {...(accept === undefined ? {} : { accept })}
      onChange={(event) => {
        const files = [...(event.target.files ?? [])];
        event.target.value = '';
        onFiles(files);
      }}
    />
  );
}

/** Системные окна выбора картинок и файлов и окно адреса ссылки — для меню и клавиш. */
export function useBoardPickers(
  model: BoardModel,
  controls: CameraControls,
): { readonly pickers: AddPickers; readonly inputs: ReactNode } {
  const images = useRef<HTMLInputElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const pickers = useMemo<AddPickers>(
    () => ({
      images: () => images.current?.click(),
      files: () => files.current?.click(),
      link: () => {
        model.overlay.setState({ dialog: { kind: 'link', at: worldPoint(controls, null) } });
      },
    }),
    [model, controls],
  );
  const inputs = (
    <>
      <FileInput
        inputRef={images}
        accept="image/*"
        onFiles={(picked) => void insertImages(model, picked, worldPoint(controls, null))}
      />
      <FileInput
        inputRef={files}
        onFiles={(picked) => void insertFiles(model, picked, worldPoint(controls, null))}
      />
    </>
  );
  return { pickers, inputs };
}
