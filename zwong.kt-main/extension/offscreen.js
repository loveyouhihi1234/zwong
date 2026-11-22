// Offscreen document: chạy mô hình ddddocr_old.onnx bằng onnxruntime-web (WASM 1 luồng) cục bộ trong trình duyệt.
// Chỉ đọc tệp nội bộ trong thu_vien/; không gọi mạng, không gửi ảnh ra ngoài.
let phien = null;
let phienDangNap = null;
let bangKyTu = null;
let lanNapMs = 0;

async function napMoHinh() {
  const t0 = performance.now();
  const goc = chrome.runtime.getURL("thu_vien/");
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = goc + "ort/";
  ort.env.logLevel = "error";
  const [mh, ks] = await Promise.all([
    fetch(goc + "ddddocr_old.onnx").then((r) => {
      if (!r.ok) throw new Error("Không tìm thấy tệp thu_vien/ddddocr_old.onnx");
      return r.arrayBuffer();
    }),
    fetch(goc + "charset.json").then((r) => {
      if (!r.ok) throw new Error("Không tìm thấy tệp thu_vien/charset.json");
      return r.json();
    }),
  ]);
  bangKyTu = ks;
  phien = await ort.InferenceSession.create(new Uint8Array(mh), {
    executionProviders: ["wasm"],
    logSeverityLevel: 3,
  });
  lanNapMs = Math.round(performance.now() - t0);
}

function damBaoMoHinh() {
  if (phien && bangKyTu) return Promise.resolve();
  if (!phienDangNap) {
    phienDangNap = napMoHinh().catch((e) => {
      phienDangNap = null;
      throw e;
    });
  }
  return phienDangNap;
}

async function giai(cong, rgba, w, h) {
  const t0 = performance.now();
  await damBaoMoHinh();
  const t1 = performance.now();
  const r = QltPng.tienXuLy(cong, Uint8Array.from(rgba), w, h);
  const x = new ort.Tensor("float32", r.tensor, [1, 1, r.H, r.W]);
  const ra = await phien.run({ [phien.inputNames[0]]: x });
  const o = ra[phien.outputNames[0]];
  const chuoi = QltPng.giaiCTC(o.data, o.dims, bangKyTu);
  return {
    ok: true,
    ma: QltPng.hauXuLy(cong, chuoi),
    rawText: chuoi,
    ms_nap: Math.round(t1 - t0),
    ms_doc: Math.round(performance.now() - t1),
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return false;
  if (msg.loai === "offscreen_ping") {
    damBaoMoHinh().then(
      () =>
        sendResponse({
          ok: true,
          ms_nap: lanNapMs,
          charsetSize: Array.isArray(bangKyTu) ? bangKyTu.length : 0,
        }),
      (e) =>
        sendResponse({
          ok: false,
          message: e?.message || "Không nạp được mô hình ONNX cục bộ",
        }),
    );
    return true;
  }
  if (msg.loai === "offscreen_giai") {
    giai(msg.cong, msg.rgba, msg.w, msg.h).then(
      sendResponse,
      (e) =>
        sendResponse({
          ok: false,
          loi: "chua_doc_duoc",
          message: e?.message || "Không đọc được captcha bằng ONNX",
        }),
    );
    return true;
  }
  return false;
});
