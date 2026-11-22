// Cấu hình mặc định của TaxCap Extension (giải captcha cục bộ 100% bằng SVG + ONNX WASM, không gọi Gemini).
self.TAXCAP_DEFAULTS = {
  solverMode: "local-onnx",
  licenseApiUrl: "",
  enabled: true,
  pausedUntil: 0,
  portals: {
    hddt: true,
    tdt: true,
    dvc: true,
    tracuunnt: true,
    ext_gov: true,
    ext_bank: true,
    ext_invoice: true
  }
};
