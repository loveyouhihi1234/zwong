const SETTINGS_KEY = "taxcapSettings";
const STATS_KEY = "taxcapStats";
const LICENSE_KEY = "taxcapLicense";

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const panels = {
  captcha: document.getElementById("panel-captcha"),
  config: document.getElementById("panel-config"),
};

const enabledToggleWrap = document.getElementById("enabledToggleWrap");
const enabledToggle = document.getElementById("enabledToggle");
const enabledLabel = document.getElementById("enabledLabel");
const lockHeaderPill = document.getElementById("lockHeaderPill");

const panelActivate = document.getElementById("panel-activate");
const activateAlert = document.getElementById("activateAlert");
const activateAlertText = document.getElementById("activateAlertText");
const activateKeyInput = document.getElementById("activateKeyInput");
const activateUrlDirectWrap = document.getElementById("activateUrlDirectWrap");
const activateApiInput = document.getElementById("activateApiInput");
const activateUrlDetails = document.getElementById("activateUrlDetails");
const activateApiPresetInput = document.getElementById("activateApiPresetInput");
const activateBtn = document.getElementById("activateBtn");
const activateStatus = document.getElementById("activateStatus");
const activateDeviceId = document.getElementById("activateDeviceId");

const licUserName = document.getElementById("licUserName");
const licCodeText = document.getElementById("licCodeText");
const licBadge = document.getElementById("licBadge");
const licExpires = document.getElementById("licExpires");
const licDevices = document.getElementById("licDevices");
const licUsageToday = document.getElementById("licUsageToday");
const licSyncInfo = document.getElementById("licSyncInfo");
const licRefreshBtn = document.getElementById("licRefreshBtn");
const licDeactivateBtn = document.getElementById("licDeactivateBtn");
const licActionStatus = document.getElementById("licActionStatus");

const statSolved = document.getElementById("statSolved");
const statFailed = document.getElementById("statFailed");
const pause15Btn = document.getElementById("pause15Btn");
const resumeBtn = document.getElementById("resumeBtn");
const pauseStatus = document.getElementById("pauseStatus");
const portalBoxes = Array.from(document.querySelectorAll("[data-portal]"));

const extGroupTitle = document.getElementById("extGroupTitle");
const extGovLabel = document.getElementById("extGovLabel");
const extBankLabel = document.getElementById("extBankLabel");
const extInvoiceLabel = document.getElementById("extInvoiceLabel");
const extDomainsSummary = document.getElementById("extDomainsSummary");
const extDomainList = document.getElementById("extDomainList");
const configPortalCount = document.getElementById("configPortalCount");

const pingBtn = document.getElementById("pingBtn");
const pingStatus = document.getElementById("pingStatus");

let currentSettings = null;
let activeTab = "captcha";
let licenseUnlocked = false;

function renderExtendedPortalsCatalog() {
  const all = Array.isArray(window.CONG_THUE) ? window.CONG_THUE : [];
  const ext = all.filter((c) => !c.portalId);
  const byGroup = { ext_gov: [], ext_bank: [], ext_invoice: [] };

  for (const item of ext) {
    const k = typeof window.nhomBatTat === "function" ? window.nhomBatTat(item) : "ext_invoice";
    if (byGroup[k]) byGroup[k].push(item);
  }

  if (extGroupTitle) extGroupTitle.textContent = `Cổng mở rộng (${ext.length} cổng)`;
  if (extGovLabel) extGovLabel.textContent = `Thuế · BHXH · Hải quan · DVCQG (${byGroup.ext_gov.length})`;
  if (extBankLabel) extBankLabel.textContent = `Hóa đơn Ngân hàng (${byGroup.ext_bank.length})`;
  if (extInvoiceLabel) extInvoiceLabel.textContent = `Tra cứu Hóa đơn NCC (${byGroup.ext_invoice.length})`;
  if (extDomainsSummary) extDomainsSummary.textContent = `Xem danh sách ${ext.length} tên miền mở rộng`;
  if (configPortalCount) configPortalCount.textContent = `${all.length} cổng`;

  if (extDomainList) {
    extDomainList.innerHTML = "";
    const tagNames = {
      ext_gov: "Cơ quan NN",
      ext_bank: "Ngân hàng",
      ext_invoice: "Hóa đơn NCC",
    };
    for (const item of ext) {
      const k = typeof window.nhomBatTat === "function" ? window.nhomBatTat(item) : "ext_invoice";
      const row = document.createElement("div");
      row.className = "domain-row";
      const host = document.createElement("span");
      host.className = "domain-host";
      host.title = `${item.ten} (${item.hostname})`;
      host.textContent = item.hostname;
      const tag = document.createElement("span");
      tag.className = "domain-tag";
      tag.textContent = tagNames[k] || "Mở rộng";
      row.append(host, tag);
      extDomainList.appendChild(row);
    }
  }
}

