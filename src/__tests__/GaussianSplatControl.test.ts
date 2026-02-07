import { describe, it, expect, vi } from 'vitest';

// Mock maplibre-gl
vi.mock('maplibre-gl', () => ({
  default: {},
}));

// Mock THREE
vi.mock('three', () => ({
  AmbientLight: vi.fn(),
  DirectionalLight: vi.fn(),
  MathUtils: {
    degToRad: (deg: number) => deg * (Math.PI / 180),
  },
}));

// Mock maplibre-three-plugin
vi.mock('@dvt3d/maplibre-three-plugin', () => ({
  MapScene: vi.fn().mockImplementation(() => ({
    addLight: vi.fn(),
    addObject: vi.fn(),
    removeObject: vi.fn(),
    on: vi.fn(),
  })),
  Creator: {
    createMercatorRTCGroup: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
    })),
  },
}));

// Mock spark
vi.mock('@sparkjsdev/spark', () => ({
  SplatMesh: vi.fn().mockImplementation(() => ({
    geometry: { attributes: { position: {} } },
    scale: { setScalar: vi.fn() },
  })),
}));

describe('GaussianSplatControl', () => {
  it('should export GaussianSplatControl', async () => {
    const module = await import('../index');
    expect(module.GaussianSplatControl).toBeDefined();
  });

  it('should have correct default options', async () => {
    const { GaussianSplatControl } = await import('../lib/core/GaussianSplatControl');
    const control = new GaussianSplatControl();
    const state = control.getState();

    expect(state.collapsed).toBe(true);
    expect(state.url).toBe('');
    expect(state.loading).toBe(false);
    expect(state.hasLayer).toBe(false);
    expect(state.opacity).toBe(1);
    expect(state.scale).toBe(1);
  });

  it('should accept custom options', async () => {
    const { GaussianSplatControl } = await import('../lib/core/GaussianSplatControl');
    const control = new GaussianSplatControl({
      collapsed: false,
      defaultUrl: 'https://example.com/test.splat',
      defaultScale: 2,
      title: 'Custom Title',
    });
    const state = control.getState();

    expect(state.collapsed).toBe(false);
    expect(state.url).toBe('https://example.com/test.splat');
    expect(state.scale).toBe(2);
  });

  it('should toggle collapsed state', async () => {
    const { GaussianSplatControl } = await import('../lib/core/GaussianSplatControl');
    const control = new GaussianSplatControl({ collapsed: true });

    expect(control.getState().collapsed).toBe(true);

    control.expand();
    expect(control.getState().collapsed).toBe(false);

    control.collapse();
    expect(control.getState().collapsed).toBe(true);

    control.toggle();
    expect(control.getState().collapsed).toBe(false);
  });

  it('should emit events', async () => {
    const { GaussianSplatControl } = await import('../lib/core/GaussianSplatControl');
    const control = new GaussianSplatControl();
    const expandHandler = vi.fn();
    const collapseHandler = vi.fn();

    control.on('expand', expandHandler);
    control.on('collapse', collapseHandler);

    control.expand();
    expect(expandHandler).toHaveBeenCalledTimes(1);

    control.collapse();
    expect(collapseHandler).toHaveBeenCalledTimes(1);
  });

  it('should remove event handlers', async () => {
    const { GaussianSplatControl } = await import('../lib/core/GaussianSplatControl');
    const control = new GaussianSplatControl();
    const handler = vi.fn();

    control.on('expand', handler);
    control.expand();
    expect(handler).toHaveBeenCalledTimes(1);

    control.off('expand', handler);
    control.collapse();
    control.expand();
    expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
  });

  it('should return correct default position', async () => {
    const { GaussianSplatControl } = await import('../lib/core/GaussianSplatControl');
    
    const control1 = new GaussianSplatControl();
    expect(control1.getDefaultPosition()).toBe('top-right');

    const control2 = new GaussianSplatControl({ position: 'top-left' });
    expect(control2.getDefaultPosition()).toBe('top-left');
  });

  it('should update options', async () => {
    const { GaussianSplatControl } = await import('../lib/core/GaussianSplatControl');
    const control = new GaussianSplatControl({ collapsed: true });

    expect(control.getState().collapsed).toBe(true);

    control.update({ collapsed: false });
    expect(control.getState().collapsed).toBe(false);
  });
});

describe('useGaussianSplat hook', () => {
  it('should export useGaussianSplat', async () => {
    const module = await import('../lib/hooks/useGaussianSplat');
    expect(module.useGaussianSplat).toBeDefined();
  });
});
