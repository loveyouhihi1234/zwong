importScripts("config.js", "direct-gemini.js", "license.js");

const SETTINGS_KEY = "taxcapSettings";
const STATS_KEY = "taxcapStats";
const MEMORY_KEY = "taxcapMemory";
const SAMPLES_KEY = "taxcapSamples";
const LOGS_KEY = "taxcapLogs";
const LICENSE_KEY = "taxcapLicense";
const DEVICE_ID_KEY = "taxcapDeviceId";
const PENDING_SOLVES_KEY = "taxcapPendingSolves";
const PAUSE_ALARM = "taxcap-resume";
const OFFSCREEN_URL = "offscreen.html";

const pendingMemoryMap = new Map();
let inFlightLicenseSync = null;
let creatingOffscreen = null;

// Mở Side Panel khi bấm icon (dự phòng mở cửa sổ riêng cho Chrome cũ / Cốc Cốc)
if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
} else if (chrome.action?.onClicked) {
  chrome.action.onClicked.addListener(() => {
    chrome.windows.create({
      url: chrome.runtime.getURL("sidepanel.html"),
      type: "popup",
      width: 460,
      height: 760,
    });
  });
}

async function getSettings() {
  const res = await chrome.storage.local.get(SETTINGS_KEY);
  const saved = res[SETTINGS_KEY] || {};
  return {
    ...self.TAXCAP_DEFAULTS,
    ...saved,
    solverMode: "local-onnx",
    portals: {
      ...self.TAXCAP_DEFAULTS.portals,
      ...(saved.portals || {}),
    },
  };
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen) {
    throw new Error("Trình duyệt chưa hỗ trợ Offscreen Document để chạy ONNX cục bộ.");
  }
  if (typeof chrome.runtime.getContexts === "function") {
    const existing = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
    });
    if (existing && existing.length > 0) return;
  }
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ["WORKERS"],
        justification: "Chạy mô hình ONNX (ddddocr_old.onnx) giải captcha cục bộ không gửi ảnh ra ngoài.",
      })
      .catch((err) => {
        if (!/Only a single offscreen document/i.test(String(err?.message || err))) {
          throw err;
        }
      })
      .finally(() => {
        creatingOffscreen = null;
      });
  }
  await creatingOffscreen;
}

function sendToOffscreen(payload) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, loi: chrome.runtime.lastError.message || "Lỗi liên lạc Offscreen ONNX" });
          return;
        }
        resolve(response || { ok: false, loi: "Offscreen ONNX không phản hồi" });
      });
    } catch (err) {
      resolve({ ok: false, loi: String(err?.message || err || "Lỗi Offscreen ONNX") });
    }
  });
}

async function ensureDeviceId() {
  const res = await chrome.storage.local.get(DEVICE_ID_KEY);
  if (res[DEVICE_ID_KEY]) return String(res[DEVICE_ID_KEY]);
  const rawUuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const generated = `dev_${rawUuid.slice(0, 12)}`;
  await chrome.storage.local.set({ [DEVICE_ID_KEY]: generated });
  return generated;
}

async function loadLicenseState() {
  const res = await chrome.storage.local.get(LICENSE_KEY);
  const defaultApiUrl = self.TAXCAP_DEFAULTS?.licenseApiUrl || "";
  return self.TaxCapLicense.normalizeLicenseState(res[LICENSE_KEY], defaultApiUrl);
}

async function saveLicenseState(nextState) {
  await chrome.storage.local.set({ [LICENSE_KEY]: nextState });
}

