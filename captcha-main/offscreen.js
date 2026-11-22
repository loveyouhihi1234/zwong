// Offscreen document: chạy mô hình ddddocr (onnx) bằng onnxruntime-web (chỉ WASM, 1 luồng) NGAY trong trình duyệt.
// Chỉ đọc tệp trong thu_vien\ của tiện ích; KHÔNG gọi mạng. Không ghi mã captcha ra console.
let phien = null;
let phienDangNap = null;
let bangKyTu = null;

async function napMoHinh() {
  const goc = chrome.runtime.getURL("thu_vien/");
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = goc + "ort/";
  const [mh, ks] = await Promise.all([
    fetch(goc + "ddddocr_old.onnx").then(function (r) { return r.arrayBuffer(); }),
    fetch(goc + "charset.json").then(function (r) { return r.json(); }),
  ]);
  bangKyTu = ks;
  phien = await ort.InferenceSession.create(new Uint8Array(mh), { executionProviders: ["wasm"] });
}

function dam() {
  if (!phienDangNap) phienDangNap = napMoHinh().catch(function (e) { phienDangNap = null; throw e; });
  return phienDangNap;
}

async function giai(cong, rgba, w, h) {
  const t0 = performance.now();
  await dam();
  const t1 = performance.now();
  const r = QltPng.tienXuLy(cong, Uint8Array.from(rgba), w, h);
  const x = new ort.Tensor("float32", r.tensor, [1, 1, r.H, r.W]);
  const ra = await phien.run({ [phien.inputNames[0]]: x });
  const o = ra[phien.outputNames[0]];
  const chuoi = QltPng.giaiCTC(o.data, o.dims, bangKyTu);
  return { ok: true, ma: QltPng.hauXuLy(cong, chuoi), ms_nap: Math.round(t1 - t0), ms_doc: Math.round(performance.now() - t1) };
}

chrome.runtime.onMessage.addListener(function (msg, gui, tra) {
  if (!msg || msg.loai !== "offscreen_giai") return false; // tin khác (vd. giai_png tới background): bỏ qua
  giai(msg.cong, msg.rgba, msg.w, msg.h).then(tra, function (e) { tra({ ok: false, loi: "chua_doc_duoc" }); });
  return true;
});
