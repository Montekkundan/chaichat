import type { CliRenderer, TextRenderable } from "@opentui/core";

type Axis = "x" | "y" | "z";

export interface PyramidOptions {
  width: number;
  height: number;
  speed?: number; // radians per second
  axis?: Axis;
  wireframe?: boolean; // false = solid faces
  edges?: boolean;
  edgeChar?: string; // character for edges
  scale?: number; // model scale
  desiredDist?: number; // camera distance to centroid
  xScale?: number; // projection scale X
  yScale?: number; // projection scale Y
  yOffset?: number; // pixel offset applied after projection
  faceChars?: string[]; // per-face symbols (len >= 4 preferred)
  du?: number; // face sampling
  dv?: number;
}

interface AnimatorState {
  renderer: CliRenderer;
  target: TextRenderable;
  running: boolean;
  theta: number;
  options: Required<PyramidOptions>;
}

let state: AnimatorState | null = null;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function startPyramid(renderer: CliRenderer, target: TextRenderable, opts: PyramidOptions): void {
  const options: Required<PyramidOptions> = {
    width: Math.max(16, Math.floor(opts.width || 40)),
    height: Math.max(8, Math.floor(opts.height || 16)),
    speed: opts.speed ?? 0.8,
    axis: opts.axis ?? "y",
    wireframe: opts.wireframe ?? false,
    edges: opts.edges ?? true,
    edgeChar: (opts.edgeChar && opts.edgeChar.length > 0 ? opts.edgeChar[0]! : "+"),
    scale: opts.scale ?? 1.6,
    desiredDist: opts.desiredDist ?? 4.4,
    xScale: opts.xScale ?? 34.0,
    yScale: opts.yScale ?? 16.0,
    yOffset: opts.yOffset ?? -4,
    faceChars: (opts.faceChars && opts.faceChars.length > 0 ? opts.faceChars : ["@", "#", "$", "*"]),
    du: opts.du ?? 0.02,
    dv: opts.dv ?? 0.02,
  };

  const W = options.width;
  const H = options.height;

  type Vec3 = [number, number, number];
  const V: ReadonlyArray<Vec3> = [
    [0.0, options.scale, 0.0],
    [-options.scale, -options.scale, -options.scale],
    [options.scale, -options.scale, -options.scale],
    [options.scale, -options.scale, options.scale],
    [-options.scale, -options.scale, options.scale],
  ] as const;
  const F: ReadonlyArray<readonly [number, number, number]> = [
    [0, 1, 2],
    [0, 2, 3],
    [0, 3, 4],
    [0, 4, 1],
  ] as const;
  const EDGE_LIST: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 1],
  ] as const;

  const getV = (i: number): Vec3 => V[i] as Vec3;
  const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross3 = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const norm3 = (v: Vec3): Vec3 => {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  };

  const centroidModel: Vec3 = [0, 0, 0];
  for (let i = 0; i < V.length; ++i) {
    const vi = V[i]!;
    centroidModel[0] += vi[0];
    centroidModel[1] += vi[1];
    centroidModel[2] += vi[2];
  }
  centroidModel[0] *= 0.2;
  centroidModel[1] *= 0.2;
  centroidModel[2] *= 0.2;

  const fnorm: Vec3[] = [];
  for (let f = 0; f < 4; f++) {
    const face = F[f] as [number, number, number];
    const v0 = getV(face[0]);
    const v1 = getV(face[1]);
    const v2 = getV(face[2]);
    const e1 = sub3(v1, v0);
    const e2 = sub3(v2, v0);
    fnorm.push(norm3(cross3(e1, e2)));
  }

  const light = norm3([0.0, 1.0, -1.0]);
  const DU = options.du;
  const DV = options.dv;

  state = {
    renderer,
    target,
    running: true,
    theta: 0,
    options,
  };

  renderer.setFrameCallback(async (deltaMs) => {
    if (!state || !state.running) return;
    const dt = clamp(deltaMs / 1000, 0.001, 0.05);
    state.theta += state.options.speed * dt;

    const faceBuf: number[] = Array(W * H).fill(-1);
    const lumBuf: number[] = Array(W * H).fill(0);
    const zBuf: number[] = Array(W * H).fill(0);

    const theta = state.theta;
    const axis = state.options.axis;
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    const cz = -centroidModel[0] * s + centroidModel[2] * c;
    const offset = state.options.desiredDist - cz;

    const rotPoint = (x: number, y: number, z: number): Vec3 => {
      if (axis === "y") return [x * c + z * s, y, -x * s + z * c];
      if (axis === "x") return [x, y * c - z * s, y * s + z * c];
      return [x * c - y * s, x * s + y * c, z];
    };

    const rotateNormal = (nx: number, ny: number, nz: number): Vec3 => {
      if (axis === "y") return [nx * c + nz * s, ny, -nx * s + nz * c];
      if (axis === "x") return [nx, ny * c - nz * s, ny * s + nz * c];
      return [nx * c - ny * s, nx * s + ny * c, nz];
    };

    const project = (x: number, y: number, z: number): [number, number, number] => {
      const zt = z + offset;
      if (zt <= 0) return [-1, -1, 0];
      const invz = 1 / zt;
      const px = Math.floor(W / 2 + state!.options.xScale * x * invz);
      const py = Math.floor(H / 2 - state!.options.yScale * y * invz + state!.options.yOffset);
      return [px, py, invz];
    };

    // Faces (solid when wireframe = false)
    if (!state.options.wireframe) {
      for (let f = 0; f < 4; f++) {
        const face = F[f] as [number, number, number];
        for (let u = 0; u <= 1.0; u += DU) {
          for (let v = 0; u + v <= 1.0; v += DV) {
            const w = 1.0 - u - v;
            const v0 = getV(face[0]);
            const v1 = getV(face[1]);
            const v2 = getV(face[2]);
            const x = w * v0[0] + u * v1[0] + v * v2[0];
            const y = w * v0[1] + u * v1[1] + v * v2[1];
            const z = w * v0[2] + u * v1[2] + v * v2[2];
            const [x2, y2, z2] = rotPoint(x, y, z);
            const [px, py, invz] = project(x2, y2, z2);
            if (px < 0 || px >= W || py < 0 || py >= H) continue;
            const idx = px + py * W;
            if (invz <= (zBuf[idx] ?? 0)) continue;
            zBuf[idx] = invz;

            const n = fnorm[f] as Vec3;
            const [nx, ny, nz] = rotateNormal(n[0], n[1], n[2]);
            let L = nx * light[0] + ny * light[1] + nz * light[2];
            if (L < 0) L = 0;
            lumBuf[idx] = L;
            faceBuf[idx] = f;
          }
        }
      }
    }

    // Edges
    if (state.options.edges || state.options.wireframe) {
      for (const [a, b] of EDGE_LIST) {
        const va = getV(a);
        const vb = getV(b);
        for (let t = 0; t <= 1.0; t += 0.005) {
          const x = va[0] + (vb[0] - va[0]) * t;
          const y = va[1] + (vb[1] - va[1]) * t;
          const z = va[2] + (vb[2] - va[2]) * t;
          const [x2, y2, z2] = rotPoint(x, y, z);
          const [px, py, invz] = project(x2, y2, z2);
          if (px < 0 || px >= W || py < 0 || py >= H) continue;
          const idx = px + py * W;
          if (invz > (zBuf[idx] ?? 0)) {
            zBuf[idx] = invz + 1e-6;
            faceBuf[idx] = -2; // mark edge
          }
        }
      }
    }

    // ASCII frame
    const rows: string[] = [];
    for (let y = 0; y < H; y++) {
      let line = "";
      for (let x = 0; x < W; x++) {
        const idx = x + y * W;
        const fb = faceBuf[idx] as number;
        if (fb === -2) {
          line += state.options.edgeChar;
        } else if (fb < 0) {
          line += " ";
        } else {
          const faceIndex = fb % state.options.faceChars.length;
          const ch = state.options.faceChars[faceIndex] || "#";
          line += ch;
        }
      }
      rows.push(line);
    }
    target.content = rows.join("\n");
    try { (renderer as any).needsUpdate?.(); } catch {}
  });
}

export function stopPyramid(renderer: CliRenderer): void {
  if (!state) return;
  state.running = false;
  try { (renderer as any).clearFrameCallbacks?.(); } catch {}
  state = null;
}