async function postAppsScript(apiUrl, payload) {
  const cleanUrl = self.TaxCapLicense.normalizeLicenseApiUrl(apiUrl);
  if (!self.TaxCapLicense.isValidAppsScriptUrl(cleanUrl)) {
    return {
      ok: false,
      reason: "NO_API_URL",
      message: "URL Google Apps Script chưa đúng định dạng https://script.google.com/macros/s/.../exec",
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), 12000);
  try {
    const res = await fetch(cleanUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (!data || typeof data !== "object") {
      return {
        ok: false,
        networkError: true,
        message: "Google Apps Script trả về dữ liệu không hợp lệ (kiểm tra quyền Deploy: Anyone).",
      };
    }
    return data;
  } catch {
    return {
      ok: false,
      networkError: true,
      message: "Không kết nối được Google Sheets (kiểm tra Internet hoặc URL Apps Script).",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function refreshLicenseIfNeeded(options = {}) {
  const force = Boolean(options.force);
  const current = await loadLicenseState();
  const licenseKey = self.TaxCapLicense.normalizeLicenseKey(options.licenseKey || current.licenseKey);
  const licenseApiUrl = self.TaxCapLicense.normalizeLicenseApiUrl(
    options.licenseApiUrl || current.licenseApiUrl || self.TAXCAP_DEFAULTS?.licenseApiUrl || "",
  );
  const localEval = self.TaxCapLicense.evaluateLocalLicense(current);

  if (!force && !localEval.needsRefresh) {
    return { state: current, evaluation: localEval };
  }
  if (!licenseKey || !licenseApiUrl) {
    const updated =
      !licenseApiUrl && licenseKey
        ? { ...current, licenseKey, lastError: "Chưa nhập URL Google Apps Script." }
        : current;
    return { state: updated, evaluation: self.TaxCapLicense.evaluateLocalLicense(updated) };
  }

  if (inFlightLicenseSync && !force) {
    return inFlightLicenseSync;
  }

  const run = (async () => {
    const deviceId = await ensureDeviceId();
    const sentDelta = current.licenseKey === licenseKey ? Math.max(0, Number(current.pendingUsageDelta) || 0) : 0;
    const serverRes = await postAppsScript(licenseApiUrl, {
      action: "verify",
      licenseKey,
      deviceId,
      delta: sentDelta,
    });
    const nextState = self.TaxCapLicense.applyServerVerifyResult(current, serverRes, {
      licenseKey,
      licenseApiUrl,
      deviceId,
      sentDelta,
      nowMs: Date.now(),
    });
    await saveLicenseState(nextState);
    const nextEval = self.TaxCapLicense.evaluateLocalLicense(nextState);
    await updateBadge(false);
    return { state: nextState, evaluation: nextEval, serverRes };
  })();

  inFlightLicenseSync = run;
  try {
    return await run;
  } finally {
    inFlightLicenseSync = null;
  }
}

async function ensureLicenseUnlocked() {
  const current = await loadLicenseState();
  const localEval = self.TaxCapLicense.evaluateLocalLicense(current);
  if (localEval.unlocked && !localEval.needsRefresh) {
    return { ok: true, state: current, evaluation: localEval };
  }
  if (!current.licenseKey) {
    return {
      ok: false,
      state: current,
      evaluation: localEval,
      message: "Chưa kích hoạt mã — bấm biểu tượng TaxCap để nhập mã.",
    };
  }
  const refreshed = await refreshLicenseIfNeeded({ force: false });
  if (refreshed.evaluation.unlocked) {
    return { ok: true, state: refreshed.state, evaluation: refreshed.evaluation };
  }
  return {
    ok: false,
    state: refreshed.state,
    evaluation: refreshed.evaluation,
    message: refreshed.evaluation.message || "Mã kích hoạt không hợp lệ.",
  };
}

async function recordLicensedSolve() {
  const current = await loadLicenseState();
  if (!current.licenseKey || !current.lastVerifyOk) return;
  const next = self.TaxCapLicense.incrementPendingUsage(current, 1, Date.now());
  await saveLicenseState(next);
  if (next.pendingUsageDelta >= self.TaxCapLicense.USAGE_SYNC_BATCH_SIZE) {
    refreshLicenseIfNeeded({ force: true }).catch(() => {});
  }
}

async function updateBadge(hasError = false) {
  const lic = await loadLicenseState().catch(() => null);
  const licEval = lic ? self.TaxCapLicense.evaluateLocalLicense(lic) : { unlocked: false };
  if (!licEval.unlocked) {
    await chrome.action.setBadgeText({ text: "KEY" }).catch(() => {});
    await chrome.action.setBadgeBackgroundColor({ color: "#b45309" }).catch(() => {});
    return;
  }
  const settings = await getSettings();
  const isPaused = !settings.enabled || Date.now() < (settings.pausedUntil || 0);
  if (hasError) {
    await chrome.action.setBadgeText({ text: "!" }).catch(() => {});
    await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" }).catch(() => {});
    return;
  }
  if (isPaused) {
    await chrome.action.setBadgeText({ text: "||" }).catch(() => {});
    await chrome.action.setBadgeBackgroundColor({ color: "#64748b" }).catch(() => {});
    return;
  }
  await chrome.action.setBadgeText({ text: "" }).catch(() => {});
}

async function bumpStats(ok) {
  const today = new Date().toISOString().slice(0, 10);
  const res = await chrome.storage.local.get(STATS_KEY);
  const prev =
    res[STATS_KEY] && res[STATS_KEY].date === today
      ? res[STATS_KEY]
      : { date: today, solved: 0, failed: 0 };
  if (ok) prev.solved += 1;
  else prev.failed += 1;
  await chrome.storage.local.set({ [STATS_KEY]: prev });
}

async function loadLocalMemory() {
  const res = await chrome.storage.local.get(MEMORY_KEY);
  return self.TaxCapDirect.normalizeMemoryState(res[MEMORY_KEY]);
}

async function saveLocalMemory(nextState) {
  await chrome.storage.local.set({ [MEMORY_KEY]: nextState });
}

async function loadSamples() {
  const res = await chrome.storage.local.get(SAMPLES_KEY);
  return Array.isArray(res[SAMPLES_KEY]) ? res[SAMPLES_KEY] : [];
}

async function saveSamples(samples) {
  await chrome.storage.local.set({ [SAMPLES_KEY]: samples });
}

async function appendSampleRecord(entry) {
  const prev = await loadSamples();
  const next = self.TaxCapDirect.recordSampleInDataset(prev, entry);
  await saveSamples(next);
}

async function loadLogs() {
  const res = await chrome.storage.local.get(LOGS_KEY);
  return Array.isArray(res[LOGS_KEY]) ? res[LOGS_KEY] : [];
}

async function pushSolveLog(params) {
  const prev = await loadLogs();
  const entry = self.TaxCapDirect.createLogEntry(params);
  const next = self.TaxCapDirect.appendSolveLog(prev, entry);
  await chrome.storage.local.set({ [LOGS_KEY]: next });
}

function summarizeMemory(state) {
  const exactCount = Object.keys(state?.exactHashes || {}).length;
  const learnedCount = Number(state?.stats?.learnedCount) || 0;
  const correctedCount = Number(state?.stats?.correctedCount) || 0;
  return { exactCount, learnedCount, correctedCount };
}

async function savePendingSolve(sampleId, record) {
  pendingMemoryMap.set(sampleId, record);
  if (pendingMemoryMap.size > 20) {
    const oldest = pendingMemoryMap.keys().next().value;
    if (oldest) pendingMemoryMap.delete(oldest);
  }
  try {
    if (chrome.storage.session) {
      const res = await chrome.storage.session.get(PENDING_SOLVES_KEY);
      const list = Array.isArray(res[PENDING_SOLVES_KEY]) ? res[PENDING_SOLVES_KEY] : [];
      const next = [{ sampleId, ...record }, ...list.filter((x) => x.sampleId !== sampleId)].slice(0, 12);
      await chrome.storage.session.set({ [PENDING_SOLVES_KEY]: next });
    }
  } catch {
    // ignore
  }
}

async function takePendingSolve(sampleId) {
  const mem = pendingMemoryMap.get(sampleId);
  if (mem) {
    pendingMemoryMap.delete(sampleId);
    return mem;
  }
  try {
    if (chrome.storage.session) {
      const res = await chrome.storage.session.get(PENDING_SOLVES_KEY);
      const list = Array.isArray(res[PENDING_SOLVES_KEY]) ? res[PENDING_SOLVES_KEY] : [];
      const found = list.find((x) => x.sampleId === sampleId);
      if (found) {
        await chrome.storage.session.set({
          [PENDING_SOLVES_KEY]: list.filter((x) => x.sampleId !== sampleId),
        });
        return found;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function handleSolveOnnx(msg) {
  const started = Date.now();
  const portal = self.TaxCapDirect.normalizePortalId(msg?.portal || msg?.cong || "hddt");
  const cong = String(msg?.cong || portal);
  const bypassCache = Boolean(msg?.bypassCache);
  const thumbnail = typeof msg?.image === "string" ? msg.image : "";

  const gate = await ensureLicenseUnlocked();
  if (!gate.ok) {
    return {
      ok: false,
      licenseLocked: true,
      message: gate.message,
    };
  }

  const rgba = msg?.rgba;
  const w = Number(msg?.w) || 0;
  const h = Number(msg?.h) || 0;
  if (!Array.isArray(rgba) || w <= 0 || h <= 0 || rgba.length !== w * h * 4) {
    await bumpStats(false);
    await pushSolveLog({
      portal,
      status: "error",
      latencyMs: Date.now() - started,
      message: "Dữ liệu pixel ảnh captcha không hợp lệ",
    });
    return { ok: false, message: "Không đọc được ảnh captcha" };
  }

  const parsedThumb = self.TaxCapDirect.parseImageDataUrl(thumbnail);
  const imageHash =
    String(msg?.sig || "") ||
    (parsedThumb ? self.TaxCapDirect.hashBase64Quick(`${parsedThumb.mimeType}:${parsedThumb.data}`) : "");

  // Kiểm tra trí nhớ cục bộ trước (nếu người dùng đã xác nhận/sửa ảnh giống hệt)
  if (!bypassCache && imageHash) {
    const memoryState = await loadLocalMemory();
    const cachedLabel = self.TaxCapDirect.getExactMemoryMatch(memoryState, portal, imageHash);
    if (cachedLabel) {
      const sampleId = `local:${crypto.randomUUID()}`;
      const latencyMs = Math.max(1, Date.now() - started);
      await savePendingSolve(sampleId, {
        portal,
        predicted: cachedLabel,
        imageHash,
      });
      await appendSampleRecord({
        sampleId,
        portal,
        source: "memory-local",
        predicted: cachedLabel,
        latencyMs,
        imageDataUrl: thumbnail,
        imageHash,
      });
      await pushSolveLog({
        portal,
        status: "ok",
        code: cachedLabel,
        latencyMs,
        message: "Trí nhớ cục bộ (<5ms)",
      });
      await recordLicensedSolve();
      await bumpStats(true);
      await updateBadge(false);
      return {
        ok: true,
        captcha: cachedLabel,
        sampleId,
        source: "memory-local",
        latencyMs,
      };
    }
  }

  try {
    await ensureOffscreenDocument();
  } catch (err) {
    const latencyMs = Date.now() - started;
    await bumpStats(false);
    await updateBadge(true);
    await pushSolveLog({
      portal,
      status: "error",
      latencyMs,
      message: err?.message || "Không khởi tạo được Offscreen ONNX",
    });
    return { ok: false, message: "Không khởi tạo được bộ giải ONNX cục bộ" };
  }

  const offRes = await sendToOffscreen({
    loai: "offscreen_giai",
    cong,
    rgba,
    w,
    h,
  });

  const latencyMs = Math.max(1, Date.now() - started);
  const captcha = self.TaxCapDirect.sanitizeCaptchaText(String(offRes?.ma || ""));

  if (!offRes?.ok || !captcha) {
    await bumpStats(false);
    await updateBadge(false);
    await pushSolveLog({
      portal,
      status: "error",
      latencyMs,
      message: offRes?.loi ? `ONNX cục bộ: ${offRes.loi}` : "ONNX cục bộ chưa đọc được mã",
    });
    return {
      ok: false,
      message: "Không đọc được, bấm thử lại",
      latencyMs,
    };
  }

  const sampleId = `local:${crypto.randomUUID()}`;
  await savePendingSolve(sampleId, {
    portal,
    predicted: captcha,
    imageHash,
  });
  await appendSampleRecord({
    sampleId,
    portal,
    source: "onnx-local",
    predicted: captcha,
    latencyMs,
    imageDataUrl: thumbnail,
    imageHash,
  });
  await pushSolveLog({
    portal,
    status: "ok",
    code: captcha,
    latencyMs,
    message: `ONNX cục bộ (ddddocr · ${latencyMs}ms)`,
  });
  await recordLicensedSolve();
  await bumpStats(true);
  await updateBadge(false);

  return {
    ok: true,
    captcha,
    sampleId,
    source: "onnx-local",
    latencyMs,
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  const res = await chrome.storage.local.get(SETTINGS_KEY);
  const saved = res[SETTINGS_KEY];
  if (!saved) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: self.TAXCAP_DEFAULTS });
  } else {
    const nextSettings = {
      ...self.TAXCAP_DEFAULTS,
      enabled: saved.enabled !== false,
      pausedUntil: Number(saved.pausedUntil) || 0,
      licenseApiUrl: saved.licenseApiUrl || self.TAXCAP_DEFAULTS.licenseApiUrl || "",
      portals: {
        ...self.TAXCAP_DEFAULTS.portals,
        ...(saved.portals || {}),
      },
    };
    await chrome.storage.local.set({ [SETTINGS_KEY]: nextSettings });
  }
  await updateBadge(false);
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local" || !changes[SETTINGS_KEY]) return;
  const next = changes[SETTINGS_KEY].newValue;
  if (next?.pausedUntil > Date.now()) {
    chrome.alarms?.create(PAUSE_ALARM, { when: next.pausedUntil + 500 });
  }
  await updateBadge(false);
});

chrome.alarms?.onAlarm?.addListener((alarm) => {
  if (alarm.name === PAUSE_ALARM) updateBadge(false);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg?.type) return;

  if (msg.type === "TAXCAP_GET_SETTINGS") {
    (async () => {
      const [settings, licState] = await Promise.all([getSettings(), loadLicenseState()]);
      let evaluation = self.TaxCapLicense.evaluateLocalLicense(licState);
      if (licState.licenseKey && evaluation.unlocked && evaluation.needsRefresh) {
        const refreshed = await refreshLicenseIfNeeded({ force: false });
        evaluation = refreshed.evaluation;
      }
      sendResponse({
        ...settings,
        licenseGate: {
          unlocked: evaluation.unlocked,
          reason: evaluation.reason,
          message: evaluation.message,
        },
      });
    })();
    return true;
  }

  if (msg.type === "TAXCAP_LICENSE_STATUS" || msg.type === "TAXCAP_GET_LICENSE") {
    (async () => {
      try {
        const [deviceId, licState] = await Promise.all([ensureDeviceId(), loadLicenseState()]);
        const evaluation = self.TaxCapLicense.evaluateLocalLicense(licState);
        sendResponse({
          ok: true,
          deviceId,
          license: licState,
          state: licState,
          evaluation,
          defaultApiUrl: self.TAXCAP_DEFAULTS?.licenseApiUrl || "",
        });
      } catch (err) {
        sendResponse({
          ok: false,
          message: err?.message || "Lỗi đọc trạng thái bản quyền.",
        });
      }
    })();
    return true;
  }

  if (msg.type === "TAXCAP_LICENSE_ACTIVATE" || msg.type === "TAXCAP_ACTIVATE_LICENSE") {
    refreshLicenseIfNeeded({
      force: true,
      licenseKey: msg.licenseKey || "",
      licenseApiUrl: msg.licenseApiUrl || "",
    })
      .then(async (res) => {
        const deviceId = await ensureDeviceId();
        sendResponse({
          ok: res.evaluation.unlocked,
          deviceId,
          license: res.state,
          state: res.state,
          evaluation: res.evaluation,
          defaultApiUrl: self.TAXCAP_DEFAULTS?.licenseApiUrl || "",
          message: res.evaluation.unlocked ? "Kích hoạt thành công!" : res.evaluation.message,
        });
      })
      .catch(() => sendResponse({ ok: false, message: "Lỗi kích hoạt mã." }));
    return true;
  }

  if (msg.type === "TAXCAP_LICENSE_REFRESH") {
    refreshLicenseIfNeeded({ force: true })
      .then(async (res) => {
        const deviceId = await ensureDeviceId();
        sendResponse({
          ok: res.evaluation.unlocked,
          deviceId,
          license: res.state,
          evaluation: res.evaluation,
          message: res.evaluation.unlocked ? "Đã đồng bộ Google Sheets." : res.evaluation.message,
        });
      })
      .catch(() => sendResponse({ ok: false, message: "Không đồng bộ được." }));
    return true;
  }

  if (msg.type === "TAXCAP_LICENSE_DEACTIVATE") {
    (async () => {
      const [current, deviceId] = await Promise.all([loadLicenseState(), ensureDeviceId()]);
      if (current.licenseKey && current.licenseApiUrl) {
        await postAppsScript(current.licenseApiUrl, {
          action: "deactivate",
          licenseKey: current.licenseKey,
          deviceId,
          delta: Math.max(0, Number(current.pendingUsageDelta) || 0),
        }).catch(() => {});
      }
      const resetState = self.TaxCapLicense.createEmptyLicenseState(
        current.licenseApiUrl || self.TAXCAP_DEFAULTS?.licenseApiUrl || "",
      );
      await saveLicenseState(resetState);
      await updateBadge(false);
      sendResponse({
        ok: true,
        deviceId,
        license: resetState,
        evaluation: self.TaxCapLicense.evaluateLocalLicense(resetState),
      });
    })();
    return true;
  }

  if (msg.type === "TAXCAP_SOLVE_ONNX") {
    handleSolveOnnx(msg).then(sendResponse);
    return true;
  }

  if (msg.type === "TAXCAP_RECORD_LOCAL") {
    (async () => {
      const gate = await ensureLicenseUnlocked();
      if (!gate.ok) {
        sendResponse({ ok: false, licenseLocked: true, message: gate.message });
        return;
      }
      await recordLicensedSolve();
      await bumpStats(true);
      await updateBadge(false);
      const parsed = self.TaxCapDirect.parseImageDataUrl(msg.image || "");
      const portal = self.TaxCapDirect.normalizePortalId(msg.portal || "hddt");
      const latencyMs = Math.max(1, Math.round(Number(msg.latencyMs) || 2));
      const confidence = Math.max(0, Math.min(100, Math.round(Number(msg.confidence) || 95)));
      const source = String(msg.source || "svg-local");

      const sourceLabel =
        source === "svg-sig"
          ? `SVG chữ ký nội bộ (${confidence}%)`
          : source === "text-local"
            ? "Đọc văn bản trực tiếp (DOM)"
            : source === "svg-text"
              ? "Đọc chữ SVG trực tiếp"
              : `SVG nội bộ (${confidence}%)`;

      await pushSolveLog({
        portal,
        status: "ok",
        code: msg.captcha || "",
        latencyMs,
        message: sourceLabel,
      });

      const imageHash = parsed
        ? self.TaxCapDirect.hashBase64Quick(`${parsed.mimeType}:${parsed.data}`)
        : "";
      const sampleId = `local:${crypto.randomUUID()}`;
      if (parsed) {
        await savePendingSolve(sampleId, {
          portal,
          predicted: msg.captcha || "",
          imageHash,
        });
      }
      await appendSampleRecord({
        sampleId,
        portal,
        source,
        predicted: msg.captcha || "",
        latencyMs,
        imageDataUrl: msg.image || "",
        imageHash,
      });
      sendResponse({ ok: true, sampleId, localOnly: true });
    })();
    return true;
  }

  if (msg.type === "TAXCAP_FEEDBACK") {
    (async () => {
      const sampleId = String(msg.sampleId || "");
      const outcome = msg.outcome;
      if (!sampleId || !outcome) {
        sendResponse({ ok: false });
        return;
      }

      const prevSamples = await loadSamples();
      const { samples: nextSamples, updatedSample } = self.TaxCapDirect.applySampleFeedback(prevSamples, {
        sampleId,
        outcome,
        finalLabel: msg.finalLabel || "",
      });
      if (updatedSample) {
        await saveSamples(nextSamples);
      }

      const pending = await takePendingSolve(sampleId);
      const sourceMeta =
        pending ||
        (updatedSample
          ? {
              portal: updatedSample.portal,
              predicted: updatedSample.predicted,
              imageHash: updatedSample.imageHash,
            }
          : null);

      if (!sourceMeta) {
        sendResponse({ ok: Boolean(updatedSample) });
        return;
      }
      const prevMem = await loadLocalMemory();
      const nextMem = self.TaxCapDirect.updateLocalLearningState(prevMem, {
        portal: sourceMeta.portal,
        predicted: sourceMeta.predicted,
        finalLabel: msg.finalLabel || "",
        outcome,
        imageHash: sourceMeta.imageHash,
      });
      await saveLocalMemory(nextMem);
      sendResponse({ ok: true, localLearned: true });
    })();
    return true;
  }

  if (msg.type === "TAXCAP_GET_DATASET") {
    Promise.all([loadSamples(), loadLocalMemory()])
      .then(([samples, mem]) => {
        const summary = self.TaxCapDirect.computeDatasetSummary(samples);
        const portalHints = {};
        for (const id of self.TaxCapDirect.PORTAL_IDS) {
          portalHints[id] = self.TaxCapDirect.getAdaptiveHints(mem, id);
        }
        sendResponse({
          ok: true,
          summary,
          samples,
          portalHints,
          memoryStats: summarizeMemory(mem),
        });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "TAXCAP_POPUP_UPDATE_SAMPLE") {
    (async () => {
      const sampleId = String(msg.sampleId || "");
      const cleaned = self.TaxCapDirect.sanitizeCaptchaText(String(msg.finalLabel || ""));
      if (!sampleId || cleaned.length < 2) {
        sendResponse({ ok: false });
        return;
      }
      const prevSamples = await loadSamples();
      const target = prevSamples.find((s) => s.sampleId === sampleId);
      if (!target) {
        sendResponse({ ok: false });
        return;
      }
      const outcome = cleaned === target.predicted ? "verified" : "corrected";
      const { samples: nextSamples, updatedSample } = self.TaxCapDirect.applySampleFeedback(prevSamples, {
        sampleId,
        outcome,
        finalLabel: cleaned,
      });
      await saveSamples(nextSamples);

      const prevMem = await loadLocalMemory();
      const nextMem = self.TaxCapDirect.updateLocalLearningState(prevMem, {
        portal: target.portal,
        predicted: target.predicted,
        finalLabel: cleaned,
        outcome,
        imageHash: target.imageHash,
      });
      await saveLocalMemory(nextMem);
      sendResponse({ ok: true, sample: updatedSample });
    })();
    return true;
  }

  if (msg.type === "TAXCAP_CLEAR_DATASET") {
    Promise.all([saveSamples([]), saveLocalMemory(self.TaxCapDirect.createEmptyMemoryState())])
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "TAXCAP_GET_LOGS") {
    loadLogs()
      .then((logs) => {
        const stats = self.TaxCapDirect.computeLogStats(logs);
        sendResponse({ ok: true, stats, logs });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "TAXCAP_CLEAR_LOGS") {
    chrome.storage.local
      .set({ [LOGS_KEY]: [] })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "TAXCAP_GET_MEMORY_STATS") {
    loadLocalMemory()
      .then((mem) => sendResponse({ ok: true, ...summarizeMemory(mem) }))
      .catch(() => sendResponse({ ok: true, exactCount: 0, learnedCount: 0, correctedCount: 0 }));
    return true;
  }

  if (msg.type === "TAXCAP_CLEAR_MEMORY") {
    saveLocalMemory(self.TaxCapDirect.createEmptyMemoryState())
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "TAXCAP_PING") {
    (async () => {
      try {
        await ensureOffscreenDocument();
        const res = await sendToOffscreen({ loai: "offscreen_ping" });
        await updateBadge(!res?.ok);
        if (res?.ok) {
          sendResponse({
            ok: true,
            mode: "local-onnx",
            model: "ddddocr_old.onnx",
            charsetCount: res.soKyTu || 0,
          });
        } else {
          sendResponse({
            ok: false,
            mode: "local-onnx",
            message: res?.loi || "Không nạp được mô hình ONNX cục bộ.",
          });
        }
      } catch (err) {
        await updateBadge(true);
        sendResponse({
          ok: false,
          mode: "local-onnx",
          message: err?.message || "Không mở được Offscreen Document ONNX.",
        });
      }
    })();
    return true;
  }

  if (msg.type === "TAXCAP_CHECK_LICENSE") {
    ensureLicenseUnlocked()
      .then((res) => {
        sendResponse({
          ok: Boolean(res.ok),
          locked: !res.ok,
          reason: res.evaluation?.reason || "",
          message: res.message || res.evaluation?.message || "",
        });
      })
      .catch(() => {
        sendResponse({
          ok: false,
          locked: true,
          reason: "ERROR",
          message: "Không kiểm tra được trạng thái kích hoạt.",
        });
      });
    return true;
  }

  if (msg.type === "TAXCAP_DOWNLOAD_FILE" || msg.type === "download") {
    (async () => {
      const licCheck = await ensureLicenseUnlocked();
      if (!licCheck.ok) {
        sendResponse({
          error: licCheck.message || "Chưa kích hoạt mã bản quyền — hãy mở TaxCap Suite để kích hoạt.",
        });
        return;
      }
      try {
        const id = await chrome.downloads.download({
          url: msg.url,
          filename: msg.filename,
          conflictAction: "overwrite",
          saveAs: false,
        });
        sendResponse({ id });
      } catch (e) {
        sendResponse({ error: e?.message || "Không lưu được tệp tải về." });
      }
    })();
    return true;
  }
});
