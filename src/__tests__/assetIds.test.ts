import { describe, it, expect, vi } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';

vi.mock('maplibre-gl', () => ({ default: {} }));

vi.mock('three', () => ({
  AmbientLight: vi.fn(),
  DirectionalLight: vi.fn(),
  MathUtils: { degToRad: (deg: number) => deg * (Math.PI / 180) },
}));

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    loadAsync: vi.fn().mockImplementation(async () => ({
      scene: { scale: { set: vi.fn(), setScalar: vi.fn() } },
    })),
  })),
}));

const scene = { addObject: vi.fn(), removeObject: vi.fn() };

vi.mock('@dvt3d/maplibre-three-plugin', () => ({
  MapScene: vi.fn().mockImplementation(() => ({
    addLight: vi.fn(),
    addObject: (object: unknown) => scene.addObject(object),
    removeObject: (object: unknown) => scene.removeObject(object),
    on: vi.fn(),
  })),
  Creator: {
    createMercatorRTCGroup: vi.fn().mockImplementation(() => ({ add: vi.fn() })),
  },
}));

vi.mock('@sparkjsdev/spark', () => ({
  SplatMesh: vi.fn().mockImplementation(() => ({ scale: { setScalar: vi.fn() } })),
}));

/**
 * A minimal map stand-in with the members the control touches.
 */
function fakeMap() {
  return {
    getCenter: () => ({ lng: 1, lat: 2 }),
    flyTo: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    triggerRepaint: vi.fn(),
  };
}

async function mountedControl(
  options: ConstructorParameters<
    typeof import('../lib/core/GaussianSplatControl').GaussianSplatControl
  >[0] = {}
) {
  const { GaussianSplatControl } = await import('../lib/core/GaussianSplatControl');
  const control = new GaussianSplatControl(options);
  const map = fakeMap();
  control.onAdd(map as unknown as MapLibreMap);
  return { control, map };
}

describe('asset ids', () => {
  it('generates splat-N and model-N ids by default', async () => {
    const { control } = await mountedControl();
    expect(await control.loadSplat('https://example.com/a.splat')).toBe('splat-0');
    expect(await control.loadSplat('https://example.com/b.splat')).toBe('splat-1');
    expect(await control.loadModel('https://example.com/a.glb')).toBe('model-0');
  });

  it('loads under an explicit id', async () => {
    const { control } = await mountedControl();
    expect(await control.loadSplat('https://example.com/a.splat', { id: 'splat-7' })).toBe(
      'splat-7'
    );
    expect(await control.load('https://example.com/a.gltf', { id: 'my-model' })).toBe('my-model');
    expect(control.getSplatIds()).toEqual(['splat-7']);
    expect(control.getModelIds()).toEqual(['my-model']);
  });

  it('rejects an explicit id that is already loaded, without loading', async () => {
    const { control } = await mountedControl();
    await control.loadSplat('https://example.com/a.splat', { id: 'x' });
    scene.addObject.mockClear();
    await expect(control.loadModel('https://example.com/a.glb', { id: 'x' })).rejects.toThrow(
      'already loaded'
    );
    expect(scene.addObject).not.toHaveBeenCalled();
    expect(control.getModelIds()).toEqual([]);
  });

  it('rejects an explicit model id taken by a concurrent load, leaving the scene clean', async () => {
    const { control } = await mountedControl();
    scene.addObject.mockClear();
    const first = control.loadModel('https://example.com/a.glb', { id: 'dup' });
    const second = control.loadModel('https://example.com/b.glb', { id: 'dup' });
    expect(await first).toBe('dup');
    await expect(second).rejects.toThrow('already loaded');
    expect(scene.addObject).toHaveBeenCalledTimes(1);
  });

  it('skips loaded ids when generating', async () => {
    const { control } = await mountedControl();
    await control.loadSplat('https://example.com/a.splat', { id: 'splat-0' });
    await control.loadSplat('https://example.com/a.splat', { id: 'splat-1' });
    expect(await control.loadSplat('https://example.com/b.splat')).toBe('splat-2');
  });

  it('skips ids the app reserves', async () => {
    const reserved = new Set(['model-0', 'model-1', 'splat-0']);
    const { control } = await mountedControl({ isIdReserved: (id) => reserved.has(id) });
    expect(await control.loadModel('https://example.com/a.glb')).toBe('model-2');
    expect(await control.loadSplat('https://example.com/a.splat')).toBe('splat-1');
    // The counter moves past the id it handed out.
    reserved.clear();
    expect(await control.loadModel('https://example.com/b.glb')).toBe('model-3');
  });

  it('lets an explicit id use a reserved one', async () => {
    const { control } = await mountedControl({ isIdReserved: () => true });
    expect(await control.loadSplat('https://example.com/a.splat', { id: 'splat-0' })).toBe(
      'splat-0'
    );
  });
});