function switchTab(nextTab) {
  if (!licenseUnlocked) return;
  const resolved = panels[nextTab] ? nextTab : "captcha";
  activeTab = resolved;
  panelActivate.classList.add("hidden");
  for (const btn of tabButtons) {
    const isMatch = btn.dataset.tab === resolved;
    btn.classList.toggle("active", isMatch);
    btn.setAttribute("aria-selected", isMatch ? "true" : "false");
  }
  for (const [id, el] of Object.entries(panels)) {
    el.classList.toggle("hidden", id !== resolved);
  }
}

for (const btn of tabButtons) {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
}

async function readSettingsDirect() {
  try {
    currentSettings = await chrome.runtime.sendMessage({ type: "TAXCAP_GET_SETTINGS" });
  } catch {
    currentSettings = null;
  }
  if (!currentSettings) {
    const res = await chrome.storage.local.get(SETTINGS_KEY);
    const saved = res[SETTINGS_KEY] || {};
    const defaults = self.TAXCAP_DEFAULTS || {
      solverMode: "local-onnx",
      enabled: true,
      pausedUntil: 0,
      portals: {},
    };
    currentSettings = {
      ...defaults,
      ...saved,
      portals: { ...(defaults.portals || {}), ...(saved.portals || {}) },
    };
  }
  return currentSettings;
}

function renderLicenseUi(licStatus) {
  const lic = licStatus?.license || {};
  const evalState = licStatus?.evaluation || { unlocked: false, reason: "UNACTIVATED" };
  const deviceId = licStatus?.deviceId || "—";
  const presetUrl = lic.licenseApiUrl || licStatus?.defaultApiUrl || self.TAXCAP_DEFAULTS?.licenseApiUrl || "";

  licenseUnlocked = Boolean(evalState.unlocked);
  activateDeviceId.textContent = deviceId;

  for (const btn of tabButtons) {
    btn.disabled = !licenseUnlocked;
  }
  enabledToggleWrap.classList.toggle("hidden", !licenseUnlocked);
  lockHeaderPill.classList.toggle("hidden", licenseUnlocked);

  if (!licenseUnlocked) {
    const pillLabel =
      evalState.reason === "LOCKED"
        ? "Đã khóa"
        : evalState.reason === "EXPIRED"
          ? "Hết hạn"
          : evalState.reason === "DAILY_LIMIT"
            ? "Hết lượt"
            : "Chưa kích hoạt";
    lockHeaderPill.textContent = pillLabel;

    for (const el of Object.values(panels)) {
      el.classList.add("hidden");
    }
    panelActivate.classList.remove("hidden");

    activateKeyInput.value = lic.licenseKey || "";
    if (presetUrl) {
      activateUrlDirectWrap.classList.add("hidden");
      activateUrlDetails.classList.remove("hidden");
      activateApiPresetInput.value = presetUrl;
    } else {
      activateUrlDirectWrap.classList.remove("hidden");
      activateUrlDetails.classList.add("hidden");
      activateApiInput.value = "";
    }

    if (evalState.reason && evalState.reason !== "UNACTIVATED") {
      activateAlert.classList.remove("hidden");
      activateAlertText.textContent = evalState.message || "Mã kích hoạt không hợp lệ.";
    } else {
      activateAlert.classList.add("hidden");
    }
    return;
  }

  panelActivate.classList.add("hidden");
  licUserName.textContent = lic.userName || "Người dùng TaxCap";
  licCodeText.textContent = lic.licenseKey || "—";
  licBadge.textContent = "Đang hoạt động";
  licBadge.className = "badge verified";
  licExpires.textContent =
    !lic.expiresAt || lic.expiresAt === "FOREVER" ? "Vĩnh viễn" : lic.expiresAt;
  licDevices.textContent = `${lic.deviceCount || 1}/${lic.maxDevices || 1} máy`;
  const used = Number(evalState.effectiveUsedToday) || 0;
  licUsageToday.textContent =
    lic.dailyLimit > 0 ? `${used}/${lic.dailyLimit}` : `${used} (Không giới hạn)`;
  const minsLeft = Math.max(0, Math.ceil((evalState.msUntilRefresh || 0) / 60000));
  const pendingCount = Number(lic.pendingUsageDelta) || 0;
  licSyncInfo.textContent =
    minsLeft > 0
      ? `~${minsLeft}p nữa${pendingCount > 0 ? ` (+${pendingCount})` : ""}`
      : "Sắp đồng bộ";

  switchTab(activeTab || "captcha");
}

