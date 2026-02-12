import './styles/main.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { App } from './App';
import { debugInjectTestEvents, debugGetCells, getCellCount } from '@/services/geo-convergence';
import { initMetaTags } from '@/services/meta-tags';

// Initialize dynamic meta tags for sharing
initMetaTags();

const app = new App('app');
app.init().catch(console.error);

// Debug helpers for geo-convergence testing (remove in production)
(window as unknown as Record<string, unknown>).geoDebug = {
  inject: debugInjectTestEvents,
  cells: debugGetCells,
  count: getCellCount,
};
