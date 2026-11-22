// Hàm thuần phục vụ giao diện CVTax Captcha (chạy được trong trình duyệt và Node unit test).
(function (goc) {
  function boDau(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .trim();
  }

  function nhanLoaiGiai(loai) {
    if (loai === "svg") return "SVG Vector";
    if (loai === "svg_chu") return "SVG văn bản";
    if (loai === "van_ban") return "Văn bản DOM";
    return "OCR PNG cục bộ";
  }

  function nhanChuHoaThuong(quyTac) {
    if (quyTac === "hoa") return "Tự chuyển chữ HOA";
    if (quyTac === "thuong") return "Tự chuyển chữ thường";
    return "Giữ nguyên hoa / thường";
  }

  function nhanNhom(nhom) {
    if (nhom === "thue_dvc") return "Thuế & DVC";
    if (nhom === "ngan_hang") return "Ngân hàng";
    return "Hóa đơn NCC";
  }

  function nhomCuaCong(c) {
    if (typeof goc.nhomCong === "function") return goc.nhomCong(c);
    const h = String((c && c.hostname) || "").toLowerCase();
    if (/\.gov\.vn$|bhxh\.vnpost\.vn$/.test(h)) return "thue_dvc";
    if (/bank|bidv|msb|ncb|woori/.test(h)) return "ngan_hang";
    return "hoa_don";
  }

  function locCong(dsCong, tuKhoa, boLoc) {
    const q = boDau(tuKhoa);
    return (dsCong || []).filter(function (c) {
      if (boLoc && boLoc !== "tat_ca") {
        if (boLoc === "svg_van_ban") {
          if (c.loai !== "svg" && c.loai !== "svg_chu" && c.loai !== "van_ban") return false;
        } else if (nhomCuaCong(c) !== boLoc) {
          return false;
        }
      }
      if (!q) return true;
      return boDau(c.ten).indexOf(q) >= 0 || boDau(c.hostname).indexOf(q) >= 0;
    });
  }

  function thongKeCong(dsCong) {
    const ds = dsCong || [];
    let svg = 0;
    let png = 0;
    let vanBan = 0;
    ds.forEach(function (c) {
      if (c.loai === "svg") svg += 1;
      else if (c.loai === "van_ban" || c.loai === "svg_chu") vanBan += 1;
      else png += 1;
    });
    return { tong: ds.length, svg: svg, png: png, vanBan: vanBan };
  }

  function sapXepLichSu(trangThaiObj, dsCong) {
    const mapTen = {};
    (dsCong || []).forEach(function (c) {
      mapTen[c.hostname] = c.ten;
    });
    return Object.keys(trangThaiObj || {})
      .map(function (hostname) {
        const muc = trangThaiObj[hostname] || {};
        return {
          hostname: hostname,
          ten: muc.ten || mapTen[hostname] || hostname,
          tt: muc.tt || "da_dien",
          luc: muc.luc || "",
          ms: muc.luc ? Date.parse(muc.luc) || 0 : 0,
        };
      })
      .sort(function (a, b) {
        return b.ms - a.ms;
      });
  }

  // Tạo chuỗi SVG hợp lệ từ các chữ ký đường nét thật trong BANG_SVG để giaiSvg() giải mã trực tiếp.
  function taoPathTuChuKy(chuKy, xGoc) {
    const phan = [];
    let buoc = 0;
    const tong = Math.max(1, chuKy.length);
    for (let i = 0; i < chuKy.length; i++) {
      const ch = chuKy[i];
      const t = i / tong;
      if (ch === "M") {
        const x0 = buoc === 0 ? xGoc : xGoc + t * 20;
        const y0 = 42 + (buoc % 2) * 3;
        phan.push("M" + x0.toFixed(1) + " " + y0.toFixed(1));
      } else if (ch === "Q") {
        const cx = xGoc + t * 22;
        const cy = 40 + Math.sin(buoc * 0.9) * 4;
        const ex = xGoc + Math.min(24, (t + 1 / tong) * 22);
        const ey = 43 + Math.cos(buoc * 0.9) * 3;
        phan.push("Q" + cx.toFixed(1) + " " + cy.toFixed(1) + " " + ex.toFixed(1) + " " + ey.toFixed(1));
      } else if (ch === "Z") {
        phan.push("Z");
      }
      buoc += 1;
    }
    return phan.join(" ");
  }

  function taoMauSvgTuBang(bang, doDai, chiSoBatDau) {
    const cap = Object.keys(bang || {}).map(function (k) {
      return [k, bang[k]];
    });
    if (!cap.length) return { svg: "", maKyVong: "" };
    const n = Math.max(1, Math.min(doDai || 6, cap.length));
    const gocIdx = typeof chiSoBatDau === "number" ? Math.abs(Math.floor(chiSoBatDau)) : 0;
    const chon = [];
    for (let i = 0; i < n; i++) {
      chon.push(cap[(gocIdx + i * 5) % cap.length]);
    }
    const paths = chon.map(function (item, idx) {
      const x = 16 + idx * 32;
      const d = taoPathTuChuKy(item[0], x);
      return '  <path d="' + d + '" fill="none" stroke="#0F4C3A" stroke-opacity="0.28" stroke-width="1.1" stroke-linecap="round"/>';
    });
    const labels = chon.map(function (item, idx) {
      const x = 22 + idx * 32;
      const rot = (idx % 2 === 0 ? -6 : 6) + ((gocIdx + idx) % 5) - 2;
      return (
        '  <text x="' +
        x +
        '" y="32" transform="rotate(' +
        rot +
        " " +
        x +
        ' 28)" font-family="monospace" font-size="22" font-weight="700" fill="#0F4C3A">' +
        item[1] +
        "</text>"
      );
    });
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="54" viewBox="0 0 220 54">',
      '  <rect width="220" height="54" rx="6" fill="#F8FAFC"/>',
      paths.join("\n"),
      labels.join("\n"),
      "</svg>",
    ].join("\n");
    return {
      svg: svg,
      maKyVong: chon
        .map(function (x) {
          return x[1];
        })
        .join(""),
    };
  }

  const kq = {
    boDau: boDau,
    nhanLoaiGiai: nhanLoaiGiai,
    nhanChuHoaThuong: nhanChuHoaThuong,
    nhanNhom: nhanNhom,
    locCong: locCong,
    thongKeCong: thongKeCong,
    sapXepLichSu: sapXepLichSu,
    taoMauSvgTuBang: taoMauSvgTuBang,
  };
  if (typeof module !== "undefined") module.exports = kq;
  else Object.assign(goc, kq);
})(typeof globalThis !== "undefined" ? globalThis : self);
