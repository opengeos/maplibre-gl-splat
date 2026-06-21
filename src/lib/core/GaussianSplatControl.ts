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
/**
 * A named sample asset offered as a one-click entry in the panel's
 * "Load sample data" dropdown. Picking it fills the URL input.
 */
export interface GaussianSplatSampleDataset {
  /** Label shown in the dropdown. */
  label: string;
  /** Asset URL filled into the input when this entry is picked. */
  url: string;
}

export interface GaussianSplatControlOptions {
  /** Position on the map. Default: 'top-right'. */
  position?: ControlPosition;
  /** Sample assets shown as a "Load sample data" dropdown above the URL input (hidden when empty). */
  sampleData?: GaussianSplatSampleDataset[];
  /** Placeholder shown in the sample-data dropdown. Default: 'Load sample data...'. */
  sampleDataLabel?: string;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control starts collapsed. Default: true. */
  collapsed?: boolean;
  /** Title for the control panel. Default: 'Gaussian Splats'. */
  title?: string;
  /** Panel width in pixels. Default: 320. */
  panelWidth?: number;
  /**
   * Deprecated. The panel now sizes to its content and grows to the room
   * available between its corner and the opposite map edge, capped dynamically.
   * Retained for backward compatibility; no longer forces a fixed height.
   * Default: 500.
   */
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
  sampleData: [],
  sampleDataLabel: 'Load sample data...',
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
 * Minimum width the panel can be shrunk to with the resize handle (px).
 */
const PANEL_MIN_WIDTH = 260;

/**
 * Minimum height the panel can be shrunk to with the resize handle (px).
 */
const PANEL_MIN_HEIGHT = 180;

/**
 * Breathing room kept between the panel and the opposite map edge (px).
 */
const PANEL_EDGE_MARGIN = 12;

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
  private _panel?: HTMLElement;
  private _options: Required<GaussianSplatControlOptions>;
  private _state: GaussianSplatControlState;
  private _eventHandlers: Map<GaussianSplatEvent, Set<GaussianSplatEventHandler>> = new Map();

  // Panel sizing: user-chosen size from the resize handle (px), re-applied on
  // every render / reposition so it survives re-render and window resize.
  private _userPanelSize: { width: number; height: number } | null = null;
  private _resizeHandler?: () => void;
  private _mapResizeHandler?: () => void;

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

