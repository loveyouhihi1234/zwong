// Service worker thuần giải captcha: chuyển ảnh captcha PNG sang offscreen document
// (mô hình ddddocr chạy cục bộ trong trình duyệt). Không đăng nhập, không kiểm tra bản quyền, không gửi dữ liệu ra ngoài.
let dangTao = null;

async function bamOffscreen() {
  const co = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (co.length) return;
  if (!dangTao) {
    dangTao = chrome.offscreen
      .createDocument({
        url: "offscreen.html",
        reasons: ["WORKERS"],
        justification: "Đọc captcha bằng mô hình cục bộ",
      })
      .finally(function () {
        dangTao = null;
      });
  }
  await dangTao;
}

async function giaiPng(msg) {
  try {
    await bamOffscreen();
    const r = await chrome.runtime.sendMessage({
      loai: "offscreen_giai",
      cong: msg.cong,
      rgba: msg.rgba,
      w: msg.w,
      h: msg.h,
    });
    return r && r.ok ? { ok: true, ma: r.ma || "" } : { ok: false, loi: "chua_doc_duoc" };
  } catch (e) {
    return { ok: false, loi: "chua_doc_duoc" };
  }
}

chrome.runtime.onMessage.addListener(function (msg, gui, tra) {
  if (!msg) return false;
  if (msg.loai === "giai_png") {
    giaiPng(msg).then(tra);
    return true;
  }
  return false;
});
