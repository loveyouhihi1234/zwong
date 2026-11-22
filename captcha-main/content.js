// Content script: tự động tìm và giải captcha (SVG / PNG / văn bản) trên mọi cổng hỗ trợ,
// điền bằng setter gốc và theo dõi đổi ảnh. Không cần đăng nhập, không cần bật kết nối thủ công.
// Chỉ điền ô captcha — không điền mật khẩu hay tự bấm nút gửi.

var qltLoiCaptcha = (function () {
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

  function timO(cauHinh, goc) {
    const doc = goc || document;
    let o = doc.querySelector(cauHinh.o);
    if (oHopLe(o)) return o;
    return timOQuanhAnh(doc.querySelector(cauHinh.anh));
  }

  // Dự phòng: chấm điểm các ô trong hộp chứa gần ảnh (đi lên tối đa 8 cấp).
  function timOQuanhAnh(img) {
    let hop = img;
    for (let i = 0; hop && i < 8; i++, hop = hop.parentElement) {
      let tot = null;
      let diem = 0;
      hop.querySelectorAll("input").forEach(function (x) {
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

  // Mọi cặp {o, anh} đang hiển thị; ô ghép với ảnh theo <form> chứa ảnh (trang HĐĐT có 2 cặp cùng lúc).
  function timCacCapSvg(cauHinh, goc) {
    const doc = goc || document;
    const kq = [];
    const daDung = [];
    doc.querySelectorAll(cauHinh.anh).forEach(function (anh) {
      if (!hienThi(anh)) return;
      const hop = anh.closest("form");
      let o = null;
      if (hop) {
        o = hop.querySelector(cauHinh.o);
        if (!oHopLe(o)) {
          o = null;
          let diem = 0;
          hop.querySelectorAll("input").forEach(function (x) {
            if (!oHopLe(x)) return;
            const d = diemO(x);
            if (d > diem) {
              diem = d;
              o = x;
            }
          });
        }
      } else {
        o = timOQuanhAnh(anh);
      }
      if (!o || daDung.indexOf(o) >= 0) return;
      daDung.push(o);
      kq.push({ o: o, anh: anh });
    });
    return kq;
  }

  function layChuoiSvg(anh) {
    if (!anh) return "";
    if (anh.tagName === "IMG") {
      const src = anh.getAttribute("src") || "";
      let m = /^data:image\/svg\+xml;base64,(.*)$/i.exec(src);
      if (m) {
        try {
          const bin = atob(decodeURIComponent(m[1]));
          try {
            return new TextDecoder("utf-8").decode(
              Uint8Array.from(bin, function (c) {
                return c.charCodeAt(0);
              })
            );
          } catch (e) {
            return bin;
          }
        } catch (e) {
          return "";
        }
      }
      m = /^data:image\/svg\+xml(?:;[^,]*)?,(.*)$/i.exec(src);
      if (m) {
        try {
          return decodeURIComponent(m[1]);
        } catch (e) {
          return m[1];
        }
      }
      return "";
    }
    if (anh.tagName && anh.tagName.toLowerCase() === "svg") {
      const c = anh.cloneNode(true);
      const r = anh.getBoundingClientRect();
      if (!c.getAttribute("xmlns")) c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      if (!c.getAttribute("width") && r.width) c.setAttribute("width", String(Math.round(r.width)));
      if (!c.getAttribute("height") && r.height) c.setAttribute("height", String(Math.round(r.height)));
      return new XMLSerializer().serializeToString(c);
    }
    return "";
  }

  function chuKyAnh(anh, svg) {
    if (anh && anh.tagName === "IMG" && anh.getAttribute("src")) return anh.getAttribute("src");
    return svg.length + ":" + svg.slice(0, 40) + svg.slice(-40);
  }

  function dien(o, ma) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(o, ma);
    o.dispatchEvent(new Event("input", { bubbles: true }));
    o.dispatchEvent(new Event("change", { bubbles: true }));
    o.setAttribute("data-qlt-captcha", ma);
  }

  function xuLy(cauHinh, trangThai, goc, ghiLa, ep) {
    const doc = goc || document;
    const o = timO(cauHinh, doc);
    if (!o) return { trang_thai: "khong_o" };
    const anh = doc.querySelector(cauHinh.anh);
    if (!anh) return { trang_thai: "khong_anh" };
    return xuLyCap(o, anh, trangThai, ghiLa, ep);
  }

  function xuLyCap(o, anh, trangThai, ghiLa, ep) {
    const svg = layChuoiSvg(anh);
    if (!svg) return { trang_thai: "khong_anh" };
    const ky = chuKyAnh(anh, svg);
    if (!ep && trangThai && trangThai.ky === ky && o.getAttribute("data-qlt-captcha") !== null) {
      return { trang_thai: "cu" };
    }
    const kq = qltGiaiSvgToanCuc(svg);
    if (trangThai) trangThai.ky = ky;
    if (!kq.ma || kq.soNhanDuoc !== kq.soDuongChu) {
      if (ghiLa && kq.chuKyLa.length) ghiLa(kq.chuKyLa);
      return { trang_thai: "chua_doc", chuKyLa: kq.chuKyLa };
    }
    const dau = o.getAttribute("data-qlt-captcha");
    if (!ep && o.value !== "" && o.value !== dau) return { trang_thai: "giu_nguoi_dung" };
    dien(o, kq.ma);
    return { trang_thai: "da_dien", ma: kq.ma };
  }

  function qltGiaiSvgToanCuc(svg) {
    return giaiSvg(svg);
  }

  function quetSvgTatCa(cauHinh, bangTT, goc, ghiLa, ep) {
    return timCacCapSvg(cauHinh, goc).map(function (c) {
      let tt = bangTT.get(c.anh);
      if (!tt) {
        tt = { ky: "" };
        bangTT.set(c.anh, tt);
      }
      return xuLyCap(c.o, c.anh, tt, ghiLa, ep);
    });
  }

  function layPng(img) {
    try {
      if (!img || img.tagName !== "IMG" || !img.complete || !img.naturalWidth) return { loi: "chua_tai_xong" };
      const cv = document.createElement("canvas");
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const g = cv.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      return { px: g.getImageData(0, 0, cv.width, cv.height).data, w: cv.width, h: cv.height };
    } catch (e) {
      return { loi: "khong_lay_duoc_anh" };
    }
  }

  function chuKyPng(lay) {
    let h = 2166136261;
    const d = lay.px;
    for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619);
    return lay.w + "x" + lay.h + ":" + (h >>> 0);
  }

  return {
    xuLy: xuLy,
    xuLyCap: xuLyCap,
    timCacCapSvg: timCacCapSvg,
    quetSvgTatCa: quetSvgTatCa,
    timO: timO,
    layChuoiSvg: layChuoiSvg,
    dien: dien,
    layPng: layPng,
    chuKyPng: chuKyPng,
  };
})();

(function () {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) return;
  if (typeof timCauHinh !== "function") return;
  const cauHinh = timCauHinh(location.hostname);
  if (!cauHinh) return;

  const cacCap = cauHinh.cap || [{ o: cauHinh.o, anh: cauHinh.anh }];
  const trangThai = cacCap.map(function () {
    return { ky: "" };
  });
  const bangTTSvg = new WeakMap();

  function ghiTrangThai(tt) {
    try {
      chrome.storage.local.get({ trang_thai: {}, so_lan_dien: 0 }, function (v) {
        const ds = v.trang_thai || {};
        ds[cauHinh.hostname] = { tt: tt, luc: new Date().toISOString(), ten: cauHinh.ten };
        const ghi = { trang_thai: ds };
        if (tt === "da_dien") ghi.so_lan_dien = (parseInt(v.so_lan_dien, 10) || 0) + 1;
        chrome.storage.local.set(ghi);
      });
    } catch (e) {
      /* bỏ qua */
    }
  }

  function ghiLa(dsChuKy) {
    try {
      chrome.storage.local.get({ chu_ky_la: [] }, function (v) {
        const ds = v.chu_ky_la || [];
        dsChuKy.forEach(function (ck) {
          if (!ds.some(function (x) { return x.chu_ky === ck; })) {
            ds.push({ chu_ky: ck, cong: location.hostname, luc: new Date().toISOString() });
          }
        });
        chrome.storage.local.set({ chu_ky_la: ds.slice(-50) });
      });
    } catch (e) {
      /* bỏ qua */
    }
  }

  function guiGiai(cong, lay) {
    return new Promise(function (ok) {
      try {
        chrome.runtime.sendMessage(
          { loai: "giai_png", cong: cong, rgba: Array.from(lay.px), w: lay.w, h: lay.h },
          function (r) {
            ok(chrome.runtime.lastError ? { ok: false, loi: "chua_doc_duoc" } : r || { ok: false, loi: "chua_doc_duoc" });
          }
        );
      } catch (e) {
        ok({ ok: false, loi: "chua_doc_duoc" });
      }
    });
  }

  async function quetPng(i, ep) {
    const c = cacCap[i];
    const img = document.querySelector(c.anh);
    if (img && !img.getAttribute("data-qlt-load")) {
      img.setAttribute("data-qlt-load", "1");
      img.addEventListener("load", function () {
        henQuet();
      });
    }
    const o = qltLoiCaptcha.timO(c, document);
    if (!o || !img) return;
    const lay = qltLoiCaptcha.layPng(img);
    if (lay.loi === "khong_lay_duoc_anh") {
      ghiTrangThai("khong_lay_duoc_anh");
      return;
    }
    if (!lay.px) return;
    const ky = qltLoiCaptcha.chuKyPng(lay);
    if (!ep && trangThai[i].ky === ky && o.getAttribute("data-qlt-captcha") !== null) return;
    trangThai[i].ky = ky;
    const kq = await guiGiai(cauHinh.cong, lay);
    if (!kq.ok) {
      ghiTrangThai("chua_doc_duoc");
      return;
    }
    const lai = qltLoiCaptcha.layPng(document.querySelector(c.anh));
    if (!lai.px || qltLoiCaptcha.chuKyPng(lai) !== ky) return;
    if (!kq.ma) {
      ghiTrangThai("chua_doc_duoc");
      return;
    }
    const dau = o.getAttribute("data-qlt-captcha");
    if (!ep && o.value !== "" && o.value !== dau) return;
    qltLoiCaptcha.dien(o, kq.ma);
    ghiTrangThai("da_dien");
  }

  function layMaVanBan(loai, nguon) {
    let t = "";
    if (loai === "svg_chu") {
      const src = String(nguon.getAttribute("src") || "");
      const i = src.indexOf(",");
      if (i < 0 || src.slice(0, 15) !== "data:image/svg+") return "";
      try {
        const svg = /;base64$/.test(src.slice(0, i)) ? atob(src.slice(i + 1)) : decodeURIComponent(src.slice(i + 1));
        const m = /<text\b[^>]*>([^<]*)<\/text>/i.exec(svg);
        t = m ? m[1] : "";
      } catch (e) {
        return "";
      }
    } else {
      t = nguon.textContent || "";
    }
    return String(t).replace(/\s+/g, "");
  }

  function quetVanBan(i, ep) {
    const c = cacCap[i];
    const o = qltLoiCaptcha.timO(c, document);
    const nguon = document.querySelector(c.anh);
    if (!o || !nguon) return;
    const ma = layMaVanBan(cauHinh.loai, nguon);
    if (!/^[A-Za-z0-9]{4,8}$/.test(ma)) return;
    if (!ep && trangThai[i].ky === ma && o.getAttribute("data-qlt-captcha") !== null) return;
    trangThai[i].ky = ma;
    const dau = o.getAttribute("data-qlt-captcha");
    if (!ep && o.value !== "" && o.value !== dau) return;
    qltLoiCaptcha.dien(o, ma);
    ghiTrangThai("da_dien");
  }

  function quet(ep) {
    if (cauHinh.loai === "van_ban" || cauHinh.loai === "svg_chu") {
      cacCap.forEach(function (c, i) {
        try {
          quetVanBan(i, ep);
        } catch (e) {
          /* bỏ qua */
        }
      });
      return;
    }
    if (cauHinh.loai === "svg") {
      try {
        const ds = qltLoiCaptcha.quetSvgTatCa(cauHinh, bangTTSvg, document, ghiLa, ep);
        if (ds.some(function (k) { return k.trang_thai === "da_dien"; })) {
          ghiTrangThai("da_dien");
        } else if (ds.some(function (k) { return k.trang_thai === "chua_doc"; })) {
          ghiTrangThai("chua_doc_duoc");
        }
      } catch (e) {
        /* bỏ qua */
      }
      return;
    }
    cacCap.forEach(function (c, i) {
      try {
        quetPng(i, ep);
      } catch (e) {
        /* bỏ qua */
      }
    });
  }

  let hen = null;
  function henQuet() {
    if (hen) clearTimeout(hen);
    hen = setTimeout(function () {
      quet(false);
    }, 300);
  }

  try {
    chrome.runtime.onMessage.addListener(function (msg, gui, tra) {
      if (msg && msg.loai === "doc_lai") {
        quet(true);
        tra({ ok: true });
      }
      return false;
    });
  } catch (e) {
    /* bỏ qua */
  }

  // Tự động chạy ngay khi trang tải xong và theo dõi mọi thay đổi ảnh captcha
  quet(false);
  new MutationObserver(henQuet).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
    attributeFilter: ["src", "class", "style"],
  });
})();
