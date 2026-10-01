import countries from "i18n-iso-countries";
import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
// Served from our own origin as a hashed static asset (no third-party map CDN).
import worldUrl from "world-atlas/countries-110m.json?url";
import type { AnalyticsSummary } from "@shared/api";
import { formatNumber } from "@/lib/format";

type Country = AnalyticsSummary["countries"][number];
type Geo = { rsmKey: string; id?: string | number; properties: { name?: string } };

/** Choropleth of clicks by country. Shading is relative to the busiest country. */
export default function WorldMap({ data }: { data: Country[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const byCode = useMemo(() => new Map(data.filter((c) => c.code).map((c) => [c.code, c])), [data]);
  const max = Math.max(1, ...data.map((c) => c.clicks));

  const fillFor = (hit: Country | undefined) =>
    hit
      ? // sqrt keeps smaller countries visible next to a dominant one
        `color-mix(in srgb, var(--primary) ${Math.round(25 + 75 * Math.sqrt(hit.clicks / max))}%, var(--muted))`
      : "var(--muted)";

  return (
    <div className="relative">
      <p className="absolute left-0 top-0 z-10 text-sm text-muted-foreground min-h-5" aria-live="polite">
        {hover ?? "Hover a country · scroll to zoom"}
      </p>
      <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 165 }} width={800} height={400} className="w-full h-auto">
        <ZoomableGroup center={[10, 10]} zoom={1} minZoom={1} maxZoom={6}>
          <Geographies geography={worldUrl}>
            {({ geographies }: { geographies: Geo[] }) =>
              geographies.map((geo) => {
                const code = geo.id === undefined ? undefined : countries.numericToAlpha2(String(geo.id).padStart(3, "0"));
                const hit = code ? byCode.get(code) : undefined;
                const label = `${hit?.label ?? geo.properties.name ?? "Unknown"}: ${formatNumber(hit?.clicks ?? 0)} clicks${hit ? ` (${hit.percentage}%)` : ""}`;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    aria-label={label}
                    onMouseEnter={() => setHover(label)}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      default: { fill: fillFor(hit), stroke: "var(--background)", strokeWidth: 0.5, outline: "none" },
                      hover: { fill: "var(--primary)", stroke: "var(--background)", strokeWidth: 0.75, outline: "none", cursor: "pointer" },
                      pressed: { fill: "var(--primary)", outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}
