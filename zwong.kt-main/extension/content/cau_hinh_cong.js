// Bảng cấu hình 46 cổng Thuế, BHXH, Hải quan, DVCQG & Tra cứu hóa đơn NCC/Ngân hàng (đồng bộ từ captcha-main).
// loai "svg": HĐĐT (ưu tiên SVG mẫu -> SVG chữ ký -> ONNX).
// loai "png": đọc cục bộ bằng ddddocr_old.onnx trong offscreen document (không gửi ảnh ra ngoài).
// loai "van_ban" / "svg_chu": trích xuất trực tiếp mã chữ trên DOM / thẻ <text> của SVG.
(function (root) {
  const CONG_THUE = [
    {
      hostname: "hoadondientu.gdt.gov.vn",
      cong: "hddt",
      portalId: "hddt",
      ten: "Hóa đơn điện tử",
      loai: "svg",
      o: "input#cvalue",
      anh: "[class*='Captcha__ImageWrapper'] img",
      chuHoaThuong: "",
    },
    {
      hostname: "tracuunnt.gdt.gov.vn",
      cong: "tracuunnt",
      portalId: "tracuunnt",
      ten: "Tra cứu MST",
      loai: "png",
      o: "input#captcha",
      anh: "img[src*='captcha.png']",
      chuHoaThuong: "",
    },
    {
      hostname: "thuedientu.gdt.gov.vn",
      cong: "thuedientu",
      portalId: "tdt",
      ten: "Thuế điện tử",
      loai: "png",
      o: "input#vcode",
      anh: "img#safecode",
      chuHoaThuong: "",
    },
    {
      hostname: "dichvucong.gdt.gov.vn",
      cong: "dichvucong",
      portalId: "dvc",
      ten: "Dịch vụ công",
      loai: "png",
      o: "input[name=captcha]",
      anh: "img#image-capt",
      cap: [
        { o: "input[name=captcha]", anh: "img#image-capt" },
        { o: "input[name=captchaCbt]", anh: "img#image-capt-cbt" },
      ],
      chuHoaThuong: "",
    },
    {
      hostname: "baohiemxahoi.gov.vn",
      cong: "bhxh",
      ten: "Bảo hiểm xã hội",
      loai: "png",
      o: "input#tokenRecaptch",
      anh: "img#imgCaptcha",
      chuHoaThuong: "hoa",
    },
    {
      hostname: "dichvucong.baohiemxahoi.gov.vn",
      cong: "dvc_bhxh",
      ten: "Dịch vụ công bảo hiểm xã hội",
      loai: "png",
      o: "input[placeholder='Nhập mã kiểm tra']",
      anh: ".captcha-img img",
      chuHoaThuong: "hoa",
    },
    {
      hostname: "customs.gov.vn",
      cong: "hai_quan",
      ten: "Hải quan (tra cứu nợ thuế)",
      loai: "png",
      o: "input#check-input",
      anh: "#mainCaptcha img",
      chuHoaThuong: "",
    },
    {
      hostname: "epayment.customs.gov.vn",
      cong: "hq_nop_thue",
      ten: "Hải quan (nộp thuế)",
      loai: "png",
      o: "input#captchaCode",
      anh: ".validationDiv img",
      chuHoaThuong: "",
    },
    {
      hostname: "bhxh.vnpost.vn",
      cong: "vnpost_bhxh",
      ten: "VNPost BHXH",
      loai: "van_ban",
      o: "input#Captcha",
      anh: "#Captcha_bot",
      chuHoaThuong: "",
    },
    {
      hostname: "gdt.gov.vn",
      cong: "gdt_ntl",
      ten: "Cục Thuế (nợ thuế · văn bản NNT)",
      loai: "png",
      o: "input[name=captcha]",
      anh: "img.captchaImg, img#captchaCtn",
      chuHoaThuong: "",
    },
    {
      hostname: "hddt.bachhoaxanh.com",
      cong: "hddt_tgdd",
      ten: "Hóa đơn Bách Hóa Xanh",
      loai: "png",
      o: "input#Captcha",
      anh: ".captcha_input img",
      chuHoaThuong: "hoa",
    },
    { hostname: "hoadondientu.thaco.com.vn", cong: "so4", ten: "Hóa đơn Thaco", loai: "png", o: "input#CaptchaInputText", anh: "img#CaptchaImage", chuHoaThuong: "" },
    { hostname: "hoadon.pvoil.vn", cong: "so4", ten: "Hóa đơn PVOIL", loai: "png", o: "input#CaptchaInputText", anh: "img#CaptchaImage", chuHoaThuong: "" },
    { hostname: "einvoice78.suntorypepsico.vn", cong: "so4", ten: "Hóa đơn Pepsi (Suntory)", loai: "png", o: "input#CaptchaInputText", anh: "img#CaptchaImage", chuHoaThuong: "" },
    { hostname: "invoice.idemitsuq8.com.vn", cong: "so4", ten: "Hóa đơn Idemitsu Q8", loai: "png", o: "input#captch", anh: "img.captcha_img", chuHoaThuong: "" },
    { hostname: "tracuu.vinvoice.vn", cong: "so4", ten: "Hóa đơn V-Invoice (Megabiz)", loai: "png", o: "input#CaptchaInputText", anh: "img#CaptchaImage", chuHoaThuong: "" },
    { hostname: "einvoice.bidv.com.vn", cong: "so4", ten: "Hóa đơn BIDV", loai: "png", o: "input#captch", anh: "img.captcha_img", chuHoaThuong: "" },
    { hostname: "hoadondientu.ezrx.com.vn", cong: "so4", ten: "Hóa đơn EZRX", loai: "png", o: "input#CaptchaInputText", anh: "img#CaptchaImage", chuHoaThuong: "" },
    { hostname: "e-invoice-tt78.vingroup.net", cong: "so4", ten: "Hóa đơn Vingroup / VinFast", loai: "png", o: "input#captch", anh: "img.captcha_img", chuHoaThuong: "" },
    { hostname: "hoadon.petrolimex.com.vn", cong: "so4", ten: "Hóa đơn Petrolimex", loai: "png", o: "input#captch", anh: "img.captcha_img", chuHoaThuong: "" },
    { hostname: "abcsys.vn", cong: "so6", ten: "Hóa đơn ABC-Sys (HACOM)", loai: "png", o: "input#txtCapChar", anh: "img[src*='ShowCaptchaImage']", chuHoaThuong: "" },
    { hostname: "tracuuhd.smartsign.com.vn", cong: "smartsign", ten: "Hóa đơn SmartVina", loai: "png", o: "input#ContentPlaceHolder1_txtCapcha", anh: "img#ContentPlaceHolder1_Image1", chuHoaThuong: "thuong" },
    { hostname: "spv.tracuuhoadon.online", cong: "spv_shopee", ten: "Hóa đơn Shopee (SPV)", loai: "png", o: "input#capcha", anh: "img#capcha-img", chuHoaThuong: "" },
    { hostname: "hoadon.ftg.vn", cong: "einvoice_vn", ten: "Hóa đơn Synnex FPT (FTG)", loai: "png", o: "input#CaptchaInputText", anh: "img#CaptchaImage", chuHoaThuong: "hoa" },
    { hostname: "einvoice.vn", cong: "einvoice_vn", ten: "Hóa đơn Thái Sơn (einvoice.vn)", loai: "png", o: "input#CaptchaInputText", anh: "img#CaptchaImage", chuHoaThuong: "hoa" },
    { hostname: "tracuu.v50.vninvoice.vn", cong: "vninvoice_v50", ten: "Hóa đơn VN-Invoice v50", loai: "png", o: "input[placeholder='Nhập mã xác thực']", anh: "img[alt=captcha]", chuHoaThuong: "" },
    { hostname: "einvoice.abbank.vn", cong: "nh_thuong5", ten: "Hóa đơn ABBank", loai: "png", o: "input#vcode", anh: "img#safecode", chuHoaThuong: "thuong" },
    { hostname: "einvoice.publicbank.com.vn", cong: "nh_thuong5", ten: "Hóa đơn Public Bank Việt Nam", loai: "png", o: "input#vcode", anh: "img#safecode", chuHoaThuong: "thuong" },
    { hostname: "einvoice.eximbank.com.vn", cong: "nh_hoa5", ten: "Hóa đơn Eximbank", loai: "png", o: "input#CaptchaInputText", anh: "img#CaptchaImage", chuHoaThuong: "hoa" },
    { hostname: "einvoice.lpbank.com.vn", cong: "so4", ten: "Hóa đơn LPBank", loai: "png", o: "input#captch", anh: "img.captcha_img", chuHoaThuong: "" },
    { hostname: "einvoice.msb.com.vn", cong: "so4", ten: "Hóa đơn MSB", loai: "png", o: "input#captch", anh: "img.captcha_img", chuHoaThuong: "" },
    {
      hostname: "portal.woori.com.vn",
      cong: "so4",
      ten: "Hóa đơn Woori Bank",
      loai: "png",
      o: "form#Searchform input#captch",
      anh: "form#Searchform img.captcha_img",
      cap: [
        { o: "form#Searchform input#captch", anh: "form#Searchform img.captcha_img" },
        { o: "form#IdLogOn input#captch", anh: "form#IdLogOn img.captcha_img" },
      ],
      chuHoaThuong: "",
    },
    { hostname: "einvoice.vpbank.com.vn", cong: "vpbank", ten: "Hóa đơn VPBank", loai: "png", o: "input#jCaptcha", anh: "img#jCaptchaImg", chuHoaThuong: "" },
    { hostname: "hoadondientu.agribank.com.vn", cong: "vninvoice_v50", ten: "Hóa đơn Agribank (VN-Invoice)", loai: "png", o: "input[placeholder='Nhập mã xác thực']", anh: "img[alt=captcha]", chuHoaThuong: "" },
    { hostname: "hoadondientu.techcombank.com.vn", cong: "nh_hoa5", ten: "Hóa đơn Techcombank", loai: "png", o: "input#txtCaptchaData", anh: "img#captchaElement", chuHoaThuong: "hoa" },
    { hostname: "ncb-bank.vn", cong: "so4", ten: "Hóa đơn NCB", loai: "png", o: "input#captch", anh: "img[src*='Captcha/Show']", chuHoaThuong: "" },
    { hostname: "tracuuhoadon.pgbank.com.vn", cong: "vninvoice_v50", ten: "Hóa đơn PGBank (VN-Invoice)", loai: "png", o: "input[placeholder='Nhập mã xác thực']", anh: "img[alt=captcha]", chuHoaThuong: "" },
    { hostname: "einvoice.vietcombank.com.vn", cong: "vninvoice_v50", ten: "Hóa đơn Vietcombank (VN-Invoice)", loai: "png", o: "input[placeholder='Nhập mã xác thực']", anh: "img[alt=captcha]", chuHoaThuong: "" },
    { hostname: "tracuuonline78.ngogiaphat.vn", cong: "ngogiaphat", ten: "Hóa đơn Ngô Gia Phát", loai: "png", o: "input#ASPxCaptcha_search_TB_I", anh: "img#ASPxCaptcha_search_IMG", chuHoaThuong: "thuong" },
    {
      hostname: "hddt.thegioididong.com",
      cong: "hddt_tgdd",
      ten: "Hóa đơn Thế Giới Di Động",
      loai: "png",
      o: "input#Captcha",
      anh: ".captcha_input img",
      chuHoaThuong: "hoa",
    },
    {
      hostname: "vnpt-invoice.com.vn",
      cong: "so4",
      ten: "VNPT Invoice (các tên miền con -tt78)",
      loai: "png",
      o: "form#Searchform input#captch",
      anh: "form#Searchform img.captcha_img",
      cap: [
        { o: "form#Searchform input#captch", anh: "form#Searchform img.captcha_img" },
        { o: "form#IdLogOn input#captch", anh: "form#IdLogOn img.captcha_img" },
      ],
      chuHoaThuong: "",
    },
    { hostname: "vdsg-invoice.vn", cong: "vdsg", ten: "Hóa đơn VDSG (BotDetect)", loai: "png", o: "input#captch", anh: "img#ExampleCaptcha_CaptchaImage", chuHoaThuong: "hoa" },
    {
      hostname: "hst.vnpt-invoice.com.vn",
      cong: "vnpt_invoice",
      ten: "VNPT Invoice (HST)",
      loai: "png",
      o: "input[formcontrolname='captcha']",
      anh: "img#captcha",
      chuHoaThuong: "",
    },
    {
      hostname: "vpcp.dichvucong.gov.vn",
      cong: "dvcqg",
      ten: "Cổng Dịch vụ công Quốc gia (tra cứu hồ sơ)",
      loai: "png",
      o: "input#ipCaptchaB",
      anh: "img#imgcaptchaB",
      cap: [
        { o: "input#ipCaptchaB", anh: "img#imgcaptchaB" },
        { o: "input#captchaCode", anh: "img#imgcaptcha" },
        { o: "input#ipCaptchaPromotion", anh: "img#imgcaptchaPromotion" },
        { o: "input#inputBA_CAPTCHA", anh: "img#imgBA_CAPTCHA" },
        { o: "input#inputNQHD_CAPTCHA", anh: "img#imgNQHD_CAPTCHA" },
        { o: "input#inputAL_CAPTCHA", anh: "img#imgAL_CAPTCHA" },
      ],
      chuHoaThuong: "thuong",
    },
    {
      hostname: "canhan.gdt.gov.vn",
      cong: "canhan",
      ten: "Thuế điện tử cá nhân",
      loai: "png",
      o: "input#capcha",
      anh: "img#safecode",
      chuHoaThuong: "hoa",
    },
    {
      hostname: "congkhaithongtin.gdt.gov.vn",
      cong: "cong_khai_nnt",
      ten: "Công khai thông tin NNT",
      loai: "svg_chu",
      o: "input#captcha-answer",
      anh: "img.lookup-form__builtin-captcha-image",
      chuHoaThuong: "",
    },
  ];

  const HAU_TO_CONG = ["vnpt-invoice.com.vn"];

  function chuanHoaHost(hostname) {
    const h = String(hostname || "").toLowerCase().replace(/^www\./, "");
    if (CONG_THUE.some((c) => c.hostname === h)) return h;
    for (const hauTo of HAU_TO_CONG) {
      if (h.endsWith("." + hauTo)) return hauTo;
    }
    return h;
  }

  function timCauHinh(hostname) {
    const h = chuanHoaHost(hostname);
    for (const c of CONG_THUE) {
      if (c.hostname === h) return c;
    }
    return null;
  }

  // Phân nhóm hiển thị: "thue_dvc" | "ngan_hang" | "hoa_don"
  function nhomCong(c) {
    const h = String((c && c.hostname) || "").toLowerCase();
    if (/\.gov\.vn$|bhxh\.vnpost\.vn$/.test(h)) return "thue_dvc";
    if (/bank|bidv|msb|ncb|woori/.test(h)) return "ngan_hang";
    return "hoa_don";
  }

  // Khóa bật/tắt trong settings.portals: 4 cổng chính giữ khóa riêng, 39 cổng mở rộng gom theo 3 nhóm
  function nhomBatTat(c) {
    if (!c) return "ext_invoice";
    if (c.portalId) return c.portalId;
    const nhom = nhomCong(c);
    if (nhom === "thue_dvc") return "ext_gov";
    if (nhom === "ngan_hang") return "ext_bank";
    return "ext_invoice";
  }

  root.CONG_THUE = CONG_THUE;
  root.chuanHoaHost = chuanHoaHost;
  root.timCauHinh = timCauHinh;
  root.nhomCong = nhomCong;
  root.nhomBatTat = nhomBatTat;
  if (typeof module !== "undefined") {
    module.exports = { CONG_THUE, chuanHoaHost, timCauHinh, nhomCong, nhomBatTat };
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
