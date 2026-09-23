import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

import type { ClientMapPreview, ClientMinimapFlag } from '@/lib/map/client-map';
import { getMapFloors, getMapMarkerLabel, getMapPreviewFloor } from '@/lib/map/client-map';

type Locale = 'es' | 'en';

type Props = {
  flags: ClientMinimapFlag[];
  mapPreview: ClientMapPreview;
  locale: Locale;
};

type MarkerCategory =
  'Pokemon Center' | 'Poke Mart' | 'Fisherman' | 'Other client flag' | 'Unlabeled';

type Pan = {
  x: number;
  y: number;
};

type CursorPosition = {
  x: number;
  y: number;
};

const copy = {
  es: {
    all: 'Todos',
    floor: 'Piso',
    filter: 'Filtrar marcadores',
    filterPlaceholder: 'Pokémon Center, Poke Mart…',
    markers: 'marcadores',
    clientObserved: 'Marcadores disponibles',
    noMarkers: 'No hay marcadores que coincidan con este filtro.',
    coordinates: 'Coordenadas',
    select: 'Selecciona un marcador para ver sus coordenadas.',
    unlabeled: 'Sin etiqueta',
    otherFlag: 'Otro marcador',
    layers: 'Capas',
    clientMarkers: 'Marcadores',
    visible: 'visibles',
    hidden: 'ocultos',
    zoomIn: 'Acercar mapa',
    zoomOut: 'Alejar mapa',
    center: 'Centrar mapa',
    cursor: 'Cursor',
    dragHint: 'Arrastra el mapa para explorar',
    baseLabel: 'Mapa base',
    baseSource: 'Mapa base no disponible',
  },
  en: {
    all: 'All',
    floor: 'Floor',
    filter: 'Filter markers',
    filterPlaceholder: 'Pokémon Center, Poke Mart…',
    markers: 'markers',
    clientObserved: 'Available markers',
    noMarkers: 'No markers match this filter.',
    coordinates: 'Coordinates',
    select: 'Select a marker to see its coordinates.',
    unlabeled: 'Unlabeled',
    otherFlag: 'Other marker',
    layers: 'Layers',
    clientMarkers: 'Markers',
    visible: 'visible',
    hidden: 'hidden',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    center: 'Center map',
    cursor: 'Cursor',
    dragHint: 'Drag the map to explore',
    baseLabel: 'Base map',
    baseSource: 'Base map unavailable',
  },
} as const;

function getCategory(flag: ClientMinimapFlag): MarkerCategory {
  const label = flag.description?.toLocaleLowerCase() ?? '';
  if (label.includes('pokemon center')) return 'Pokemon Center';
  if (label.includes('poke mart')) return 'Poke Mart';
  if (label.includes('fisherman')) return 'Fisherman';
  if (label.length === 0) return 'Unlabeled';
  return 'Other client flag';
}

function getCategoryCount(flags: ClientMinimapFlag[], category: MarkerCategory): number {
  return flags.filter((flag) => getCategory(flag) === category).length;
}

