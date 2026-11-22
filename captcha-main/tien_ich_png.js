// Lõi THUẦN (không DOM) đọc captcha PNG/JPEG giống ddddocr 1.6.1 (common_old.onnx) + cách app đọc từng cổng.
// Chạy được trong offscreen.html (script thường) và node (module.exports) để test_cm591 so với Pillow / ddddocr Python.
// Mỗi bước port đúng Pillow 12.x: đổi cỡ LANCZOS (Resample.c, 8 bit, PRECISION_BITS 22, ngang rồi dọc, RGBA nhân trước alpha),
// xám L24 (R*19595+G*38470+B*7471+0x8000)>>16, alpha_composite lên nền trắng. Nâng Pillow / ddddocr thì chạy lại test_cm591.
var QltPng = (function () {
  const PB = 22;
  const MOT = 1 << PB;

  function sinc(x) {
    if (x === 0) return 1;
    x = x * Math.PI;
    return Math.sin(x) / x;
  }
  function lanczos(x) {
    if (x > -3 && x < 3) return sinc(x) * sinc(x / 3);
    return 0;
  }

  // Giống precompute_coeffs + normalize_coeffs_8bpc của Pillow (in0 = 0, in1 = inSize).
  function heSo(inSize, outSize) {
    let tyLe = inSize / outSize;
    const filterscale = tyLe < 1 ? 1 : tyLe;
    const support = 3 * filterscale;
    const ksize = Math.ceil(support) * 2 + 1;
    const bien = new Int32Array(outSize * 2);
    const kk = new Int32Array(outSize * ksize);
    const tam = new Float64Array(ksize);
    const ss = 1 / filterscale;
    for (let xx = 0; xx < outSize; xx++) {
      const center = (xx + 0.5) * tyLe;
      let xmin = Math.trunc(center - support + 0.5);
      if (xmin < 0) xmin = 0;
      let xmax = Math.trunc(center + support + 0.5);
      if (xmax > inSize) xmax = inSize;
      xmax -= xmin;
      let ww = 0;
      for (let x = 0; x < xmax; x++) {
        const w = lanczos((x + xmin - center + 0.5) * ss);
        tam[x] = w;
        ww += w;
      }
      for (let x = 0; x < xmax; x++) {
        const k = ww !== 0 ? tam[x] / ww : tam[x];
        kk[xx * ksize + x] = k < 0 ? Math.trunc(-0.5 + k * MOT) : Math.trunc(0.5 + k * MOT);
      }
      bien[xx * 2] = xmin;
      bien[xx * 2 + 1] = xmax;
    }
    return { bien: bien, kk: kk, ksize: ksize };
  }

  function kep8(ss) {
    const v = Math.floor(ss / MOT);
    return v < 0 ? 0 : (v > 255 ? 255 : v);
  }

  // src: Uint8Array w*h*n (n kênh xen kẽ). Trả Uint8Array W*h*n (chỉ đổi ngang).
  function ngang(src, w, h, n, W) {
    const c = heSo(w, W);
    const out = new Uint8Array(W * h * n);
    for (let y = 0; y < h; y++) {
      for (let xx = 0; xx < W; xx++) {
        const xmin = c.bien[xx * 2], xmax = c.bien[xx * 2 + 1];
        for (let k = 0; k < n; k++) {
          let ss = MOT / 2;
          for (let x = 0; x < xmax; x++) ss += src[(y * w + xmin + x) * n + k] * c.kk[xx * c.ksize + x];
          out[(y * W + xx) * n + k] = kep8(ss);
        }
      }
    }
    return out;
  }

  function doc(src, w, h, n, H) {
    const c = heSo(h, H);
    const out = new Uint8Array(w * H * n);
    for (let yy = 0; yy < H; yy++) {
      const ymin = c.bien[yy * 2], ymax = c.bien[yy * 2 + 1];
      for (let x = 0; x < w; x++) {
        for (let k = 0; k < n; k++) {
          let ss = MOT / 2;
          for (let y = 0; y < ymax; y++) ss += src[((ymin + y) * w + x) * n + k] * c.kk[yy * c.ksize + y];
          out[(yy * w + x) * n + k] = kep8(ss);
        }
      }
    }
    return out;
  }

  function mulDiv255(a, b) {
    const t = a * b + 128;
    return ((t >> 8) + t) >> 8;
  }

  // RGBA -> RGBA, giống Image.resize((W, H), LANCZOS) của ảnh RGBA (Pillow: RGBa nhân trước alpha, đổi cỡ, trả lại RGBA).
  function doiCoLanczosNhuPillow(rgba, w, h, W, H) {
    let a = Uint8Array.from(rgba);
    for (let i = 0; i < a.length; i += 4) {
      const al = a[i + 3];
      a[i] = mulDiv255(a[i], al); a[i + 1] = mulDiv255(a[i + 1], al); a[i + 2] = mulDiv255(a[i + 2], al);
    }
    let cw = w, ch = h;
    if (W !== w) { a = ngang(a, w, h, 4, W); cw = W; }
    if (H !== h) { a = doc(a, cw, h, 4, H); ch = H; }
    for (let i = 0; i < a.length; i += 4) {
      const al = a[i + 3];
      if (al !== 0 && al !== 255) {
        a[i] = Math.min(255, Math.floor(255 * a[i] / al));
        a[i + 1] = Math.min(255, Math.floor(255 * a[i + 1] / al));
        a[i + 2] = Math.min(255, Math.floor(255 * a[i + 2] / al));
      }
    }
    return a;
  }

  // RGBA -> Uint8Array xám (Pillow convert('L'), bỏ qua alpha).
  function xamNhuPillow(rgba) {
    const n = rgba.length / 4;
    const g = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      g[i] = (rgba[i * 4] * 19595 + rgba[i * 4 + 1] * 38470 + rgba[i * 4 + 2] * 7471 + 0x8000) >> 16;
    }
    return g;
  }

  // Giống nen_trang_png của app: alpha_composite lên nền trắng (kết quả mờ đục).
  function nenTrang(rgba) {
    const o = new Uint8Array(rgba.length);
    for (let i = 0; i < rgba.length; i += 4) {
      const A = rgba[i + 3];
      for (let k = 0; k < 3; k++) o[i + k] = Math.floor((rgba[i + k] * A + 255 * (255 - A) + 127) / 255);
      o[i + 3] = 255;
    }
    return o;
  }

  // Ghép lên nền đen rồi đảo màu: điểm = 255 - màu * alpha / 255 (chữ sáng trong suốt -> chữ đen nền trắng).
  function nenDenDao(rgba) {
    const o = new Uint8Array(rgba.length);
    for (let i = 0; i < rgba.length; i += 4) {
      const A = rgba[i + 3];
      for (let k = 0; k < 3; k++) o[i + k] = Math.floor((65025 - rgba[i + k] * A) / 255);
      o[i + 3] = 255;
    }
    return o;
  }

  // Tensor [1,1,64,W] float32 = xám/255 (ddddocr 1.6.1 chỉ chia 255).
  function taoTensor(xam) {
    const t = new Float32Array(xam.length);
    for (let i = 0; i < xam.length; i++) t[i] = xam[i] / 255;
    return t;
  }

  // Cắt ảnh sát vùng chữ (điểm tối < thr) cộng lề padY / padX: ảnh nhỏ nhiều lề (vd 100x30 của hddt.thegioididong.com)
  // khiến model đọc sai; cắt sát chữ rồi mới đổi cỡ thì đọc đúng hơn hẳn. Không có điểm tối: trả lại ảnh gốc.
  function catSatChu(rgba, w, h, thr, padY, padX) {
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const l = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
        if (l < thr) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return { rgba: rgba, w: w, h: h };
    x0 = Math.max(x0 - padX, 0);
    y0 = Math.max(y0 - padY, 0);
    x1 = Math.min(x1 + padX + 1, w);
    y1 = Math.min(y1 + padY + 1, h);
    const cw = x1 - x0, ch = y1 - y0;
    const o = new Uint8Array(cw * ch * 4);
    for (let y = 0; y < ch; y++) {
      o.set(rgba.subarray(((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0 + cw) * 4), y * cw * 4);
    }
    return { rgba: o, w: cw, h: ch };
  }

  // rgba (canvas) -> {tensor, xam, W, H}; cong "tracuunnt" ghép nền trắng trước (như app).
  function tienXuLy(cong, rgba, w, h, nenTrangNeuTracuu) {
    let a = rgba;
    if (cong === "hddt_tgdd") {
      const c = catSatChu(rgba, w, h, 140, 3, 6);
      a = c.rgba; w = c.w; h = c.h;
    }
    // Ảnh PNG nền trong suốt (chữ đen + lưới trong alpha) phải ghép nền trắng, nếu không cả ảnh thành đen và model trả rỗng.
    if ((cong === "tracuunnt" || cong === "gdt_ntl" || cong === "einvoice_vn") && nenTrangNeuTracuu !== false) a = nenTrang(rgba);
    // Ngô Gia Phát: chữ trắng trên nền trong suốt -> ghép nền đen rồi đảo màu (chữ đen trên nền trắng).
    if (cong === "ngogiaphat") a = nenDenDao(rgba);
    const W = Math.floor(w * (64 / h));
    const nho = doiCoLanczosNhuPillow(a, w, h, W, 64);
    const xam = xamNhuPillow(nho);
    return { tensor: taoTensor(xam), xam: xam, W: W, H: 64 };
  }

  // logits phẳng + dims -> chuỗi CTC (đúng _process_text_output + _ctc_decode_indices).
  function giaiCTC(logits, dims, charset) {
    let T, C, goc, buoc;
    if (dims.length === 3) {
      if (dims[1] === 1) { T = dims[0]; C = dims[2]; goc = function (t) { return t * C; }; }
      else { T = dims[1]; C = dims[2]; goc = function (t) { return t * C; }; }
    } else { T = dims[0]; C = dims[1]; goc = function (t) { return t * C; }; }
    const kq = [];
    let truoc = null;
    for (let t = 0; t < T; t++) {
      let tot = 0, max = logits[goc(t)];
      for (let c = 1; c < C; c++) {
        const v = logits[goc(t) + c];
        if (v > max) { max = v; tot = c; }
      }
      if (tot !== truoc) {
        if (tot !== 0 && tot >= 0 && tot < charset.length) kq.push(charset[tot]);
      }
      truoc = tot;
    }
    return kq.join("");
  }

  // Hậu xử lý theo cổng (như app): tracuunnt lower+strip; bhxh in hoa 5 ký tự; thuedientu / dichvucong chỉ giữ A-Za-z0-9, đúng 5 ký tự.
  function hauXuLy(cong, chuoi) {
    const s = String(chuoi || "");
    if (cong === "tracuunnt") return s.toLowerCase().trim();
    const t = s.replace(/[^A-Za-z0-9]+/g, "");
    if (cong === "bhxh") return t.length === 5 ? t.toUpperCase() : "";
    // Nhóm cổng hóa đơn (NCC): mã toàn số thì bỏ chữ lạ model đọc nhầm (vd 'l5713' -> '5713'), đúng độ dài mới điền.
    if (cong === "so4" || cong === "so6") {
      const d = s.replace(/[^0-9]+/g, "");
      return d.length === (cong === "so4" ? 4 : 6) ? d : "";
    }
    if (cong === "nh_thuong5") return t.length === 5 ? t.toLowerCase() : ""; // ABBank / Public Bank: 5 ký tự chữ thường + số
    if (cong === "nh_hoa5") return t.length === 5 ? t.toUpperCase() : ""; // Eximbank: 5 ký tự CHỮ HOA + số
    if (cong === "vpbank") return t.length === 6 ? t : ""; // VPBank (jCaptcha): 6 ký tự, hoa/thường lẫn
    if (cong === "vdsg") return t.length >= 4 && t.length <= 6 ? t.toUpperCase() : ""; // VDSG (BotDetect): 4-6 ký tự, không phân biệt hoa/thường -> IN HOA
    if (cong === "smartsign") return t.length >= 4 && t.length <= 6 ? t.toLowerCase() : ""; // SmartVina: 4-6 ký tự chữ thường + số
    if (cong === "spv_shopee") return t.length === 6 ? t : ""; // Shopee (spv.tracuuhoadon.online): 6 ký tự, hoa/thường lẫn
    if (cong === "vninvoice_v50") return t.length === 6 ? t : ""; // VN-Invoice v50: 6 ký tự
    if (cong === "ngogiaphat") return t.length === 5 ? t.toLowerCase() : ""; // Ngô Gia Phát: 5 ký tự chữ thường + số
    if (cong === "einvoice_vn") {
      const c = s.replace(/[^A-Za-z]+/g, "").toUpperCase(); // einvoice.vn: 4 chữ cái IN HOA
      return c.length === 4 ? c : "";
    }
    if (cong === "hddt_tgdd") return t.length === 6 ? t.toUpperCase() : ""; // Hóa đơn TGDĐ: đúng 6 ký tự, viết HOA hết
    if (cong === "vnpt_invoice") return t.length === 4 ? t : ""; // VNPT Invoice: đúng 4 ký tự, giữ nguyên hoa/thường
    if (cong === "dvcqg") return t.length >= 5 && t.length <= 7 ? t.toLowerCase() : ""; // Cổng DVC Quốc gia: 5-7 ký tự (độ dài thay đổi), toàn chữ thường
    if (cong === "canhan") return t.length === 5 ? t.toUpperCase() : ""; // Thuế điện tử cá nhân: đúng 5 ký tự, viết HOA hết
    if (cong === "gdt_ntl") return t.length === 5 ? t : ""; // Công khai nợ thuế: đúng 5 ký tự, giữ nguyên hoa/thường
    if (cong === "dvc_bhxh") return t.length === 4 ? t.toUpperCase() : ""; // Dịch vụ công BHXH: mã 4 ký tự, chữ in hoa
    return t.length === 5 ? t : "";
  }

  const api = {
    doiCoLanczosNhuPillow: doiCoLanczosNhuPillow, xamNhuPillow: xamNhuPillow, nenTrang: nenTrang,
    taoTensor: taoTensor, tienXuLy: tienXuLy, giaiCTC: giaiCTC, hauXuLy: hauXuLy,
  };

  // Cầu nối cho test_cm591 (node): xử lý theo lô.
  api.chayLo = function (inp) {
    if (inp.lenh === "xam") {
      return { anh: inp.anh.map(function (a) {
        const W = Math.floor(a.w * (64 / a.h));
        const nho = doiCoLanczosNhuPillow(Uint8Array.from(a.rgba), a.w, a.h, W, 64);
        return { ten: a.ten, W: W, xam: Array.from(xamNhuPillow(nho)) };
      }) };
    }
    if (inp.lenh === "tensor") {
      return { anh: inp.anh.map(function (a) {
        const r = tienXuLy(a.cong, Uint8Array.from(a.rgba), a.w, a.h, inp.ct_nen_trang);
        return { ten: a.ten, W: r.W, tensor: Array.from(r.tensor) };
      }) };
    }
    if (inp.lenh === "ctc") {
      const chuoi = inp.logits.map(function (l) { return giaiCTC(l.data, l.dims, inp.charset); });
      const kq = { chuoi: chuoi };
      if (inp.cong) kq.ma = chuoi.map(function (s, i) { return hauXuLy(inp.cong[i], s); });
      return kq;
    }
    if (inp.lenh === "hau") return { ra: inp.ca.map(function (c) { return hauXuLy(c[0], c[1]); }) };
    throw new Error("lenh la");
  };
  return api;
})();

if (typeof module !== "undefined") module.exports = QltPng;
