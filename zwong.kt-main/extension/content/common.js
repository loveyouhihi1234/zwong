(() => {
  if (window.__taxcapCommonLoaded) return;
  window.__taxcapCommonLoaded = true;
  const MAX_AUTO_RETRIES = 3;
  const inputStates = new WeakMap();
  const inputWidgets = new WeakMap();
  const EXT_ID = typeof chrome !== "undefined" && chrome.runtime?.id ? chrome.runtime.id : "taxcap-suite";

  function getState(input) {
    let st = inputStates.get(input);
    if (!st) {
      st = {
        status: "idle",
        attempts: 0,
        lastKey: null,
        lastSource: "",
        solving: false,
      };
      inputStates.set(input, st);
      input.addEventListener("input", (e) => {
        if (e.isTrusted) {
          st.attempts = 0;
          st.status = "idle";
          renderWidget(input, st);
        }
      });
    }
    return st;
  }

  /**
   * Điền giá trị an toàn cho React / Ant Design / jQuery / JSP mà KHÔNG tự submit form.
   */
  function fillInputSafely(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function ensureWidget(input, onManualRetry) {
    let widget = inputWidgets.get(input);
    if (widget && widget.host.isConnected) return widget;

    const anchor =
      input.closest(".ant-input-affix-wrapper") ||
      input.closest(".input-group") ||
      input;

    // Dọn dẹp widget cũ còn sót lại của chính TaxCap Suite sau khi reload extension
    let sibling = anchor.nextElementSibling;
    while (sibling && sibling.dataset?.taxcapWidget === "1") {
      const next = sibling.nextElementSibling;
      if (sibling.dataset.taxcapExtId === EXT_ID) {
        sibling.remove();
      }
      sibling = next;
    }

    const host = document.createElement("div");
    host.dataset.taxcapWidget = "1";
    host.dataset.taxcapExtId = EXT_ID;
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
          margin-top: 4px;
          font: 12px/1.35 "Segoe UI", system-ui, -apple-system, sans-serif;
        }
        .bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-height: 20px;
        }
        .msg {
          color: #475569;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .msg.reading { color: #0b6bcb; }
        .msg.filled { color: #15803d; font-weight: 500; }
        .msg.failed { color: #b45309; }
        .msg.locked { color: #b91c1c; font-weight: 500; }
        .retry-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          height: 22px;
          padding: 0 7px;
          border-radius: 999px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          font: inherit;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          flex-shrink: 0;
        }
        .retry-btn:hover { background: #f1f5f9; border-color: #94a3b8; }
        .retry-btn:disabled { opacity: 0.5; cursor: wait; }
        .spin {
          display: inline-block;
          animation: taxcap-spin 0.8s linear infinite;
        }
        @keyframes taxcap-spin { to { transform: rotate(360deg); } }
      </style>
      <div class="bar">
        <span class="msg"></span>
        <button type="button" class="retry-btn" title="Giải lại ảnh captcha này (TaxCap)">
          <span class="icon">↻</span>
          <span>Giải lại</span>
        </button>
      </div>
    `;

    const msgEl = root.querySelector(".msg");
    const retryBtn = root.querySelector(".retry-btn");
    const iconEl = root.querySelector(".icon");

    retryBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onManualRetry();
    });

    anchor.insertAdjacentElement("afterend", host);

    widget = { host, msgEl, retryBtn, iconEl };
    inputWidgets.set(input, widget);
    return widget;
  }

  function renderWidget(input, st) {
    const widget = inputWidgets.get(input);
    if (!widget) return;
    const { msgEl, retryBtn, iconEl } = widget;
    msgEl.className = `msg ${st.status}`;
    retryBtn.disabled = st.solving;
    iconEl.className = st.solving ? "icon spin" : "icon";

    if (st.status === "reading") {
      msgEl.textContent = "Đang đọc...";
    } else if (st.status === "filled") {
      msgEl.textContent = "Đã điền (kiểm tra lại)";
    } else if (st.status === "failed") {
      msgEl.textContent = st.errorText || "Không đọc được, bấm thử lại";
    } else if (st.status === "locked") {
      msgEl.textContent = `Đã tự thử lại ${st.attempts}/${MAX_AUTO_RETRIES} lần — tự nhập hoặc bấm Giải lại`;
    } else {
      msgEl.textContent = "";
    }
  }

  function canvasToCompactDataUrl(canvas) {
    const webp = canvas.toDataURL("image/webp", 0.86);
    if (webp.startsWith("data:image/webp")) return webp;
    return canvas.toDataURL("image/jpeg", 0.88);
  }

  /**
   * Đọc pixel RGBA nguyên bản (không biến đổi alpha / tương phản) để QltPng.tienXuLy
   * xử lý chính xác 100% theo chuẩn Pillow LANCZOS của ddddocr_old.onnx.
   */
  async function readRawRgba(img) {
    if (!img || img.tagName !== "IMG") return null;
    if (!img.complete) {
      await new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
        setTimeout(resolve, 2000);
      });
    }
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const px = ctx.getImageData(0, 0, w, h).data;
      return { px, w, h };
    } catch {
      return null;
    }
  }

  function imagePixelSig(raw) {
    if (!raw || !raw.px) return "";
    let h = 2166136261;
    const d = raw.px;
    for (let i = 0; i < d.length; i++) {
      h = Math.imul(h ^ d[i], 16777619);
    }
    return `${raw.w}x${raw.h}:${h >>> 0}`;
  }

  /**
   * Tạo ảnh thu nhỏ nhẹ để hiển thị trong tab Kho dữ liệu (không gửi ra mạng).
   */
  async function readCanvasImage(img) {
    if (!img || img.tagName !== "IMG") return null;
    if (!img.complete) {
      await new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
        setTimeout(resolve, 1500);
      });
    }
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return canvasToCompactDataUrl(canvas);
    } catch {
      return null;
    }
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function imageKeyFor(el) {
    if (!el) return "";
    if (el.tagName === "IMG") {
      const src = el.currentSrc || el.getAttribute("src") || "";
      if (!src) return "";
      return `${hashString(src)}:${src.length}:${el.naturalWidth}x${el.naturalHeight}`;
    }
    const txt = String(el.textContent || "").replace(/\s+/g, "");
    if (txt) return `txt:${hashString(txt)}:${txt.length}`;
    if (el.outerHTML) return `el:${hashString(el.outerHTML)}:${el.outerHTML.length}`;
    return "";
  }

  async function getPortalSettings() {
    let settings = null;
    try {
      settings = await chrome.runtime.sendMessage({ type: "TAXCAP_GET_SETTINGS" });
    } catch {
      settings = null;
    }
    if (!settings) {
      try {
        const res = await chrome.storage.local.get("taxcapSettings");
        settings = res?.taxcapSettings || { enabled: true, pausedUntil: 0, portals: {} };
      } catch {
        return null;
      }
    }
    return settings;
  }

  function isSettingsPortalActive(settings, settingKey) {
    if (!settings?.licenseGate?.unlocked) return false;
    if (!settings?.enabled) return false;
    if (Date.now() < (settings.pausedUntil || 0)) return false;
    return settings.portals?.[settingKey] !== false;
  }

  window.taxcapWatchCaptchas = function ({
    portal,
    settingKey,
    cong,
    findPairs,
    readImage = readCanvasImage,
    tryLocalSolve = null,
  }) {
    const gateKey = settingKey || portal;
    const solverCong = cong || portal;
    let scanTimer = null;

    async function solvePair(img, input, manual = false) {
      const st = getState(input);
      ensureWidget(input, () => {
        solvePair(img, input, true);
      });

      const key = imageKeyFor(img);
      if (!key) return;

      const prevKey = st.lastKey;
      const prevSource = st.lastSource;

      if (manual) {
        st.attempts = 1;
      } else {
        if (st.solving) return;
        if (st.lastKey === key && st.status !== "idle") return;
        if (st.attempts >= MAX_AUTO_RETRIES) {
          st.status = "locked";
          st.lastKey = key;
          renderWidget(input, st);
          return;
        }
        st.attempts += 1;
      }

      st.lastKey = key;
      st.errorText = "";

      // Tầng cục bộ tức thì (HĐĐT SVG Tầng 1/2, cổng văn bản/SVG chữ):
      // Bấm "Giải lại" ngay sau svg-local trên cùng ảnh sẽ bỏ qua Tầng 1 để kiểm tra chéo sang Tầng 2/ONNX.
      if (typeof tryLocalSolve === "function") {
        let localRes = null;
        try {
          localRes = tryLocalSolve(img, {
            manual,
            skipTier1: manual && prevKey === key && prevSource === "svg-local",
            skipSvgTiers: manual && prevKey === key && prevSource === "svg-sig",
          });
        } catch {
          localRes = null;
        }
        if (localRes?.captcha) {
          fillInputSafely(input, localRes.captcha);
          st.lastSource = localRes.source || "svg-local";
          st.status = "filled";
          st.solving = false;
          renderWidget(input, st);

          chrome.runtime
            .sendMessage({
              type: "TAXCAP_RECORD_LOCAL",
              portal,
              cong: solverCong,
              source: localRes.source || "svg-local",
              captcha: localRes.captcha,
              latencyMs: localRes.latencyMs,
            })
            .catch(() => {});
          return;
        }
      }

      // Tầng ONNX cục bộ (ddddocr_old.onnx chạy trong offscreen document)
      st.status = "reading";
      st.solving = true;
      renderWidget(input, st);

      try {
        const raw = await readRawRgba(img);
        if (!raw) {
          st.status = st.attempts >= MAX_AUTO_RETRIES ? "locked" : "failed";
          st.errorText = "Không đọc được ảnh captcha";
          return;
        }
        const pixelSig = imagePixelSig(raw);

        const res = await chrome.runtime.sendMessage({
          type: "TAXCAP_SOLVE_ONNX",
          portal,
          cong: solverCong,
          rgba: Array.from(raw.px),
          w: raw.w,
          h: raw.h,
          sig: pixelSig,
        });

        // Bỏ qua kết quả nếu ảnh captcha đã bị đổi trong lúc đang chạy ONNX
        if (imageKeyFor(img) !== key) {
          return;
        }
        const latestRaw = await readRawRgba(img);
        if (latestRaw && imagePixelSig(latestRaw) !== pixelSig) {
          return;
        }

        if (res?.ok && res.captcha) {
          fillInputSafely(input, res.captcha);
          st.lastSource = res.source || "onnx-local";
          st.status = "filled";
        } else {
          st.status = st.attempts >= MAX_AUTO_RETRIES ? "locked" : "failed";
          st.errorText = res?.message || "Không đọc được, bấm thử lại";
        }
      } catch {
        st.status = st.attempts >= MAX_AUTO_RETRIES ? "locked" : "failed";
        st.errorText = "Không đọc được, bấm thử lại";
      } finally {
        st.solving = false;
        renderWidget(input, st);
      }
    }

    async function scan() {
      const settings = await getPortalSettings();
      if (!isSettingsPortalActive(settings, gateKey)) return;
      const pairs = findPairs();
      for (const { img, input } of pairs) {
        solvePair(img, input, false);
      }
    }

    const scheduleScan = () => {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(scan, 80);
    };

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ["src", "style", "class"],
    });

    document.addEventListener(
      "load",
      (e) => {
        if (e.target instanceof HTMLImageElement) scheduleScan();
      },
      true,
    );

    scan();
    setTimeout(scan, 450);
  };

  window.taxcapReadRawRgba = readRawRgba;
  window.taxcapImagePixelSig = imagePixelSig;
  window.taxcapReadCanvasImage = readCanvasImage;
})();
