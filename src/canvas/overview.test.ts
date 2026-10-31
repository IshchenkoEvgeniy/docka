import { describe, expect, it } from 'vitest';
import {
  drawOverview,
  groupVisibleByFill,
  type OverviewContext,
  type OverviewItem,
} from './overview';

const item = (x: number, fill: string): OverviewItem => ({
  rect: { x, y: 0, width: 10, height: 10 },
  fill,
});

function recordingContext() {
  const calls: string[] = [];
  const context: OverviewContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    setTransform: (...args: unknown[]) => calls.push(`setTransform ${args.join(',')}`),
    clearRect: () => calls.push('clearRect'),
    beginPath: () => calls.push('beginPath'),
    roundRect: () => calls.push('roundRect'),
    fill: () =>
      calls.push(`fill ${typeof context.fillStyle === 'string' ? context.fillStyle : 'pattern'}`),
    stroke: () => calls.push('stroke'),
  };
  return { context, calls };
}

describe('groupVisibleByFill', () => {
  it('группирует по цвету и отбрасывает невидимые', () => {
    const groups = groupVisibleByFill(
      [item(0, 'a'), item(20, 'b'), item(40, 'a'), item(5000, 'a')],
      { x: 0, y: 0, width: 100, height: 100 },
    );
    expect(groups.get('a')).toHaveLength(2);
    expect(groups.get('b')).toHaveLength(1);
  });
});

describe('drawOverview', () => {
  it('делает один fill на цвет и учитывает камеру и плотность пикселей', () => {
    const { context, calls } = recordingContext();
    drawOverview(
      context,
      [item(0, '--red'), item(20, '--blue'), item(40, '--red')],
      { offsetX: 10, offsetY: 20, zoom: 0.5 },
      { width: 400, height: 300 },
      2,
      { stroke: 'gray', radius: 4 },
      (fill) => `resolved${fill}`,
    );
    expect(calls).toContain('setTransform 1,0,0,1,0,0');
    expect(calls).toContain('setTransform 1,0,0,1,20,40');
    expect(calls.filter((call) => call.startsWith('fill'))).toEqual([
      'fill resolved--red',
      'fill resolved--blue',
    ]);
    expect(calls.filter((call) => call === 'roundRect')).toHaveLength(3);
    expect(context.lineWidth).toBe(2);
  });
});
