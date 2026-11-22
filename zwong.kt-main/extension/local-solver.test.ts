import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadScript(relPath: string, sharedSandbox?: Record<string, unknown>) {
  const code = fs.readFileSync(path.resolve(process.cwd(), 'extension', relPath), 'utf8');
  const sandbox: Record<string, unknown> = sharedSandbox || {};
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: relPath });
  return sandbox;
}

test('cau_hinh_cong.js exposes all 46 portals, normalizes www & *.vnpt-invoice.com.vn, and groups toggle keys', () => {
  const sb = loadScript('content/cau_hinh_cong.js');
  const CONG_THUE = sb.CONG_THUE as Array<{ hostname: string; cong: string; portalId?: string; loai: string }>;
  const chuanHoaHost = sb.chuanHoaHost as (h: string) => string;
  const timCauHinh = sb.timCauHinh as (h: string) => { hostname: string; cong: string; portalId?: string } | null;
  const nhomBatTat = sb.nhomBatTat as (c: { hostname: string; portalId?: string }) => string;

  assert.equal(CONG_THUE.length, 46, 'Expected exactly 46 portals in CONG_THUE');

  // Normalize www prefix and wildcard subdomains
  assert.equal(chuanHoaHost('www.customs.gov.vn'), 'customs.gov.vn');
  assert.equal(chuanHoaHost('WWW.GDT.GOV.VN'), 'gdt.gov.vn');
  assert.equal(chuanHoaHost('abc-tt78.vnpt-invoice.com.vn'), 'vnpt-invoice.com.vn');
  assert.equal(chuanHoaHost('hst.vnpt-invoice.com.vn'), 'hst.vnpt-invoice.com.vn');

  assert.equal(timCauHinh('abc-tt78.vnpt-invoice.com.vn')?.cong, 'so4');
  assert.equal(timCauHinh('hst.vnpt-invoice.com.vn')?.cong, 'vnpt_invoice');
  assert.equal(timCauHinh('unknown.example.com'), null);

  // Verify group toggle counts: 4 main + 9 ext_gov + 13 ext_bank + 20 ext_invoice = 46
  const counts: Record<string, number> = {};
  for (const c of CONG_THUE) {
    const key = nhomBatTat(c);
    counts[key] = (counts[key] || 0) + 1;
  }
  assert.equal(counts.hddt, 1);
  assert.equal(counts.tdt, 1);
  assert.equal(counts.dvc, 1);
  assert.equal(counts.tracuunnt, 1);
  assert.equal(counts.ext_gov, 9);
  assert.equal(counts.ext_bank, 13);
  assert.equal(counts.ext_invoice, 20);
});

test('tien_ich_png.js handles Lanczos preprocessing, alpha compositing, inversion, cropping, CTC decoding, and portal post-processing', () => {
  const sb = loadScript('tien_ich_png.js');
  const QltPng = sb.QltPng as {
    nenTrang: (rgba: Uint8Array) => Uint8Array;
    nenDenDao: (rgba: Uint8Array) => Uint8Array;
    catSatChu: (rgba: Uint8Array, w: number, h: number, thr: number, padY: number, padX: number) => { rgba: Uint8Array; w: number; h: number };
    tienXuLy: (cong: string, rgba: Uint8Array, w: number, h: number) => { tensor: Float32Array; xam: Uint8Array; W: number; H: number };
    giaiCTC: (logits: Float32Array, dims: number[], charset: string[]) => string;
    hauXuLy: (cong: string, chuoi: string) => string;
  };

  // Transparent pixel composited onto white becomes 255,255,255,255
  const transparent = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 255]);
  const whiteBg = QltPng.nenTrang(transparent);
  assert.deepEqual(Array.from(whiteBg), [255, 255, 255, 255, 0, 0, 0, 255]);

  // Dark background inversion (ngogiaphat): white ink on transparent/black becomes black ink on white
  const darkInv = QltPng.nenDenDao(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]));
  assert.deepEqual(Array.from(darkInv), [0, 0, 0, 255, 255, 255, 255, 255]);

  // Preprocessing scales height to 64 and normalizes tensor to [0, 1]
  const w = 100;
  const h = 32;
  const rgba = new Uint8Array(w * h * 4);
  rgba.fill(255);
  const pre = QltPng.tienXuLy('thuedientu', rgba, w, h);
  assert.equal(pre.H, 64);
  assert.equal(pre.W, 200);
  assert.equal(pre.tensor.length, 64 * 200);
  assert.equal(pre.tensor[0], 1);

  // CTC greedy decode collapses duplicates and removes blank index 0
  const charset = ['', 'a', 'b', '3'];
  // T=5, C=4 -> argmax sequence [1, 1, 0, 2, 3] => "ab3"
  const logits = new Float32Array([
    0, 5, 0, 0,
    0, 4, 0, 0,
    9, 0, 0, 0,
    0, 0, 6, 0,
    0, 0, 0, 7,
  ]);
  assert.equal(QltPng.giaiCTC(logits, [5, 1, 4], charset), 'ab3');

  // Portal-specific post-processing
  assert.equal(QltPng.hauXuLy('thuedientu', 'ab12c'), 'ab12c');
  assert.equal(QltPng.hauXuLy('thuedientu', 'ab12'), '');
  assert.equal(QltPng.hauXuLy('tracuunnt', '  Ab34E '), 'ab34e');
  assert.equal(QltPng.hauXuLy('hddt', 'e6h3va'), 'E6H3VA');
  assert.equal(QltPng.hauXuLy('bhxh', 'a1b2c'), 'A1B2C');
  assert.equal(QltPng.hauXuLy('so4', 'l5713'), '5713');
  assert.equal(QltPng.hauXuLy('so6', '123456'), '123456');
  assert.equal(QltPng.hauXuLy('einvoice_vn', '1ab2cd'), 'ABCD');
  assert.equal(QltPng.hauXuLy('dvcqg', 'ABCDE1'), 'abcde1');
  assert.equal(QltPng.hauXuLy('ngogiaphat', 'XY12Z'), 'xy12z');
});

test('giai_svg.js decodes HDDT SVG paths from bang_svg.js signatures', () => {
  const sb: Record<string, unknown> = {};
  loadScript('content/bang_svg.js', sb);
  loadScript('content/giai_svg.js', sb);
  const BANG_SVG = sb.BANG_SVG as Record<string, string>;
  const giaiSvg = sb.giaiSvg as (svg: string) => {
    ma: string;
    soDuongChu: number;
    soNhanDuoc: number;
    chuKyLa: string[];
  };

  assert.ok(Object.keys(BANG_SVG).length >= 30, 'BANG_SVG should contain all 30 glyph signatures');

  // Build synthetic SVG using the first known signature from BANG_SVG
  const [firstSig, firstChar] = Object.entries(BANG_SVG)[0];
  const commands = firstSig.split('');
  let d = '';
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (cmd === 'M' || cmd === 'L') d += `${cmd}${10 + i} ${20 + i} `;
    else if (cmd === 'Q') d += `Q${12 + i} ${22 + i} ${14 + i} ${24 + i} `;
    else if (cmd === 'Z') d += 'Z ';
  }
  const svg = `<svg viewBox="0 0 200 40"><path d="${d.trim()}" fill="#111"/></svg>`;
  const res = giaiSvg(svg);
  assert.equal(res.soDuongChu, 1);
  assert.equal(res.soNhanDuoc, 1);
  assert.equal(res.ma, firstChar);
  assert.equal(res.chuKyLa.length, 0);
});
