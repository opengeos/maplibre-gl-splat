import { useState, useCallback } from 'react';
import type { GaussianSplatControlState } from '../core/types';

const DEFAULT_STATE: GaussianSplatControlState = {
  collapsed: true,
  url: '',
  loading: false,
  error: null,
  status: null,
  hasLayer: false,
  layerCount: 0,
  opacity: 1,
  rotation: [-90, 90, 0],
  scale: 1,
  longitude: 0,
  latitude: 0,
  altitude: 0,
};

/**
 * React hook for managing Gaussian splat control state.
 *
 * @example
 * ```tsx
 * const { state, setUrl, setCollapsed, loadSplat } = useGaussianSplat();
 *
 * return (
 *   <GaussianSplatControlReact
 *     map={map}
 *     collapsed={state.collapsed}
 *     defaultUrl={state.url}
 *     onSplatLoad={() => console.log('Loaded!')}
 *   />
 * );
 * ```
 */
export function useGaussianSplat(initialState?: Partial<GaussianSplatControlState>) {
  const [state, setState] = useState<GaussianSplatControlState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setUrl = useCallback((url: string) => {
    setState((prev) => ({ ...prev, url }));
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => ({ ...prev, collapsed }));
  }, []);

  const setLocation = useCallback((longitude: number, latitude: number, altitude?: number) => {
    setState((prev) => ({
      ...prev,
      longitude,
      latitude,
      altitude: altitude ?? prev.altitude,
    }));
  }, []);

  const setScale = useCallback((scale: number) => {
    setState((prev) => ({ ...prev, scale }));
  }, []);

  const setRotation = useCallback((rotation: [number, number, number]) => {
    setState((prev) => ({ ...prev, rotation }));
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: !prev.collapsed }));
  }, []);

  const expand = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: false }));
  }, []);

  const collapse = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: true }));
  }, []);

  return {
    state,
    setState,
    setUrl,
    setCollapsed,
    setLocation,
    setScale,
    setRotation,
    toggle,
    expand,
    collapse,
  };
}
