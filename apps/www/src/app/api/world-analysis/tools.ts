import { tool } from "ai";
import { z } from "zod";

// Tools for world analysis overlays
export const overlayPointsTool = tool({
  description: "Render data-driven points on the Earth globe overlay. Use when the user asks to mark, plot, or show values at specific locations.",
  inputSchema: z.object({
    intent: z.string().describe("What this overlay represents, e.g. 'population hotspots'."),
    points: z.array(
      z.object({
        lat: z.number().min(-90).max(90).describe("Latitude in degrees (south negative)."),
        lon: z.number().min(-180).max(180).describe("Longitude in degrees (west negative)."),
        value: z.number().optional().describe("Optional numeric value for sizing/legend."),
        color: z.string().optional().describe("CSS color or hex for point."),
        size: z.number().optional().describe("Point size; defaults based on value or theme."),
        label: z.string().optional().describe("Optional label shown in tooltip/legend."),
      })
    ).min(1),
    legend: z.object({
      title: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      units: z.string().optional(),
    }).optional(),
  }),
  execute: async (input) => ({ type: "points", ...input }),
});

export const setCameraTool = tool({
  description: "Adjust camera focus for the Earth scene to highlight a region of interest.",
  inputSchema: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    radius: z.number().min(1).max(30).optional().describe("Approx camera distance from globe center."),
  }),
  execute: async (input) => ({ type: "camera", ...input }),
});

export const setRotationTool = tool({
  description: "Control globe rotation. Set speed (radians/sec) or pause/resume.",
  inputSchema: z.object({
    running: z.boolean().optional().describe("Whether rotation should be running (true/false)."),
    speed: z.number().min(0).max(2).optional().describe("Rotation speed in radians per second around Y axis. 0 pauses."),
  }),
  execute: async (input) => ({ type: "rotation", ...input }),
});

export const overlayBarsTool = tool({
  description: 'Render 3D bars on the globe for metrics (e.g., population).',
  inputSchema: z.object({
    intent: z.string().optional(),
    bars: z.array(z.object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      value: z.number().optional().describe('Numeric value used for height scaling'),
      height: z.number().optional().describe('Explicit height in world units; if omitted use value scaling'),
      color: z.string().optional(),
      radius: z.number().optional().describe('Cylinder radius'),
      label: z.string().optional(),
    })).min(1),
    legend: z.object({ title: z.string().optional(), min: z.number().optional(), max: z.number().optional(), units: z.string().optional() }).optional(),
    scaling: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
  }),
  execute: async (input) => ({ type: 'bars', ...input }),
});

export const setShaderParamsTool = tool({
  description: 'Adjust shader parameters like sun position and atmosphere colors.',
  inputSchema: z.object({
    sun: z.object({ phi: z.number().min(0).max(Math.PI).optional(), theta: z.number().min(-Math.PI).max(Math.PI).optional() }).optional(),
    atmosphereDayColor: z.string().optional(),
    atmosphereTwilightColor: z.string().optional(),
    overlayOffset: z.object({ lonDeg: z.number().min(-180).max(180).optional(), latDeg: z.number().min(-90).max(90).optional() }).optional(),
  }),
  execute: async (input) => ({ type: 'shader', ...input }),
});

// Geographic overlays: borders, fills, and masking
export const overlayGeoTool = tool({
  description:
    "Render geographic features (countries/regions) on the Earth: highlight borders, optionally fill, or mask everything except selected regions.",
  inputSchema: z.object({
    intent: z.string().optional(),
    // One of these can be provided; the client can resolve to GeoJSON
    countryCodes: z.array(z.string()).optional().describe("ISO 3166-1 alpha-2 or alpha-3 codes"),
    countryNames: z.array(z.string()).optional().describe("Country or region common names in English"),
    geojsonUrl: z.string().url().optional().describe("URL to a GeoJSON Feature or FeatureCollection"),
    geojson: z.unknown().optional().describe("Inline GeoJSON Feature/FeatureCollection/Geometry"),
    style: z
      .object({
        showBorders: z.boolean().optional().describe("Whether to draw borders"),
        borderColor: z.string().optional(),
        borderWidth: z.number().min(0.5).max(8).optional(),
        fillColor: z.string().optional(),
        fillOpacity: z.number().min(0).max(1).optional(),
        // When true, hide everything except selected regions by showing a plain color elsewhere
        maskOthers: z.boolean().optional(),
        plainColor: z.string().optional().describe("Color for areas outside the selection when maskOthers=true"),
      })
      .optional(),
  }),
  execute: async (input) => ({ type: "geo", ...input }),
});

