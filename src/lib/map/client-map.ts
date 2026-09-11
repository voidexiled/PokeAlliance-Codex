import markerDataset from '../../../data/staging/local-minimap-flags.json';
import otmmPreview from '../../../data/staging/local-otmm-preview.json';

export type ClientMinimapFlag = {
  flagId: number;
  description: string | null;
  x: number;
  y: number;
  z: number;
  icon: number;
};

export const clientMinimapFlags = markerDataset.records as ClientMinimapFlag[];

export const clientMinimapSource = {
  sourceLocator: markerDataset.sourceLocator,
  sourceSnapshot: markerDataset.sourceSha256,
  markerCount: markerDataset.recordCount,
  generatedAt: markerDataset.generatedAt,
} as const;

export type ClientMapBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type ClientMapPreviewFloor = {
  z: number;
  asset: string;
  width: number;
  height: number;
  blockCount: number;
  seenTiles: number;
  bounds: ClientMapBounds;
};

export const clientMapPreview = {
  sourceLocator: otmmPreview.sourceLocator,
  sourceSnapshot: otmmPreview.sourceSha256,
  sourceModifiedAt: otmmPreview.sourceModifiedAt,
  recordCount: otmmPreview.recordCount,
  format: otmmPreview.format,
  floors: otmmPreview.floors as ClientMapPreviewFloor[],
} as const;

export function getMapPreviewFloor(floor: number): ClientMapPreviewFloor | undefined {
  return clientMapPreview.floors.find((item) => item.z === floor);
}

export function getMapFloors(flags: ClientMinimapFlag[] = clientMinimapFlags): number[] {
  return [...new Set(flags.map((flag) => flag.z))].sort((a, b) => a - b);
}

export function getMapMarkerLabel(flag: ClientMinimapFlag): string {
  return flag.description?.trim() || 'Marcador sin etiqueta';
}
