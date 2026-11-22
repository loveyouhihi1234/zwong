// Popup tiện ích CVTax Captcha: tự động hoạt động, không đăng nhập, không khóa bản quyền, không donate.
(function () {
  const NHAN_TT = {
    da_dien: "Đã điền",
    chua_doc_duoc: "Chưa đọc được",
    khong_lay_duoc_anh: "Không lấy được ảnh",
  };

  let congChon = "";
  let tuKhoa = "";
  let boLoc = "tat_ca";
  let tabDangMo = "chinh";
  let lanTaoMau = 0;
  let tabHost = "";
  let timBao = null;
  let local = { trang_thai: {}, chu_ky_la: [], so_lan_dien: 0, cong_chon: "" };

  const $ = function (id) {
    return document.getElementById(id);
  };

  function gio(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleTimeString("vi-VN");
    } catch (e) {
      return "";
    }
  }

  function dongTrangThai(hostname) {
    const x = (local.trang_thai || {})[hostname];
    if (!x) return "";
    return (NHAN_TT[x.tt] || x.tt) + " · " + gio(x.luc);
  }

  function bao(chu) {
    const el = $("bao");
    el.textContent = chu;
    el.hidden = false;
    if (timBao) clearTimeout(timBao);
    timBao = setTimeout(function () {
      el.textContent = "";
      el.hidden = true;
    }, 2200);
  }

  function congTuTab() {
    return CONG_THUE.some(function (c) {
      return c.hostname === tabHost;
    })
      ? tabHost
      : "";
  }

  function chonTab(tenTab) {
    tabDangMo = tenTab;
    document.querySelectorAll(".ext-tab").forEach(function (btn) {
      btn.setAttribute("aria-selected", btn.dataset.tab === tabDangMo ? "true" : "false");
    });
    $("pane_chinh").hidden = tabDangMo !== "chinh";
    $("pane_cong").hidden = tabDangMo !== "cong";
    $("pane_svg").hidden = tabDangMo !== "svg";
  }

  function docLaiTab() {
    const mucTieu = congChon || tabHost;
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { loai: "doc_lai", hostname: mucTieu }, function () {
          void chrome.runtime.lastError;
          bao("Đã gửi lệnh đọc lại captcha");
          setTimeout(nap, 200);
        });
      } else {
        bao("Không tìm thấy tab đang mở");
      }
    });
  }

  function veChinh() {
    const sel = $("cong");
    if (!sel.options.length) {
      CONG_THUE.forEach(function (c) {
        const o = document.createElement("option");
        o.value = c.hostname;
        o.textContent = c.ten + " · " + c.hostname;
        sel.appendChild(o);
      });
    }
    sel.value = congChon;

    $("tab_dem_cong").textContent = String(CONG_THUE.length);
    $("stat_cong").textContent = CONG_THUE.length + " cổng hỗ trợ";
    $("stat_lan_dien").textContent = String(local.so_lan_dien || 0);

    const c =
      CONG_THUE.find(function (item) {
        return item.hostname === congChon;
      }) || CONG_THUE[0];

    if (c) {
      $("ct_nhom").textContent = nhanNhom(nhomCong(c));
      $("ct_loai").textContent = nhanLoaiGiai(c.loai);
      $("ct_o").textContent = c.o;
      const ln = dongTrangThai(c.hostname);
      const lanEl = $("ct_lan");
      lanEl.textContent = ln || "Sẵn sàng tự động";
      lanEl.className = "spec-v tabular" + (ln ? " ok" : "");
    }

    const la = local.chu_ky_la || [];
    $("canh").hidden = !la.length;
    $("canh_n").textContent = String(la.length);
  }

  function veLichSu() {
    const ds = sapXepLichSu(local.trang_thai, CONG_THUE);
    const khung = $("ds_lich_su");
    khung.textContent = "";
    $("xoa_lich_su").disabled = ds.length === 0;

    if (!ds.length) {
      const p = document.createElement("div");
      p.className = "empty-note";
      p.textContent = "Chưa có lượt điền nào. Tiện ích sẽ tự động điền khi mở cổng hỗ trợ.";
      khung.appendChild(p);
      return;
    }

    ds.slice(0, 4).forEach(function (item) {
      const row = document.createElement("div");
      row.className = "history-item";

      const name = document.createElement("span");
      name.className = "history-name";
      name.textContent = item.ten;

      const time = document.createElement("span");
      time.className = "history-time tabular";
      time.textContent = (NHAN_TT[item.tt] || item.tt) + " · " + gio(item.luc);

      row.appendChild(name);
      row.appendChild(time);
      khung.appendChild(row);
    });
  }

  function veDanhSachCong() {
    const ds = locCong(CONG_THUE, tuKhoa, boLoc);
    const khung = $("ds_cong");
    khung.textContent = "";

    if (!ds.length) {
      const empty = document.createElement("div");
      empty.style.padding = "20px 12px";
      empty.style.textAlign = "center";
      empty.style.fontSize = "12px";
      empty.style.color = "#64748B";
      empty.textContent = "Không tìm thấy cổng phù hợp.";
      khung.appendChild(empty);
      return;
    }

    ds.forEach(function (c) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "portal-row";
      if (c.hostname === congChon) row.setAttribute("aria-current", "true");

      const left = document.createElement("span");
      left.className = "portal-main";
      const ten = document.createElement("span");
      ten.className = "portal-name";
      ten.textContent = c.ten;
      const host = document.createElement("span");
      host.className = "portal-host";
      host.textContent = c.hostname;
      left.appendChild(ten);
      left.appendChild(host);

      const right = document.createElement("span");
      right.className = "portal-right";
      const eng = document.createElement("span");
      eng.className = "portal-engine";
      eng.textContent = nhanLoaiGiai(c.loai);
      const st = document.createElement("span");
      const ln = dongTrangThai(c.hostname);
      st.className = "portal-status tabular" + (ln ? " filled" : "");
      st.textContent = ln || "Tự động";
      right.appendChild(eng);
      right.appendChild(st);

      row.appendChild(left);
      row.appendChild(right);
      row.addEventListener("click", function () {
        congChon = c.hostname;
        chrome.storage.local.set({ cong_chon: congChon });
        chonTab("chinh");
        ve();
      });
      khung.appendChild(row);
    });
  }

  function ve() {
    veChinh();
    veLichSu();
    veDanhSachCong();
  }

  function hienXemTruocSvg(chuoiSvg) {
    const khung = $("svg_xem");
    khung.textContent = "";
    const trimmed = String(chuoiSvg || "").trim();
    if (!trimmed) {
      const ph = document.createElement("span");
      ph.className = "svg-placeholder";
      ph.textContent = "Tạo mẫu SVG thử hoặc dán mã SVG để giải";
      khung.appendChild(ph);
      return;
    }
    try {
      const img = document.createElement("img");
      img.alt = "Xem trước captcha SVG";
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(trimmed);
      img.style.maxWidth = "100%";
      img.style.maxHeight = "50px";
      img.style.display = "block";
      khung.appendChild(img);
    } catch (e) {
      const ph = document.createElement("span");
      ph.className = "svg-placeholder";
      ph.textContent = "Không hiển thị được xem trước SVG";
      khung.appendChild(ph);
    }
  }

  function chayGiaiSvg() {
    const src = $("svg_nhap").value.trim();
    hienXemTruocSvg(src);
    const kqEl = $("svg_kq");
    const csEl = $("svg_chi_so");

    if (!src) {
      kqEl.textContent = "Chưa có dữ liệu";
      kqEl.className = "svg-code empty";
      csEl.textContent = "0 / 0 nét";
      return;
    }

    const kq = giaiSvg(src);
    if (kq.ma) {
      kqEl.textContent = kq.ma;
      kqEl.className = "svg-code tabular";
    } else {
      kqEl.textContent = "Chưa đọc được";
      kqEl.className = "svg-code empty";
    }
    csEl.textContent = kq.soNhanDuoc + " / " + kq.soDuongChu + " nét";
  }

  function nap() {
    chrome.storage.local.get(
      { trang_thai: {}, chu_ky_la: [], so_lan_dien: 0, cong_chon: "" },
      function (v) {
        local = v || { trang_thai: {}, chu_ky_la: [], so_lan_dien: 0, cong_chon: "" };
        if (!congChon) congChon = congTuTab() || local.cong_chon || CONG_THUE[0].hostname;
        ve();
      }
    );
  }

  document.querySelectorAll(".ext-tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      chonTab(btn.dataset.tab || "chinh");
    });
  });

  $("cong").addEventListener("change", function () {
    congChon = $("cong").value;
    chrome.storage.local.set({ cong_chon: congChon });
    ve();
  });

  $("doc_lai").addEventListener("click", docLaiTab);

  $("xoa_lich_su").addEventListener("click", function () {
    chrome.storage.local.set({ trang_thai: {}, so_lan_dien: 0 }, function () {
      bao("Đã xóa lịch sử");
      nap();
    });
  });

  $("tim_cong").addEventListener("input", function (e) {
    tuKhoa = e.target.value || "";
    veDanhSachCong();
  });

  document.querySelectorAll(".filter-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      boLoc = btn.dataset.filter || "tat_ca";
      document.querySelectorAll(".filter-btn").forEach(function (b) {
        b.setAttribute("aria-pressed", b.dataset.filter === boLoc ? "true" : "false");
      });
      veDanhSachCong();
    });
  });

  $("svg_mau").addEventListener("click", function () {
    const mau = taoMauSvgTuBang(BANG_SVG, 6, lanTaoMau);
    lanTaoMau += 1;
    $("svg_nhap").value = mau.svg;
    chayGiaiSvg();
  });

  $("svg_nhap").addEventListener("input", chayGiaiSvg);

  $("svg_xoa").addEventListener("click", function () {
    $("svg_nhap").value = "";
    chayGiaiSvg();
  });

  $("chep").addEventListener("click", function () {
    const ds = (local.chu_ky_la || []).map(function (x) {
      return x.chu_ky + " " + x.cong;
    });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ds.join("\n")).then(
        function () {
          bao("Đã chép mẫu chữ");
        },
        function () {
          bao("Không chép được");
        }
      );
    }
  });

  $("xoa_canh").addEventListener("click", function () {
    chrome.storage.local.set({ chu_ky_la: [] }, nap);
  });

  try {
    $("phien_ban").textContent = "Phiên bản " + chrome.runtime.getManifest().version;
  } catch (e) {}

  chrome.storage.onChanged.addListener(function () {
    nap();
  });

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    try {
      tabHost = chuanHoaHost(new URL(tabs[0].url).hostname);
    } catch (e) {
      tabHost = "";
    }
    nap();
  });
})();