    // Keep the panel's dynamic max-height and any user-chosen size in sync with
    // the available room when the window or the map container is resized.
    this._resizeHandler = () => {
      if (!this._state.collapsed) this._updatePanelSize();
    };
    window.addEventListener('resize', this._resizeHandler);
    this._mapResizeHandler = () => {
      if (!this._state.collapsed) this._updatePanelSize();
    };
    map.on('resize', this._mapResizeHandler);

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

    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = undefined;
    }
    if (this._mapResizeHandler && this._map) {
      this._map.off('resize', this._mapResizeHandler);
      this._mapResizeHandler = undefined;
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
    container.className = `maplibregl-ctrl maplibregl-ctrl-group maplibre-gl-splat ${this._options.className || ''}`;
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
    // Size to content but grow to the room available between the panel and the
    // opposite map edge (computed in _updatePanelSize). A flex column keeps the
    // header / resize handle fixed while the content area scrolls on overflow.
    // Do not force a fixed height here; maxHeight is driven dynamically.
    panel.style.cssText = `
      box-sizing: border-box;
      padding: 12px;
      position: relative;
      width: ${this._options.panelWidth}px;
      display: flex;
      flex-direction: column;
      font-size: 13px;
      color: #333;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      flex: 0 0 auto;
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

    // Scrolling content area: grows to fill the capped panel height and scrolls
    // only when the content overflows. min-height: 0 lets it shrink in the flex
    // column so the overflow actually engages.
    const content = document.createElement('div');
    content.className = 'maplibre-gl-splat-content';
    // scrollbar-gutter reserves space for the scrollbar so it does not overlay
    // the right edge of the form fields when the content scrolls.
    content.style.cssText =
      'flex: 1 1 auto; overflow-y: auto; min-height: 0; scrollbar-gutter: stable;';

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
    const sampleDropdown = this._createSampleDropdown((url) => {
      urlInput.value = url;
      this._state.url = url;
    });
    if (sampleDropdown) content.appendChild(sampleDropdown);
    content.appendChild(urlGroup);

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
    content.appendChild(locGroup);

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
    content.appendChild(rotGroup);

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
    content.appendChild(scaleGroup);

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
    content.appendChild(loadBtn);

    // Status/error
    if (this._state.loading) {
      content.appendChild(this._createStatus('Loading...', 'info'));
    } else if (this._state.error) {
      content.appendChild(this._createStatus(this._state.error, 'error'));
    } else if (this._state.status) {
      content.appendChild(this._createStatus(this._state.status, 'success'));
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

      content.appendChild(listDiv);
    }

    panel.appendChild(content);
    this._addResizeHandles(panel);

    this._container.appendChild(panel);
    this._panel = panel;

    // Drive the dynamic max-height and re-apply any user-chosen size now that
    // the panel is in the DOM and its geometry is known.
    this._updatePanelSize();
  }

  /**
   * Detect which corner the control is docked in by inspecting the MapLibre
   * control container's position class.
   *
   * @returns The corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'.
   */
  private _getControlPosition():
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right' {
    const parent = this._container?.parentElement;
    if (parent?.classList.contains('maplibregl-ctrl-top-left')) return 'top-left';
    if (parent?.classList.contains('maplibregl-ctrl-bottom-left')) return 'bottom-left';
    if (parent?.classList.contains('maplibregl-ctrl-bottom-right')) return 'bottom-right';
    return 'top-right';
  }

  /**
   * Returns the map container element MapLibre renders into, used to measure the
   * room available for the panel.
   *
   * @returns The map container element, or undefined if the map is detached.
   */
  private _getMapContainer(): HTMLElement | undefined {
    if (typeof this._map?.getContainer !== 'function') return undefined;
    return this._map.getContainer();
  }

  /**
   * Size the panel to its content while letting it grow up to the vertical room
   * available between its anchored corner and the opposite map edge (less a
   * small margin). Does not force a fixed height: a dynamic max-height is set so
   * the content area scrolls only on overflow. Re-applies any user-chosen size
   * from the resize handle so it survives re-render and window / map resize.
   */
  private _updatePanelSize(): void {
    if (!this._panel) return;
    const mapContainer = this._getMapContainer();
    if (!mapContainer) return;

    const mapRect = mapContainer.getBoundingClientRect();
    const panelRect = this._panel.getBoundingClientRect();
    const position = this._getControlPosition();
    const bottom = position.startsWith('bottom');

    // Offset of the panel's anchored (top or bottom) edge from the same map
    // edge. The panel is in normal flow inside the corner-anchored control
    // container, so its current rect already reflects that offset.
    const anchorOffset = bottom
      ? mapRect.bottom - panelRect.bottom
      : panelRect.top - mapRect.top;

    // Room from the anchored edge to the opposite map edge, less a margin. The
    // 160px floor keeps the panel usable on a tiny map; overflow-y then scrolls.
    const available = Math.max(
      160,
      mapRect.height - anchorOffset - PANEL_EDGE_MARGIN
    );
    // Cap at the room actually available (and a hard 720px ceiling), not 80vh:
    // an 80vh cap is smaller than the available room on common window sizes, so
    // a form that would otherwise fit was forced to scroll. The panel still
    // sizes to its content and only scrolls when the content exceeds this cap.
    this._panel.style.maxHeight = `min(720px, ${available}px)`;

    this._applyUserPanelSize();
  }

  /**
   * Apply the user-chosen panel size from the resize handle, clamped to the room
   * available from the panel's anchored corner to the opposite map edge so a
   * small map cannot leave an overflowing panel after re-render.
   */
  private _applyUserPanelSize(): void {
    if (!this._panel || !this._userPanelSize) return;
    const mapContainer = this._getMapContainer();
    if (!mapContainer) return;

    const mapRect = mapContainer.getBoundingClientRect();
    const panelRect = this._panel.getBoundingClientRect();
    const position = this._getControlPosition();
    const right = position.endsWith('right');
    const bottom = position.startsWith('bottom');

    const maxW =
      (right ? panelRect.right - mapRect.left : mapRect.right - panelRect.left) -
      PANEL_EDGE_MARGIN;
    const maxH =
      (bottom ? panelRect.bottom - mapRect.top : mapRect.bottom - panelRect.top) -
      PANEL_EDGE_MARGIN;

    const width = Math.min(
      Math.max(PANEL_MIN_WIDTH, this._userPanelSize.width),
      Math.max(0, maxW)
    );
    const height = Math.min(
      Math.max(PANEL_MIN_HEIGHT, this._userPanelSize.height),
      Math.max(0, maxH)
    );

    this._panel.style.maxHeight = 'none';
    this._panel.style.width = `${width}px`;
    this._panel.style.height = `${height}px`;
  }

  /**
   * Add two pointer-driven resize grips, one in each bottom corner of the
   * panel, matching the UX shipped in maplibre-gl-vector. The bottom-right grip
   * grows the panel rightward, the bottom-left grip grows it leftward, and both
   * grow it downward. Custom grips are used instead of CSS `resize`, which is
   * unreliable in WebKitGTK. The chosen size is persisted on the control and
   * re-applied (clamped to the room available) on re-render and window / map
   * resize.
   *
   * @param panel - The panel element to make resizable.
   */
  private _addResizeHandles(panel: HTMLElement): void {
    for (const side of ['left', 'right'] as const) {
      const handle = document.createElement('div');
      handle.className = `maplibre-gl-splat-resize-handle maplibre-gl-splat-resize-${side}`;
      handle.setAttribute('aria-hidden', 'true');
      // This control styles every element inline because the bundled stylesheet
      // is not guaranteed to be loaded by the host app, so the grip is
      // positioned and drawn here rather than via a class. A diagonal-stripe
      // background reads as a resize affordance and is visible on light and dark
      // panels without needing a pseudo-element.
      handle.style.cssText = `
        position: absolute;
        bottom: 0;
        ${side}: 0;
        width: 16px;
        height: 16px;
        z-index: 5;
        cursor: ${side === 'right' ? 'nwse' : 'nesw'}-resize;
        touch-action: none;
        opacity: 0.6;
        background-image: repeating-linear-gradient(
          ${side === 'right' ? '135deg' : '45deg'},
          rgba(128, 128, 128, 0.9) 0 1px,
          transparent 1px 3px
        );
      `;
      handle.addEventListener('pointerdown', (event) =>
        this._beginResize(event, panel, handle)
      );
      panel.appendChild(handle);
    }
  }

  /**
   * Start a pointer-driven resize from one of the bottom-corner grips.
   *
   * The splat panel is a flowed child of the corner-anchored MapLibre control
   * container, which already holds it pinned at its docked corner. So the drag
   * only changes the panel's `width` / `height`; it never touches
   * `position` / `left` / `top` / `right` / `bottom`. (An earlier version used
   * `position: fixed`, but MapLibre's map and control containers carry a CSS
   * `transform`, which makes `fixed` resolve relative to that transformed
   * ancestor instead of the viewport, so the pinned coordinates were wrong and
   * the panel jumped.)
   *
   * On pointerdown the panel's docked edges are captured from its bounding rect
   * and held fixed for the whole drag. The docked corner is read from
   * `_getControlPosition()`: `right` panels keep their right edge fixed and grow
   * leftward into the map, `bottom` panels keep their bottom edge fixed and grow
   * upward. On each move the interior corner follows the pointer:
   * `width  = right  ? dockRight  - pointerX : pointerX - dockLeft`,
   * `height = bottom ? dockBottom - pointerY : pointerY - dockTop`, clamped to a
   * minimum and to the room to the opposite map edge (less an edge margin). Both
   * bottom grips run this same dock-based math. The chosen width / height is
   * kept on `_userPanelSize` and re-applied (clamped) by `_applyUserPanelSize`.
   *
   * Both bottom grips run this same dock-based math, so it takes no `side`.
   *
   * @param event - The pointerdown event.
   * @param panel - The panel element being resized.
   * @param handle - The grip element (for pointer capture).
   */
  private _beginResize(
    event: PointerEvent,
    panel: HTMLElement,
    handle: HTMLElement
  ): void {
    const mapContainer = this._getMapContainer();
    if (!mapContainer) return;
    event.preventDefault();
    // Keep the drag from bubbling to any outside click / close handler.
    event.stopPropagation();

    const mapRect = mapContainer.getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    // The panel's docked edges, fixed for the whole drag. The control container
    // keeps the docked corner pinned, so we only ever change width / height.
    const dockLeft = rect.left;
    const dockRight = rect.right;
    const dockTop = rect.top;
    const dockBottom = rect.bottom;

    const position = this._getControlPosition();
    const right = position.endsWith('right');
    const bottom = position.startsWith('bottom');

    // Clamp the preferred minimums to what the map can actually hold.
    const minWidth = Math.min(
      PANEL_MIN_WIDTH,
      Math.max(120, mapRect.width - 2 * PANEL_EDGE_MARGIN)
    );
    const minHeight = Math.min(
      PANEL_MIN_HEIGHT,
      Math.max(120, mapRect.height - 2 * PANEL_EDGE_MARGIN)
    );

    // Room from the docked edge to the opposite map edge, less an edge margin.
    const maxWidth = Math.max(
      minWidth,
      (right ? dockRight - mapRect.left : mapRect.right - dockLeft) -
        PANEL_EDGE_MARGIN
    );
    const maxHeight = Math.max(
      minHeight,
      (bottom ? dockBottom - mapRect.top : mapRect.bottom - dockTop) -
        PANEL_EDGE_MARGIN
    );

    // Only width / height change during the drag. The flow layout and the
    // dynamic max caps are dropped so the panel can size freely.
    panel.style.boxSizing = 'border-box';
    panel.style.maxWidth = 'none';
    panel.style.maxHeight = 'none';

    const onMove = (moveEvent: PointerEvent): void => {
      // The interior corner follows the pointer while the docked edges stay put.
      const rawWidth = right
        ? dockRight - moveEvent.clientX
        : moveEvent.clientX - dockLeft;
      const rawHeight = bottom
        ? dockBottom - moveEvent.clientY
        : moveEvent.clientY - dockTop;

      const nextWidth = Math.max(minWidth, Math.min(rawWidth, maxWidth));
      const nextHeight = Math.max(minHeight, Math.min(rawHeight, maxHeight));

      panel.style.width = `${nextWidth}px`;
      panel.style.height = `${nextHeight}px`;
      this._userPanelSize = { width: nextWidth, height: nextHeight };
    };

    const cleanup = (): void => {
      try {
        handle.releasePointerCapture?.(event.pointerId);
      } catch {
        // No active capture to release (e.g. synthetic events); ignore.
      }
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', cleanup);
      handle.removeEventListener('pointercancel', cleanup);
      // Re-apply the chosen width / height, clamped to the room available.
      this._updatePanelSize();
    };

    // Attach the move / end listeners first so a failed pointer capture (which
    // can throw for a pointer the platform does not consider active) never stops
    // the drag from being wired up.
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', cleanup);
    // Touch / pen drags can end with pointercancel instead of pointerup.
    handle.addEventListener('pointercancel', cleanup);
    try {
      handle.setPointerCapture?.(event.pointerId);
    } catch {
      // Capture is a nicety (keeps events flowing if the pointer leaves the
      // grip); the listeners above still drive the resize without it.
    }
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

  /**
   * Builds the "Load sample data" dropdown: a custom (not native `<select>`)
   * dropdown so the menu themes correctly in dark mode. Picking an entry calls
   * `onSelect` with its URL. Returns null when no samples are configured.
   */
  private _createSampleDropdown(onSelect: (url: string) => void): HTMLElement | null {
    const samples = this._options.sampleData;
    if (samples.length === 0) return null;
    const placeholder = this._options.sampleDataLabel;

    // Like the rest of this control, the dropdown is styled inline so it lays
    // out correctly even when the bundled stylesheet is not loaded by the host
    // app. Colors are intentionally left to the stylesheet / host overrides;
    // only the layout that the label relies on (full-width trigger, single-line
    // ellipsis) is set here so the label cannot wrap and overlap the next field.
    const triggerLabel = document.createElement('span');
    triggerLabel.className = 'splat-sample-trigger-label';
    triggerLabel.textContent = placeholder;
    triggerLabel.style.cssText = `
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    const caret = document.createElement('span');
    caret.className = 'splat-sample-caret';
    caret.textContent = '▾';
    caret.style.cssText = 'flex: 0 0 auto; font-size: 10px;';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'splat-sample-trigger';
    trigger.style.cssText = `
      box-sizing: border-box;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px;
      font: inherit;
      font-weight: 400;
      text-align: left;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      background: #fff;
      color: #6b7280;
      cursor: pointer;
      outline: none;
    `;
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', placeholder);
    trigger.appendChild(triggerLabel);
    trigger.appendChild(caret);

    const menu = document.createElement('div');
    menu.className = 'splat-sample-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    // No `display` here: the `hidden` attribute toggles visibility, and an
    // inline `display` would override it and keep the menu shown.
    menu.style.cssText = `
      position: absolute;
      top: calc(100% + 2px);
      left: 0;
      right: 0;
      z-index: 10;
      box-sizing: border-box;
      padding: 4px;
      background: #fff;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
      max-height: 220px;
      overflow-y: auto;
    `;

    let menuOpen = false;
    const setMenuOpen = (open: boolean): void => {
      menuOpen = open;
      menu.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
      trigger.classList.toggle('open', open);
      if (open) (menu.firstElementChild as HTMLElement | null)?.focus();
    };

    for (const sample of samples) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'splat-sample-option';
      option.setAttribute('role', 'option');
      option.textContent = sample.label;
      option.style.cssText = `
        display: block;
        box-sizing: border-box;
        width: 100%;
        margin: 0;
        padding: 6px 8px;
        font: inherit;
        font-weight: 400;
        text-align: left;
        border: none;
        border-radius: 3px;
        background: none;
        color: #111827;
        cursor: pointer;
      `;
      option.title = sample.url;
      option.addEventListener('click', (event) => {
        event.stopPropagation();
        setMenuOpen(false);
        trigger.focus();
        onSelect(sample.url);
      });
      menu.appendChild(option);
    }

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      setMenuOpen(!menuOpen);
    });

    const group = this._createFormGroup('Sample data');
    const dropdown = document.createElement('div');
    dropdown.className = 'splat-sample-dropdown';
    dropdown.style.cssText = 'position: relative;';
    dropdown.appendChild(trigger);
    dropdown.appendChild(menu);
    group.appendChild(dropdown);

    group.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
        trigger.focus();
      }
    });
    group.addEventListener('focusout', (e) => {
      const next = (e as FocusEvent).relatedTarget as Node | null;
      if (!next || !group.contains(next)) setMenuOpen(false);
    });

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
