import { StrictMode, useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GaussianSplatControlReact } from '../../src/react';

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: BASEMAP_STYLE,
      center: [0, 0],
      zoom: 2,
      pitch: 60,
      maxPitch: 85,
      antialias: true,
    });

    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-left');
    mapInstance.on('load', () => setMap(mapInstance));

    return () => mapInstance.remove();
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {map && (
        <GaussianSplatControlReact
          map={map}
          position="top-right"
          collapsed={false}
          title="Gaussian Splats"
          defaultUrl="https://sparkjs.dev/assets/splats/butterfly.spz"
          onSplatLoad={(url, id) => console.log('Loaded:', url, id)}
          onSplatRemove={(id) => console.log('Removed:', id)}
          onError={(err) => console.error('Error:', err)}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
