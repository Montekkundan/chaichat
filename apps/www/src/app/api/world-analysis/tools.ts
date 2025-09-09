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

// Lightweight built-in dataset: India states centroids and populations (approximate)
const INDIA_STATES_DATA: Array<{ name: string; lat: number; lon: number; population: number }> = [
  { name: 'Uttar Pradesh', lat: 27.130334, lon: 80.859666, population: 237882725 },
  { name: 'Maharashtra', lat: 19.75148, lon: 75.71389, population: 124904071 },
  { name: 'Bihar', lat: 25.644084, lon: 85.906508, population: 128500364 },
  { name: 'West Bengal', lat: 22.986757, lon: 87.854976, population: 99609303 },
  { name: 'Madhya Pradesh', lat: 23.473324, lon: 77.947998, population: 85358965 },
  { name: 'Tamil Nadu', lat: 11.127123, lon: 78.656891, population: 77841267 },
  { name: 'Rajasthan', lat: 27.023803, lon: 74.217933, population: 81032689 },
  { name: 'Gujarat', lat: 22.258652, lon: 71.192381, population: 71067000 },
  { name: 'Karnataka', lat: 15.317277, lon: 75.71389, population: 67562686 },
  { name: 'Andhra Pradesh', lat: 15.9129, lon: 79.74, population: 53900000 },
  { name: 'Telangana', lat: 17.9784, lon: 79.5941, population: 39362732 },
  { name: 'Odisha', lat: 20.951666, lon: 85.098524, population: 46356334 },
  { name: 'Kerala', lat: 10.850516, lon: 76.27108, population: 35699443 },
  { name: 'Assam', lat: 26.200604, lon: 92.937573, population: 35607039 },
  { name: 'Jharkhand', lat: 23.61018, lon: 85.27994, population: 39576757 },
  { name: 'Punjab', lat: 31.14713, lon: 75.34122, population: 30141373 },
  { name: 'Haryana', lat: 29.058776, lon: 76.085601, population: 28672000 },
  { name: 'Chhattisgarh', lat: 21.278657, lon: 81.866144, population: 29436231 },
  { name: 'Delhi', lat: 28.70406, lon: 77.10249, population: 18710922 },
  { name: 'Jammu and Kashmir', lat: 33.2778, lon: 75.3412, population: 13300000 },
]

export const overlayIndiaStatesTool = tool({
  description: 'Show markers for Indian states (topK by population or specific names).',
  inputSchema: z.object({
    intent: z.string().optional(),
    names: z.array(z.string()).optional(),
    topK: z.number().min(1).max(36).optional(),
    color: z.string().optional(),
  }),
  execute: async ({ intent, names, topK, color }) => {
    let rows = INDIA_STATES_DATA.slice()
    if (Array.isArray(names) && names.length > 0) {
      const set = new Set(names.map((s) => s.toLowerCase()))
      rows = rows.filter((r) => set.has(r.name.toLowerCase()))
    }
    rows.sort((a, b) => b.population - a.population)
    if (typeof topK === 'number') rows = rows.slice(0, topK)
    const points = rows.map((r) => ({ lat: r.lat, lon: r.lon, value: r.population, color: color || '#F59E0B', size: undefined, label: r.name }))
    return { type: 'points' as const, intent: intent || 'india-states', points, legend: { title: 'State population', units: 'people' } }
  },
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
