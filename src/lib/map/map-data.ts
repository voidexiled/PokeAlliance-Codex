// Server-only: loads content/map/ and checks it against its schemas when the
// site builds. The map page passes the result to the MapExplorer island.
import floorData from '../../../content/map/floors.json';
import markerData from '../../../content/map/markers.json';
import {
  mapFloorsFileSchema,
  mapMarkersFileSchema,
  parseContent,
} from '@/lib/content/content-schema';
import type { ClientMapPreview, ClientMinimapFlag } from './client-map';

export const clientMinimapFlags: ClientMinimapFlag[] = parseContent(
  mapMarkersFileSchema,
  markerData,
  'content/map/markers.json',
).marcadores.map((marker) => ({
  flagId: marker.id,
  description: marker.descripcion,
  x: marker.x,
  y: marker.y,
  z: marker.z,
  icon: marker.icono,
}));

export const clientMapPreview: ClientMapPreview = {
  floors: parseContent(mapFloorsFileSchema, floorData, 'content/map/floors.json').pisos.map(
    (floor) => ({
      z: floor.z,
      asset: floor.imagen,
      width: floor.ancho,
      height: floor.alto,
      bounds: floor.limites,
    }),
  ),
};
