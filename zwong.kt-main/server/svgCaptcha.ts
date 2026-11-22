import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SVG_BASE64_PREFIX = 'data:image/svg+xml;base64,';
const MIN_SVG_CONFIDENCE = 80;

export interface SvgSolveResult {
  captcha: string;
  confidence: number;
  latencyMs: number;
  source: 'svg-local' | 'svg-sig';
}

interface SvgCaptchaEngine {
  solve: (svg: string) => { text: string; confidence: number; chars: Array<{ ch: string; distance: number }> };
}

type GiaiSvgFn = (svg: string) => {
  ma: string;
  soDuongChu: number;
  soNhanDuoc: number;
  chuKyLa: string[];
};

interface LoadedEngines {
  primary: SvgCaptchaEngine | null;
  secondary: GiaiSvgFn | null;
}

let cachedEngines: LoadedEngines | null | undefined;

function getEngines(): LoadedEngines {
  if (cachedEngines !== undefined && cachedEngines !== null) return cachedEngines;
  const extDir = path.resolve(process.cwd(), 'extension', 'content');
  let primary: SvgCaptchaEngine | null = null;
  let secondary: GiaiSvgFn | null = null;

  try {
    const templatesCode = fs.readFileSync(path.join(extDir, 'captcha-svg-templates.js'), 'utf8');
    const solverCode = fs.readFileSync(path.join(extDir, 'captcha-svg.js'), 'utf8');
    const sandbox: Record<string, unknown> = {};
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(templatesCode, sandbox, { filename: 'captcha-svg-templates.js' });
    vm.runInNewContext(solverCode, sandbox, { filename: 'captcha-svg.js' });
    const engine = sandbox.SvgCaptcha as SvgCaptchaEngine | undefined;
    primary = engine && typeof engine.solve === 'function' ? engine : null;
  } catch {
    primary = null;
  }

  try {
    const bangCode = fs.readFileSync(path.join(extDir, 'bang_svg.js'), 'utf8');
    const giaiCode = fs.readFileSync(path.join(extDir, 'giai_svg.js'), 'utf8');
    const sandbox: Record<string, unknown> = {};
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(bangCode, sandbox, { filename: 'bang_svg.js' });
    vm.runInNewContext(giaiCode, sandbox, { filename: 'giai_svg.js' });
    const fn = sandbox.giaiSvg as GiaiSvgFn | undefined;
    secondary = typeof fn === 'function' ? fn : null;
  } catch {
    secondary = null;
  }

  cachedEngines = { primary, secondary };
  return cachedEngines;
}

function decodeSvgDataUrl(svgDataUrl: string): string {
  if (typeof svgDataUrl !== 'string') return '';
  if (svgDataUrl.startsWith(SVG_BASE64_PREFIX)) {
    try {
      const b64 = svgDataUrl.slice(SVG_BASE64_PREFIX.length);
      return Buffer.from(b64, 'base64').toString('utf8');
    } catch {
      return '';
    }
  }
  const m = /^data:image\/svg\+xml(?:;[^,]*)?,(.*)$/i.exec(svgDataUrl);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return '';
}

/**
 * 2-tier SVG solver for Hóa đơn điện tử (`hddt`) raw SVG data URIs:
 * - Tier 1: SvgCaptcha.solve (primary template matcher, confidence >= 80)
 * - Tier 2: giaiSvg (M/Q/Z path signature table from captcha-main)
 * Returns null if neither tier matches cleanly so callers fall back to local ONNX.
 */
export function solveHddtSvgDataUrl(
  svgDataUrl: string,
  options?: { skipTier1?: boolean },
): SvgSolveResult | null {
  const svg = decodeSvgDataUrl(svgDataUrl);
  if (!svg || !svg.includes('<path')) return null;

  const { primary, secondary } = getEngines();

  if (!options?.skipTier1 && primary) {
    const t0 = performance.now();
    const res = primary.solve(svg);
    const latencyMs = Math.max(1, Math.round(performance.now() - t0));
    if (res && res.confidence >= MIN_SVG_CONFIDENCE && /^[A-Za-z0-9]{4,8}$/.test(res.text || '')) {
      return {
        captcha: res.text,
        confidence: res.confidence,
        latencyMs,
        source: 'svg-local',
      };
    }
  }

  if (secondary) {
    const t1 = performance.now();
    const kq = secondary(svg);
    const latencyMs = Math.max(1, Math.round(performance.now() - t1));
    if (
      kq &&
      kq.ma &&
      kq.soDuongChu > 0 &&
      kq.soNhanDuoc === kq.soDuongChu &&
      /^[A-Za-z0-9]{4,8}$/.test(kq.ma)
    ) {
      return {
        captcha: kq.ma,
        confidence: 95,
        latencyMs,
        source: 'svg-sig',
      };
    }
  }

  return null;
}
