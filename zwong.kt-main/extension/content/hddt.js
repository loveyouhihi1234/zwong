(() => {
  const SVG_BASE64_PREFIX = "data:image/svg+xml;base64,";
  const MIN_SVG_CONFIDENCE = 80;

  function decodeSvgFromImg(img) {
    const src = img.currentSrc || img.getAttribute("src") || "";
    if (!src) return "";
    if (src.startsWith(SVG_BASE64_PREFIX)) {
      try {
        const raw = src.slice(SVG_BASE64_PREFIX.length);
        const bin = atob(decodeURIComponent(raw));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder("utf-8").decode(bytes);
      } catch {
        try {
          const bin = atob(src.slice(SVG_BASE64_PREFIX.length));
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          return new TextDecoder("utf-8").decode(bytes);
        } catch {
          return "";
        }
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
    return "";
  }

  /**
   * Chuỗi giải 3 tầng cục bộ cho Hóa đơn điện tử (hoadondientu.gdt.gov.vn):
   * - Tầng 1: SvgCaptcha.solve (so khớp mẫu font SVG cũ của zwong.kt-main, <5ms)
   * - Tầng 2: giaiSvg (so khớp chữ ký nét M/Q/Z từ captcha-main, <5ms)
   * - Tầng 3: Trả về null để common.js tự động rơi về ONNX cục bộ (ddddocr_old.onnx)
   */
  function tryLocalSolve(img, opts = {}) {
    if (opts.skipSvgTiers) return null;
    const svg = decodeSvgFromImg(img);
    if (!svg || !svg.includes("<path")) return null;

    // Tầng 1: SvgCaptcha (cơ chế cũ ưu tiên hàng đầu)
    if (!opts.skipTier1 && window.SvgCaptcha && typeof window.SvgCaptcha.solve === "function") {
      const t0 = performance.now();
      const res = window.SvgCaptcha.solve(svg);
      const latencyMs = Math.max(1, Math.round(performance.now() - t0));
      if (
        res &&
        res.confidence >= MIN_SVG_CONFIDENCE &&
        /^[A-Za-z0-9]{4,8}$/.test(res.text || "")
      ) {
        return {
          captcha: res.text,
          confidence: res.confidence,
          latencyMs,
          source: "svg-local",
        };
      }
    }

    // Tầng 2: giaiSvg (bảng chữ ký M/Q/Z từ captcha-main)
    if (typeof window.giaiSvg === "function") {
      const t1 = performance.now();
      const kq = window.giaiSvg(svg);
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
          source: "svg-sig",
        };
      }
    }

    // Tầng 3: Rơi về ONNX cục bộ trong common.js
    return null;
  }

  function findPairs() {
    const pairs = [];
    const usedInputs = new Set();
    const candidates = document.querySelectorAll(
      'img[alt="captcha"], [class*="Captcha__ImageWrapper"] img',
    );
    for (const img of candidates) {
      const src = img.getAttribute("src") || "";
      if (!src) continue;
      if (!src.startsWith("data:image/svg+xml") && !(img.complete && img.naturalWidth > 0)) continue;
      if (typeof img.checkVisibility === "function" && !img.checkVisibility()) continue;
      const scope = img.closest("form") || img.closest(".ant-modal-content") || document;
      const input = scope.querySelector(
        'input[id="cvalue"], input[id$="_cvalue"], input[name="cvalue"]',
      );
      if (!input || usedInputs.has(input)) continue;
      if (typeof input.checkVisibility === "function" && !input.checkVisibility()) continue;
      usedInputs.add(input);
      pairs.push({ img, input });
    }
    return pairs;
  }

  window.taxcapWatchCaptchas({
    portal: "hddt",
    settingKey: "hddt",
    cong: "hddt",
    findPairs,
    readImage: window.taxcapReadCanvasImage,
    tryLocalSolve,
  });
})();
