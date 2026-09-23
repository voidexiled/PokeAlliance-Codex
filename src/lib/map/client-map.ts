// Map types and pure helpers, safe for the MapExplorer island. The data itself
// is loaded and validated on the server by map-data.ts and passed as props.

export type ClientMinimapFlag = {
  flagId: number;
  description: string | null;
  x: number;
  y: number;
  z: number;
  icon: number;
};

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
  bounds: ClientMapBounds;
};

export type ClientMapPreview = {
  floors: readonly ClientMapPreviewFloor[];
};

export function getMapPreviewFloor(
  preview: ClientMapPreview,
  floor: number,
): ClientMapPreviewFloor | undefined {
  return preview.floors.find((item) => item.z === floor);
}

export function getMapFloors(flags: readonly ClientMinimapFlag[]): number[] {
  return [...new Set(flags.map((flag) => flag.z))].sort((a, b) => a - b);
}

export function getMapMarkerLabel(flag: ClientMinimapFlag): string {
  return flag.description?.trim() || 'Marcador sin etiqueta';
}
