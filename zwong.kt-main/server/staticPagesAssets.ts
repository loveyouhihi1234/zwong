import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildDemoChromeShimScript, injectDemoShimIntoHtml } from './extensionDemo.ts';

const LOCAL_SOLVER_MAPPINGS: ReadonlyArray<{ dest: string; srcRel: string }> = [
  { dest: 'tien_ich_png.js', srcRel: 'tien_ich_png.js' },
  { dest: 'bang_svg.js', srcRel: path.join('content', 'bang_svg.js') },
  { dest: 'giai_svg.js', srcRel: path.join('content', 'giai_svg.js') },
  { dest: 'captcha-svg-templates.js', srcRel: path.join('content', 'captcha-svg-templates.js') },
  { dest: 'captcha-svg.js', srcRel: path.join('content', 'captcha-svg.js') },
  { dest: 'cau_hinh_cong.js', srcRel: path.join('content', 'cau_hinh_cong.js') },
];

const DEMO_SINGLE_FILES: ReadonlyArray<string> = [
  'sidepanel.html',
  'sidepanel.js',
  'config.js',
  'license.js',
  path.join('content', 'cau_hinh_cong.js'),
];

const DEMO_DIRECTORIES: ReadonlyArray<string> = ['icons', 'panels'];

/**
 * Computes the relative script src path from an HTML file inside extension-demo/
 * back to extension-demo/demo-chrome-shim.js so GitHub Pages subpaths work cleanly.
 */
export function computeRelativeShimPath(relHtmlPath: string): string {
  const normalized = String(relHtmlPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const dir = path.posix.dirname(normalized);
  if (!dir || dir === '.') {
    return './demo-chrome-shim.js';
  }
  const rel = path.posix.relative(dir, 'demo-chrome-shim.js');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

async function copyFileSafe(src: string, dest: string): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function copyDirRecursive(
  srcDir: string,
  destDir: string,
  onFile?: (srcFile: string, destFile: string, relPosix: string) => Promise<void>,
  relPrefix = '',
): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    const relPosix = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath, onFile, relPosix);
    } else if (entry.isFile()) {
      if (onFile) {
        await onFile(srcPath, destPath, relPosix);
      } else {
        await copyFileSafe(srcPath, destPath);
      }
    }
  }
}

/**
 * Emits all static assets required for GitHub Pages (zero-server hosting):
 *  - dist/thu_vien/         (ONNX model, charset, ONNX Runtime WASM)
 *  - dist/local-solver/     (SVG + PNG solver scripts for SandboxPanel)
 *  - dist/extension-demo/   (Interactive Side Panel demo with relative demo-chrome-shim.js)
 *  - dist/.nojekyll         (Disable Jekyll on GitHub Pages)
 */
export async function emitStaticPagesAssets(projectRoot: string, outDir: string): Promise<void> {
  const extensionDir = path.join(projectRoot, 'extension');
  if (!existsSync(extensionDir)) {
    throw new Error(`Không tìm thấy thư mục extension tại ${extensionDir}`);
  }

  // 1. Copy extension/thu_vien -> dist/thu_vien
  const thuVienSrc = path.join(extensionDir, 'thu_vien');
  const thuVienDest = path.join(outDir, 'thu_vien');
  if (existsSync(thuVienSrc)) {
    await copyDirRecursive(thuVienSrc, thuVienDest);
  }

  // 2. Copy local solver JS files -> dist/local-solver
  const localSolverDest = path.join(outDir, 'local-solver');
  await fs.mkdir(localSolverDest, { recursive: true });
  for (const item of LOCAL_SOLVER_MAPPINGS) {
    const srcPath = path.join(extensionDir, item.srcRel);
    if (existsSync(srcPath)) {
      await copyFileSafe(srcPath, path.join(localSolverDest, item.dest));
    }
  }

  // 3. Build static dist/extension-demo (without duplicating thu_vien/)
  const demoDest = path.join(outDir, 'extension-demo');
  await fs.mkdir(demoDest, { recursive: true });
  await fs.writeFile(path.join(demoDest, 'demo-chrome-shim.js'), buildDemoChromeShimScript(), 'utf8');

  const copyDemoFile = async (srcFile: string, destFile: string, relPosix: string) => {
    await fs.mkdir(path.dirname(destFile), { recursive: true });
    if (relPosix.endsWith('.html')) {
      const html = await fs.readFile(srcFile, 'utf8');
      const shimSrc = computeRelativeShimPath(relPosix);
      await fs.writeFile(destFile, injectDemoShimIntoHtml(html, shimSrc), 'utf8');
    } else {
      await fs.copyFile(srcFile, destFile);
    }
  };

  for (const relFile of DEMO_SINGLE_FILES) {
    const srcFile = path.join(extensionDir, relFile);
    if (existsSync(srcFile)) {
      const relPosix = relFile.replace(/\\/g, '/');
      await copyDemoFile(srcFile, path.join(demoDest, relFile), relPosix);
    }
  }

  for (const relDir of DEMO_DIRECTORIES) {
    const srcDir = path.join(extensionDir, relDir);
    if (existsSync(srcDir)) {
      await copyDirRecursive(srcDir, path.join(demoDest, relDir), copyDemoFile, relDir);
    }
  }

  // 4. Write .nojekyll so GitHub Pages serves every asset directly
  await fs.writeFile(path.join(outDir, '.nojekyll'), '', 'utf8');
}