export function MapExplorer({ flags, locale, mapPreview }: Props) {
  const strings = copy[locale];
  const floors = useMemo(() => getMapFloors(flags), [flags]);
  const [selectedFloor, setSelectedFloor] = useState(floors.includes(7) ? 7 : (floors[0] ?? 0));
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<MarkerCategory>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; pan: Pan } | null>(null);

  const markerCategories = useMemo<MarkerCategory[]>(
    () => ['Pokemon Center', 'Poke Mart', 'Fisherman', 'Other client flag', 'Unlabeled'],
    [],
  );

  const categories = useMemo(
    () => ['all', ...new Set(flags.filter((flag) => flag.z === selectedFloor).map(getCategory))],
    [flags, selectedFloor],
  );

  const visibleFlags = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return flags.filter((flag) => {
      const matchesFloor = flag.z === selectedFloor;
      const matchesCategory = category === 'all' || getCategory(flag) === category;
      const matchesVisibility = !hiddenCategories.has(getCategory(flag));
      const matchesQuery =
        !normalizedQuery || getMapMarkerLabel(flag).toLocaleLowerCase().includes(normalizedQuery);
      return matchesFloor && matchesCategory && matchesVisibility && matchesQuery;
    });
  }, [category, flags, hiddenCategories, query, selectedFloor]);

  const baseFloor = useMemo(
    () => getMapPreviewFloor(mapPreview, selectedFloor),
    [mapPreview, selectedFloor],
  );

  const bounds = useMemo(() => {
    if (baseFloor) return baseFloor.bounds;
    const source = flags.filter((flag) => flag.z === selectedFloor);
    const xValues = source.map((flag) => flag.x);
    const yValues = source.map((flag) => flag.y);
    const minX = Math.min(...xValues, 0);
    const maxX = Math.max(...xValues, 1);
    const minY = Math.min(...yValues, 0);
    const maxY = Math.max(...yValues, 1);
    const padX = Math.max((maxX - minX) * 0.08, 40);
    const padY = Math.max((maxY - minY) * 0.08, 40);
    return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
  }, [baseFloor, flags, selectedFloor]);

  const selectedFlag = flags.find((flag) => flag.flagId === selectedId);
  const positionFor = (flag: ClientMinimapFlag): CSSProperties => ({
    left: `${50 + (((flag.x - bounds.minX) / (bounds.maxX - bounds.minX)) * 100 - 50) * zoom + pan.x}%`,
    top: `${50 + (((flag.y - bounds.minY) / (bounds.maxY - bounds.minY)) * 100 - 50) * zoom + pan.y}%`,
  });

  function chooseFloor(floor: number) {
    setSelectedFloor(floor);
    setSelectedId(null);
    setPan({ x: 0, y: 0 });
    setCursorPosition(null);
  }

  function toggleCategory(categoryToToggle: MarkerCategory) {
    setHiddenCategories((current) => {
      const next = new Set(current);
      if (next.has(categoryToToggle)) next.delete(categoryToToggle);
      else next.add(categoryToToggle);
      return next;
    });
  }

  function zoomBy(delta: number) {
    setZoom((current) => Math.min(2.5, Math.max(0.75, Number((current + delta).toFixed(2)))));
  }

  function centerMap() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function updateCursorPosition(event: PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const normalizedX = Math.min(
      1,
      Math.max(0, ((event.clientX - rect.left) / rect.width - 0.5 - pan.x / 100) / zoom + 0.5),
    );
    const normalizedY = Math.min(
      1,
      Math.max(0, ((event.clientY - rect.top) / rect.height - 0.5 - pan.y / 100) / zoom + 0.5),
    );
    setCursorPosition({
      x: Math.round(bounds.minX + normalizedX * (bounds.maxX - bounds.minX)),
      y: Math.round(bounds.minY + normalizedY * (bounds.maxY - bounds.minY)),
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, pan };
    setIsDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    updateCursorPosition(event);
    if (!dragRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPan({
      x: dragRef.current.pan.x + ((event.clientX - dragRef.current.pointerX) / rect.width) * 100,
      y: dragRef.current.pan.y + ((event.clientY - dragRef.current.pointerY) / rect.height) * 100,
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <section className="map-tool" data-testid="map-explorer">
      <div className="map-tool-toolbar">
        <div className="map-floor-tabs" aria-label={strings.floor}>
          {floors.map((floor) => (
            <button
              className="map-filter-button"
              data-active={selectedFloor === floor}
              key={floor}
              onClick={() => chooseFloor(floor)}
              type="button"
            >
              {strings.floor} {floor}
            </button>
          ))}
        </div>
        <label className="map-query">
          <span className="sr-only">{strings.filter}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={strings.filterPlaceholder}
          />
        </label>
      </div>

      <div className="map-category-tabs" aria-label={strings.filter}>
        {categories.map((item) => (
          <button
            className="map-category-button"
            data-active={category === item}
            key={item}
            onClick={() => setCategory(item)}
            type="button"
          >
            {item === 'all'
              ? strings.all
              : item === 'Unlabeled'
                ? strings.unlabeled
                : item === 'Other client flag'
                  ? strings.otherFlag
                  : item}
          </button>
        ))}
      </div>

      <div className="map-coordinate-layout">
        <div className="map-viewport-shell">
          <div className="map-legend" aria-label={strings.layers}>
            <div className="map-legend-heading">
              <strong>{strings.layers}</strong>
              <span>
                {strings.floor} {selectedFloor}
              </span>
            </div>
            <div className="map-legend-client-row">
              <span className="map-legend-swatch" data-category="client" />
              <span>{strings.clientMarkers}</span>
              <small>
                {visibleFlags.length} {strings.visible}
              </small>
            </div>
            {markerCategories.map((markerCategory) => {
              const hidden = hiddenCategories.has(markerCategory);
              return (
                <button
                  aria-pressed={!hidden}
                  className="map-legend-row"
                  data-hidden={hidden}
                  data-testid={`map-layer-${markerCategory}`}
                  key={markerCategory}
                  onClick={() => toggleCategory(markerCategory)}
                  type="button"
                >
                  <span className="map-legend-swatch" data-category={markerCategory} />
                  <span>
                    {markerCategory === 'Unlabeled'
                      ? strings.unlabeled
                      : markerCategory === 'Other client flag'
                        ? strings.otherFlag
                        : markerCategory}
                  </span>
                  <small>{getCategoryCount(flags, markerCategory)}</small>
                </button>
              );
            })}
          </div>
          <div
            className="map-viewport"
            data-dragging={isDragging}
            data-testid="map-viewport"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            ref={viewportRef}
            role="region"
            aria-label={`${strings.floor} ${selectedFloor}, ${visibleFlags.length} ${strings.markers}`}
          >
            <span className="map-base-badge">
              {baseFloor ? strings.baseLabel : strings.baseSource}
            </span>
            <div className="map-plot" data-base-loaded={Boolean(baseFloor)}>
              <div
                aria-hidden="true"
                className="map-base-layer"
                data-base-loaded={Boolean(baseFloor)}
                style={
                  baseFloor
                    ? {
                        backgroundImage: `url(${baseFloor.asset})`,
                        transform: `translate(${pan.x}%, ${pan.y}%) scale(${zoom})`,
                      }
                    : undefined
                }
              />
              <span className="map-axis-label map-axis-label-x">
                x {Math.round(bounds.minX)}–{Math.round(bounds.maxX)}
              </span>
              <span className="map-axis-label map-axis-label-y">
                y {Math.round(bounds.minY)}–{Math.round(bounds.maxY)}
              </span>
              {visibleFlags.map((flag) => (
                <button
                  className="map-marker"
                  data-category={getCategory(flag)}
                  data-selected={selectedId === flag.flagId}
                  key={flag.flagId}
                  onClick={() => setSelectedId(flag.flagId)}
                  style={positionFor(flag)}
                  title={`${getMapMarkerLabel(flag)} · ${flag.x}, ${flag.y}, ${flag.z}`}
                  type="button"
                >
                  <span className="sr-only">
                    {getMapMarkerLabel(flag)} · {flag.x}, {flag.y}, {flag.z}
                  </span>
                </button>
              ))}
              {visibleFlags.length === 0 && <p className="map-no-markers">{strings.noMarkers}</p>}
            </div>
            <div className="map-map-controls" aria-label={strings.center}>
              <button
                aria-label={strings.zoomOut}
                className="map-control-button"
                data-testid="map-zoom-out"
                onClick={() => zoomBy(-0.25)}
                type="button"
              >
                −
              </button>
              <button
                aria-label={strings.center}
                className="map-control-button"
                data-testid="map-center"
                onClick={centerMap}
                type="button"
              >
                ◎
              </button>
              <button
                aria-label={strings.zoomIn}
                className="map-control-button"
                data-testid="map-zoom-in"
                onClick={() => zoomBy(0.25)}
                type="button"
              >
                +
              </button>
              <div className="map-zoom-level" data-testid="map-zoom-level">
                {Math.round(zoom * 100)}%
              </div>
              <div className="map-coordinate-readout">
                <span>{strings.cursor}</span>
                <code>
                  {cursorPosition
                    ? `${cursorPosition.x}, ${cursorPosition.y}, ${selectedFloor}`
                    : '—'}
                </code>
              </div>
            </div>
            <div className="map-floor-controls" aria-label={strings.floor}>
              <button
                aria-label={`${strings.floor} ${selectedFloor + 1}`}
                className="map-control-button"
                disabled={floors.indexOf(selectedFloor) >= floors.length - 1}
                onClick={() => {
                  const nextFloor = floors[floors.indexOf(selectedFloor) + 1];
                  if (nextFloor !== undefined) chooseFloor(nextFloor);
                }}
                type="button"
              >
                ↑
              </button>
              <button
                aria-label={`${strings.floor} ${selectedFloor - 1}`}
                className="map-control-button"
                disabled={floors.indexOf(selectedFloor) <= 0}
                onClick={() => {
                  const previousFloor = floors[floors.indexOf(selectedFloor) - 1];
                  if (previousFloor !== undefined) chooseFloor(previousFloor);
                }}
                type="button"
              >
                ↓
              </button>
            </div>
            <p className="map-drag-hint">{strings.dragHint}</p>
          </div>
          <div className="map-viewport-footer">
            <span>
              {visibleFlags.length} {strings.markers}
            </span>
            <span>{strings.clientObserved}</span>
          </div>
        </div>

        <aside className="map-details-panel" aria-live="polite">
          <div className="map-details-header">
            <strong>{selectedFlag ? getMapMarkerLabel(selectedFlag) : strings.coordinates}</strong>
            <span>
              {strings.floor} {selectedFloor}
            </span>
          </div>
          {selectedFlag ? (
            <dl className="map-coordinate-list">
              <div>
                <dt>x</dt>
                <dd>{selectedFlag.x}</dd>
              </div>
              <div>
                <dt>y</dt>
                <dd>{selectedFlag.y}</dd>
              </div>
              <div>
                <dt>z</dt>
                <dd>{selectedFlag.z}</dd>
              </div>
              <div>
                <dt>icon</dt>
                <dd>{selectedFlag.icon}</dd>
              </div>
              <div>
                <dt>flagId</dt>
                <dd>{selectedFlag.flagId}</dd>
              </div>
            </dl>
          ) : (
            <p className="map-details-empty">{strings.select}</p>
          )}
        </aside>
      </div>
    </section>
  );
}
