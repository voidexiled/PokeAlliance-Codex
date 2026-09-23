import { describe, expect, it } from 'vitest';

import { getMapFloors, getMapMarkerLabel, getMapPreviewFloor } from '@/lib/map/client-map';
import { clientMapPreview, clientMinimapFlags } from '@/lib/map/map-data';

describe('map data', () => {
  it('loads every marker and floor from content/map', () => {
    expect(clientMinimapFlags).toHaveLength(119);
    expect(clientMapPreview.floors.map((floor) => floor.z)).toEqual([1, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('exposes the marker floors in stable numeric order', () => {
    expect(getMapFloors(clientMinimapFlags)).toEqual([1, 3, 4, 5, 6, 7, 8, 9]);
    expect(getMapPreviewFloor(clientMapPreview, 7)).toMatchObject({ width: 832, height: 672 });
    expect(getMapPreviewFloor(clientMapPreview, 2)).toBeUndefined();
  });

  it('does not fabricate a label for an unlabeled marker', () => {
    const unlabeled = clientMinimapFlags.find((flag) => flag.description === null);
    expect(unlabeled).toBeDefined();
    expect(getMapMarkerLabel(unlabeled!)).toBe('Marcador sin etiqueta');
  });
});
