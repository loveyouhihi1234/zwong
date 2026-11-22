export type PortalGroupId = 'main' | 'ext_gov' | 'ext_bank' | 'ext_invoice';
export type PortalSolverKind = 'svg-3tier' | 'onnx' | 'text' | 'svg-text';

export interface CatalogPortalItem {
  hostname: string;
  cong: string;
  portalId?: 'hddt' | 'tdt' | 'dvc' | 'tracuunnt';
  name: string;
  group: PortalGroupId;
  solverKind: PortalSolverKind;
  imgSelector: string;
  inputSelector: string;
  pairCount: number;
  caseMode: '' | 'hoa' | 'thuong';
  notes: string;
}

export const ALL_PORTALS: CatalogPortalItem[] = [
  // 4 cổng Thuế & DVC chính
  {
    hostname: 'hoadondientu.gdt.gov.vn',
    cong: 'hddt',
    portalId: 'hddt',
    name: 'Hóa đơn điện tử (Tổng cục Thuế)',
    group: 'main',
    solverKind: 'svg-3tier',
    imgSelector: 'img[alt="captcha"], [class*="Captcha__ImageWrapper"] img',
    inputSelector: 'input[id="cvalue"], input[id$="_cvalue"], input[name="cvalue"]',
    pairCount: 1,
    caseMode: '',
    notes: 'Ưu tiên 3 tầng cục bộ: SVG mẫu (<5ms) → SVG chữ ký nét M/Q/Z → ONNX (ddddocr_old.onnx).',
  },
  {
    hostname: 'thuedientu.gdt.gov.vn',
    cong: 'thuedientu',
    portalId: 'tdt',
    name: 'Thuế điện tử (eTax NNT)',
    group: 'main',
    solverKind: 'onnx',
    imgSelector: 'img#safecode',
    inputSelector: 'input#vcode',
    pairCount: 1,
    caseMode: '',
    notes: 'Đọc pixel RGBA trực tiếp từ DOM → tiền xử lý LANCZOS 64px → ONNX cục bộ (5 ký tự chữ và số).',
  },
  {
    hostname: 'dichvucong.gdt.gov.vn',
    cong: 'dichvucong',
    portalId: 'dvc',
    name: 'Dịch vụ công Thuế (TTHC)',
    group: 'main',
    solverKind: 'onnx',
    imgSelector: 'img#image-capt, img#image-capt-cbt',
    inputSelector: 'input[name="captcha"], input[name="captchaCbt"]',
    pairCount: 2,
    caseMode: '',
    notes: 'Hỗ trợ 2 form đăng nhập NNT & CBT song song, chỉ điền cặp đang hiển thị (ONNX cục bộ, 5 ký tự).',
  },
  {
    hostname: 'tracuunnt.gdt.gov.vn',
    cong: 'tracuunnt',
    portalId: 'tracuunnt',
    name: 'Tra cứu Người nộp thuế',
    group: 'main',
    solverKind: 'onnx',
    imgSelector: 'img[src*="captcha.png"]',
    inputSelector: 'input#captcha, input[name="captcha"]',
    pairCount: 1,
    caseMode: '',
    notes: 'Ghép nền trắng cho PNG trong suốt trước khi giải ONNX cục bộ (5 ký tự chữ thường + số).',
  },

  // Nhóm mở rộng 1: Thuế · BHXH · Hải quan · DVCQG (9 cổng)
  {
    hostname: 'baohiemxahoi.gov.vn',
    cong: 'bhxh',
    name: 'Bảo hiểm xã hội Việt Nam',
    group: 'ext_gov',
    solverKind: 'onnx',
    imgSelector: 'img#imgCaptcha',
    inputSelector: 'input#tokenRecaptch',
    pairCount: 1,
    caseMode: 'hoa',
    notes: 'ONNX cục bộ, hậu xử lý 5 ký tự chữ hoa + số.',
  },
  {
    hostname: 'dichvucong.baohiemxahoi.gov.vn',
    cong: 'dvc_bhxh',
    name: 'Dịch vụ công Bảo hiểm xã hội',
    group: 'ext_gov',
    solverKind: 'onnx',
    imgSelector: '.captcha-img img',
    inputSelector: "input[placeholder='Nhập mã kiểm tra']",
    pairCount: 1,
    caseMode: 'hoa',
    notes: 'ONNX cục bộ, hậu xử lý 4 ký tự chữ hoa + số.',
  },
  {
    hostname: 'customs.gov.vn',
    cong: 'hai_quan',
    name: 'Hải quan (Tra cứu nợ thuế)',
    group: 'ext_gov',
    solverKind: 'onnx',
    imgSelector: '#mainCaptcha img',
    inputSelector: 'input#check-input',
    pairCount: 1,
    caseMode: '',
    notes: 'Hỗ trợ cả www.customs.gov.vn — ONNX cục bộ, 5 ký tự chữ và số.',
  },
  {
    hostname: 'epayment.customs.gov.vn',
    cong: 'hq_nop_thue',
    name: 'Hải quan (Nộp thuế điện tử)',
    group: 'ext_gov',
    solverKind: 'onnx',
    imgSelector: '.validationDiv img',
    inputSelector: 'input#captchaCode',
    pairCount: 1,
    caseMode: '',
    notes: 'ONNX cục bộ, 4 ký tự chữ và số.',
  },
  {
    hostname: 'bhxh.vnpost.vn',
    cong: 'vnpost_bhxh',
    name: 'VNPost BHXH',
    group: 'ext_gov',
    solverKind: 'text',
    imgSelector: '#Captcha_bot',
    inputSelector: 'input#Captcha',
    pairCount: 1,
    caseMode: '',
    notes: 'Đọc trực tiếp mã văn bản trong DOM (#Captcha_bot), tức thì <1ms.',
  },
  {
    hostname: 'gdt.gov.vn',
    cong: 'gdt_ntl',
    name: 'Cục Thuế (Nợ thuế · Văn bản NNT)',
    group: 'ext_gov',
    solverKind: 'onnx',
    imgSelector: 'img.captchaImg, img#captchaCtn',
    inputSelector: 'input[name=captcha]',
    pairCount: 1,
    caseMode: '',
    notes: 'Hỗ trợ cả www.gdt.gov.vn — ghép nền trắng PNG trong suốt → ONNX cục bộ (5 ký tự).',
  },
  {
    hostname: 'vpcp.dichvucong.gov.vn',
    cong: 'dvcqg',
    name: 'Cổng Dịch vụ công Quốc gia (Tra cứu hồ sơ)',
    group: 'ext_gov',
    solverKind: 'onnx',
    imgSelector: 'img#imgcaptchaB (+ 5 cặp dự phòng)',
    inputSelector: 'input#ipCaptchaB (+ 5 ô dự phòng)',
    pairCount: 6,
    caseMode: 'thuong',
    notes: 'Tự động khớp cả 6 biểu mẫu tra cứu hồ sơ & khuyến mãi — ONNX cục bộ (4 ký tự chữ thường + số).',
  },
  {
    hostname: 'canhan.gdt.gov.vn',
    cong: 'canhan',
    name: 'Thuế điện tử cá nhân',
    group: 'ext_gov',
    solverKind: 'onnx',
    imgSelector: 'img#safecode',
    inputSelector: 'input#capcha',
    pairCount: 1,
    caseMode: 'hoa',
    notes: 'ONNX cục bộ, 4 ký tự chữ hoa + số.',
  },
  {
    hostname: 'congkhaithongtin.gdt.gov.vn',
    cong: 'cong_khai_nnt',
    name: 'Công khai thông tin NNT',
    group: 'ext_gov',
    solverKind: 'svg-text',
    imgSelector: 'img.lookup-form__builtin-captcha-image',
    inputSelector: 'input#captcha-answer',
    pairCount: 1,
    caseMode: '',
    notes: 'Trích xuất trực tiếp thẻ <text> trong SVG nhúng, tức thì <1ms.',
  },

  // Nhóm mở rộng 2: Hóa đơn Ngân hàng (13 cổng)
  { hostname: 'einvoice.bidv.com.vn', cong: 'so4', name: 'Hóa đơn BIDV', group: 'ext_bank', solverKind: 'onnx', imgSelector: 'img.captcha_img', inputSelector: 'input#captch', pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 4 chữ số.' },
  { hostname: 'einvoice.abbank.vn', cong: 'nh_thuong5', name: 'Hóa đơn ABBank', group: 'ext_bank', solverKind: 'onnx', imgSelector: 'img#safecode', inputSelector: 'input#vcode', pairCount: 1, caseMode: 'thuong', notes: 'ONNX cục bộ — 5 ký tự chữ thường + số.' },
  { hostname: 'einvoice.publicbank.com.vn', cong: 'nh_thuong5', name: 'Hóa đơn Public Bank Việt Nam', group: 'ext_bank', solverKind: 'onnx', imgSelector: 'img#safecode', inputSelector: 'input#vcode', pairCount: 1, caseMode: 'thuong', notes: 'ONNX cục bộ — 5 ký tự chữ thường + số.' },
  { hostname: 'einvoice.eximbank.com.vn', cong: 'nh_hoa5', name: 'Hóa đơn Eximbank', group: 'ext_bank', solverKind: 'onnx', imgSelector: 'img#CaptchaImage', inputSelector: 'input#CaptchaInputText', pairCount: 1, caseMode: 'hoa', notes: 'ONNX cục bộ — 5 ký tự chữ hoa + số.' },
  { hostname: 'einvoice.lpbank.com.vn', cong: 'so4', name: 'Hóa đơn LPBank', group: 'ext_bank', solverKind: 'onnx', imgSelector: 'img.captcha_img', inputSelector: 'input#captch', pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 4 chữ số.' },
  { hostname: 'einvoice.msb.com.vn', cong: 'so4', name: 'Hóa đơn MSB', group: 'ext_bank', solverKind: 'onnx', imgSelector: 'img.captcha_img', inputSelector: 'input#captch', pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 4 chữ số.' },
  { hostname: 'portal.woori.com.vn', cong: 'so4', name: 'Hóa đơn Woori Bank', group: 'ext_bank', solverKind: 'onnx', imgSelector: 'form#Searchform / #IdLogOn img.captcha_img', inputSelector: 'input#captch', pairCount: 2, caseMode: '', notes: 'Hỗ trợ cả form tra cứu & đăng nhập — ONNX cục bộ (4 chữ số).' },
  { hostname: 'einvoice.vpbank.com.vn', cong: 'vpbank', name: 'Hóa đơn VPBank', group: 'ext_bank', solverKind: 'onnx', imgSelector: 'img#jCaptchaImg', inputSelector: 'input#jCaptcha', pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 6 chữ số.' },
  { hostname: 'hoadondientu.agribank.com.vn', cong: 'vninvoice_v50', name: 'Hóa đơn Agribank (VN-Invoice)', group: 'ext_bank', solverKind: 'onnx', imgSelector: 'img[alt=captcha]', inputSelector: "input[placeholder='Nhập mã xác thực']", pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 6 ký tự chữ và số.' },
  { hostname: 'hoadondientu.techcombank.com.vn', cong: 'nh_hoa5', name: 'Hóa đơn Techcombank', group: 'ext_bank', solverKind: 'onnx', imgSelector: 'img#captchaElement', inputSelector: 'input#txtCaptchaData', pairCount: 1, caseMode: 'hoa', notes: 'ONNX cục bộ — 5 ký tự chữ hoa + số.' },
  { hostname: 'ncb-bank.vn', cong: 'so4', name: 'Hóa đơn NCB', group: 'ext_bank', solverKind: 'onnx', imgSelector: "img[src*='Captcha/Show']", inputSelector: 'input#captch', pairCount: 1, caseMode: '', notes: 'Hỗ trợ cả www.ncb-bank.vn — ONNX cục bộ (4 chữ số).' },
  { hostname: 'tracuuhoadon.pgbank.com.vn', cong: 'vninvoice_v50', name: 'Hóa đơn PGBank (VN-Invoice)', group: 'ext_bank', solverKind: 'onnx', imgSelector: 'img[alt=captcha]', inputSelector: "input[placeholder='Nhập mã xác thực']", pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 6 ký tự chữ và số.' },
  { hostname: 'einvoice.vietcombank.com.vn', cong: 'vninvoice_v50', name: 'Hóa đơn Vietcombank (VN-Invoice)', group: 'ext_bank', solverKind: 'onnx', imgSelector: 'img[alt=captcha]', inputSelector: "input[placeholder='Nhập mã xác thực']", pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 6 ký tự chữ và số.' },

  // Nhóm mở rộng 3: Tra cứu Hóa đơn NCC & Doanh nghiệp (20 cổng)
  { hostname: 'hddt.bachhoaxanh.com', cong: 'hddt_tgdd', name: 'Hóa đơn Bách Hóa Xanh', group: 'ext_invoice', solverKind: 'onnx', imgSelector: '.captcha_input img', inputSelector: 'input#Captcha', pairCount: 1, caseMode: 'hoa', notes: 'Cắt sát viền chữ + ONNX cục bộ — 6 ký tự chữ hoa + số.' },
  { hostname: 'hddt.thegioididong.com', cong: 'hddt_tgdd', name: 'Hóa đơn Thế Giới Di Động', group: 'ext_invoice', solverKind: 'onnx', imgSelector: '.captcha_input img', inputSelector: 'input#Captcha', pairCount: 1, caseMode: 'hoa', notes: 'Cắt sát viền chữ + ONNX cục bộ — 6 ký tự chữ hoa + số.' },
  { hostname: 'hoadondientu.thaco.com.vn', cong: 'so4', name: 'Hóa đơn Thaco', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img#CaptchaImage', inputSelector: 'input#CaptchaInputText', pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 4 chữ số.' },
  { hostname: 'hoadon.pvoil.vn', cong: 'so4', name: 'Hóa đơn PVOIL', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img#CaptchaImage', inputSelector: 'input#CaptchaInputText', pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 4 chữ số.' },
  { hostname: 'einvoice78.suntorypepsico.vn', cong: 'so4', name: 'Hóa đơn Pepsi (Suntory)', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img#CaptchaImage', inputSelector: 'input#CaptchaInputText', pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 4 chữ số.' },
  { hostname: 'invoice.idemitsuq8.com.vn', cong: 'so4', name: 'Hóa đơn Idemitsu Q8', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img.captcha_img', inputSelector: 'input#captch', pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 4 chữ số.' },
  { hostname: 'tracuu.vinvoice.vn', cong: 'so4', name: 'Hóa đơn V-Invoice (Megabiz)', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img#CaptchaImage', inputSelector: 'input#CaptchaInputText', pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 4 chữ số.' },
  { hostname: 'hoadondientu.ezrx.com.vn', cong: 'so4', name: 'Hóa đơn EZRX', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img#CaptchaImage', inputSelector: 'input#CaptchaInputText', pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 4 chữ số.' },
  { hostname: 'e-invoice-tt78.vingroup.net', cong: 'so4', name: 'Hóa đơn Vingroup / VinFast', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img.captcha_img', inputSelector: 'input#captch', pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 4 chữ số.' },
  { hostname: 'hoadon.petrolimex.com.vn', cong: 'so4', name: 'Hóa đơn Petrolimex', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img.captcha_img', inputSelector: 'input#captch', pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 4 chữ số.' },
  { hostname: 'abcsys.vn', cong: 'so6', name: 'Hóa đơn ABC-Sys (HACOM)', group: 'ext_invoice', solverKind: 'onnx', imgSelector: "img[src*='ShowCaptchaImage']", inputSelector: 'input#txtCapChar', pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 6 chữ số.' },
  { hostname: 'tracuuhd.smartsign.com.vn', cong: 'smartsign', name: 'Hóa đơn SmartVina', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img#ContentPlaceHolder1_Image1', inputSelector: 'input#ContentPlaceHolder1_txtCapcha', pairCount: 1, caseMode: 'thuong', notes: 'ONNX cục bộ — 6 ký tự chữ thường + số.' },
  { hostname: 'spv.tracuuhoadon.online', cong: 'spv_shopee', name: 'Hóa đơn Shopee (SPV)', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img#capcha-img', inputSelector: 'input#capcha', pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 4 ký tự chữ và số.' },
  { hostname: 'hoadon.ftg.vn', cong: 'einvoice_vn', name: 'Hóa đơn Synnex FPT (FTG)', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img#CaptchaImage', inputSelector: 'input#CaptchaInputText', pairCount: 1, caseMode: 'hoa', notes: 'Ghép nền trắng + ONNX cục bộ — 5 ký tự chữ hoa.' },
  { hostname: 'einvoice.vn', cong: 'einvoice_vn', name: 'Hóa đơn Thái Sơn (einvoice.vn)', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img#CaptchaImage', inputSelector: 'input#CaptchaInputText', pairCount: 1, caseMode: 'hoa', notes: 'Ghép nền trắng + ONNX cục bộ — 5 ký tự chữ hoa.' },
  { hostname: 'tracuu.v50.vninvoice.vn', cong: 'vninvoice_v50', name: 'Hóa đơn VN-Invoice v50', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img[alt=captcha]', inputSelector: "input[placeholder='Nhập mã xác thực']", pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 6 ký tự chữ và số.' },
  { hostname: 'tracuuonline78.ngogiaphat.vn', cong: 'ngogiaphat', name: 'Hóa đơn Ngô Gia Phát', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img#ASPxCaptcha_search_IMG', inputSelector: 'input#ASPxCaptcha_search_TB_I', pairCount: 1, caseMode: 'thuong', notes: 'Đảo màu nền đen + ONNX cục bộ — 5 ký tự chữ thường + số.' },
  { hostname: 'vnpt-invoice.com.vn', cong: 'so4', name: 'VNPT Invoice (tất cả tên miền con *.vnpt-invoice.com.vn)', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'form#Searchform / #IdLogOn img.captcha_img', inputSelector: 'input#captch', pairCount: 2, caseMode: '', notes: 'Áp dụng cho mọi tên miền con -tt78.vnpt-invoice.com.vn — ONNX cục bộ (4 chữ số).' },
  { hostname: 'vdsg-invoice.vn', cong: 'vdsg', name: 'Hóa đơn VDSG (BotDetect)', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img#ExampleCaptcha_CaptchaImage', inputSelector: 'input#captch', pairCount: 1, caseMode: 'hoa', notes: 'ONNX cục bộ — 4 ký tự chữ hoa + số.' },
  { hostname: 'hst.vnpt-invoice.com.vn', cong: 'vnpt_invoice', name: 'VNPT Invoice (HST)', group: 'ext_invoice', solverKind: 'onnx', imgSelector: 'img#captcha', inputSelector: "input[formcontrolname='captcha']", pairCount: 1, caseMode: '', notes: 'ONNX cục bộ — 6 chữ số.' },
];

export const PORTAL_GROUP_LABELS: Record<PortalGroupId, string> = {
  main: '4 cổng Thuế chính',
  ext_gov: 'Thuế · BHXH · HQ · DVCQG',
  ext_bank: 'Ngân hàng',
  ext_invoice: 'NCC Hóa đơn',
};

export function getPortalGroupCounts(): Record<PortalGroupId | 'all', number> {
  const counts: Record<PortalGroupId | 'all', number> = {
    all: ALL_PORTALS.length,
    main: 0,
    ext_gov: 0,
    ext_bank: 0,
    ext_invoice: 0,
  };
  for (const item of ALL_PORTALS) {
    counts[item.group] += 1;
  }
  return counts;
}

export function getPortalDisplayName(codeOrId: string): string {
  if (codeOrId === 'hddt') return 'HĐĐT';
  if (codeOrId === 'tdt') return 'Thuế ĐT';
  if (codeOrId === 'dvc') return 'DVC Thuế';
  if (codeOrId === 'tracuunnt') return 'Tra cứu NNT';
  const match = ALL_PORTALS.find((p) => p.cong === codeOrId || p.portalId === codeOrId);
  return match ? match.name : codeOrId;
}
