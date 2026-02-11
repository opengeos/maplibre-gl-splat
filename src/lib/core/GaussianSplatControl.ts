import type { IControl, Map as MapLibreMap, ControlPosition } from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - MTP types not fully typed
import * as MTP from '@dvt3d/maplibre-three-plugin';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Spark types not fully typed
import { SplatMesh } from '@sparkjsdev/spark';

/**
 * Options for configuring the GaussianSplatControl.
 */
export interface GaussianSplatControlOptions {
  /** Position on the map. Default: 'top-right'. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control starts collapsed. Default: true. */
  collapsed?: boolean;
  /** Title for the control panel. Default: 'Gaussian Splats'. */
  title?: string;
  /** Panel width in pixels. Default: 320. */
  panelWidth?: number;
  /** Maximum height of the panel in pixels. Default: 500. */
  maxHeight?: number;
  /** Default URL to load. */
  defaultUrl?: string;
  /** Auto-load the default URL when control is added. Default: false. */
  loadDefaultUrl?: boolean;
  /** Default opacity (0-1). Default: 1. */
  defaultOpacity?: number;
  /** Default rotation in degrees [x, y, z] for splats. Default: [-90, 90, 0]. */
  defaultRotation?: [number, number, number];
  /** Default rotation in degrees [x, y, z] for GLTF/GLB models. Default: [90, 0, 0]. */
  defaultModelRotation?: [number, number, number];
  /** Default scale. Default: 1. */
  defaultScale?: number;
  /** Default longitude for splat placement. */
  defaultLongitude?: number;
  /** Default latitude for splat placement. */
  defaultLatitude?: number;
  /** Default altitude for splat placement. Default: 0. */
  defaultAltitude?: number;
  /** Fly to splat location after loading. Default: true. */
  flyTo?: boolean;
  /** Zoom level when flying to splat. Default: 18. */
  flyToZoom?: number;
}

/**
 * Internal state of the GaussianSplatControl.
 */
export interface GaussianSplatControlState {
  collapsed: boolean;
  url: string;
  loading: boolean;
  error: string | null;
  status: string | null;
  hasLayer: boolean;
  layerCount: number;
  opacity: number;
  rotation: [number, number, number];
  scale: number;
  longitude: number;
  latitude: number;
  altitude: number;
}

/**
 * Event types for the GaussianSplatControl.
 */
export type GaussianSplatEvent =
  | 'expand'
  | 'collapse'
  | 'show'
  | 'hide'
  | 'splatload'
  | 'splatremove'
  | 'modelload'
  | 'modelremove'
  | 'error';

/**
 * Event handler function type.
 */
export type GaussianSplatEventHandler = (event: {
  type: GaussianSplatEvent;
  state: GaussianSplatControlState;
  url?: string;
  error?: string;
  splatId?: string;
  modelId?: string;
}) => void;

/**
 * Internal splat layer info.
 */
interface SplatLayerInfo {
  id: string;
  url: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mesh: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rtcGroup: any;
  longitude: number;
  latitude: number;
  altitude: number;
}

/**
 * Internal model (GLTF/GLB) layer info.
 */
interface ModelLayerInfo {
  id: string;
  url: string;
  scene: THREE.Group;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rtcGroup: any;
  longitude: number;
  latitude: number;
  altitude: number;
}

/**
 * Default options for the GaussianSplatControl.
 */
const DEFAULT_OPTIONS: Required<GaussianSplatControlOptions> = {
  position: 'top-right',
  className: '',
  collapsed: true,
  title: 'Gaussian Splats',
  panelWidth: 320,
  maxHeight: 500,
  defaultUrl: '',
  loadDefaultUrl: false,
  defaultOpacity: 1,
  defaultRotation: [-90, 90, 0],
  defaultModelRotation: [90, 0, 0],
  defaultScale: 1,
  defaultLongitude: 0,
  defaultLatitude: 0,
  defaultAltitude: 0,
  flyTo: true,
  flyToZoom: 18,
};

