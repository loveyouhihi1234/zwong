import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import {
  PORTAL_LIST,
  isValidPortal,
  parseCaptchaImageInput,
  sanitizeCaptchaText,
  type PortalId,
} from './src/utils/captchaLogic.ts';
import { createRateLimiter } from './server/rateLimit.ts';
import { buildExtensionArtifacts } from './server/extensionBundle.ts';
import { isSameOriginSandboxRequest, normalizeExtensionToken } from './server/auth.ts';
import { createDatasetStore } from './server/dataset.ts';
import { createMemoryStore, type FewShotMode } from './server/memory.ts';
import { createLocalOcrRouter } from './server/localOcr.ts';
import { solveHddtSvgDataUrl } from './server/svgCaptcha.ts';

const PORT = Number(process.env.PORT) || 3000;
const EXTENSION_DIR = path.resolve(process.cwd(), 'extension');
const THU_VIEN_DIR = path.join(EXTENSION_DIR, 'thu_vien');
const TOTAL_PORTAL_COUNT = 46;

const datasetStore = createDatasetStore();
const memoryStore = createMemoryStore({
  getAllSamples: () => datasetStore.getAllSamples(),
});
const localOcr = createLocalOcrRouter();

export interface SolveLogEntry {
  id: string;
  timestamp: string;
  portal: string;
  status: 'ok' | 'error';
  codeMasked: string;
  latencyMs: number;
  message: string;
}

const solveLogs: SolveLogEntry[] = [];
const MAX_LOG_ENTRIES = 100;

function recordLog(entry: SolveLogEntry) {
  solveLogs.unshift(entry);
  if (solveLogs.length > MAX_LOG_ENTRIES) {
    solveLogs.length = MAX_LOG_ENTRIES;
  }
}

function maskCode(code: string): string {
  if (!code) return '—';
  if (code.length <= 2) return '*'.repeat(code.length);
  return `${code[0]}${'*'.repeat(code.length - 2)}${code[code.length - 1]}`;
}

const rateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 60,
});

function resolveClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'local';
}

const ALLOWED_LOCAL_SOLVER_FILES: Record<string, string> = {
  'tien_ich_png.js': path.join(EXTENSION_DIR, 'tien_ich_png.js'),
  'bang_svg.js': path.join(EXTENSION_DIR, 'content', 'bang_svg.js'),
  'giai_svg.js': path.join(EXTENSION_DIR, 'content', 'giai_svg.js'),
  'captcha-svg-templates.js': path.join(EXTENSION_DIR, 'content', 'captcha-svg-templates.js'),
  'captcha-svg.js': path.join(EXTENSION_DIR, 'content', 'captcha-svg.js'),
  'cau_hinh_cong.js': path.join(EXTENSION_DIR, 'content', 'cau_hinh_cong.js'),
};

