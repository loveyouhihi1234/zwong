import path from 'node:path';

export const DEMO_SHIM_URL = '/extension-demo/demo-chrome-shim.js';
export const DEMO_LICENSE_KEY = 'DEMO-TAXCAP-2026';
export const DEMO_API_URL = 'https://script.google.com/macros/s/demo-taxcap-sheet/exec';

/**
 * Resolves a request relative path safely inside extensionDir, preventing directory traversal.
 */
export function resolveSafeDemoPath(extensionDir: string, reqSubPath: string): string | null {
  const cleaned = String(reqSubPath || '').replace(/^\/+/, '');
  const rel = cleaned || 'sidepanel.html';
  const base = path.resolve(extensionDir);
  const full = path.resolve(base, rel);
  if (full !== base && !full.startsWith(base + path.sep)) {
    return null;
  }
  return full;
}

/**
 * Injects the isolated demo chrome.* shim into HTML served under /extension-demo/
 * without modifying any packaged extension file on disk.
 */
export function injectDemoShimIntoHtml(html: string, shimSrc: string = DEMO_SHIM_URL): string {
  const tag = `<script src="${shimSrc}"></script>`;
  if (html.includes(tag)) return html;
  if (/<head(\s[^>]*)?>/i.test(html)) {
    return html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${tag}`);
  }
  return `${tag}\n${html}`;
}

/**
 * Generates the in-memory chrome.* API shim shared across sidepanel.html and its 3 child iframes
 * (panels/hddt, panels/hoso, panels/captcha) when previewed inside TaxCap Studio's Extension Demo.
 */
export function buildDemoChromeShimScript(): string {
  return `/* TaxCap Extension Demo — Isolated chrome.* API Shim (only served on /extension-demo/) */
(() => {
  if (window.__taxcapDemoShimInstalled) return;
  window.__taxcapDemoShimInstalled = true;

  const DEMO_KEY = ${JSON.stringify(DEMO_LICENSE_KEY)};
  const DEMO_URL = ${JSON.stringify(DEMO_API_URL)};
  const SETTINGS_KEY = "taxcapSettings";
  const STATS_KEY = "taxcapStats";
  const LICENSE_KEY = "taxcapLicense";
  const DEVICE_ID_KEY = "taxcapDeviceId";
  const ACTIVE_TAB_KEY = "taxcapActiveMainTab";

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function createUnlockedLicense(key = DEMO_KEY, apiUrl = DEMO_URL) {
    return {
      licenseKey: key,
      licenseApiUrl: apiUrl,
      deviceId: "dev_demo2026tax",
      userName: "CÔNG TY TNHH KẾ TOÁN MINH ANH",
      status: "ACTIVE",
      expiresAt: "2027-12-31",
      maxDevices: 3,
      deviceCount: 1,
      dailyLimit: 500,
      serverUsedToday: 14,
      pendingUsageDelta: 0,
      usageDate: todayIso(),
      lastVerifiedAt: Date.now(),
      lastVerifyOk: true,
      lastError: "",
    };
  }

  function createLockedLicense(apiUrl = DEMO_URL, lastError = "") {
    return {
      licenseKey: "",
      licenseApiUrl: apiUrl,
      deviceId: "dev_demo2026tax",
      userName: "",
      status: "",
      expiresAt: "",
      maxDevices: 1,
      deviceCount: 0,
      dailyLimit: 0,
      serverUsedToday: 0,
      pendingUsageDelta: 0,
      usageDate: todayIso(),
      lastVerifiedAt: 0,
      lastVerifyOk: false,
      lastError,
    };
  }

  function createDefaultSettings() {
    return {
      solverMode: "local-onnx",
      licenseApiUrl: DEMO_URL,
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
    };
  }

  function evaluateLicense(lic) {
    const unlocked = Boolean(lic && lic.licenseKey && lic.lastVerifyOk && lic.status === "ACTIVE");
    if (unlocked) {
      return {
        unlocked: true,
        reason: "ACTIVE",
        message: "Đang hoạt động (Chế độ Demo)",
        needsRefresh: false,
        msUntilRefresh: 14 * 60 * 1000,
        effectiveUsedToday: (Number(lic.serverUsedToday) || 0) + (Number(lic.pendingUsageDelta) || 0),
      };
    }
    return {
      unlocked: false,
      reason: lic?.status === "LOCKED" ? "LOCKED" : "UNACTIVATED",
      message: lic?.lastError || "Chưa kích hoạt mã bản quyền.",
      needsRefresh: false,
      msUntilRefresh: 0,
      effectiveUsedToday: 0,
    };
  }

  const DEMO_TO_KHAI = [
    { value: "01/GTGT", label: "01/GTGT - Tờ khai thuế giá trị gia tăng (TT80/2021)" },
    { value: "05/KK-TNCN", label: "05/KK-TNCN - Tờ khai khấu trừ thuế TNCN (TT80/2021)" },
    { value: "03/TNDN", label: "03/TNDN - Tờ khai quyết toán thuế TNDN (TT80/2021)" },
    { value: "BCTC-TT133", label: "BCTC - Bộ Báo cáo tài chính (TT133/2016)" },
    { value: "01/MBAI", label: "01/LPMB - Tờ khai lệ phí môn bài" },
    { value: "05/QTT-TNCN", label: "05/QTT-TNCN - Tờ khai quyết toán thuế TNCN" },
  ];

  const DEMO_HOSO_ROWS = [
    {
      maHoSo: "HS2026041800192",
      toKhai: "01/GTGT - Tờ khai thuế GTGT (Quý 1/2026)",
      maToKhai: "01/GTGT",
      kyTinhThue: "Q1/2026",
      ngayNop: "18/04/2026",
      trangThai: "Cơ quan thuế chấp nhận hồ sơ khai thuế điện tử",
    },
    {
      maHoSo: "HS2026041800205",
      toKhai: "05/KK-TNCN - Tờ khai khấu trừ thuế TNCN",
      maToKhai: "05/KK-TNCN",
      kyTinhThue: "Q1/2026",
      ngayNop: "18/04/2026",
      trangThai: "Cơ quan thuế chấp nhận hồ sơ khai thuế điện tử",
    },
    {
      maHoSo: "HS2026032800841",
      toKhai: "03/TNDN - Tờ khai quyết toán thuế TNDN",
      maToKhai: "03/TNDN",
      kyTinhThue: "2025",
      ngayNop: "28/03/2026",
      trangThai: "Cơ quan thuế chấp nhận hồ sơ khai thuế điện tử",
    },
    {
      maHoSo: "HS2026032800849",
      toKhai: "BCTC - Bộ Báo cáo tài chính (TT133/2016)",
      maToKhai: "BCTC-TT133",
      kyTinhThue: "2025",
      ngayNop: "28/03/2026",
      trangThai: "Cơ quan thuế chấp nhận hồ sơ khai thuế điện tử",
    },
    {
      maHoSo: "HS2026032500412",
      toKhai: "05/QTT-TNCN - Tờ khai quyết toán thuế TNCN",
      maToKhai: "05/QTT-TNCN",
      kyTinhThue: "2025",
      ngayNop: "25/03/2026",
      trangThai: "Cơ quan thuế chấp nhận hồ sơ khai thuế điện tử",
    },
    {
      maHoSo: "HS2026011500088",
      toKhai: "01/GTGT - Tờ khai thuế GTGT (Bản nộp thử lỗi định dạng)",
      maToKhai: "01/GTGT",
      kyTinhThue: "Q4/2025",
      ngayNop: "15/01/2026",
      trangThai: "Không chấp nhận việc nộp HSKT điện tử",
    },
  ];

  // Tìm hub dùng chung từ sidepanel cha (cùng origin /extension-demo/)
  let sharedHub = null;
  try {
    if (window.parent && window.parent !== window && window.parent.__TAXCAP_DEMO_HUB__) {
      sharedHub = window.parent.__TAXCAP_DEMO_HUB__;
    }
  } catch {
    sharedHub = null;
  }

  const isRootDemoFrame = !sharedHub;

  if (!sharedHub) {
    const params = new URLSearchParams(window.location.search || "");
    const initialLocked = params.get("locked") === "1";
    const initialTab = params.get("tab") || "hddt";

    const store = {
      [DEVICE_ID_KEY]: "dev_demo2026tax",
      [SETTINGS_KEY]: createDefaultSettings(),
      [STATS_KEY]: { date: todayIso(), solved: 14, failed: 0 },
      [ACTIVE_TAB_KEY]: ["hddt", "hoso", "captcha"].includes(initialTab) ? initialTab : "hddt",
      [LICENSE_KEY]: initialLocked ? createLockedLicense() : createUnlockedLicense(),
    };

    const storageListeners = new Set();

    function notifyHostState() {
      try {
        const lic = store[LICENSE_KEY];
        const ev = evaluateLicense(lic);
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            {
              type: "TAXCAP_DEMO_STATE",
              unlocked: ev.unlocked,
              activeTab: store[ACTIVE_TAB_KEY] || "hddt",
              stats: store[STATS_KEY] || { date: todayIso(), solved: 0, failed: 0 },
            },
            "*",
          );
        }
      } catch {
        // ignore
      }
    }

    function emitStorageChanges(changes) {
      for (const fn of Array.from(storageListeners)) {
        try {
          fn(changes, "local");
        } catch {
          // ignore
        }
      }
      notifyHostState();
    }

    function setStorageValues(obj) {
      const changes = {};
      for (const [k, v] of Object.entries(obj || {})) {
        const oldValue = store[k];
        store[k] = v;
        changes[k] = { oldValue, newValue: v };
      }
      emitStorageChanges(changes);
    }

    function bumpDemoStat(ok) {
      const cur = store[STATS_KEY] && store[STATS_KEY].date === todayIso()
        ? { ...store[STATS_KEY] }
        : { date: todayIso(), solved: 0, failed: 0 };
      if (ok) cur.solved += 1;
      else cur.failed += 1;
      const lic = store[LICENSE_KEY];
      if (ok && lic && lic.lastVerifyOk) {
        store[LICENSE_KEY] = { ...lic, pendingUsageDelta: (Number(lic.pendingUsageDelta) || 0) + 1 };
      }
      setStorageValues({ [STATS_KEY]: cur });
    }

    // Quản lý tiến trình mô phỏng cho Tab 1 (HĐĐT) và Tab 2 (Hồ sơ)
    const activeJobs = {
      hddt: { timers: [], running: false, stopped: false },
      hoso: { timers: [], running: false, stopped: false },
    };

    function clearJobTimers(kind) {
      const job = activeJobs[kind];
      for (const t of job.timers) clearTimeout(t);
      job.timers = [];
    }

    function scheduleJob(kind, ms, fn) {
      const id = setTimeout(() => {
        const job = activeJobs[kind];
        job.timers = job.timers.filter((t) => t !== id);
        fn();
      }, ms);
      activeJobs[kind].timers.push(id);
    }

    function createMockPort(name) {
      const msgListeners = new Set();
      const discListeners = new Set();
      const emit = (payload) => {
        for (const fn of Array.from(msgListeners)) {
          try { fn(payload); } catch { /* ignore */ }
        }
      };

      const stopHddt = () => {
        if (!activeJobs.hddt.running) return;
        activeJobs.hddt.stopped = true;
        activeJobs.hddt.running = false;
        clearJobTimers("hddt");
        emit({ type: "log", text: "Đã dừng mô phỏng theo yêu cầu (không lưu file ra máy).", level: "warn" });
        emit({ type: "done", stopped: true, total: 0, saved: 0 });
        emit({ type: "idle" });
      };

      const stopHoso = () => {
        if (!activeJobs.hoso.running) return;
        activeJobs.hoso.stopped = true;
        activeJobs.hoso.running = false;
        clearJobTimers("hoso");
        emit({ type: "log", text: "Đã dừng tác vụ tra cứu/tải hồ sơ mẫu.", level: "warn" });
        emit({ type: "idle" });
      };

      return {
        name,
        onMessage: {
          addListener: (fn) => msgListeners.add(fn),
          removeListener: (fn) => msgListeners.delete(fn),
        },
        onDisconnect: {
          addListener: (fn) => discListeners.add(fn),
          removeListener: (fn) => discListeners.delete(fn),
        },
        disconnect: () => {
          clearJobTimers(name === "hddt-job" ? "hddt" : "hoso");
          for (const fn of Array.from(discListeners)) {
            try { fn(); } catch { /* ignore */ }
          }
        },
        postMessage: (msg) => {
          if (name === "hddt-job") {
            if (msg?.type === "hddt-stop") {
              stopHddt();
              return;
            }
            if (msg?.type === "hddt-download-big-excel") {
              emit({ type: "log", text: "Chế độ Demo: bỏ qua tải file Excel dung lượng lớn ra máy.", level: "ok" });
              return;
            }
            if (msg?.type === "run") {
              clearJobTimers("hddt");
              activeJobs.hddt.running = true;
              activeJobs.hddt.stopped = false;
              const total = 10;
              const selectedSheets = Object.entries(msg.sheets || {}).filter(([, v]) => v).map(([k]) => k);
              const selectedFormats = Object.entries(msg.formats || {})
                .filter(([k, v]) => k !== "lines" && v)
                .map(([k]) => k.toUpperCase());

              emit({ type: "status", text: "Đang kết nối phiên MST 0101234567 (Chế độ Demo)…" });
              emit({ type: "log", text: "Đã xác thực phiên mẫu: 0101234567 – CÔNG TY TNHH KẾ TOÁN MINH ANH" });

              scheduleJob("hddt", 220, () => {
                if (!activeJobs.hddt.running) return;
                emit({ type: "log", text: "Đang quét danh sách hóa đơn (" + msg.tuNgay + " – " + msg.denNgay + ")…" });
                if (Array.isArray(msg.forms) && msg.forms.includes("mtt")) {
                  emit({ type: "log", text: "Tự động giải captcha SVG nội bộ (<5ms) cho đoạn hóa đơn máy tính tiền…", level: "ok" });
                  bumpDemoStat(true);
                }
                emit({ type: "summary", total });
              });

              for (let i = 1; i <= total; i++) {
                scheduleJob("hddt", 380 + i * 170, () => {
                  if (!activeJobs.hddt.running) return;
                  emit({ type: "progress", done: i, total });
                  if (i === 4 && selectedSheets.includes("risk")) {
                    emit({ type: "log", text: "Đang đối chiếu danh sách người bán rủi ro theo MST…" });
                  }
                  if (i === 8) {
                    emit({
                      type: "log",
                      text: "Đang dựng gói xuất mẫu (" + (selectedFormats.join(", ") || "EXCEL") + (selectedSheets.length ? " + " + selectedSheets.length + " sheet thêm" : "") + ")…",
                    });
                  }
                });
              }

              scheduleJob("hddt", 380 + (total + 1) * 170, () => {
                if (!activeJobs.hddt.running) return;
                activeJobs.hddt.running = false;
                emit({ type: "log", text: "Hoàn tất mô phỏng 10 hóa đơn (Chế độ Demo không ghi tệp xuống ổ đĩa).", level: "ok" });
                emit({
                  type: "done",
                  stopped: false,
                  total,
                  saved: Math.max(1, selectedFormats.length) * total,
                  errors: 0,
                  dir: "HoaDon_Demo_0101234567",
                });
                emit({ type: "idle" });
              });
            }
            return;
          }

          if (name === "hoso-job") {
            if (msg?.type === "hoso-stop") {
              stopHoso();
              return;
            }
            if (msg?.type === "search") {
              clearJobTimers("hoso");
              activeJobs.hoso.running = true;
              activeJobs.hoso.stopped = false;
              const srcName = msg.source === "tdt" ? "Thuế điện tử" : "Dịch vụ công Thuế";
              emit({ type: "status", text: "Đang tra cứu trên " + srcName + " (Chế độ Demo)…" });
              emit({ type: "log", text: "Đang nạp danh sách tờ khai từ " + srcName + " (" + msg.tuNgay + " – " + msg.denNgay + ")…", level: "warn" });

              scheduleJob("hoso", 450, () => {
                if (!activeJobs.hoso.running) return;
                const filtered = msg.maToKhai
                  ? DEMO_HOSO_ROWS.filter((r) => r.maToKhai === msg.maToKhai)
                  : DEMO_HOSO_ROWS;
                activeJobs.hoso.running = false;
                emit({ type: "rows", rows: filtered });
                emit({ type: "log", text: "Tìm thấy " + filtered.length + " hồ sơ mẫu (gồm cả hồ sơ được chấp nhận & không chấp nhận để thử bộ lọc).", level: "ok" });
                emit({ type: "status", text: "Sẵn sàng tải " + filtered.length + " hồ sơ mẫu" });
                emit({ type: "idle" });
              });
              return;
            }
            if (msg?.type === "download") {
              clearJobTimers("hoso");
              activeJobs.hoso.running = true;
              activeJobs.hoso.stopped = false;
              const ids = Array.isArray(msg.ids) ? msg.ids : [];
              const kinds = Array.isArray(msg.kinds) ? msg.kinds : ["hoso"];
              const tasks = [];
              for (const id of ids) {
                for (const kind of kinds) tasks.push({ id, kind });
              }
              const total = Math.max(1, tasks.length);
              emit({ type: "status", text: "Đang mô phỏng tải " + total + " tệp hồ sơ…" });

              tasks.forEach((task, idx) => {
                scheduleJob("hoso", idx * 240 + 80, () => {
                  if (!activeJobs.hoso.running) return;
                  emit({ type: "rowStatus", id: task.id, kind: task.kind, state: "loading", text: "Đang tải…" });
                });
                scheduleJob("hoso", idx * 240 + 220, () => {
                  if (!activeJobs.hoso.running) return;
                  emit({ type: "rowStatus", id: task.id, kind: task.kind, state: "ok", text: "Đã tải (Demo)" });
                  emit({ type: "progress", done: idx + 1, total });
                });
              });

              scheduleJob("hoso", tasks.length * 240 + 340, () => {
                if (!activeJobs.hoso.running) return;
                activeJobs.hoso.running = false;
                emit({ type: "log", text: "Hoàn tất mô phỏng tải " + tasks.length + " tệp (Chế độ Demo không lưu file rác ra máy).", level: "ok" });
                emit({ type: "done" });
                emit({ type: "idle" });
              });
            }
          }
        },
      };
    }

    sharedHub = {
      store,
      storageListeners,
      setStorageValues,
      notifyHostState,
      bumpDemoStat,
      setLocked: (locked) => {
        const nextLic = locked
          ? createLockedLicense(DEMO_URL, "")
          : createUnlockedLicense(DEMO_KEY, DEMO_URL);
        setStorageValues({ [LICENSE_KEY]: nextLic });
      },
      handleRuntimeMessage: async (msg) => {
        if (!msg || !msg.type) return { ok: false };
        if (msg.type === "TAXCAP_GET_SETTINGS") {
          const ev = evaluateLicense(store[LICENSE_KEY]);
          return {
            ...(store[SETTINGS_KEY] || createDefaultSettings()),
            licenseGate: { unlocked: ev.unlocked, reason: ev.reason, message: ev.message },
          };
        }
        if (msg.type === "TAXCAP_LICENSE_STATUS" || msg.type === "TAXCAP_GET_LICENSE") {
          const lic = store[LICENSE_KEY];
          return {
            ok: true,
            deviceId: store[DEVICE_ID_KEY],
            license: lic,
            state: lic,
            evaluation: evaluateLicense(lic),
            defaultApiUrl: DEMO_URL,
          };
        }
        if (msg.type === "TAXCAP_LICENSE_ACTIVATE" || msg.type === "TAXCAP_ACTIVATE_LICENSE") {
          const key = String(msg.licenseKey || "").trim().toUpperCase();
          const apiUrl = String(msg.licenseApiUrl || DEMO_URL).trim();
          if (!key || key === "LOCKED" || key === "INVALID") {
            const lockedLic = createLockedLicense(
              apiUrl,
              key === "LOCKED"
                ? "Mã kích hoạt này đang bị khóa trên Google Sheets (mô phỏng)."
                : "Mã kích hoạt không tồn tại. Hãy thử mã mẫu DEMO-TAXCAP-2026.",
            );
            if (key === "LOCKED") lockedLic.status = "LOCKED";
            setStorageValues({ [LICENSE_KEY]: lockedLic });
            return {
              ok: false,
              deviceId: store[DEVICE_ID_KEY],
              license: lockedLic,
              state: lockedLic,
              evaluation: evaluateLicense(lockedLic),
              defaultApiUrl: DEMO_URL,
              message: lockedLic.lastError,
            };
          }
          const activeLic = createUnlockedLicense(key, apiUrl);
          setStorageValues({ [LICENSE_KEY]: activeLic });
          return {
            ok: true,
            deviceId: store[DEVICE_ID_KEY],
            license: activeLic,
            state: activeLic,
            evaluation: evaluateLicense(activeLic),
            defaultApiUrl: DEMO_URL,
            message: "Kích hoạt thành công (Chế độ Demo)!",
          };
        }
        if (msg.type === "TAXCAP_LICENSE_REFRESH") {
          const lic = store[LICENSE_KEY];
          const ev = evaluateLicense(lic);
          if (ev.unlocked) {
            const synced = {
              ...lic,
              serverUsedToday: (Number(lic.serverUsedToday) || 0) + (Number(lic.pendingUsageDelta) || 0),
              pendingUsageDelta: 0,
              lastVerifiedAt: Date.now(),
            };
            setStorageValues({ [LICENSE_KEY]: synced });
            return {
              ok: true,
              deviceId: store[DEVICE_ID_KEY],
              license: synced,
              evaluation: evaluateLicense(synced),
              message: "Đã đồng bộ Google Sheets (Chế độ Demo).",
            };
          }
          return { ok: false, deviceId: store[DEVICE_ID_KEY], license: lic, evaluation: ev, message: "Chưa kích hoạt." };
        }
        if (msg.type === "TAXCAP_LICENSE_DEACTIVATE") {
          const lockedLic = createLockedLicense(DEMO_URL, "");
          setStorageValues({ [LICENSE_KEY]: lockedLic });
          return {
            ok: true,
            deviceId: store[DEVICE_ID_KEY],
            license: lockedLic,
            evaluation: evaluateLicense(lockedLic),
          };
        }
        if (msg.type === "TAXCAP_PING") {
          return {
            ok: true,
            mode: "local-onnx",
            model: "ddddocr_old.onnx",
            charsetCount: 8210,
          };
        }
        if (msg.type === "TAXCAP_CHECK_LICENSE") {
          const ev = evaluateLicense(store[LICENSE_KEY]);
          return { ok: ev.unlocked, locked: !ev.unlocked, reason: ev.reason, message: ev.message };
        }
        return { ok: true };
      },
      handleTabMessage: async (_tabId, msg) => {
        if (msg?.type === "hddt-info") {
          return {
            ready: true,
            mst: "0101234567",
            company: "CÔNG TY TNHH KẾ TOÁN MINH ANH",
            busy: activeJobs.hddt.running,
          };
        }
        if (msg?.type === "hddt-stop") {
          clearJobTimers("hddt");
          activeJobs.hddt.running = false;
          return { ok: true };
        }
        if (msg?.type === "hoso-info") {
          return {
            ready: true,
            company: "0101234567 – CÔNG TY TNHH KẾ TOÁN MINH ANH",
            toKhai: DEMO_TO_KHAI,
            busy: activeJobs.hoso.running,
          };
        }
        if (msg?.type === "hoso-status") {
          return {
            ready: true,
            company: "0101234567 – CÔNG TY TNHH KẾ TOÁN MINH ANH",
          };
        }
        if (msg?.type === "hoso-stop") {
          clearJobTimers("hoso");
          activeJobs.hoso.running = false;
          return { ok: true };
        }
        return { ok: true };
      },
      connectTab: (_tabId, info) => createMockPort(info?.name || "demo-job"),
    };

    window.__TAXCAP_DEMO_HUB__ = sharedHub;

    // Lắng nghe lệnh điều khiển từ TaxCap Studio (chuyển Khóa/Mở khóa, nhảy Tab, điền mã mẫu, mô phỏng +1 Captcha)
    window.addEventListener("message", (event) => {
      const data = event?.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "TAXCAP_DEMO_SET_LOCKED") {
        sharedHub.setLocked(Boolean(data.locked));
        return;
      }

      if (data.type === "TAXCAP_DEMO_SWITCH_TAB") {
        const targetTab = String(data.tab || "hddt");
        const btn = document.querySelector('.main-tab-btn[data-main-tab="' + targetTab + '"]');
        if (btn && !btn.disabled) {
          btn.click();
        }
        return;
      }

      if (data.type === "TAXCAP_DEMO_FILL_KEY") {
        const keyInput = document.getElementById("shellKeyInput");
        if (keyInput) {
          keyInput.value = String(data.key || DEMO_KEY);
          keyInput.focus();
        }
        return;
      }

      if (data.type === "TAXCAP_DEMO_SIMULATE_SOLVE") {
        sharedHub.bumpDemoStat(data.ok !== false);
        return;
      }
    });

    // Báo trạng thái ban đầu lên khung TaxCap Studio sau khi sidepanel khởi tạo
    window.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => sharedHub.notifyHostState(), 50);
    });
  }

  // Tính đường dẫn gốc của thư mục extension-demo (tương thích cả localhost lẫn GitHub Pages subpath)
  const demoBaseUrl = (() => {
    try {
      const cs = document.currentScript && document.currentScript.src;
      if (cs) return new URL("./", cs).href;
    } catch {
      // ignore
    }
    return "/extension-demo/";
  })();

  // Gắn chrome.* API giả lập vào window hiện tại
  window.chrome = {
    runtime: {
      id: "taxcap-demo-preview",
      lastError: null,
      getURL: (p) => demoBaseUrl + String(p || "").replace(/^\\/+/, ""),
      sendMessage: (msg, cb) => {
        const p = sharedHub.handleRuntimeMessage(msg);
        if (typeof cb === "function") {
          p.then((res) => cb(res)).catch(() => cb(null));
          return;
        }
        return p;
      },
    },
    storage: {
      local: {
        get: async (keys) => {
          if (!keys) return { ...sharedHub.store };
          if (typeof keys === "string") {
            return { [keys]: sharedHub.store[keys] };
          }
          if (Array.isArray(keys)) {
            const out = {};
            for (const k of keys) out[k] = sharedHub.store[k];
            return out;
          }
          const out = {};
          for (const [k, defVal] of Object.entries(keys)) {
            out[k] = k in sharedHub.store ? sharedHub.store[k] : defVal;
          }
          return out;
        },
        set: async (obj) => {
          sharedHub.setStorageValues(obj);
        },
        remove: async (keys) => {
          const list = Array.isArray(keys) ? keys : [keys];
          const changes = {};
          for (const k of list) {
            if (k in sharedHub.store) {
              changes[k] = { oldValue: sharedHub.store[k], newValue: undefined };
              delete sharedHub.store[k];
            }
          }
          if (Object.keys(changes).length) {
            for (const fn of Array.from(sharedHub.storageListeners)) {
              try { fn(changes, "local"); } catch { /* ignore */ }
            }
          }
        },
      },
      onChanged: {
        addListener: (fn) => sharedHub.storageListeners.add(fn),
        removeListener: (fn) => sharedHub.storageListeners.delete(fn),
      },
    },
    tabs: {
      query: async (q) => {
        const urlPattern = String(q?.url || "");
        if (urlPattern.includes("hoadondientu")) {
          return [{ id: 101, active: true, url: "https://hoadondientu.gdt.gov.vn/" }];
        }
        if (urlPattern.includes("dichvucong")) {
          return [{ id: 102, active: true, url: "https://dichvucong.gdt.gov.vn/tthc/tchs" }];
        }
        return [{ id: 100, active: true, url: "https://hoadondientu.gdt.gov.vn/" }];
      },
      sendMessage: (tabId, msg) => sharedHub.handleTabMessage(tabId, msg),
      connect: (tabId, info) => sharedHub.connectTab(tabId, info),
      onRemoved: { addListener: () => {}, removeListener: () => {} },
      onUpdated: { addListener: () => {}, removeListener: () => {} },
    },
  };

  if (isRootDemoFrame) {
    // Gắn sẵn licenseApiUrl mẫu cho bản Demo
    window.addEventListener("DOMContentLoaded", () => {
      if (self.TAXCAP_DEFAULTS && !self.TAXCAP_DEFAULTS.licenseApiUrl) {
        self.TAXCAP_DEFAULTS.licenseApiUrl = DEMO_URL;
      }
    });
  }
})();
`;
}
