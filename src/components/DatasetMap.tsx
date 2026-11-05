import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Bounds } from "../services/arcgis";
// MapLibre 6 loads a separate ESM worker; make Vite emit it as a static asset.
maplibregl.setWorkerUrl(workerUrl);
export default function DatasetMap({
  data,
  onBounds,
}: {
  data: GeoJSON.FeatureCollection<GeoJSON.Geometry | null>;
  onBounds: (b: Bounds) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(
    null,
  );
  useEffect(() => {
    if (!host.current) return;
    setReady(false);
    setSelected(null);
    setError("");
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: host.current,
        center: [-82.55, 27.95],
        zoom: 8,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "base", type: "raster", source: "osm" }],
        },
      });
    } catch {
      setError(
        "The map needs WebGL. Records and exports remain available below.",
      );
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl());
    map.on("error", () =>
      setError(
        "Some map resources could not load. Records remain available below.",
      ),
    );
    map.on("load", () => {
      const mapped: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: data.features.filter(
          (f): f is GeoJSON.Feature<GeoJSON.Geometry> => f.geometry !== null,
        ),
      };
      map.addSource("records", { type: "geojson", data: mapped });
      map.addLayer({
        id: "polygons",
        type: "fill",
        source: "records",
        filter: ["==", "$type", "Polygon"],
        paint: { "fill-color": "#d28941", "fill-opacity": 0.35 },
      });
      map.addLayer({
        id: "lines",
        type: "line",
        source: "records",
        filter: ["!=", "$type", "Point"],
        paint: { "line-color": "#a9652c", "line-width": 2 },
      });
      map.addLayer({
        id: "points",
        type: "circle",
        source: "records",
        filter: ["==", "$type", "Point"],
        paint: {
          "circle-color": "#c47734",
          "circle-radius": 6,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      });
      const bounds = new maplibregl.LngLatBounds();
      const extend = (coords: unknown) => {
        if (!Array.isArray(coords)) return;
        if (typeof coords[0] === "number" && typeof coords[1] === "number")
          bounds.extend([coords[0], coords[1]]);
        else coords.forEach(extend);
      };
      data.features.forEach((f) => {
        if (f.geometry && "coordinates" in f.geometry)
          extend(f.geometry.coordinates);
      });
      if (!bounds.isEmpty())
        map.fitBounds(bounds, { padding: 45, maxZoom: 15, duration: 0 });
      map.once("idle", () => setReady(true));
      map.on("click", (e) => {
        const feature = map.queryRenderedFeatures(e.point, {
          layers: ["points", "polygons", "lines"],
        })[0];
        setSelected(feature?.properties ?? null);
      });
    });
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [data]);
  return (
    <section aria-label="Map of loaded spatial records">
      <div className="map-toolbar">
        <p>
          Only the loaded page is mapped. Select a feature for its attributes.
        </p>
        <button
          className="button secondary"
          disabled={!ready}
          onClick={() => {
            const b = mapRef.current?.getBounds();
            if (b)
              onBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
          }}
        >
          Search this map area
        </button>
      </div>
      {error && (
        <p role="status" className="notice">
          {error}
        </p>
      )}
      <div className="map" ref={host} />
      {ready && (
        <p role="status" className="muted">
          Map ready · {data.features.filter((f) => f.geometry !== null).length}{" "}
          loaded features
        </p>
      )}
      {selected && (
        <details open className="feature">
          <summary>Selected feature attributes</summary>
          <dl>
            {Object.entries(selected).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{String(v ?? "—")}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}
