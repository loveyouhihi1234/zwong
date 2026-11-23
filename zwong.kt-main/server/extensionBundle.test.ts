import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import JSZip from 'jszip';
import {
  buildExtensionArtifacts,
  generatePngIcon,
  UNIFIED_EXTENSION_BINARY_FILES,
  UNIFIED_EXTENSION_TEXT_FILES,
} from './extensionBundle';

const ESM_MODULE_SCRIPTS = new Set([
  'panels/hddt/panel-hddt.js',
  'panels/hddt/datepicker-hddt.js',
  'panels/hoso/panel-hoso.js',
  'panels/hoso/datepicker-hoso.js',
  'panels/hoso/combobox-hoso.js',
  'thu_vien/ort/ort-wasm-simd-threaded.mjs',
  'thu_vien/ort/ort.wasm.min.js',
]);

test('generatePngIcon returns valid PNG header', () => {
  const buf = generatePngIcon(48);
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});

test('buildExtensionArtifacts packages unified 3-tab Side Panel extension with 46 portals, ONNX/WASM binaries, and zero Gemini', async () => {
  const { zipBuffer, files } = await buildExtensionArtifacts({
    licenseApiUrl: 'https://script.google.com/macros/s/test-deploy/exec',
  });

  const zip = await JSZip.loadAsync(zipBuffer);
  assert.ok(zip.file('manifest.json'));
  assert.ok(zip.file('config.js'));
  assert.ok(zip.file('icons/icon-48.png'));
  assert.ok(zip.file('icons/icon-128.png'));

  for (const rel of UNIFIED_EXTENSION_TEXT_FILES) {
    assert.ok(zip.file(rel), `Missing text file in zip: ${rel}`);
  }
  for (const rel of UNIFIED_EXTENSION_BINARY_FILES) {
    const entry = zip.file(rel);
    assert.ok(entry, `Missing binary asset in zip: ${rel}`);
    const bytes = await entry!.async('uint8array');
    assert.equal(bytes.length > 1000, true, `Binary asset looks empty: ${rel}`);
  }

  // Verify embedded ONNX model and WASM runtime sizes
  const onnxBytes = await zip.file('thu_vien/ddddocr_old.onnx')!.async('uint8array');
  const wasmBytes = await zip.file('thu_vien/ort/ort-wasm-simd-threaded.wasm')!.async('uint8array');
  assert.equal(onnxBytes.length > 5_000_000, true, 'ddddocr_old.onnx should be full model binary');
  assert.equal(wasmBytes.length > 5_000_000, true, 'ort-wasm-simd-threaded.wasm should be full WASM binary');
  assert.equal(
    wasmBytes[0] === 0x00 && wasmBytes[1] === 0x61 && wasmBytes[2] === 0x73 && wasmBytes[3] === 0x6d,
    true,
    'WASM binary must start with magic bytes \\0asm',
  );

  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '2.1.0');
  assert.equal(manifest.side_panel?.default_path, 'sidepanel.html');
  assert.equal(manifest.action?.default_popup, undefined);
  assert.equal(manifest.permissions.includes('storage'), true);
  assert.equal(manifest.permissions.includes('alarms'), true);
  assert.equal(manifest.permissions.includes('sidePanel'), true);
  assert.equal(manifest.permissions.includes('downloads'), true);
  assert.equal(manifest.permissions.includes('offscreen'), true);
  assert.equal(
    manifest.content_security_policy?.extension_pages?.includes("'wasm-unsafe-eval'"),
    true,
    'CSP must allow wasm-unsafe-eval for local ONNX WASM',
  );

  // Zero Gemini host permissions
  assert.equal(
    manifest.host_permissions.includes('https://generativelanguage.googleapis.com/*'),
    false,
    'Gemini API host permission must be completely removed',
  );
  assert.equal(manifest.host_permissions.includes('https://script.google.com/*'), true);
  assert.equal(manifest.host_permissions.length >= 45, true, 'Expected host_permissions for all 46 portals + Google Sheets');

  assert.equal(
    manifest.web_accessible_resources?.[0]?.resources?.includes('content/fonts/*.ttf'),
    true,
  );

  // Verify HDDT content script injects BOTH Tier-1 SVG (captcha-svg.js) and Tier-2 SVG (bang_svg.js + giai_svg.js) once
  const hddtRule = manifest.content_scripts.find((s: { matches: string[] }) =>
    s.matches.includes('https://hoadondientu.gdt.gov.vn/*'),
  );
  assert.ok(hddtRule);
  assert.equal(hddtRule.js.filter((f: string) => f.includes('captcha-svg.js')).length, 1);
  assert.equal(hddtRule.js.includes('content/bang_svg.js'), true);
  assert.equal(hddtRule.js.includes('content/giai_svg.js'), true);
  assert.equal(hddtRule.js.includes('content/hddt/hddt-content.js'), true);
  assert.equal(hddtRule.js.includes('content/hddt.js'), true);

  // Verify Hoso downloader + DVC captcha run together on dichvucong
  const dvcRule = manifest.content_scripts.find((s: { matches: string[] }) =>
    s.matches.includes('https://dichvucong.gdt.gov.vn/*'),
  );
  assert.ok(dvcRule);
  assert.equal(dvcRule.js.includes('content/dvc.js'), true);
  assert.equal(dvcRule.js.includes('content/hoso/hoso-content.js'), true);

  // Verify extended portals content script rule covers BHXH, Hải quan, Ngân hàng, NCC Hóa đơn
  const extRule = manifest.content_scripts.find((s: { js: string[] }) =>
    s.js.includes('content/extended-portals.js'),
  );
  assert.ok(extRule, 'Missing content_scripts entry for content/extended-portals.js');
  assert.equal(extRule.js.includes('content/cau_hinh_cong.js'), true);
  assert.equal(extRule.js.includes('content/common.js'), true);
  assert.equal(extRule.matches.includes('https://baohiemxahoi.gov.vn/*'), true);
  assert.equal(extRule.matches.includes('https://einvoice.vietcombank.com.vn/*'), true);
  assert.equal(extRule.matches.includes('https://*.vnpt-invoice.com.vn/*'), true);

  // Verify exact top-level tab order in sidepanel.html: Tải HĐĐT -> Tải Hồ sơ -> Captcha
  const sidepanelHtml = await zip.file('sidepanel.html')!.async('string');
  const idxHddt = sidepanelHtml.indexOf('data-main-tab="hddt"');
  const idxHoso = sidepanelHtml.indexOf('data-main-tab="hoso"');
  const idxCaptcha = sidepanelHtml.indexOf('data-main-tab="captcha"');
  assert.equal(idxHddt > 0 && idxHoso > idxHddt && idxCaptcha > idxHoso, true);

  // Verify global license guard & local ONNX offscreen solver in background.js (and zero Gemini calls)
  const backgroundJs = await zip.file('background.js')!.async('string');
  assert.equal(backgroundJs.includes('TAXCAP_CHECK_LICENSE'), true);
  assert.equal(backgroundJs.includes('TAXCAP_DOWNLOAD_FILE'), true);
  assert.equal(backgroundJs.includes('TAXCAP_SOLVE_ONNX'), true);
  assert.equal(backgroundJs.includes('openPanelOnActionClick: true'), true);
  assert.equal(backgroundJs.includes('generativelanguage.googleapis.com'), false);

  const configJs = await zip.file('config.js')!.async('string');
  assert.equal(configJs.includes('"solverMode": "local-onnx"'), true);
  assert.equal(configJs.includes('https://script.google.com/macros/s/test-deploy/exec'), true);
  assert.equal(configJs.includes('"ext_gov": true'), true);
  assert.equal(configJs.includes('"ext_bank": true'), true);
  assert.equal(configJs.includes('"ext_invoice": true'), true);

  // Syntax-check every classic JS script bundled into the extension
  for (const file of files) {
    if (file.path.endsWith('.js') && !ESM_MODULE_SCRIPTS.has(file.path)) {
      assert.doesNotThrow(() => new vm.Script(file.content, { filename: file.path }));
    }
  }
});

