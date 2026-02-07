import { useEffect, useRef } from 'react';
import type { Map as MapLibreMap, ControlPosition } from 'maplibre-gl';
import { GaussianSplatControl, type GaussianSplatControlOptions, type GaussianSplatEventHandler } from './GaussianSplatControl';

export interface GaussianSplatControlReactProps extends GaussianSplatControlOptions {
  /** MapLibre GL map instance. */
  map: MapLibreMap;
  /** Position for the control. */
  position?: ControlPosition;
  /** Callback when a splat is loaded. */
  onSplatLoad?: (url: string, splatId: string) => void;
  /** Callback when a splat is removed. */
  onSplatRemove?: (splatId: string) => void;
  /** Callback when a GLTF/GLB model is loaded. */
  onModelLoad?: (url: string, modelId: string) => void;
  /** Callback when a GLTF/GLB model is removed. */
  onModelRemove?: (modelId: string) => void;
  /** Callback when an error occurs. */
  onError?: (error: string) => void;
  /** Callback when the control is expanded. */
  onExpand?: () => void;
  /** Callback when the control is collapsed. */
  onCollapse?: () => void;
}

/**
 * React wrapper for the GaussianSplatControl.
 *
 * @example
 * ```tsx
 * <GaussianSplatControlReact
 *   map={map}
 *   position="top-right"
 *   defaultUrl="https://example.com/scene.splat"
 *   loadDefaultUrl
 *   onSplatLoad={(url, id) => console.log('Loaded:', url)}
 * />
 * ```
 */
export function GaussianSplatControlReact({
  map,
  position = 'top-right',
  onSplatLoad,
  onSplatRemove,
  onModelLoad,
  onModelRemove,
  onError,
  onExpand,
  onCollapse,
  ...options
}: GaussianSplatControlReactProps) {
  const controlRef = useRef<GaussianSplatControl | null>(null);

  useEffect(() => {
    if (!map) return;

    const control = new GaussianSplatControl({ ...options, position });
    controlRef.current = control;

    // Set up event handlers
    const handlers: Array<[Parameters<GaussianSplatControl['on']>[0], GaussianSplatEventHandler]> = [];

    if (onSplatLoad) {
      const handler: GaussianSplatEventHandler = (e) => {
        if (e.url && e.splatId) onSplatLoad(e.url, e.splatId);
      };
      control.on('splatload', handler);
      handlers.push(['splatload', handler]);
    }

    if (onSplatRemove) {
      const handler: GaussianSplatEventHandler = (e) => {
        if (e.splatId) onSplatRemove(e.splatId);
      };
      control.on('splatremove', handler);
      handlers.push(['splatremove', handler]);
    }

    if (onModelLoad) {
      const handler: GaussianSplatEventHandler = (e) => {
        if (e.url && e.modelId) onModelLoad(e.url, e.modelId);
      };
      control.on('modelload', handler);
      handlers.push(['modelload', handler]);
    }

    if (onModelRemove) {
      const handler: GaussianSplatEventHandler = (e) => {
        if (e.modelId) onModelRemove(e.modelId);
      };
      control.on('modelremove', handler);
      handlers.push(['modelremove', handler]);
    }

    if (onError) {
      const handler: GaussianSplatEventHandler = (e) => {
        if (e.error) onError(e.error);
      };
      control.on('error', handler);
      handlers.push(['error', handler]);
    }

    if (onExpand) {
      const handler: GaussianSplatEventHandler = () => onExpand();
      control.on('expand', handler);
      handlers.push(['expand', handler]);
    }

    if (onCollapse) {
      const handler: GaussianSplatEventHandler = () => onCollapse();
      control.on('collapse', handler);
      handlers.push(['collapse', handler]);
    }

    map.addControl(control, position);

    return () => {
      // Clean up event handlers
      for (const [event, handler] of handlers) {
        control.off(event, handler);
      }
      map.removeControl(control);
      controlRef.current = null;
    };
  }, [map, position]);

  // Update options when they change
  useEffect(() => {
    if (controlRef.current) {
      controlRef.current.update(options);
    }
  }, [options.collapsed, options.title, options.panelWidth]);

  return null;
}