async function loadLicenseStatus() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "TAXCAP_LICENSE_STATUS" });
    if (res?.ok) {
      renderLicenseUi(res);
      return;
    }
  } catch {
    // ignore
  }
  renderLicenseUi({
    license: {},
    evaluation: { unlocked: false, reason: "UNACTIVATED" },
    defaultApiUrl: self.TAXCAP_DEFAULTS?.licenseApiUrl || "",
  });
}

async function refreshDailyStats() {
  const today = new Date().toISOString().slice(0, 10);
  const statsRes = await chrome.storage.local.get(STATS_KEY);
  const stats = statsRes[STATS_KEY];
  if (stats && stats.date === today) {
    statSolved.textContent = String(stats.solved || 0);
    statFailed.textContent = String(stats.failed || 0);
  } else {
    statSolved.textContent = "0";
    statFailed.textContent = "0";
  }
}

async function loadState() {
  renderExtendedPortalsCatalog();
  await readSettingsDirect();
  enabledToggle.checked = Boolean(currentSettings.enabled);
  enabledLabel.textContent = currentSettings.enabled ? "Đang bật" : "Đang tắt";

  for (const box of portalBoxes) {
    const id = box.getAttribute("data-portal");
    box.checked = currentSettings.portals?.[id] !== false;
  }

  const remainingMs = (currentSettings.pausedUntil || 0) - Date.now();
  if (remainingMs > 0) {
    const mins = Math.ceil(remainingMs / 60000);
    pauseStatus.textContent = `Đang tạm dừng (còn ~${mins} phút)`;
  } else {
    pauseStatus.textContent = "";
  }

  await refreshDailyStats();
  await loadLicenseStatus();
}

async function saveSettings(patch) {
  currentSettings = {
    ...currentSettings,
    ...patch,
    portals: {
      ...(currentSettings?.portals || {}),
      ...(patch.portals || {}),
    },
  };
  await chrome.storage.local.set({ [SETTINGS_KEY]: currentSettings });
  await loadState();
}

enabledToggle.addEventListener("change", () => {
  saveSettings({ enabled: enabledToggle.checked, pausedUntil: 0 });
});

for (const box of portalBoxes) {
  box.addEventListener("change", () => {
    const id = box.getAttribute("data-portal");
    saveSettings({ portals: { [id]: box.checked } });
  });
}