test('all TAXCAP_* runtime messages sent by sidepanel, panels, and content scripts are handled by background.js', async () => {
  const { files } = await buildExtensionArtifacts({ includeZip: false });
  const bg = files.find((f) => f.path === 'background.js')?.content || '';
  const sidepanel = files.find((f) => f.path === 'sidepanel.js')?.content || '';

  assert.equal(sidepanel.includes('TAXCAP_LICENSE_STATUS'), true);
  assert.equal(sidepanel.includes('TAXCAP_LICENSE_ACTIVATE'), true);
  assert.equal(sidepanel.includes('licRes?.license'), true);

  const sentTypes = new Set<string>();
  const typeRegex = /type\s*:\s*['"](TAXCAP_[A-Z0-9_]+)['"]/g;
  for (const file of files) {
    if (!file.path.endsWith('.js') || file.path === 'background.js') continue;
    let m: RegExpExecArray | null;
    while ((m = typeRegex.exec(file.content)) !== null) {
      sentTypes.add(m[1]);
    }
  }

  assert.ok(sentTypes.size >= 8, 'Expected at least 8 TAXCAP_* runtime message types');
  for (const removedType of [
    'TAXCAP_FEEDBACK',
    'TAXCAP_GET_DATASET',
    'TAXCAP_CLEAR_DATASET',
    'TAXCAP_POPUP_UPDATE_SAMPLE',
    'TAXCAP_GET_LOGS',
    'TAXCAP_CLEAR_LOGS',
    'TAXCAP_GET_MEMORY_STATS',
    'TAXCAP_CLEAR_MEMORY',
  ]) {
    assert.equal(sentTypes.has(removedType), false, `Removed message type should not be sent: ${removedType}`);
    assert.equal(bg.includes(removedType), false, `Removed handler should not remain in background.js: ${removedType}`);
  }
  for (const msgType of sentTypes) {
    assert.equal(
      bg.includes(`"${msgType}"`) || bg.includes(`'${msgType}'`),
      true,
      `background.js is missing handler for message type: ${msgType}`,
    );
  }
});

test('UI & reliability guarantees preserved: HDDT log visible + instant abort, Hoso 4 presets, Captcha dedupe, 2 sub-tabs only (no Dataset/Logs), and Today counter', async () => {
  const { files } = await buildExtensionArtifacts({ includeZip: false });
  const get = (p: string) => files.find((f) => f.path === p)?.content || '';

  const hddtHtml = get('panels/hddt/index.html');
  assert.equal(hddtHtml.includes('class="notice"'), false, 'HDDT yellow update notice must be removed');
  assert.equal(hddtHtml.includes('id="jobArea"'), true, 'HDDT Nhật ký section must exist');
  assert.equal(hddtHtml.includes('id="log"'), true, 'HDDT log list must exist');

  const hddtCss = get('panels/hddt/panel-hddt.css');
  assert.equal(hddtCss.includes('.job:has(#log:empty)'), false, 'HDDT Nhật ký must not hide when empty');

  const hddtApi = get('content/hddt/hddt-api.js');
  const hddtContent = get('content/hddt/hddt-content.js');
  const hddtPanelJs = get('panels/hddt/panel-hddt.js');
  assert.equal(hddtApi.includes('abortActive'), true, 'HDDT API must expose abortActive()');
  assert.equal(hddtApi.includes('giaiSvg'), true, 'HDDT API must include Tier-2 giaiSvg fallback');
  assert.equal(hddtContent.includes("msg.type === 'hddt-stop'"), true, 'HDDT port must handle hddt-stop');
  assert.equal(hddtPanelJs.includes('Đang dừng…'), true, 'HDDT Stop button must show immediate Đang dừng… feedback');

  const hosoHtml = get('panels/hoso/index.html');
  assert.equal(hosoHtml.includes('class="privacy"'), false, 'Hoso privacy box must be removed');
  assert.equal(hosoHtml.includes('Cam kết không thu thập dữ liệu'), false);

  const hosoPanelJs = get('panels/hoso/panel-hoso.js');
  for (const label of ["'Tháng này'", "'Tháng trước'", "'Quý trước'", "'Năm nay'"]) {
    assert.equal(hosoPanelJs.includes(label), true, `Hoso presets missing ${label}`);
  }
  assert.equal(hosoPanelJs.includes("'12 tháng qua'"), false, 'Hoso old 12 tháng qua preset must be removed');

  const commonJs = get('content/common.js');
  assert.equal(commonJs.includes('window.__taxcapCommonLoaded'), true, 'common.js must guard against duplicate load');
  assert.equal(commonJs.includes('taxcapExtId'), true, 'common.js must tag and dedupe same-extension widgets');
  assert.equal(commonJs.includes('taxcapReadRawRgba'), true, 'common.js must capture raw RGBA for ONNX');

  const captchaPanelHtml = get('panels/captcha/index.html');
  assert.equal(captchaPanelHtml.includes('geminiApiKey'), false, 'Captcha panel must not contain Gemini API Key input');
  assert.equal(captchaPanelHtml.includes('data-tab="captcha"'), true, 'Captcha panel must keep Captcha sub-tab');
  assert.equal(captchaPanelHtml.includes('data-tab="config"'), true, 'Captcha panel must keep Cấu hình sub-tab');
  assert.equal(captchaPanelHtml.includes('data-tab="dataset"'), false, 'Captcha panel must NOT contain Kho dữ liệu sub-tab');
  assert.equal(captchaPanelHtml.includes('data-tab="logs"'), false, 'Captcha panel must NOT contain Nhật ký sub-tab');
  assert.equal(captchaPanelHtml.includes('memoryStatsText'), false, 'Captcha panel must NOT contain local memory stats');
  assert.equal(captchaPanelHtml.includes('id="statSolved"'), true, 'Captcha panel must keep Today Solved counter');
  assert.equal(captchaPanelHtml.includes('id="statFailed"'), true, 'Captcha panel must keep Today Failed counter');
  assert.equal(captchaPanelHtml.includes('ext_gov'), true, 'Captcha panel must include ext_gov group toggle');
  assert.equal(captchaPanelHtml.includes('ext_bank'), true, 'Captcha panel must include ext_bank group toggle');
  assert.equal(captchaPanelHtml.includes('ext_invoice'), true, 'Captcha panel must include ext_invoice group toggle');

  // Verify packaged extension stays completely clean of demo-only shim
  assert.equal(files.some((f) => f.path.includes('demo-chrome-shim')), false);
  assert.equal(get('sidepanel.html').includes('demo-chrome-shim'), false);
});
