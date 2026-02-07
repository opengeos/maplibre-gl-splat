import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GaussianSplatControl } from '../../src';

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const map = new maplibregl.Map({
  container: 'map',
  style: BASEMAP_STYLE,
  center: [0, 0],
  zoom: 2,
  pitch: 60,
  maxPitch: 85,
  antialias: true,
});

// Add navigation control
map.addControl(new maplibregl.NavigationControl(), 'top-left');

// Add Gaussian Splat control
const splatControl = new GaussianSplatControl({
  collapsed: false,
  title: 'Gaussian Splats',
  // Example splat URL - users can enter their own
  // defaultUrl: 'https://sparkjs.dev/assets/splats/butterfly.spz',
  defaultUrl: 'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
  defaultLongitude: 148.9819,
  defaultLatitude: -35.39847,
  defaultAltitude: 0,
  defaultScale: 0.03,
  defaultRotation: [-90, 90, 0],
});

map.addControl(splatControl, 'top-right');

// Listen for events
splatControl.on('splatload', (event) => {
  console.log('Splat loaded:', event.url, 'id:', event.splatId);
});

splatControl.on('splatremove', (event) => {
  console.log('Splat removed:', event.splatId);
});

splatControl.on('modelload', (event) => {
  console.log('Model loaded:', event.url, 'id:', event.modelId);
});

splatControl.on('modelremove', (event) => {
  console.log('Model removed:', event.modelId);
});

splatControl.on('error', (event) => {
  console.error('Error:', event.error);
});

// Log when map is ready
map.on('load', () => {
  console.log('Map loaded. Enter a splat URL and click Load Splat.');
  console.log('');
  console.log('Supported formats: .splat, .ply, .spz, .ksplat, .sog, .gltf, .glb');
  console.log('');
  console.log('Example URLs:');
  console.log('  - https://sparkjs.dev/assets/splats/butterfly.spz');
  console.log('  - https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf');
  console.log('  - Your own Gaussian splat or GLTF/GLB files');
});

// Example: Load a GLTF model programmatically
// Uncomment to test GLTF loading:
// map.once('idle', async () => {
//   try {
//     const modelId = await splatControl.loadModel(
//       'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
//       { longitude: 148.9819, latitude: -35.39847, altitude: 0, scale: 1 }
//     );
//     console.log('GLTF model loaded:', modelId);
//   } catch (err) {
//     console.error('Failed to load GLTF:', err);
//   }
// });
