import { describe, expect, it } from 'vitest';

import {
  clientMinimapFlags,
  clientMinimapSource,
  getMapFloors,
  getMapMarkerLabel,
} from '@/lib/map/client-map';

describe('client minimap preview data', () => {
  it('keeps the extracted marker count and source snapshot', () => {
    expect(clientMinimapFlags).toHaveLength(119);
    expect(clientMinimapSource.markerCount).toBe(119);
    expect(clientMinimapSource.sourceSnapshot).toMatch(/^[a-f0-9]{64}$/i);
  });

  it('exposes the observed floors in stable numeric order', () => {
    expect(getMapFloors()).toEqual([1, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('does not fabricate a label for an unlabeled marker', () => {
    const unlabeled = clientMinimapFlags.find((flag) => flag.description === null);
    expect(unlabeled).toBeDefined();
    expect(getMapMarkerLabel(unlabeled!)).toBe('Marcador sin etiqueta');
  });
});
