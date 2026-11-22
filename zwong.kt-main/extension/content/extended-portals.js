(() => {
  if (typeof timCauHinh !== "function" || typeof window.taxcapWatchCaptchas !== "function") return;
  const cauHinh = timCauHinh(location.hostname);
  // 4 cổng chính (hddt, tdt, dvc, tracuunnt) dùng content script chuyên biệt riêng
  if (!cauHinh || cauHinh.portalId) return;

  const settingKey = typeof nhomBatTat === "function" ? nhomBatTat(cauHinh) : "ext_invoice";
  const cacCap = cauHinh.cap || [{ o: cauHinh.o, anh: cauHinh.anh }];

  function hienThi(el) {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    const st = window.getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none";
  }

  function oHopLe(el) {
    if (!el || el.tagName !== "INPUT") return false;
    const t = (el.getAttribute("type") || "text").toLowerCase();
    if (["text", "tel", "search", "number"].indexOf(t) < 0) return false;
    if (el.disabled || el.readOnly) return false;
    if ((el.getAttribute("autocomplete") || "").toLowerCase() === "one-time-code") return false;
    return hienThi(el);
  }

  const MANH = /captcha|capcha|recaptch|cvalue|kaptcha|checkcode|vcode|verifycode|securitycode/i;
  const LOAI = /user|login|pass|mst|tax|phone|email|search|otp|sms/i;

  function diemO(el) {
    const nguon = [
      el.id,
      el.name,
      el.className,
      el.placeholder,
      el.getAttribute("aria-label"),
      el.getAttribute("formcontrolname"),
      el.getAttribute("ng-model"),
      el.getAttribute("data-testid"),
    ].join(" ");
    if (LOAI.test(nguon) && !MANH.test(nguon)) return -1;
    return MANH.test(nguon) ? 10 : 0;
  }

  function timOQuanhAnh(img) {
    let hop = img;
    for (let i = 0; hop && i < 8; i++, hop = hop.parentElement) {
      let tot = null;
      let diem = 0;
      hop.querySelectorAll("input").forEach((x) => {
        if (!oHopLe(x)) return;
        const d = diemO(x);
        if (d > diem) {
          diem = d;
          tot = x;
        }
      });
      if (tot) return tot;
    }
    return null;
  }

  function findPairs() {
    const pairs = [];
    const usedInputs = new Set();
    for (const c of cacCap) {
      const img = document.querySelector(c.anh);
      if (!img || !hienThi(img)) continue;
      let input = document.querySelector(c.o);
      if (!oHopLe(input)) {
        input = timOQuanhAnh(img);
      }
      if (!input || !oHopLe(input) || usedInputs.has(input)) continue;
      usedInputs.add(input);
      pairs.push({ img, input });
    }
    return pairs;
  }

  function layMaVanBan(loai, nguon) {
    let t = "";
    if (loai === "svg_chu") {
      const src = String(nguon.getAttribute("src") || "");
      const idx = src.indexOf(",");
      if (idx < 0 || src.slice(0, 15) !== "data:image/svg+") return "";
      try {
        const svg = /;base64$/i.test(src.slice(0, idx))
          ? atob(src.slice(idx + 1))
          : decodeURIComponent(src.slice(idx + 1));
        const m = /<text\b[^>]*>([^<]*)<\/text>/i.exec(svg);
        t = m ? m[1] : "";
      } catch {
        return "";
      }
    } else {
      t = nguon.textContent || "";
    }
    return String(t).replace(/\s+/g, "");
  }

  const tryLocalSolve =
    cauHinh.loai === "van_ban" || cauHinh.loai === "svg_chu"
      ? (el) => {
          const t0 = performance.now();
          const ma = layMaVanBan(cauHinh.loai, el);
          if (!/^[A-Za-z0-9]{4,8}$/.test(ma)) return null;
          return {
            captcha: ma,
            confidence: 100,
            latencyMs: Math.max(1, Math.round(performance.now() - t0)),
            source: cauHinh.loai === "svg_chu" ? "svg-text" : "text-local",
          };
        }
      : null;

  window.taxcapWatchCaptchas({
    portal: cauHinh.cong,
    settingKey,
    cong: cauHinh.cong,
    findPairs,
    readImage: window.taxcapReadCanvasImage,
    tryLocalSolve,
  });
})();
