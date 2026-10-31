import { describe, expect, it } from 'vitest';
import { createRandom, generateCards } from './benchmarkCards';
import { summarizeFrames } from './frameStats';

describe('generateCards', () => {
  it('создаёт нужное число карточек', () => {
    expect(generateCards(1000)).toHaveLength(1000);
  });

  it('одинаковый seed даёт одинаковые карточки', () => {
    expect(generateCards(50, 7)).toEqual(generateCards(50, 7));
  });

  it('генератор выдаёт числа в [0, 1)', () => {
    const random = createRandom(1);
    for (let i = 0; i < 1000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('summarizeFrames', () => {
  it('ровные кадры по 16.67 мс дают 60 FPS', () => {
    const stats = summarizeFrames(Array.from({ length: 120 }, () => 1000 / 60));
    expect(stats.averageFps).toBe(60);
    expect(stats.lowFps).toBe(60);
  });

  it('редкий долгий кадр виден в худшем кадре', () => {
    const frames = [...Array.from({ length: 99 }, () => 1000 / 60), 100];
    const stats = summarizeFrames(frames);
    expect(stats.worstFrameMs).toBe(100);
    expect(stats.averageFps).toBeLessThan(60);
  });

  it('пустой замер не падает', () => {
    expect(summarizeFrames([]).frames).toBe(0);
  });
});
