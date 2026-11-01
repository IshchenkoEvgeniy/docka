import { boundsOf } from '../../canvas';
import { t } from '../../i18n';
import { exportFits, paddedBounds, type ExportPlan } from './plan';
import { waitForPreviews } from './waitForPreview';

export const nextFrame = (): Promise<void> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => {
      resolve();
    }),
  );

/** Реальная высота текста и ширина подписей могут отличаться от сохранённых размеров. */
function fitScene(node: HTMLElement, plan: ExportPlan, scale: number) {
  const origin = node.getBoundingClientRect();
  const measured = [...node.querySelectorAll('[data-export-bounds]')].map((child) => {
    const box = child.getBoundingClientRect();
    return {
      x: box.left - origin.left + plan.bounds.x,
      y: box.top - origin.top + plan.bounds.y,
      width: box.width,
      height: box.height,
    };
  });
  const bounds = boundsOf(measured);
  const framed =
    bounds === null ? plan.bounds : (boundsOf([plan.bounds, paddedBounds(bounds)]) ?? plan.bounds);
  if (!exportFits(framed, scale)) throw new Error(t('export.tooLarge'));
  const world = node.querySelector<HTMLElement>('[data-export-world]');
  if (world !== null)
    world.style.transform = `translate(${String(-framed.x)}px, ${String(-framed.y)}px)`;
  node.style.width = `${String(framed.width)}px`;
  node.style.height = `${String(framed.height)}px`;
  return framed;
}

export async function capturePng(
  node: HTMLElement,
  plan: ExportPlan,
  scale: number,
): Promise<Uint8Array> {
  await document.fonts.ready;
  await waitForPreviews(node);
  await nextFrame();
  await Promise.all([...node.querySelectorAll('img')].map((img) => img.decode()));
  const bounds = fitScene(node, plan, scale);
  const { toBlob } = await import('html-to-image');
  const blob = await toBlob(node, {
    width: bounds.width,
    height: bounds.height,
    pixelRatio: scale,
    skipAutoScale: true,
    fontEmbedCSS: '',
    // Системный шрифт уже установлен; сеть и внешние iframe в PNG не нужны.
    filter: (child) => !(child instanceof HTMLIFrameElement),
  });
  if (blob === null || blob.size === 0) throw new Error(t('export.failed'));
  return new Uint8Array(await blob.arrayBuffer());
}
