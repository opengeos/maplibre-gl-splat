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
          title="3D Assets"
          defaultUrl="https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf"
          defaultLongitude={148.9819}
          defaultLatitude={-35.39847}
          defaultAltitude={0}
          defaultScale={1}
          defaultRotation={[-90, 90, 0]}
          defaultModelRotation={[90, 0, 0]}
          onSplatLoad={(url, id) => console.log('Splat loaded:', url, id)}
          onSplatRemove={(id) => console.log('Splat removed:', id)}
          onModelLoad={(url, id) => console.log('Model loaded:', url, id)}
          onModelRemove={(id) => console.log('Model removed:', id)}
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
