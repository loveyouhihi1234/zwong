import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bangSvgMod = require("../bang_svg.js");
const giaiSvgMod = require("../giai_svg.js");
const cauHinhCong = require("../cau_hinh_cong.js");
const popupLogic = require("../popup_logic.js");
const tienIchPng = require("../tien_ich_png.js");
const shimMod = require("../chrome-shim.js");
const serverMod = require("../server.js");

test("manifest and codebase have zero license, auth, key, or donate artifacts", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "manifest.json"), "utf8"));
  assert.equal(manifest.key, undefined);
  assert.equal(manifest.update_url, undefined);
  assert.equal(manifest.permissions.includes("identity"), false);
  assert.equal(manifest.permissions.includes("alarms"), false);
  assert.equal(manifest.host_permissions.some((u) => u.includes("api.cvtax.vn")), false);

  for (const removed of ["giay_phep.js", "may_chu.js", "cau_hinh_may_chu.js", "man_hinh.js", "anh", "_metadata"]) {
    assert.equal(fs.existsSync(path.join(process.cwd(), removed)), false, `${removed} should be removed`);
  }
});

test("cau_hinh_cong normalizes hostnames and classifies portals accurately", () => {
  assert.equal(cauHinhCong.chuanHoaHost("www.customs.gov.vn"), "customs.gov.vn");
  assert.equal(cauHinhCong.chuanHoaHost("0100109106-tt78.vnpt-invoice.com.vn"), "vnpt-invoice.com.vn");
  assert.equal(cauHinhCong.chuanHoaHost("hst.vnpt-invoice.com.vn"), "hst.vnpt-invoice.com.vn");

  const cfg = cauHinhCong.timCauHinh("hoadondientu.gdt.gov.vn");
  assert.ok(cfg);
  assert.equal(cfg.loai, "svg");
  assert.equal(cauHinhCong.nhomCong(cfg), "thue_dvc");

  const bank = cauHinhCong.timCauHinh("einvoice.vietcombank.com.vn");
  assert.equal(cauHinhCong.nhomCong(bank), "ngan_hang");
});

test("popup_logic filters portals diacritic-insensitively and computes accurate stats", () => {
  const stats = popupLogic.thongKeCong(cauHinhCong.CONG_THUE);
  assert.equal(stats.tong, cauHinhCong.CONG_THUE.length);
  assert.equal(stats.svg + stats.png + stats.vanBan, stats.tong);
  assert.ok(stats.svg >= 1 && stats.png >= 40 && stats.vanBan >= 2);

  const vcb = popupLogic.locCong(cauHinhCong.CONG_THUE, "vietcombank", "ngan_hang");
  assert.equal(vcb.length, 1);
  assert.equal(vcb[0].hostname, "einvoice.vietcombank.com.vn");

  const thue = popupLogic.locCong(cauHinhCong.CONG_THUE, "hoa don dien tu", "thue_dvc");
  assert.ok(thue.some((c) => c.hostname === "hoadondientu.gdt.gov.vn"));
});

test("generated SVG sample from BANG_SVG decodes cleanly with real giaiSvg()", () => {
  const sample = popupLogic.taoMauSvgTuBang(bangSvgMod.BANG_SVG, 6, 0);
  assert.equal(sample.maKyVong.length, 6);
  const decoded = giaiSvgMod.giaiSvg(sample.svg);
  assert.equal(decoded.ma, sample.maKyVong);
  assert.equal(decoded.soDuongChu, 6);
  assert.equal(decoded.soNhanDuoc, 6);
  assert.deepEqual(decoded.chuKyLa, []);
});

test("tien_ich_png post-processing rules remain intact", () => {
  assert.equal(tienIchPng.hauXuLy("so4", "l5713"), "5713");
  assert.equal(tienIchPng.hauXuLy("bhxh", "ab12c"), "AB12C");
  assert.equal(tienIchPng.hauXuLy("einvoice_vn", "a1b2c3d"), "ABCD");
});

test("chrome-shim records doc_lai solves immediately with no login or connection gate", async () => {
  const chrome = shimMod.createChromeShim({
    manifest: { name: "CVTax – Tự động giải captcha", version: "2.0.0" },
  });

  let changed = 0;
  chrome.storage.onChanged.addListener(() => {
    changed += 1;
  });

  await chrome.tabs.sendMessage(1, { loai: "doc_lai", hostname: "einvoice.vietcombank.com.vn" });
  const stored = await chrome.storage.local.get({ trang_thai: {}, so_lan_dien: 0 });
  assert.equal(stored.so_lan_dien, 1);
  assert.equal(stored.trang_thai["einvoice.vietcombank.com.vn"].tt, "da_dien");
  assert.equal(changed, 1);
});

test("server injects chrome-shim before bang_svg.js and adds meta tags", () => {
  const popupHtml = fs.readFileSync(path.join(process.cwd(), "popup.html"), "utf8");
  const manifest = serverMod.readManifest();
  const injected = serverMod.injectPreviewShell(popupHtml, manifest);

  assert.match(injected, /<script src="\/chrome-shim\.js"><\/script><script src="bang_svg\.js">/);
  assert.match(injected, /<meta property="og:title"/);
  assert.match(injected, /Plus\+Jakarta\+Sans/);
});
