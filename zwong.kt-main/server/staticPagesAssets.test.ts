import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeRelativeShimPath, emitStaticPagesAssets } from './staticPagesAssets';

test('computeRelativeShimPath resolves subpath-safe relative URLs for root and nested panels', () => {
  assert.equal(computeRelativeShimPath('sidepanel.html'), './demo-chrome-shim.js');
  assert.equal(computeRelativeShimPath('panels/hddt/index.html'), '../../demo-chrome-shim.js');
  assert.equal(computeRelativeShimPath('panels/hoso/index.html'), '../../demo-chrome-shim.js');
  assert.equal(computeRelativeShimPath('panels/captcha/index.html'), '../../demo-chrome-shim.js');
});

test('emitStaticPagesAssets outputs thu_vien, local-solver, extension-demo, and .nojekyll', async () => {
  const projectRoot = path.resolve(import.meta.dirname, '..');
  const tmpOut = await fs.mkdtemp(path.join(os.tmpdir(), 'taxcap-pages-'));
  try {
    await emitStaticPagesAssets(projectRoot, tmpOut);

    // ONNX/WASM binaries & charset
    assert.equal(existsSync(path.join(tmpOut, 'thu_vien', 'ddddocr_old.onnx')), true);
    assert.equal(existsSync(path.join(tmpOut, 'thu_vien', 'charset.json')), true);
    assert.equal(existsSync(path.join(tmpOut, 'thu_vien', 'ort', 'ort.wasm.min.js')), true);
    assert.equal(existsSync(path.join(tmpOut, 'thu_vien', 'ort', 'ort-wasm-simd-threaded.wasm')), true);

    // Local solver scripts for SandboxPanel
    assert.equal(existsSync(path.join(tmpOut, 'local-solver', 'tien_ich_png.js')), true);
    assert.equal(existsSync(path.join(tmpOut, 'local-solver', 'captcha-svg.js')), true);
    assert.equal(existsSync(path.join(tmpOut, 'local-solver', 'giai_svg.js')), true);

    // Static Extension Demo with relative demo-chrome-shim.js injected
    assert.equal(existsSync(path.join(tmpOut, 'extension-demo', 'demo-chrome-shim.js')), true);
    const sidepanelHtml = await fs.readFile(path.join(tmpOut, 'extension-demo', 'sidepanel.html'), 'utf8');
    assert.equal(sidepanelHtml.includes('<script src="./demo-chrome-shim.js"></script>'), true);

    const hddtHtml = await fs.readFile(
      path.join(tmpOut, 'extension-demo', 'panels', 'hddt', 'index.html'),
      'utf8',
    );
    assert.equal(hddtHtml.includes('<script src="../../demo-chrome-shim.js"></script>'), true);

    // Must not duplicate heavy ONNX binaries inside extension-demo
    assert.equal(existsSync(path.join(tmpOut, 'extension-demo', 'thu_vien')), false);

    // .nojekyll marker
    assert.equal(existsSync(path.join(tmpOut, '.nojekyll')), true);
  } finally {
    await fs.rm(tmpOut, { recursive: true, force: true });
  }
});
