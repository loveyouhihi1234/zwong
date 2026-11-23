interface OrtModule {
  env: {
    wasm: {
      wasmPaths: string;
      numThreads: number;
      proxy: boolean;
    };
  };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
  InferenceSession: {
    create: (buffer: ArrayBuffer, options: { executionProviders: string[] }) => Promise<{
      inputNames: string[];
      outputNames: string[];
      run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array; dims: number[] }>>;
    }>;
  };
}

interface QltPngModule {
  tienXuLy: (
    cong: string,
    rgba: Uint8Array | Uint8ClampedArray,
    w: number,
    h: number,
    nenTrangNeuTracuu?: boolean,
  ) => { tensor: Float32Array; xam: Uint8Array; W: number; H: number };
  giaiCTC: (data: Float32Array, dims: number[], bang: string[]) => string;
  hauXuLy: (cong: string, chuoi: string) => string;
}

interface SvgCaptchaGlobal {
  solve: (svg: string) => { text: string; confidence: number };
}

type GiaiSvgGlobal = (svg: string) => {
  ma: string;
  soDuongChu: number;
  soNhanDuoc: number;
  chuKyLa: string[];
};

declare global {
  interface Window {
    ort?: OrtModule;
    QltPng?: QltPngModule;
    SvgCaptcha?: SvgCaptchaGlobal;
    giaiSvg?: GiaiSvgGlobal;
  }
}

export interface LocalSolveOutput {
  ok: boolean;
  captcha: string;
  source: 'svg-local' | 'svg-sig' | 'onnx-local';
  confidence: number;
  latencyMs: number;
  thumbnail: string;
  message?: string;
}

const loadedScripts = new Map<string, Promise<void>>();

