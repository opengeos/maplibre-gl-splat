import type { CustomLayerAdapter, LayerState } from 'maplibre-gl-layer-control';
import type { GaussianSplatControl } from '../core/GaussianSplatControl';

/**
 * Adapter for integrating Gaussian Splat/3D model layers with maplibre-gl-layer-control.
 *
 * @example
 * ```typescript
 * import { GaussianSplatControl, GaussianSplatLayerAdapter } from 'maplibre-gl-splat';
 * import { LayerControl } from 'maplibre-gl-layer-control';
 *
 * const splatControl = new GaussianSplatControl({ ... });
 * map.addControl(splatControl, 'top-right');
 *
 * const splatAdapter = new GaussianSplatLayerAdapter(splatControl);
 * const layerControl = new LayerControl({
 *   customLayerAdapters: [splatAdapter],
 * });
 * map.addControl(layerControl, 'top-left');
 * ```
 */
export class GaussianSplatLayerAdapter implements CustomLayerAdapter {
  readonly type = 'gaussian-splat';

  private _control: GaussianSplatControl;
  private _changeCallbacks: Array<(event: 'add' | 'remove', layerId: string) => void> = [];
  private _visibilityState: Map<string, boolean> = new Map();
  private _unsubscribe?: () => void;

  constructor(control: GaussianSplatControl) {
    this._control = control;
    this._setupEventListeners();
  }

  private _setupEventListeners(): void {
    const handleSplatLoad = (event: { splatId?: string }) => {
      if (event.splatId) {
        this._visibilityState.set(event.splatId, true);
        this._changeCallbacks.forEach((cb) => cb('add', event.splatId!));
      }
    };

    const handleSplatRemove = (event: { splatId?: string }) => {
      if (event.splatId) {
        this._visibilityState.delete(event.splatId);
        this._changeCallbacks.forEach((cb) => cb('remove', event.splatId!));
      }
    };

    const handleModelLoad = (event: { modelId?: string }) => {
      if (event.modelId) {
        this._visibilityState.set(event.modelId, true);
        this._changeCallbacks.forEach((cb) => cb('add', event.modelId!));
      }
    };

    const handleModelRemove = (event: { modelId?: string }) => {
      if (event.modelId) {
        this._visibilityState.delete(event.modelId);
        this._changeCallbacks.forEach((cb) => cb('remove', event.modelId!));
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._control.on('splatload', handleSplatLoad as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._control.on('splatremove', handleSplatRemove as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._control.on('modelload', handleModelLoad as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._control.on('modelremove', handleModelRemove as any);

    this._unsubscribe = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._control.off('splatload', handleSplatLoad as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._control.off('splatremove', handleSplatRemove as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._control.off('modelload', handleModelLoad as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._control.off('modelremove', handleModelRemove as any);
    };
  }

  getLayerIds(): string[] {
    const splatIds = this._control.getSplatIds();
    // Access model IDs via internal map
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelIds = Array.from(((this._control as any)._modelLayers as Map<string, unknown>)?.keys() ?? []);
    return [...splatIds, ...modelIds];
  }

  getLayerState(layerId: string): LayerState | null {
    const ids = this.getLayerIds();
    if (!ids.includes(layerId)) return null;

    return {
      visible: this._visibilityState.get(layerId) ?? true,
      opacity: this._control.getState().opacity,
      name: this.getName(layerId),
      isCustomLayer: true,
      customLayerType: 'gaussian-splat',
    };
  }

  setVisibility(layerId: string, visible: boolean): void {
    this._visibilityState.set(layerId, visible);

    // Access the internal layer maps to toggle Three.js object visibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctrl = this._control as any;
    const splatLayer = ctrl._splatLayers?.get(layerId);
    if (splatLayer?.rtcGroup) {
      splatLayer.rtcGroup.visible = visible;
      return;
    }
    const modelLayer = ctrl._modelLayers?.get(layerId);
    if (modelLayer?.rtcGroup) {
      modelLayer.rtcGroup.visible = visible;
    }
  }

  setOpacity(layerId: string, opacity: number): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctrl = this._control as any;
    const splatLayer = ctrl._splatLayers?.get(layerId);
    if (splatLayer?.mesh?.material) {
      splatLayer.mesh.material.opacity = opacity;
      splatLayer.mesh.material.transparent = opacity < 1;
      return;
    }
    const modelLayer = ctrl._modelLayers?.get(layerId);
    if (modelLayer?.scene) {
      modelLayer.scene.traverse((child: { material?: { opacity: number; transparent: boolean } }) => {
        if (child.material) {
          child.material.opacity = opacity;
          child.material.transparent = opacity < 1;
        }
      });
    }
  }

  getName(layerId: string): string {
    const info = this._control.getSplatInfo(layerId);
    if (info) {
      return this._getFilename(info.url);
    }
    // Check model layers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelLayer = (this._control as any)._modelLayers?.get(layerId);
    if (modelLayer?.url) {
      return this._getFilename(modelLayer.url);
    }
    return layerId;
  }

  getSymbolType(_layerId: string): string {
    return 'raster';
  }

  removeLayer(layerId: string): void {
    if (layerId.startsWith('splat-')) {
      this._control.removeSplat(layerId);
    } else if (layerId.startsWith('model-')) {
      this._control.removeModel(layerId);
    }
  }

  onLayerChange(callback: (event: 'add' | 'remove', layerId: string) => void): () => void {
    this._changeCallbacks.push(callback);
    return () => {
      const idx = this._changeCallbacks.indexOf(callback);
      if (idx >= 0) this._changeCallbacks.splice(idx, 1);
    };
  }

  destroy(): void {
    this._unsubscribe?.();
    this._changeCallbacks = [];
    this._visibilityState.clear();
  }

  private _getFilename(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      return pathname.split('/').pop() || url;
    } catch {
      return url.split('/').pop() || url;
    }
  }
}