pause15Btn.addEventListener("click", () => {
  saveSettings({ pausedUntil: Date.now() + 15 * 60 * 1000 });
});

resumeBtn.addEventListener("click", () => {
  saveSettings({ enabled: true, pausedUntil: 0 });
});

pingBtn.addEventListener("click", async () => {
  pingBtn.disabled = true;
  pingStatus.className = "status";
  pingStatus.textContent = "Đang nạp mô hình ddddocr_old.onnx (WASM)...";

  let res = null;
  try {
    res = await chrome.runtime.sendMessage({ type: "TAXCAP_PING" });
  } catch {
    res = null;
  } finally {
    pingBtn.disabled = false;
  }

  if (!res) {
    res = { ok: false, message: "Không liên hệ được Service Worker." };
  }

  if (res.ok) {
    pingStatus.className = "status ok";
    const chars = res.charsetCount ? ` · ${res.charsetCount} ký tự` : "";
    pingStatus.textContent = `Sẵn sàng: ${res.model || "ddddocr_old.onnx"} (WASM cục bộ${chars}).`;
  } else {
    pingStatus.className = "status err";
    pingStatus.textContent = res.message || "Không nạp được mô hình ONNX cục bộ.";
  }
});

activateBtn.addEventListener("click", async () => {
  const key = activateKeyInput.value.trim().toUpperCase();
  const url = activateUrlDirectWrap.classList.contains("hidden")
    ? activateApiPresetInput.value.trim()
    : activateApiInput.value.trim();

  if (!key) {
    activateStatus.className = "status err";
    activateStatus.textContent = "Hãy nhập Mã kích hoạt.";
    return;
  }
  if (!url) {
    activateStatus.className = "status err";
    activateStatus.textContent = "Hãy nhập URL Google Apps Script Web App.";
    return;
  }

  activateBtn.disabled = true;
  activateStatus.className = "status";
  activateStatus.textContent = "Đang xác thực với Google Sheets...";
  try {
    const res = await chrome.runtime.sendMessage({
      type: "TAXCAP_LICENSE_ACTIVATE",
      licenseKey: key,
      licenseApiUrl: url,
    });
    if (res?.ok) {
      activateStatus.className = "status ok";
      activateStatus.textContent = "Kích hoạt thành công!";
      activeTab = "captcha";
      renderLicenseUi(res);
    } else {
      activateStatus.className = "status err";
      activateStatus.textContent = res?.message || "Mã kích hoạt không hợp lệ.";
      renderLicenseUi(res);
    }
  } catch {
    activateStatus.className = "status err";
    activateStatus.textContent = "Không liên hệ được Service Worker.";
  } finally {
    activateBtn.disabled = false;
  }
});

licRefreshBtn.addEventListener("click", async () => {
  licActionStatus.className = "status";
  licActionStatus.textContent = "Đang đồng bộ Google Sheets...";
  licRefreshBtn.disabled = true;
  try {
    const res = await chrome.runtime.sendMessage({ type: "TAXCAP_LICENSE_REFRESH" });
    renderLicenseUi(res);
    licActionStatus.className = res?.ok ? "status ok" : "status err";
    licActionStatus.textContent = res?.message || (res?.ok ? "Đã đồng bộ." : "Lỗi đồng bộ.");
  } finally {
    licRefreshBtn.disabled = false;
  }
});

licDeactivateBtn.addEventListener("click", async () => {
  licActionStatus.className = "status";
  licActionStatus.textContent = "Đang gỡ thiết bị khỏi Google Sheets...";
  licDeactivateBtn.disabled = true;
  try {
    const res = await chrome.runtime.sendMessage({ type: "TAXCAP_LICENSE_DEACTIVATE" });
    activateStatus.textContent = "";
    renderLicenseUi(res);
  } finally {
    licDeactivateBtn.disabled = false;
  }
});

if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[STATS_KEY]) refreshDailyStats();
    if (changes[LICENSE_KEY]) loadLicenseStatus();
  });
}

loadState();
