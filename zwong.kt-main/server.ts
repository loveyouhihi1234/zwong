import 'dotenv/config';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { PORTAL_LIST } from './src/utils/captchaLogic.ts';
import { buildExtensionArtifacts } from './server/extensionBundle.ts';
import {
  buildDemoChromeShimScript,
  injectDemoShimIntoHtml,
  resolveSafeDemoPath,
} from './server/extensionDemo.ts';

const PORT = Number(process.env.PORT) || 3000;
const EXTENSION_DIR = path.resolve(process.cwd(), 'extension');
const THU_VIEN_DIR = path.join(EXTENSION_DIR, 'thu_vien');
const TOTAL_PORTAL_COUNT = 46;

const ALLOWED_LOCAL_SOLVER_FILES: Record<string, string> = {
  'tien_ich_png.js': path.join(EXTENSION_DIR, 'tien_ich_png.js'),
  'bang_svg.js': path.join(EXTENSION_DIR, 'content', 'bang_svg.js'),
  'giai_svg.js': path.join(EXTENSION_DIR, 'content', 'giai_svg.js'),
  'captcha-svg-templates.js': path.join(EXTENSION_DIR, 'content', 'captcha-svg-templates.js'),
  'captcha-svg.js': path.join(EXTENSION_DIR, 'content', 'captcha-svg.js'),
  'cau_hinh_cong.js': path.join(EXTENSION_DIR, 'content', 'cau_hinh_cong.js'),
};

async function startServer() {
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

  // Tuyến Extension Demo: phục vụ giao diện Side Panel thật của Extension kèm lớp giả lập chrome.* cô lập
  app.get('/extension-demo/demo-chrome-shim.js', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buildDemoChromeShimScript());
  });

  app.get(/^\/extension-demo\/?(.*)$/, async (req: Request, res: Response) => {
    const rawSubPath = String(req.params[0] || '');
    const resolved = resolveSafeDemoPath(EXTENSION_DIR, rawSubPath);
    if (!resolved || !existsSync(resolved)) {
      res.status(404).end();
      return;
    }
    if (resolved.endsWith('.html')) {
      try {
        const html = await fs.readFile(resolved, 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.send(injectDemoShimIntoHtml(html));
      } catch {
        res.status(500).end();
      }
      return;
    }
    if (resolved.endsWith('.js') || resolved.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    } else if (resolved.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (resolved.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (resolved.endsWith('.woff2')) {
      res.setHeader('Content-Type', 'font/woff2');
    }
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(resolved);
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
