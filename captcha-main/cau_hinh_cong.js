// Bảng cổng Thuế -> bộ chọn ô captcha / ảnh captcha (đo trên cổng thật 18/11/2026).
// loai "svg": giải ngay trong tiện ích (CAP1). loai "png": ảnh được đọc bằng mô hình ddddocr chạy ngay trong trình duyệt (offscreen document), không gửi ảnh ra ngoài (CAP2).
const CONG_THUE = [
  {
    hostname: "hoadondientu.gdt.gov.vn",
    ten: "Hóa đơn điện tử",
    loai: "svg",
    o: "input#cvalue",
    anh: "[class*='Captcha__ImageWrapper'] img",
    chuHoaThuong: "",
  },
  {
    hostname: "tracuunnt.gdt.gov.vn",
    cong: "tracuunnt",
    ten: "Tra cứu MST",
    loai: "png",
    o: "input#captcha",
    anh: "img[src*='captcha.png']",
    chuHoaThuong: "",
  },
  {
    hostname: "thuedientu.gdt.gov.vn",
    cong: "thuedientu",
    ten: "Thuế điện tử",
    loai: "png",
    o: "input#vcode",
    anh: "img#safecode",
    chuHoaThuong: "",
  },
  {
    hostname: "dichvucong.gdt.gov.vn",
    cong: "dichvucong",
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
    loai: "van_ban", // mã hiện bằng chữ trong trang, đọc thẳng văn bản của phần tử
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
    anh: "img.captchaImg, img#captchaCtn", // /home/ntl dùng img.captchaImg, /home/ckvb dùng img#captchaCtn
    chuHoaThuong: "",
  },
  {
    hostname: "hddt.bachhoaxanh.com",
    cong: "hddt_tgdd", // cùng hệ thống với hddt.thegioididong.com
    ten: "Hóa đơn Bách Hóa Xanh",
    loai: "png",
    o: "input#Captcha",
    anh: ".captcha_input img",
    chuHoaThuong: "hoa",
  },
  // ---- Trang tra cứu hóa đơn của các nhà cung cấp (NCC). Cặp /Captcha/Show 4 chữ số dùng chung kiểu "so4". ----
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
  // ---- Cổng tra cứu hóa đơn của ngân hàng (không phải internet banking) ----
  { hostname: "einvoice.abbank.vn", cong: "nh_thuong5", ten: "Hóa đơn ABBank", loai: "png", o: "input#vcode", anh: "img#safecode", chuHoaThuong: "thuong" },
  { hostname: "einvoice.publicbank.com.vn", cong: "nh_thuong5", ten: "Hóa đơn Public Bank Việt Nam", loai: "png", o: "input#vcode", anh: "img#safecode", chuHoaThuong: "thuong" },
  { hostname: "einvoice.eximbank.com.vn", cong: "nh_hoa5", ten: "Hóa đơn Eximbank", loai: "png", o: "input#CaptchaInputText", anh: "img#CaptchaImage", chuHoaThuong: "hoa" },
  { hostname: "einvoice.lpbank.com.vn", cong: "so4", ten: "Hóa đơn LPBank", loai: "png", o: "input#captch", anh: "img.captcha_img", chuHoaThuong: "" },
  { hostname: "einvoice.msb.com.vn", cong: "so4", ten: "Hóa đơn MSB", loai: "png", o: "input#captch", anh: "img.captcha_img", chuHoaThuong: "" },
  {
    hostname: "portal.woori.com.vn", cong: "so4", ten: "Hóa đơn Woori Bank", loai: "png",
    o: "form#Searchform input#captch", anh: "form#Searchform img.captcha_img",
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
    hostname: "vnpt-invoice.com.vn", // đuôi tên miền: <tên|MST>-tt78.vnpt-invoice.com.vn ... (xem HAU_TO_CONG)
    cong: "so4",
    ten: "VNPT Invoice (các tên miền con -tt78)",
    loai: "png",
    o: "form#Searchform input#captch",
    anh: "form#Searchform img.captcha_img",
    // Trang có 2 form: tra cứu (Searchform) và đăng nhập (IdLogOn), mỗi form một cặp ô + ảnh 4 chữ số.
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
    // Trang tra cứu có 3 tab, mỗi tab một cặp ô + ảnh (chỉ cặp đang hiển thị được điền).
    cap: [
      { o: "input#ipCaptchaB", anh: "img#imgcaptchaB" },
      { o: "input#captchaCode", anh: "img#imgcaptcha" },
      { o: "input#ipCaptchaPromotion", anh: "img#imgcaptchaPromotion" },
      // Trang tra cứu bản án (/dvc-tra-cuu-ban-an.html): 3 tab, mỗi tab một cặp.
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
    loai: "svg_chu", // ảnh SVG có mã nằm sẵn trong thẻ <text>
    o: "input#captcha-answer",
    anh: "img.lookup-form__builtin-captcha-image",
    chuHoaThuong: "",
  },
];

// Bỏ tiền tố "www." để customs.gov.vn và www.customs.gov.vn dùng chung một cấu hình / một cờ bật.
// Một số NCC cấp mỗi khách một tên miền con (vd <MST>-tt78.vnpt-invoice.com.vn): các tên miền con đó dùng chung
// một cấu hình / một cờ bật, khóa theo đuôi tên miền (HAU_TO_CONG). Tên miền có mục riêng (vd hst.vnpt-invoice.com.vn) ưu tiên trước.
const HAU_TO_CONG = ["vnpt-invoice.com.vn"];

function chuanHoaHost(hostname) {
  const h = String(hostname || "").toLowerCase().replace(/^www\./, "");
  if (CONG_THUE.some(function (c) { return c.hostname === h; })) return h;
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

// Phân nhóm hiển thị cho danh mục cổng: "thue_dvc" | "ngan_hang" | "hoa_don"
function nhomCong(c) {
  const h = String((c && c.hostname) || "").toLowerCase();
  if (/\.gov\.vn$|bhxh\.vnpost\.vn$/.test(h)) return "thue_dvc";
  if (/bank|bidv|msb|ncb|woori/.test(h)) return "ngan_hang";
  return "hoa_don";
}

if (typeof module !== "undefined") module.exports = { chuanHoaHost, timCauHinh, CONG_THUE, nhomCong };
