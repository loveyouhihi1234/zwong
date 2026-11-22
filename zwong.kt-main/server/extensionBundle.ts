import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import JSZip from 'jszip';

const EXTENSION_DIR = path.resolve(process.cwd(), 'extension');

// Pure Node CRC32 for generating valid PNG icons without native canvas dependencies
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * Generates a crisp square TaxCap PNG icon (deep blue badge with clean white geometric glyph).
 */
export function generatePngIcon(size: number): Buffer {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const cornerR = size * 0.22;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // PNG filter type 0
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 4;
      const dx = Math.max(0, cornerR - Math.min(x, size - 1 - x));
      const dy = Math.max(0, cornerR - Math.min(y, size - 1 - y));
      const inRoundedRect = dx * dx + dy * dy <= cornerR * cornerR;

      if (!inRoundedRect) {
        raw[px] = 0;
        raw[px + 1] = 0;
        raw[px + 2] = 0;
        raw[px + 3] = 0;
        continue;
      }

      const nx = x / size;
      const ny = y / size;
      const isTopBar = ny >= 0.24 && ny <= 0.36 && nx >= 0.24 && nx <= 0.76;
      const isStem = nx >= 0.44 && nx <= 0.56 && ny >= 0.24 && ny <= 0.76;
      const isWhite = isTopBar || isStem;

      if (isWhite) {
        raw[px] = 255;
        raw[px + 1] = 255;
        raw[px + 2] = 255;
        raw[px + 3] = 255;
      } else {
        const t = y / size;
        raw[px] = Math.round(11 + t * 4);
        raw[px + 1] = Math.round(107 - t * 14);
        raw[px + 2] = Math.round(203 - t * 20);
        raw[px + 3] = 255;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export interface ExtensionFilePreview {
  path: string;
  content: string;
}

export const UNIFIED_EXTENSION_TEXT_FILES = [
  // Lõi, Side Panel & Offscreen ONNX cục bộ
  'direct-gemini.js',
  'license.js',
  'background.js',
  'offscreen.html',
  'offscreen.js',
  'tien_ich_png.js',
  'sidepanel.html',
  'sidepanel.js',
  'icons/hddt-logo.svg',
  'icons/hoso-logo.svg',
  // Tab 1: Tải Hóa đơn điện tử (HĐĐT)
  'panels/hddt/index.html',
  'panels/hddt/panel-hddt.css',
  'panels/hddt/panel-hddt.js',
  'panels/hddt/datepicker-hddt.js',
  'content/hddt/zip.js',
  'content/hddt/xlsx.js',
  'content/hddt/hddt-api.js',
  'content/hddt/report.js',
  'content/hddt/pdf.js',
  'content/hddt/hddt-content.js',
  // Tab 2: Tải Hồ sơ thuế (DVC & Thuế ĐT)
  'panels/hoso/index.html',
  'panels/hoso/panel-hoso.css',
  'panels/hoso/panel-hoso.js',
  'panels/hoso/datepicker-hoso.js',
  'panels/hoso/combobox-hoso.js',
  'content/hoso/gdt-api.js',
  'content/hoso/hoso-content.js',
  // Tab 3: Giải Captcha cục bộ (46 cổng + SVG 2 tầng + ONNX WASM)
  'panels/captcha/index.html',
  'panels/captcha/panel-captcha.js',
  'content/captcha-svg-templates.js',
  'content/captcha-svg.js',
  'content/bang_svg.js',
  'content/giai_svg.js',
  'content/cau_hinh_cong.js',
  'content/common.js',
  'content/hddt.js',
  'content/tdt.js',
  'content/dvc.js',
  'content/tracuunnt.js',
  'content/extended-portals.js',
  // Thư viện cục bộ (bảng ký tự, ONNX Runtime Web JS loader, bản quyền)
  'thu_vien/charset.json',
  'thu_vien/LICENSE_ddddocr.txt',
  'thu_vien/ort/LICENSE',
  'thu_vien/ort/ort.wasm.min.js',
  'thu_vien/ort/ort-wasm-simd-threaded.mjs',
  // Bản quyền font đi kèm
  'content/fonts/LICENSE',
  'panels/shared/fonts/LICENSE',
] as const;

export const UNIFIED_EXTENSION_BINARY_FILES = [
  'content/fonts/pdf-regular.ttf',
  'content/fonts/pdf-bold.ttf',
  'content/fonts/pdf-italic.ttf',
  'panels/shared/fonts/roboto-latin-wght-normal.woff2',
  'panels/shared/fonts/roboto-vietnamese-wght-normal.woff2',
  'thu_vien/ddddocr_old.onnx',
  'thu_vien/ort/ort-wasm-simd-threaded.wasm',
] as const;

export async function buildExtensionArtifacts(options: {
  licenseApiUrl?: string;
  includeZip?: boolean;
}): Promise<{ zipBuffer: Buffer; files: ExtensionFilePreview[] }> {
  const cleanLicenseUrl = (options.licenseApiUrl || '').trim().replace(/\/+$/, '');
  const includeZip = options.includeZip !== false;

  const manifestRaw = await fs.readFile(path.join(EXTENSION_DIR, 'manifest.json'), 'utf8');
  const manifestObj = JSON.parse(manifestRaw);
  const manifestContent = JSON.stringify(manifestObj, null, 2);

  const configContent = `// Cấu hình tạo tự động từ TaxCap Studio (giải cục bộ 100% bằng SVG + ONNX WASM)
self.TAXCAP_DEFAULTS = ${JSON.stringify(
    {
      solverMode: 'local-onnx',
      licenseApiUrl: cleanLicenseUrl,
      enabled: true,
      pausedUntil: 0,
      portals: {
        hddt: true,
        tdt: true,
        dvc: true,
        tracuunnt: true,
        ext_gov: true,
        ext_bank: true,
        ext_invoice: true,
      },
    },
    null,
    2,
  )};
`;

  const previews: ExtensionFilePreview[] = [
    { path: 'manifest.json', content: manifestContent },
    { path: 'config.js', content: configContent },
  ];

  const zip = includeZip ? new JSZip() : null;
  if (zip) {
    zip.file('manifest.json', manifestContent);
    zip.file('config.js', configContent);
  }

  for (const rel of UNIFIED_EXTENSION_TEXT_FILES) {
    const content = await fs.readFile(path.join(EXTENSION_DIR, rel), 'utf8');
    if (zip) {
      zip.file(rel, content);
    }
    previews.push({ path: rel, content });
  }

  if (!zip) {
    return { zipBuffer: Buffer.alloc(0), files: previews };
  }

  for (const rel of UNIFIED_EXTENSION_BINARY_FILES) {
    const buf = await fs.readFile(path.join(EXTENSION_DIR, rel));
    // Dùng STORE cho nhị phân lớn (.onnx/.wasm/.woff2/.ttf) để đóng gói nhanh tức thì
    zip.file(rel, buf, { compression: 'STORE' });
  }

  zip.file('icons/icon-48.png', generatePngIcon(48), { compression: 'STORE' });
  zip.file('icons/icon-128.png', generatePngIcon(128), { compression: 'STORE' });

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { zipBuffer, files: previews };
}
