// Bộ giải SVG bằng chữ ký chuỗi lệnh M/Q/Z (tầng 2 dự phòng cho hoadondientu). Không dùng DOM.
(function (root) {
  function _layBang() {
    if (typeof BANG_SVG !== "undefined") return BANG_SVG;
    if (root && root.BANG_SVG) return root.BANG_SVG;
    if (typeof require === "function") return require("./bang_svg.js").BANG_SVG;
    return {};
  }

  function giaiSvg(chuoiSvg) {
    const kq = { ma: "", soDuongChu: 0, soNhanDuoc: 0, chuKyLa: [] };
    try {
      if (!chuoiSvg) return kq;
      const bang = _layBang();
      const dPaths = [];
      const reD = /\bd\s*=\s*["']([^"']+)["']/g;
      let md;
      while ((md = reD.exec(chuoiSvg)) !== null) dPaths.push(md[1]);
      if (!dPaths.length) return kq;
      const reSo = /[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/;
      const tim = [];
      for (const d of dPaths) {
        const reLenh = /([MQZmqz])([^MQZmqz]*)/g;
        const ms = [];
        let m;
        while ((m = reLenh.exec(d)) !== null) ms.push(m);
        if (!ms.length) continue;
        const kyHieu = ms.map((x) => x[1].toUpperCase()).join("");
        if (kyHieu.indexOf("Q") >= 0) {
          kq.soDuongChu++;
        }
        const ch = Object.prototype.hasOwnProperty.call(bang, kyHieu) ? bang[kyHieu] : "";
        if (ch) {
          const ms1 = reSo.exec(ms[0][2]);
          const x = ms1 ? parseFloat(ms1[0]) : 0;
          tim.push([x, ch]);
          if (kyHieu.indexOf("Q") >= 0) kq.soNhanDuoc++;
        } else if (kyHieu.indexOf("Q") >= 0 && kq.chuKyLa.indexOf(kyHieu) < 0) {
          kq.chuKyLa.push(kyHieu);
        }
      }
      tim.sort((a, b) => a[0] - b[0]);
      kq.ma = tim.map((x) => x[1]).join("");
      return kq;
    } catch {
      return { ma: "", soDuongChu: 0, soNhanDuoc: 0, chuKyLa: [] };
    }
  }

  root.giaiSvg = giaiSvg;
  if (typeof module !== "undefined") module.exports = { giaiSvg };
})(typeof globalThis !== "undefined" ? globalThis : self);
