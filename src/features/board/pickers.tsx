import { useMemo, useRef, type ReactNode, type RefObject } from 'react';
import type { CameraControls, Point } from '../../canvas';
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
  // Куда положить выбранное: точка, куда бросили значок с панели; иначе центр экрана.
  const target = useRef<Point | null>(null);
  const placeAt = (): Point => {
    const at = target.current ?? worldPoint(controls, null);
    target.current = null;
    return at;
  };
  const pickers = useMemo<AddPickers>(
    () => ({
      images: (at) => {
        target.current = at ?? null;
        images.current?.click();
      },
      files: (at) => {
        target.current = at ?? null;
        files.current?.click();
      },
      link: (at) => {
        model.overlay.setState({ dialog: { kind: 'link', at: at ?? worldPoint(controls, null) } });
      },
    }),
    [model, controls],
  );
  const inputs = (
    <>
      <FileInput
        inputRef={images}
        accept="image/*"
        onFiles={(picked) => void insertImages(model, picked, placeAt())}
      />
      <FileInput
        inputRef={files}
        onFiles={(picked) => void insertFiles(model, picked, placeAt())}
      />
    </>
  );
  return { pickers, inputs };
}