function loadScriptOnce(src: string): Promise<void> {
  const existing = loadedScripts.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Không nạp được script ${src}`));
    document.head.appendChild(script);
  });
  loadedScripts.set(src, p);
  return p;
}

let svgEnginesPromise: Promise<void> | null = null;
async function ensureSvgEngines(): Promise<void> {
  if (!svgEnginesPromise) {
    svgEnginesPromise = (async () => {
      await loadScriptOnce('./local-solver/captcha-svg-templates.js');
      await loadScriptOnce('./local-solver/captcha-svg.js');
      await loadScriptOnce('./local-solver/bang_svg.js');
      await loadScriptOnce('./local-solver/giai_svg.js');
    })().catch((err) => {
      svgEnginesPromise = null;
      throw err;
    });
  }
  return svgEnginesPromise;
}

let onnxRuntimePromise: Promise<{
  session: Awaited<ReturnType<OrtModule['InferenceSession']['create']>>;
  charset: string[];
}> | null = null;

async function ensureOnnxRuntime() {
  if (!onnxRuntimePromise) {
    onnxRuntimePromise = (async () => {
      await loadScriptOnce('./thu_vien/ort/ort.wasm.min.js');
      await loadScriptOnce('./local-solver/tien_ich_png.js');
      const ort = window.ort;
      if (!ort || !window.QltPng) {
        throw new Error('Không khởi tạo được ONNX Runtime Web hoặc QltPng');
      }
      ort.env.wasm.wasmPaths = new URL('./thu_vien/ort/', window.location.href).href;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      (ort.env as Record<string, unknown>).logLevel = 'error';

      const [modelRes, charsetRes] = await Promise.all([
        fetch('./thu_vien/ddddocr_old.onnx'),
        fetch('./thu_vien/charset.json'),
      ]);
      if (!modelRes.ok) throw new Error('Không tải được mô hình ddddocr_old.onnx');
      if (!charsetRes.ok) throw new Error('Không tải được bảng ký tự charset.json');

      const [modelBuf, charset] = await Promise.all([
        modelRes.arrayBuffer(),
        charsetRes.json() as Promise<string[]>,
      ]);
      const session = await ort.InferenceSession.create(modelBuf, {
        executionProviders: ['wasm'],
        logSeverityLevel: 3,
      } as { executionProviders: string[] });
      return { session, charset };
    })().catch((err) => {
      onnxRuntimePromise = null;
      throw err;
    });
  }
  return onnxRuntimePromise;
}

function decodeSvgDataUrl(src: string): string {
  if (!src) return '';
  const b64Prefix = 'data:image/svg+xml;base64,';
  if (src.startsWith(b64Prefix)) {
    try {
      const bin = atob(src.slice(b64Prefix.length));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return '';
    }
  }
  const m = /^data:image\/svg\+xml(?:;[^,]*)?,(.*)$/i.exec(src);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return '';
}

async function readImagePixelsAndThumb(
  img: HTMLImageElement,
): Promise<{ px: Uint8ClampedArray; w: number; h: number; thumbnail: string } | null> {
  if (!img.complete) {
    await new Promise<void>((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
      setTimeout(resolve, 2000);
    });
  }
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;

  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = w;
  rawCanvas.height = h;
  const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });
  if (!rawCtx) return null;
  rawCtx.drawImage(img, 0, 0, w, h);
  const px = rawCtx.getImageData(0, 0, w, h).data;

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = w;
  thumbCanvas.height = h;
  const thumbCtx = thumbCanvas.getContext('2d');
  let thumbnail = '';
  if (thumbCtx) {
    thumbCtx.fillStyle = '#ffffff';
    thumbCtx.fillRect(0, 0, w, h);
    thumbCtx.drawImage(img, 0, 0, w, h);
    const webp = thumbCanvas.toDataURL('image/webp', 0.86);
    thumbnail = webp.startsWith('data:image/webp') ? webp : thumbCanvas.toDataURL('image/png');
  }

  return { px, w, h, thumbnail };
}

export async function solveCaptchaInBrowser(params: {
  img: HTMLImageElement;
  src: string;
  cong: string;
  isHddt?: boolean;
  skipTier1?: boolean;
  skipSvgTiers?: boolean;
}): Promise<LocalSolveOutput> {
  const started = performance.now();
  const captured = await readImagePixelsAndThumb(params.img);
  const thumbnail = captured?.thumbnail || '';

  // Chuỗi 2 tầng SVG dành riêng cho ảnh SVG vector của HĐĐT
  if (params.isHddt && !params.skipSvgTiers && params.src.startsWith('data:image/svg+xml')) {
    const svg = decodeSvgDataUrl(params.src);
    if (svg && svg.includes('<path')) {
      try {
        await ensureSvgEngines();
        if (!params.skipTier1 && window.SvgCaptcha) {
          const res = window.SvgCaptcha.solve(svg);
          if (res && res.confidence >= 80 && /^[A-Za-z0-9]{4,8}$/.test(res.text || '')) {
            return {
              ok: true,
              captcha: res.text,
              source: 'svg-local',
              confidence: res.confidence,
              latencyMs: Math.max(1, Math.round(performance.now() - started)),
              thumbnail,
            };
          }
        }
        if (typeof window.giaiSvg === 'function') {
          const kq = window.giaiSvg(svg);
          if (
            kq &&
            kq.ma &&
            kq.soDuongChu > 0 &&
            kq.soNhanDuoc === kq.soDuongChu &&
            /^[A-Za-z0-9]{4,8}$/.test(kq.ma)
          ) {
            return {
              ok: true,
              captcha: kq.ma,
              source: 'svg-sig',
              confidence: 95,
              latencyMs: Math.max(1, Math.round(performance.now() - started)),
              thumbnail,
            };
          }
        }
      } catch {
        // Rơi xuống tầng 3 ONNX cục bộ
      }
    }
  }

  // Tầng ONNX cục bộ (ddddocr_old.onnx chạy trực tiếp bằng WebAssembly trên trình duyệt)
  if (!captured) {
    return {
      ok: false,
      captcha: '',
      source: 'onnx-local',
      confidence: 0,
      latencyMs: Math.max(1, Math.round(performance.now() - started)),
      thumbnail: '',
      message: 'Không đọc được pixel từ ảnh captcha.',
    };
  }

  try {
    const { session, charset } = await ensureOnnxRuntime();
    const QltPng = window.QltPng!;
    const ort = window.ort!;
    const dauVao = QltPng.tienXuLy(params.cong, Uint8Array.from(captured.px), captured.w, captured.h);
    const tensor = new ort.Tensor('float32', dauVao.tensor, [1, 1, dauVao.H, dauVao.W]);
    const out = await session.run({ [session.inputNames[0]]: tensor });
    const kq = out[session.outputNames[0]];
    const tho = QltPng.giaiCTC(kq.data, kq.dims, charset);
    const ma = QltPng.hauXuLy(params.cong, tho) || tho.replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
    const latencyMs = Math.max(1, Math.round(performance.now() - started));

    if (!ma) {
      return {
        ok: false,
        captcha: '',
        source: 'onnx-local',
        confidence: 0,
        latencyMs,
        thumbnail,
        message: 'ONNX cục bộ chưa nhận diện được ký tự rõ ràng.',
      };
    }

    return {
      ok: true,
      captcha: ma,
      source: 'onnx-local',
      confidence: 92,
      latencyMs,
      thumbnail,
    };
  } catch (err) {
    return {
      ok: false,
      captcha: '',
      source: 'onnx-local',
      confidence: 0,
      latencyMs: Math.max(1, Math.round(performance.now() - started)),
      thumbnail,
      message: err instanceof Error ? err.message : 'Lỗi chạy ONNX cục bộ trên trình duyệt.',
    };
  }
}
