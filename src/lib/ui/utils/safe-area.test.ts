import { describe, it, expect } from 'vitest';
import { cn } from './cn';
import { safeTopFlow, safeTopStrip, safeTopViewport, safeBottomViewport } from './safe-area';

describe('safe-area: утилиты инсета в cn', () => {
  it('p-0 хоста не вычищает отступы контейнера, когда они идут последними', () => {
    const cls = cn('flex flex-col', 'relative p-0', safeBottomViewport, safeTopViewport);
    expect(cls).toContain('p-0');
    expect(cls).toContain('pb-[var(--safe-area-root-bottom,0px)]');
    expect(cls).toContain('pt-[var(--safe-area-root-top,0px)]');
  });

  // Ровно этот порядок стоял в Dialog до 0.16.0: contentClass="p-0" шёл после утилиты
  // панели, и tailwind-merge снимал нижний отступ.
  it('обратный порядок теряет отступ — поэтому константы всегда последние', () => {
    const cls = cn(safeBottomViewport, 'p-0');
    expect(cls).not.toContain('pb-[var(--safe-area-root-bottom,0px)]');
  });

  it('полоска Page не спорит с цветом фона хоста', () => {
    const cls = cn('bg-background', 'bg-surface', safeTopFlow, safeTopStrip);
    expect(cls).toContain('bg-surface');
    expect(cls).not.toContain('bg-background');
    expect(cls).toContain('bg-[image:linear-gradient(var(--color-surface),var(--color-surface))]');
    expect(cls).toContain('bg-[length:100%_var(--safe-area-inset-top,0px)]');
    expect(cls).toContain('pt-[var(--safe-area-inset-top,0px)]');
  });
});