async function startServer() {
  await memoryStore.init().catch(() => {});
  await localOcr.scanModels().catch(() => {});

  const autoConsolidateTimer = setInterval(() => {
    memoryStore.consolidate('auto-timer').catch(() => {});
    localOcr.scanModels().catch(() => {});
  }, 15 * 60 * 1000);
  autoConsolidateTimer.unref?.();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Phục vụ tài nguyên ONNX Runtime WASM & mô hình ddddocr_old.onnx cho Web Studio Sandbox
  app.use(
    '/thu_vien',
    express.static(THU_VIEN_DIR, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm');
        } else if (filePath.endsWith('.mjs') || filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        } else if (filePath.endsWith('.onnx')) {
          res.setHeader('Content-Type', 'application/octet-stream');
        }
        res.setHeader('Cache-Control', 'public, max-age=3600');
      },
    }),
  );

  // Phục vụ các script giải SVG/PNG cục bộ cho Sandbox chạy trực tiếp trên trình duyệt
  app.get('/local-solver/:name', (req: Request, res: Response) => {
    const filePath = ALLOWED_LOCAL_SOLVER_FILES[String(req.params.name || '')];
    if (!filePath || !existsSync(filePath)) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.sendFile(filePath);
  });

  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Extension-Token, X-TaxCap-Sandbox');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    const onnxReady = existsSync(path.join(THU_VIEN_DIR, 'ddddocr_old.onnx'));
    const wasmReady = existsSync(path.join(THU_VIEN_DIR, 'ort', 'ort-wasm-simd-threaded.wasm'));
    res.json({
      ok: true,
      mode: 'local-onnx',
      model: 'ddddocr_old.onnx',
      onnxReady,
      wasmReady,
      portalCount: TOTAL_PORTAL_COUNT,
      portals: PORTAL_LIST.map((p) => p.id),
    });
  });

  app.get('/api/stats', (_req: Request, res: Response) => {
    const total = solveLogs.length;
    const successCount = solveLogs.filter((l) => l.status === 'ok').length;
    const avgLatencyMs =
      successCount > 0
        ? Math.round(
            solveLogs
              .filter((l) => l.status === 'ok')
              .reduce((acc, item) => acc + item.latencyMs, 0) / successCount,
          )
        : 0;

    res.json({
      total,
      successCount,
      errorCount: total - successCount,
      avgLatencyMs,
      logs: solveLogs,
    });
  });

  app.delete('/api/stats', (_req: Request, res: Response) => {
    solveLogs.length = 0;
    res.json({ ok: true });
  });

  // Chỉ giữ tuyến giải nội bộ (SVG 2 tầng + Trí nhớ cục bộ + ONNX nội bộ, không gọi Gemini)
  app.post('/api/captcha/solve', async (req: Request, res: Response) => {
    const start = Date.now();
    const portalRaw = String(req.body?.portal || '');
    const portal: PortalId = isValidPortal(portalRaw) ? portalRaw : 'hddt';

    const ip = resolveClientIp(req);
    const limit = rateLimiter.check(ip);
    if (!limit.allowed) {
      res.status(429).json({
        ok: false,
        message: `Vượt quá giới hạn tần suất. Thử lại sau ${Math.ceil(limit.resetInMs / 1000)} giây.`,
      });
      return;
    }

    const parsedImage = parseCaptchaImageInput(String(req.body?.image || ''));
    if (!parsedImage) {
      res.status(400).json({
        ok: false,
        message: 'Ảnh captcha không hợp lệ (cần PNG/JPEG/WEBP dạng base64).',
      });
      return;
    }

    const bypassCache = Boolean(req.body?.bypassCache);
    const imageHash = crypto.createHash('sha256').update(parsedImage.data).digest('hex');
    const imageHash24 = imageHash.slice(0, 24);

    if (portal === 'hddt' && typeof req.body?.svgDataUrl === 'string') {
      const svgHit = solveHddtSvgDataUrl(req.body.svgDataUrl, { skipTier1: bypassCache });
      if (svgHit) {
        const sampleId = await datasetStore
          .recordSolve({
            portal,
            model: svgHit.source,
            speedMode: 'fast',
            latencyMs: svgHit.latencyMs,
            predicted: svgHit.captcha,
            mimeType: parsedImage.mimeType,
            base64Data: parsedImage.data,
          })
          .catch(() => '');
        recordLog({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          portal,
          status: 'ok',
          codeMasked: maskCode(svgHit.captcha),
          latencyMs: svgHit.latencyMs,
          message:
            svgHit.source === 'svg-sig'
              ? `SVG chữ ký nội bộ (${svgHit.confidence}%)`
              : `SVG mẫu nội bộ (${svgHit.confidence}%)`,
        });
        res.json({
          ok: true,
          captcha: svgHit.captcha,
          sampleId,
          latencyMs: svgHit.latencyMs,
          model: svgHit.source,
          source: svgHit.source,
          confidence: svgHit.confidence,
        });
        return;
      }
    }

    if (!bypassCache) {
      const memoryHit = await memoryStore.lookupExact(portal, imageHash24).catch(() => null);
      if (memoryHit) {
        const latencyMs = Math.max(1, Date.now() - start);
        recordLog({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          portal,
          status: 'ok',
          codeMasked: maskCode(memoryHit.label),
          latencyMs,
          message: 'Trí nhớ cục bộ (<5ms)',
        });
        res.json({
          ok: true,
          captcha: memoryHit.label,
          sampleId: memoryHit.sampleId,
          latencyMs,
          model: 'memory-exact',
          source: 'memory',
          cached: true,
        });
        return;
      }

      const localHit = await localOcr.trySolve(portal, parsedImage.data).catch(() => null);
      if (localHit) {
        const sampleId = await datasetStore
          .recordSolve({
            portal,
            model: 'local-onnx',
            speedMode: 'fast',
            latencyMs: localHit.latencyMs,
            predicted: localHit.captcha,
            mimeType: parsedImage.mimeType,
            base64Data: parsedImage.data,
          })
          .catch(() => '');
        recordLog({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          portal,
          status: 'ok',
          codeMasked: maskCode(localHit.captcha),
          latencyMs: localHit.latencyMs,
          message: `Model ONNX nội bộ (${Math.round(localHit.confidence * 100)}%)`,
        });
        res.json({
          ok: true,
          captcha: localHit.captcha,
          sampleId,
          latencyMs: localHit.latencyMs,
          model: 'local-onnx',
          source: 'onnx-local',
        });
        return;
      }
    }

    res.status(422).json({
      ok: false,
      message: 'Ảnh PNG được giải cục bộ trên trình duyệt bằng ONNX WASM (ddddocr_old.onnx).',
    });
  });

  app.post('/api/dataset/record-local', async (req: Request, res: Response) => {
    const requiredToken = normalizeExtensionToken(process.env.EXTENSION_SHARED_TOKEN);
    if (requiredToken && !isSameOriginSandboxRequest(req, process.env.APP_URL)) {
      const provided = normalizeExtensionToken(String(req.headers['x-extension-token'] || ''));
      if (provided !== requiredToken) {
        res.status(401).json({ ok: false, message: 'Mã truy cập Extension không hợp lệ.' });
        return;
      }
    }

    const portalRaw = String(req.body?.portal || 'hddt').trim();
    const datasetPortal: PortalId = isValidPortal(portalRaw) ? portalRaw : 'hddt';
    const displayPortal = portalRaw || datasetPortal;
    const captcha = sanitizeCaptchaText(String(req.body?.captcha || ''));
    const parsedImage = parseCaptchaImageInput(String(req.body?.image || ''));
    const source = String(req.body?.source || 'onnx-local').trim();
    const latencyMs = Math.max(1, Math.min(30000, Number(req.body?.latencyMs) || 2));
    const confidence = Math.max(0, Math.min(100, Math.round(Number(req.body?.confidence) || 95)));

    if (!captcha) {
      recordLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        portal: displayPortal,
        status: 'error',
        codeMasked: '—',
        latencyMs,
        message: String(req.body?.message || 'ONNX cục bộ chưa đọc được mã'),
      });
      res.json({ ok: true, sampleId: '' });
      return;
    }

    let sampleId = '';
    if (parsedImage) {
      sampleId = await datasetStore
        .recordSolve({
          portal: datasetPortal,
          model: source,
          speedMode: 'fast',
          latencyMs,
          predicted: captcha,
          mimeType: parsedImage.mimeType,
          base64Data: parsedImage.data,
        })
        .catch(() => '');
    }

    const detailMessage =
      source === 'svg-local'
        ? `SVG mẫu nội bộ (${confidence}%)`
        : source === 'svg-sig'
          ? `SVG chữ ký nội bộ (${confidence}%)`
          : source === 'text-local' || source === 'svg-text'
            ? 'Đọc chữ trực tiếp (DOM/SVG)'
            : `ONNX cục bộ (ddddocr · ${latencyMs}ms)`;

    recordLog({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      portal: displayPortal,
      status: 'ok',
      codeMasked: maskCode(captcha),
      latencyMs,
      message: detailMessage,
    });

    res.json({ ok: true, sampleId });
  });

  app.post('/api/dataset/feedback', async (req: Request, res: Response) => {
    const requiredToken = normalizeExtensionToken(process.env.EXTENSION_SHARED_TOKEN);
    if (requiredToken && !isSameOriginSandboxRequest(req, process.env.APP_URL)) {
      const provided = normalizeExtensionToken(String(req.headers['x-extension-token'] || ''));
      if (provided !== requiredToken) {
        res.status(401).json({ ok: false, message: 'Mã truy cập Extension không hợp lệ.' });
        return;
      }
    }

    const sampleId = String(req.body?.sampleId || '').trim();
    const rawOutcome = String(req.body?.outcome || '').trim();
    const outcome =
      rawOutcome === 'verified' || rawOutcome === 'corrected' || rawOutcome === 'rejected'
        ? rawOutcome
        : null;
    if (!sampleId || !outcome) {
      res.status(400).json({ ok: false, message: 'Thiếu sampleId hoặc outcome hợp lệ.' });
      return;
    }

    const finalLabel =
      typeof req.body?.finalLabel === 'string' ? req.body.finalLabel : undefined;
    const sample = await datasetStore.recordFeedback({ sampleId, outcome, finalLabel });
    if (!sample) {
      res.status(404).json({ ok: false, message: 'Không tìm thấy mẫu captcha.' });
      return;
    }
    const autoConsolidated = await memoryStore.notifyFeedbackRecorded().catch(() => false);
    res.json({ ok: true, sample, autoConsolidated });
  });

  app.get('/api/dataset', async (_req: Request, res: Response) => {
    try {
      const snapshot = await datasetStore.getSnapshot(60);
      res.json({ ok: true, ...snapshot });
    } catch {
      res.status(500).json({ ok: false, message: 'Không đọc được kho dữ liệu.' });
    }
  });

  app.get('/api/dataset/image/:filename', async (req: Request, res: Response) => {
    const filename = String(req.params.filename || '');
    const imgPath = await datasetStore.getImagePath(filename);
    if (!imgPath) {
      res.status(404).end();
      return;
    }
    res.sendFile(imgPath);
  });

  app.get('/api/dataset/export', async (_req: Request, res: Response) => {
    try {
      const { zipBuffer } = await datasetStore.exportZipBuffer();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="taxcap-dataset.zip"');
      res.send(zipBuffer);
    } catch {
      res.status(500).json({ ok: false, message: 'Không xuất được bộ dữ liệu.' });
    }
  });

  app.delete('/api/dataset', async (_req: Request, res: Response) => {
    await datasetStore.clearAll();
    await memoryStore.reset();
    res.json({ ok: true });
  });

  app.get('/api/memory', async (_req: Request, res: Response) => {
    try {
      const [memory, localModels] = await Promise.all([
        memoryStore.getSummary(),
        localOcr.getStatus(),
      ]);
      res.json({ ok: true, memory, localModels });
    } catch {
      res.status(500).json({ ok: false, message: 'Không đọc được trí nhớ cục bộ.' });
    }
  });

  app.post('/api/memory/consolidate', async (_req: Request, res: Response) => {
    try {
      await memoryStore.consolidate('manual');
      const [memory, localModels] = await Promise.all([
        memoryStore.getSummary(),
        localOcr.getStatus(),
      ]);
      res.json({ ok: true, memory, localModels });
    } catch {
      res.status(500).json({ ok: false, message: 'Không cập nhật được trí nhớ cục bộ.' });
    }
  });

  app.post('/api/memory/config', async (req: Request, res: Response) => {
    const rawMode = String(req.body?.fewShotMode || '');
    const mode: FewShotMode =
      rawMode === 'always' || rawMode === 'off' ? rawMode : 'smart';
    await memoryStore.setFewShotMode(mode);
    const [memory, localModels] = await Promise.all([
      memoryStore.getSummary(),
      localOcr.getStatus(),
    ]);
    res.json({ ok: true, memory, localModels });
  });

  app.get('/api/extension/preview', async (req: Request, res: Response) => {
    try {
      const licenseApiUrl = String(req.query.licenseApiUrl || '');
      const { files } = await buildExtensionArtifacts({
        licenseApiUrl,
        includeZip: false,
      });
      res.json({ ok: true, files });
    } catch {
      res.status(500).json({ ok: false, message: 'Không đọc được mã nguồn extension.' });
    }
  });

  app.get('/api/extension/bundle', async (req: Request, res: Response) => {
    try {
      const licenseApiUrl = String(req.query.licenseApiUrl || '');
      const { zipBuffer } = await buildExtensionArtifacts({
        licenseApiUrl,
        includeZip: true,
      });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="taxcap-suite-mv3.zip"');
      res.send(zipBuffer);
    } catch {
      res.status(500).json({ ok: false, message: 'Không đóng gói được tệp zip.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', async (_req, res) => {
      const html = await fs.readFile(path.join(distDir, 'index.html'), 'utf8');
      res.status(200).type('html').send(html);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TaxCap Studio (Local SVG + ONNX) running on http://localhost:${PORT}`);
  });
}

startServer();