// Control the base map/texture (day, night, paleo, or custom url)
export const setBaseMapTool = tool({
  description:
    "Switch the Earth's base texture. Use 'paleo' for pre-continental-drift textures when available or provide a custom URL.",
  inputSchema: z.object({
    mode: z
      .enum(["day", "night", "paleo", "custom"]) // custom requires url
      .describe("Which base map to use"),
    url: z.string().url().optional().describe("Custom texture URL for mode=custom (equirectangular)"),
  }),
  execute: async (input) => ({ type: "texture", ...input }),
});

// Clear overlays and restore defaults. Use when a new, unrelated question starts.
export const clearOverlaysTool = tool({
  description: "Clear all overlays, borders, and custom textures and reset offsets.",
  inputSchema: z.object({}).optional(),
  execute: async () => ({ type: "clear" as const }),
});

// Plot metrics by country code. The client will resolve country centroids and render bars.
export const overlayCountryMetricTool = tool({
  description: 'Plot a metric for multiple countries (by ISO code). The client computes centroids and renders bars.',
  inputSchema: z.object({
    intent: z.string().optional(),
    metricName: z.string().optional(),
    items: z.array(z.object({
      code: z.string().min(2).max(3).describe('ISO A2 or A3 code'),
      value: z.number(),
      color: z.string().optional(),
      radius: z.number().optional(),
    })).min(1),
    legend: z.object({ title: z.string().optional(), min: z.number().optional(), max: z.number().optional(), units: z.string().optional() }).optional(),
    scaling: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
  }),
  execute: async (input) => ({ type: 'country-metric', ...input }),
});

// Fetch latest population data from the web (RestCountries) and return as country-metric
export const fetchPopulationTool = tool({
  description: 'Fetch current population for given ISO country codes (A2/A3) using RestCountries API or fetch top-k globally.',
  inputSchema: z.object({
    codes: z.array(z.string()).optional().describe('ISO codes to fetch; if omitted, fetch all and return topK'),
    topK: z.number().min(1).max(250).optional().describe('Return the top K by population when codes not provided'),
    color: z.string().optional(),
  }),
  async execute({ codes, topK, color }, { abortSignal }) {
    type CountryApiRow = { cca2?: string; cca3?: string; ccn3?: string; population?: number; pop?: number }
    const makeItems = (list: CountryApiRow[]) => {
      return list.map((c) => {
        const code = (c.cca3 || c.cca2 || c.ccn3 || '').toString().toUpperCase()
        const value = Number(c.population || c.pop || 0)
        return { code, value, color }
      }).filter((x) => x.code && Number.isFinite(x.value))
    }

    let data: CountryApiRow[] = []
    try {
      if (Array.isArray(codes) && codes.length > 0) {
        const url = `https://restcountries.com/v3.1/alpha?codes=${codes.join(',')}&fields=cca2,cca3,population`
        const res = await fetch(url, { signal: abortSignal, cache: 'no-cache' })
        if (res.ok) data = await res.json()
      } else {
        const url = 'https://restcountries.com/v3.1/all?fields=cca2,cca3,population'
        const res = await fetch(url, { signal: abortSignal, cache: 'no-cache' })
        if (res.ok) data = await res.json()
      }
    } catch {}

    const items = makeItems(Array.isArray(data) ? data : [])
      .sort((a, b) => b.value - a.value)
      .slice(0, typeof topK === 'number' && (!codes || codes.length === 0) ? topK : undefined)

    return {
      type: 'country-metric' as const,
      intent: 'Population by Country',
      metricName: 'Population',
      items,
      legend: { title: 'Population by Country', min: 0, max: Math.max(0, ...items.map((i) => i.value)), units: 'people' },
    }
  },
});