describe('asset placement', () => {
  it('reports the resolved placement of a splat and a model', async () => {
    const { control } = await mountedControl({
      defaultRotation: [1, 2, 3],
      defaultModelRotation: [4, 5, 6],
      defaultScale: 0.5,
    });
    const splatId = await control.loadSplat('https://example.com/a.splat', {
      longitude: 10,
      latitude: 20,
      altitude: 30,
    });
    expect(control.getAssetPlacement(splatId)).toEqual({
      id: splatId,
      type: 'splat',
      url: 'https://example.com/a.splat',
      longitude: 10,
      latitude: 20,
      altitude: 30,
      rotation: [1, 2, 3],
      scale: 0.5,
    });

    const modelId = await control.loadModel('https://example.com/a.glb', {
      rotation: [7, 8, 9],
      scale: 2,
    });
    expect(control.getAssetPlacement(modelId)).toMatchObject({
      id: modelId,
      type: 'model',
      longitude: 10,
      latitude: 20,
      rotation: [7, 8, 9],
      scale: 2,
    });
    expect(control.getAssetPlacement('missing')).toBeNull();
  });

  it('returns a copy of the rotation', async () => {
    const { control } = await mountedControl();
    const id = await control.loadSplat('https://example.com/a.splat');
    control.getAssetPlacement(id)!.rotation[0] = 999;
    expect(control.getAssetPlacement(id)!.rotation[0]).not.toBe(999);
  });

  it('includes the placement in load events', async () => {
    const { control } = await mountedControl();
    const onSplat = vi.fn();
    const onModel = vi.fn();
    control.on('splatload', onSplat);
    control.on('modelload', onModel);
    const splatId = await control.loadSplat('https://example.com/a.splat', { scale: 3 });
    const modelId = await control.loadModel('https://example.com/a.glb');
    expect(onSplat.mock.calls[0][0].placement).toEqual(control.getAssetPlacement(splatId));
    expect(onModel.mock.calls[0][0].placement).toEqual(control.getAssetPlacement(modelId));
    expect(onSplat.mock.calls[0][0].placement.scale).toBe(3);
  });
});

describe('per-load flyTo', () => {
  it('overrides the control option for one call', async () => {
    const { control, map } = await mountedControl({ flyTo: true });
    await control.loadSplat('https://example.com/a.splat', { flyTo: false });
    await control.loadModel('https://example.com/a.glb', { flyTo: false });
    expect(map.flyTo).not.toHaveBeenCalled();
    await control.loadSplat('https://example.com/b.splat');
    expect(map.flyTo).toHaveBeenCalledTimes(1);
  });

  it('can fly when the control option is off', async () => {
    const { control, map } = await mountedControl({ flyTo: false });
    await control.loadModel('https://example.com/a.glb', { flyTo: true });
    expect(map.flyTo).toHaveBeenCalledTimes(1);
  });
});

describe('show and hide', () => {
  it('hides and shows the container and emits events', async () => {
    const { control } = await mountedControl();
    const container = (control as unknown as { _container: HTMLElement })._container;
    const onShow = vi.fn();
    const onHide = vi.fn();
    control.on('show', onShow);
    control.on('hide', onHide);

    expect(control.isVisible()).toBe(true);
    control.hide();
    control.hide();
    expect(container.style.display).toBe('none');
    expect(control.isVisible()).toBe(false);
    expect(onHide).toHaveBeenCalledTimes(1);

    // Re-rendering the panel keeps it hidden.
    control.expand();
    expect(container.style.display).toBe('none');

    control.show();
    expect(container.style.display).toBe('');
    expect(onShow).toHaveBeenCalledTimes(1);
  });

  it('applies a hide made before the control is added', async () => {
    const { GaussianSplatControl } = await import('../lib/core/GaussianSplatControl');
    const control = new GaussianSplatControl();
    control.hide();
    const container = control.onAdd(fakeMap() as unknown as MapLibreMap);
    expect(container.style.display).toBe('none');
  });
});

describe('failed id claims', () => {
  it('adds nothing to the scene when isIdReserved throws', async () => {
    const { control } = await mountedControl({
      isIdReserved: () => {
        throw new Error('boom');
      },
    });
    scene.addObject.mockClear();
    await expect(control.loadSplat('https://example.com/a.splat')).rejects.toThrow('boom');
    await expect(control.loadModel('https://example.com/a.glb')).rejects.toThrow('boom');
    expect(scene.addObject).not.toHaveBeenCalled();
  });

  it('stores the rotation as it was when the load started', async () => {
    const { control } = await mountedControl();
    const rotation: [number, number, number] = [1, 2, 3];
    const pending = control.loadModel('https://example.com/a.glb', { rotation });
    rotation[0] = 99;
    const id = await pending;
    expect(control.getAssetPlacement(id)!.rotation).toEqual([1, 2, 3]);
  });
});