/**
 * Splat icon SVG for the control button.
 */
const SPLAT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="3"/>
  <circle cx="12" cy="12" r="7" stroke-dasharray="4 2"/>
  <circle cx="12" cy="12" r="10" stroke-dasharray="2 3"/>
</svg>`;

/**
 * A control for loading and displaying Gaussian Splat 3D scenes on a MapLibre map.
 *
 * Supports .splat, .ply, .spz, .ksplat, and .sog file formats.
 * Uses THREE.js via maplibre-three-plugin for rendering.
 *
 * @example
 * ```typescript
 * const splatControl = new GaussianSplatControl({
 *   defaultUrl: 'https://example.com/scene.splat',
 *   loadDefaultUrl: true,
 * });
 * map.addControl(splatControl, 'top-right');
 * ```
 */
export class GaussianSplatControl implements IControl {
  private _map?: MapLibreMap;
  private _container?: HTMLElement;
  // @ts-expect-error - Used for future panel reference
  private _panel?: HTMLElement;
  private _options: Required<GaussianSplatControlOptions>;
  private _state: GaussianSplatControlState;
  private _eventHandlers: Map<GaussianSplatEvent, Set<GaussianSplatEventHandler>> = new Map();

  // THREE.js / MapLibre bridge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _mapScene?: any;
  private _splatLayers: Map<string, SplatLayerInfo> = new Map();
  private _modelLayers: Map<string, ModelLayerInfo> = new Map();
  private _layerCounter = 0;
  private _modelCounter = 0;
  private _gltfLoader?: GLTFLoader;
  private _idleHandler?: () => void;

  constructor(options?: GaussianSplatControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      collapsed: this._options.collapsed,
      url: this._options.defaultUrl,
      loading: false,
      error: null,
      status: null,
      hasLayer: false,
      layerCount: 0,
      opacity: this._options.defaultOpacity,
      rotation: this._options.defaultRotation,
      scale: this._options.defaultScale,
      longitude: this._options.defaultLongitude,
      latitude: this._options.defaultLatitude,
      altitude: this._options.defaultAltitude,
    };
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();
    this._render();

    // Initialize THREE.js scene
    this._initMapScene();

    // Auto-load default URL if specified
    if (this._options.loadDefaultUrl && this._options.defaultUrl) {
      this._idleHandler = () => {
        // Check if control is still attached (handles React StrictMode cleanup)
        if (this._map && this._mapScene) {
          this.load(this._options.defaultUrl);
        }
      };
      map.once('idle', this._idleHandler);
    }

    return this._container;
  }

  onRemove(): void {
    // Remove idle handler if pending
    if (this._idleHandler && this._map) {
      this._map.off('idle', this._idleHandler);
      this._idleHandler = undefined;
    }

    this._removeAllLayers();

    this._mapScene = undefined;
    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._panel = undefined;
  }

  getDefaultPosition(): ControlPosition {
    return this._options.position;
  }

  /**
   * Expand the control panel.
   */
  expand(): void {
    if (this._state.collapsed) {
      this._state.collapsed = false;
      this._render();
      this._emit('expand', {});
    }
  }

  /**
   * Collapse the control panel.
   */
  collapse(): void {
    if (!this._state.collapsed) {
      this._state.collapsed = true;
      this._render();
      this._emit('collapse', {});
    }
  }

  /**
   * Toggle the control panel.
   */
  toggle(): void {
    if (this._state.collapsed) this.expand();
    else this.collapse();
  }

  /**
   * Get the current state.
   */
  getState(): GaussianSplatControlState {
    return { ...this._state };
  }

  /**
   * Update control options.
   */
  update(options: Partial<GaussianSplatControlOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.collapsed !== undefined) this._state.collapsed = options.collapsed;
    this._render();
  }

  /**
   * Add an event listener.
   */
  on(event: GaussianSplatEvent, handler: GaussianSplatEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove an event listener.
   */
  off(event: GaussianSplatEvent, handler: GaussianSplatEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Load a 3D asset from a URL (auto-detects file type).
   * Routes GLTF/GLB files to loadModel(), all others to loadSplat().
   */
  async load(
    url: string,
    options?: {
      longitude?: number;
      latitude?: number;
      altitude?: number;
      rotation?: [number, number, number];
      scale?: number;
    }
  ): Promise<string> {
    const extension = this._getFileExtension(url);
    if (extension === 'gltf' || extension === 'glb') {
      // Use GLTF-specific rotation defaults if not explicitly set
      const modelOptions = { ...options };
      if (!modelOptions.rotation) {
        modelOptions.rotation = this._options.defaultModelRotation;
      }
      return this.loadModel(url, modelOptions);
    }
    return this.loadSplat(url, options);
  }

  /**
   * Get the file extension from a URL.
   */
  private _getFileExtension(url: string): string {
    const pathname = new URL(url, 'http://dummy').pathname;
    const ext = pathname.split('.').pop()?.toLowerCase() || '';
    return ext;
  }

  /**
   * Load a Gaussian splat from a URL.
   */
  async loadSplat(
    url: string,
    options?: {
      longitude?: number;
      latitude?: number;
      altitude?: number;
      rotation?: [number, number, number];
      scale?: number;
    }
  ): Promise<string> {
    if (!this._map || !this._mapScene) {
      throw new Error('Map not initialized');
    }

    const lng = options?.longitude ?? (this._state.longitude || this._map.getCenter().lng);
    const lat = options?.latitude ?? (this._state.latitude || this._map.getCenter().lat);
    const alt = options?.altitude ?? (this._state.altitude || 0);
    const rotation = options?.rotation ?? this._state.rotation;
    const scale = options?.scale ?? this._state.scale;

    this._state.url = url;
    this._state.loading = true;
    this._state.error = null;
    this._state.status = 'Loading splat...';
    this._state.longitude = lng;
    this._state.latitude = lat;
    this._state.altitude = alt;
    this._render();

    try {
      // Create RTC group for georeferenced positioning
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rtcGroup = (MTP.Creator as any).createMercatorRTCGroup(
        [lng, lat, alt],
        [
          THREE.MathUtils.degToRad(rotation[0]),
          THREE.MathUtils.degToRad(rotation[1]),
          THREE.MathUtils.degToRad(rotation[2]),
        ],
        scale
      );

      // Create the splat mesh - it handles loading internally
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const splatMesh = new (SplatMesh as any)({ url });

      // Apply scale
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((splatMesh as any).scale?.setScalar) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (splatMesh as any).scale.setScalar(scale);
      }

      // Add to RTC group and scene immediately
      // SplatMesh loads asynchronously and renders when ready
      rtcGroup.add(splatMesh);
      this._mapScene.addObject(rtcGroup);

      // Store layer info
      const layerId = `splat-${this._layerCounter++}`;
      this._splatLayers.set(layerId, {
        id: layerId,
        url,
        mesh: splatMesh,
        rtcGroup,
        longitude: lng,
        latitude: lat,
        altitude: alt,
      });

      // Fly to location
      if (this._options.flyTo) {
        this._map.flyTo({
          center: [lng, lat],
          zoom: this._options.flyToZoom,
          pitch: 60,
          duration: 1500,
        });
      }

      this._state.hasLayer = true;
      this._state.layerCount = this._splatLayers.size + this._modelLayers.size;
      this._state.loading = false;
      this._state.status = `Loaded: ${this._getFilename(url)}`;
      this._render();
      this._emit('splatload', { url, splatId: layerId });

      return layerId;
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Failed to load: ${err instanceof Error ? err.message : String(err)}`;
      this._render();
      this._emit('error', { error: this._state.error });
      throw err;
    }
  }

  /**
   * Load a GLTF/GLB 3D model from a URL.
   *
   * @example
   * ```typescript
   * const modelId = await control.loadModel(
   *   'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
   *   { longitude: 148.9819, latitude: -35.39847 }
   * );
   * ```
   */
  async loadModel(
    url: string,
    options?: {
      longitude?: number;
      latitude?: number;
      altitude?: number;
      rotation?: [number, number, number];
      scale?: number;
    }
  ): Promise<string> {
    if (!this._map || !this._mapScene) {
      throw new Error('Map not initialized');
    }

    const lng = options?.longitude ?? (this._state.longitude || this._map.getCenter().lng);
    const lat = options?.latitude ?? (this._state.latitude || this._map.getCenter().lat);
    const alt = options?.altitude ?? (this._state.altitude || 0);
    // Use model-specific rotation defaults for GLTF/GLB
    const rotation = options?.rotation ?? this._options.defaultModelRotation;
    const scale = options?.scale ?? this._state.scale;

    this._state.url = url;
    this._state.loading = true;
    this._state.error = null;
    this._state.status = 'Loading model...';
    this._state.longitude = lng;
    this._state.latitude = lat;
    this._state.altitude = alt;
    this._render();

    try {
      // Initialize GLTF loader if not already done
      if (!this._gltfLoader) {
        this._gltfLoader = new GLTFLoader();
      }

      // Create RTC group for georeferenced positioning
      // GLTF models need rotation to align with map coordinate system
      // Create RTC group for georeferenced positioning
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rtcGroup = (MTP.Creator as any).createMercatorRTCGroup(
        [lng, lat, alt],
        [
          THREE.MathUtils.degToRad(rotation[0]),
          THREE.MathUtils.degToRad(rotation[1]),
          THREE.MathUtils.degToRad(rotation[2]),
        ],
        scale // Pass user scale to RTC group for mercator coordinate scaling
      );

      // Load the GLTF model
      const gltf = await this._gltfLoader.loadAsync(url);
      const modelScene = gltf.scene;

      // Apply scale with Y-axis flip for proper GLTF orientation
      // MapLibre uses a different coordinate system than GLTF
      // Scale is applied to both RTC group and model (like splats)
      modelScene.scale.set(scale, -scale, scale);

      // Add model to RTC group and scene (lighting is handled by the global scene)
      rtcGroup.add(modelScene);
      this._mapScene.addObject(rtcGroup);

      // Store layer info
      const layerId = `model-${this._modelCounter++}`;
      this._modelLayers.set(layerId, {
        id: layerId,
        url,
        scene: modelScene,
        rtcGroup,
        longitude: lng,
        latitude: lat,
        altitude: alt,
      });

      // Fly to location
      if (this._options.flyTo) {
        this._map.flyTo({
          center: [lng, lat],
          zoom: this._options.flyToZoom,
          pitch: 60,
          duration: 1500,
        });
      }

      this._state.hasLayer = true;
      this._state.layerCount = this._splatLayers.size + this._modelLayers.size;
      this._state.loading = false;
      this._state.status = `Loaded: ${this._getFilename(url)}`;
      this._render();
      this._emit('modelload', { url, modelId: layerId });

      return layerId;
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Failed to load: ${err instanceof Error ? err.message : String(err)}`;
      this._render();
      this._emit('error', { error: this._state.error });
      throw err;
    }
  }

  /**
   * Remove a model layer by ID.
   */
  removeModel(layerId: string): void {
    const layer = this._modelLayers.get(layerId);
    if (!layer || !this._mapScene) return;

    this._mapScene.removeObject(layer.rtcGroup);
    this._modelLayers.delete(layerId);

    this._state.hasLayer = this._splatLayers.size > 0 || this._modelLayers.size > 0;
    this._state.layerCount = this._splatLayers.size + this._modelLayers.size;
    this._state.status = null;
    this._render();
    this._emit('modelremove', { modelId: layerId });
  }

  /**
   * Remove all model layers.
   */
  removeAllModels(): void {
    for (const layerId of this._modelLayers.keys()) {
      this.removeModel(layerId);
    }
  }

  /**
   * Remove a splat layer by ID.
   */
  removeSplat(layerId: string): void {
    const layer = this._splatLayers.get(layerId);
    if (!layer || !this._mapScene) return;

    this._mapScene.removeObject(layer.rtcGroup);
    this._splatLayers.delete(layerId);

    this._state.hasLayer = this._splatLayers.size > 0 || this._modelLayers.size > 0;
    this._state.layerCount = this._splatLayers.size + this._modelLayers.size;
    this._state.status = null;
    this._render();
    this._emit('splatremove', { splatId: layerId });
  }

  /**
   * Remove all splat layers.
   */
  removeAllSplats(): void {
    this._removeAllLayers();
  }

  /**
   * Get all loaded splat layer IDs.
   */
  getSplatIds(): string[] {
    return Array.from(this._splatLayers.keys());
  }

  /**
   * Get info about a specific splat layer.
   */
  getSplatInfo(layerId: string): { url: string; longitude: number; latitude: number; altitude: number } | null {
    const layer = this._splatLayers.get(layerId);
    if (!layer) return null;
    return {
      url: layer.url,
      longitude: layer.longitude,
      latitude: layer.latitude,
      altitude: layer.altitude,
    };
  }

  private _removeAllLayers(): void {
    for (const [layerId] of this._splatLayers) {
      this.removeSplat(layerId);
    }
    for (const [layerId] of this._modelLayers) {
      this.removeModel(layerId);
    }
  }

  private _emit(
    event: GaussianSplatEvent,
    extra?: { url?: string; error?: string; splatId?: string; modelId?: string }
  ): void {
    const handlers = this._eventHandlers.get(event);
    if (!handlers) return;
    const payload = { type: event, state: this._state, ...extra };
    for (const handler of handlers) {
      handler(payload);
    }
  }

  private _initMapScene(): void {
    if (!this._map) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapScene = new (MTP.MapScene as any)(this._map as any);
    this._mapScene = mapScene;
    mapScene.addLight(new THREE.AmbientLight(0xffffff, 1));
    mapScene.addLight(new THREE.DirectionalLight(0xffffff, 0.5));

    // Trigger repaint on post-render
    mapScene.on('postRender', () => {
      this._map?.triggerRepaint();
    });
  }

  private _createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = `maplibregl-ctrl maplibre-gl-splat ${this._options.className || ''}`;
    container.style.background = 'rgba(255, 255, 255, 0.95)';
    container.style.borderRadius = '4px';
    return container;
  }

  private _render(): void {
    if (!this._container) return;
    this._container.innerHTML = '';

    if (this._state.collapsed) {
      this._renderCollapsed();
    } else {
      this._renderExpanded();
    }
  }

  private _renderCollapsed(): void {
    if (!this._container) return;

    const button = document.createElement('button');
    button.className = `maplibre-gl-splat-button${this._state.hasLayer ? ' active' : ''}`;
    button.innerHTML = SPLAT_ICON;
    button.title = this._options.title;
    button.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 29px;
      height: 29px;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      color: ${this._state.hasLayer ? '#0078d7' : '#333'};
    `;
    button.addEventListener('click', () => this.expand());

    this._container.appendChild(button);
  }

  private _renderExpanded(): void {
    if (!this._container) return;

    const panel = document.createElement('div');
    panel.className = 'maplibre-gl-splat-panel';
    panel.style.cssText = `
      padding: 12px;
      width: ${this._options.panelWidth}px;
      max-height: ${this._options.maxHeight}px;
      overflow-y: auto;
      font-size: 13px;
      color: #333;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e0e0e0;
    `;

    const title = document.createElement('span');
    title.textContent = this._options.title;
    title.style.cssText = 'font-weight: 600; font-size: 14px;';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      font-size: 20px;
      color: #666;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    `;
    closeBtn.addEventListener('click', () => this.collapse());
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // URL input
    const urlGroup = this._createFormGroup('3D Asset URL (.splat, .ply, .spz, .gltf, .glb)');
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'https://example.com/model.gltf';
    urlInput.value = this._state.url;
    urlInput.style.cssText = `
      width: 100%;
      padding: 8px 10px;
      font-size: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    `;
    urlInput.addEventListener('input', () => {
      this._state.url = urlInput.value;
    });
    urlGroup.appendChild(urlInput);
    panel.appendChild(urlGroup);

    // Location inputs
    const locGroup = this._createFormGroup('Location (Longitude, Latitude, Altitude)');
    const locRow = document.createElement('div');
    locRow.style.cssText = 'display: flex; gap: 8px;';

    const lngInput = this._createNumberInput('Lng', this._state.longitude, (v) => {
      this._state.longitude = v;
    });
    const latInput = this._createNumberInput('Lat', this._state.latitude, (v) => {
      this._state.latitude = v;
    });
    const altInput = this._createNumberInput('Alt', this._state.altitude, (v) => {
      this._state.altitude = v;
    });

    locRow.appendChild(lngInput);
    locRow.appendChild(latInput);
    locRow.appendChild(altInput);
    locGroup.appendChild(locRow);
    panel.appendChild(locGroup);

    // Rotation inputs (X, Y, Z in degrees)
    const rotGroup = this._createFormGroup('Rotation (°)');
    const rotRow = document.createElement('div');
    rotRow.style.cssText = 'display: flex; gap: 6px;';

    const rotXInput = this._createSmallInput('X', String(this._state.rotation[0]), (val) => {
      this._state.rotation[0] = Number(val) || 0;
    });
    const rotYInput = this._createSmallInput('Y', String(this._state.rotation[1]), (val) => {
      this._state.rotation[1] = Number(val) || 0;
    });
    const rotZInput = this._createSmallInput('Z', String(this._state.rotation[2]), (val) => {
      this._state.rotation[2] = Number(val) || 0;
    });

    rotRow.appendChild(rotXInput);
    rotRow.appendChild(rotYInput);
    rotRow.appendChild(rotZInput);
    rotGroup.appendChild(rotRow);
    panel.appendChild(rotGroup);

    // Scale input
    const scaleGroup = this._createFormGroup('Scale');
    const scaleInput = document.createElement('input');
    scaleInput.type = 'number';
    scaleInput.step = '0.1';
    scaleInput.value = String(this._state.scale);
    scaleInput.style.cssText = `
      width: 100%;
      padding: 8px 10px;
      font-size: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    `;
    scaleInput.addEventListener('input', () => {
      this._state.scale = Number(scaleInput.value) || 1;
    });
    scaleGroup.appendChild(scaleInput);
    panel.appendChild(scaleGroup);

    // Load button
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load 3D Asset';
    loadBtn.disabled = this._state.loading || !this._state.url;
    loadBtn.style.cssText = `
      width: 100%;
      padding: 10px 16px;
      font-size: 12px;
      font-weight: 500;
      border: none;
      border-radius: 4px;
      background: #0078d7;
      color: white;
      cursor: pointer;
      margin-top: 12px;
      opacity: ${this._state.loading || !this._state.url ? '0.5' : '1'};
    `;
    loadBtn.addEventListener('click', () => {
      if (this._state.url) {
        this.load(this._state.url, {
          longitude: this._state.longitude,
          latitude: this._state.latitude,
          altitude: this._state.altitude,
          rotation: this._state.rotation,
          scale: this._state.scale,
        });
      }
    });
    panel.appendChild(loadBtn);

    // Status/error
    if (this._state.loading) {
      panel.appendChild(this._createStatus('Loading...', 'info'));
    } else if (this._state.error) {
      panel.appendChild(this._createStatus(this._state.error, 'error'));
    } else if (this._state.status) {
      panel.appendChild(this._createStatus(this._state.status, 'success'));
    }

    // Layer list (splats and models)
    const totalLayers = this._splatLayers.size + this._modelLayers.size;
    if (totalLayers > 0) {
      const listDiv = document.createElement('div');
      listDiv.style.cssText = `
        margin-top: 16px;
        border-top: 1px solid #e0e0e0;
        padding-top: 12px;
      `;

      const listHeader = document.createElement('div');
      listHeader.textContent = `Layers (${totalLayers})`;
      listHeader.style.cssText = 'font-size: 12px; font-weight: 500; color: #555; margin-bottom: 8px;';
      listDiv.appendChild(listHeader);

      // Splat layers
      for (const [layerId, layer] of this._splatLayers) {
        const item = this._createLayerItem(this._getFilename(layer.url), 'splat', () => {
          this.removeSplat(layerId);
        });
        listDiv.appendChild(item);
      }

      // Model layers
      for (const [layerId, layer] of this._modelLayers) {
        const item = this._createLayerItem(this._getFilename(layer.url), 'model', () => {
          this.removeModel(layerId);
        });
        listDiv.appendChild(item);
      }

      panel.appendChild(listDiv);
    }

    this._container.appendChild(panel);
    this._panel = panel;
  }

  private _createFormGroup(label: string): HTMLElement {
    const group = document.createElement('div');
    group.style.marginBottom = '12px';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'display: block; font-size: 12px; font-weight: 500; color: #555; margin-bottom: 4px;';
    group.appendChild(labelEl);

    return group;
  }

  private _createNumberInput(placeholder: string, value: number, onChange: (v: number) => void): HTMLElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.placeholder = placeholder;
    input.value = String(value);
    input.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      font-size: 11px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
      min-width: 0;
    `;
    input.addEventListener('input', () => {
      onChange(Number(input.value) || 0);
    });
    return input;
  }

  private _createSmallInput(placeholder: string, value: string, onChange: (v: string) => void): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 2px;';

    const label = document.createElement('span');
    label.textContent = placeholder;
    label.style.cssText = 'font-size: 9px; color: #888; text-align: center;';

    const input = document.createElement('input');
    input.type = 'number';
    input.step = '1';
    input.value = value;
    input.style.cssText = `
      width: 100%;
      padding: 4px 6px;
      font-size: 11px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
      text-align: center;
    `;
    input.addEventListener('input', () => {
      onChange(input.value);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    return wrapper;
  }

  private _createStatus(message: string, type: 'info' | 'error' | 'success'): HTMLElement {
    const status = document.createElement('div');
    const colors = {
      info: { bg: '#e3f2fd', color: '#1565c0' },
      error: { bg: '#ffebee', color: '#c62828' },
      success: { bg: '#e8f5e9', color: '#2e7d32' },
    };
    status.textContent = message;
    status.style.cssText = `
      margin-top: 12px;
      padding: 8px 10px;
      font-size: 11px;
      border-radius: 4px;
      background: ${colors[type].bg};
      color: ${colors[type].color};
    `;
    return status;
  }

  private _createLayerItem(name: string, type: 'splat' | 'model', onRemove: () => void): HTMLElement {
    const item = document.createElement('div');
    item.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 8px;
      background: #f8f8f8;
      border-radius: 4px;
      margin-bottom: 4px;
      font-size: 11px;
    `;

    const label = document.createElement('span');
    const typeIcon = type === 'model' ? '📦 ' : '✨ ';
    label.textContent = typeIcon + name;
    label.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    item.appendChild(label);

    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Remove';
    removeBtn.style.cssText = `
      border: none;
      background: transparent;
      cursor: pointer;
      color: #999;
      font-size: 14px;
      padding: 0 4px;
    `;
    removeBtn.addEventListener('click', onRemove);
    item.appendChild(removeBtn);

    return item;
  }

  private _getFilename(url: string): string {
    try {
      const path = new URL(url).pathname;
      return path.split('/').pop() || url;
    } catch {
      return url.split('/').pop() || url;
    }
  }
}
