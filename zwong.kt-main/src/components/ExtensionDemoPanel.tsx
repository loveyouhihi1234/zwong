import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FolderDown,
  KeyRound,
  Lock,
  PlusCircle,
  RotateCcw,
  ShieldCheck,
  Unlock,
} from 'lucide-react';

type DemoTabId = 'hddt' | 'hoso' | 'captcha';

interface ExtensionDemoPanelProps {
  onGoToPackager: () => void;
}

const DEMO_SAMPLE_KEY = 'DEMO-TAXCAP-2026';

const DEMO_TABS: { id: DemoTabId; label: string; icon: typeof FileSpreadsheet }[] = [
  { id: 'hddt', label: 'Tab 1: Tải HĐĐT', icon: FileSpreadsheet },
  { id: 'hoso', label: 'Tab 2: Tải Hồ sơ', icon: FolderDown },
  { id: 'captcha', label: 'Tab 3: Captcha', icon: ShieldCheck },
];

export const ExtensionDemoPanel: React.FC<ExtensionDemoPanelProps> = ({ onGoToPackager }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [unlocked, setUnlocked] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<DemoTabId>('hddt');
  const [demoSolved, setDemoSolved] = useState<number>(14);
  const [demoFailed, setDemoFailed] = useState<number>(0);
  const [resetNonce, setResetNonce] = useState<number>(1);
  const [initialLockedParam, setInitialLockedParam] = useState<boolean>(false);

  const postToDemo = useCallback((payload: Record<string, unknown>) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(payload, '*');
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event?.data;
      if (!data || typeof data !== 'object' || data.type !== 'TAXCAP_DEMO_STATE') return;
      setUnlocked(Boolean(data.unlocked));
      if (data.activeTab === 'hddt' || data.activeTab === 'hoso' || data.activeTab === 'captcha') {
        setActiveTab(data.activeTab);
      }
      if (data.stats && typeof data.stats === 'object') {
        setDemoSolved(Number(data.stats.solved) || 0);
        setDemoFailed(Number(data.stats.failed) || 0);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const handleToggleLock = (nextUnlocked: boolean) => {
    setUnlocked(nextUnlocked);
    postToDemo({ type: 'TAXCAP_DEMO_SET_LOCKED', locked: !nextUnlocked });
  };

  const handleJumpTab = (tab: DemoTabId) => {
    if (!unlocked) return;
    setActiveTab(tab);
    postToDemo({ type: 'TAXCAP_DEMO_SWITCH_TAB', tab });
  };

  const handleResetDemo = () => {
    setUnlocked(true);
    setActiveTab('hddt');
    setDemoSolved(14);
    setDemoFailed(0);
    setInitialLockedParam(false);
    setResetNonce((n) => n + 1);
  };

  const handleFillDemoKey = () => {
    postToDemo({ type: 'TAXCAP_DEMO_FILL_KEY', key: DEMO_SAMPLE_KEY });
  };

  const handleSimulateSolve = (ok: boolean) => {
    postToDemo({ type: 'TAXCAP_DEMO_SIMULATE_SOLVE', ok });
  };

  const iframeSrc = `./extension-demo/sidepanel.html?locked=${initialLockedParam ? '1' : '0'}&tab=hddt&v=${resetNonce}`;

  return (
    <div className="space-y-5">
      {/* Control Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Lock / Unlock Switcher */}
          <div
            className="inline-flex items-center rounded-lg bg-slate-100 p-1"
            role="group"
            aria-label="Chuyển trạng thái khóa bản quyền Demo"
          >
            <button
              type="button"
              data-testid="demo-mode-unlocked"
              aria-pressed={unlocked}
              onClick={() => handleToggleLock(true)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                unlocked
                  ? 'bg-white text-emerald-700 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Unlock className="h-3.5 w-3.5" />
              <span>Đã mở khóa (3 Tab)</span>
            </button>
            <button
              type="button"
              data-testid="demo-mode-locked"
              aria-pressed={!unlocked}
              onClick={() => handleToggleLock(false)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                !unlocked
                  ? 'bg-white text-amber-700 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Màn hình khóa bản quyền</span>
            </button>
          </div>

          {/* Quick Tab Jumpers */}
          <div
            className="hidden sm:inline-flex items-center gap-1 border-l border-slate-200 pl-3"
            role="group"
            aria-label="Mở nhanh từng tab Extension"
          >
            {DEMO_TABS.map((t) => {
              const Icon = t.icon;
              const isCurrent = unlocked && activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => handleJumpTab(t.id)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    isCurrent
                      ? 'bg-sky-50 text-sky-800 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          data-testid="demo-reset-btn"
          onClick={handleResetDemo}
          className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Đặt lại phiên Demo</span>
        </button>
      </div>

      {/* Main 2-Column Interactive Preview + Companion Guide */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Real Extension Side Panel Frame (436px realistic Chrome Side Panel width) */}
        <div className="xl:col-span-5 flex justify-center">
          <div className="w-full max-w-[436px] rounded-xl border border-slate-300 bg-white overflow-hidden">
            {/* Realistic Chrome Side Panel Header Bar */}
            <div className="bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block h-2 w-2 rounded-full bg-sky-400 shrink-0" aria-hidden="true" />
                <span className="font-semibold truncate">Chrome Side Panel · TaxCap Suite</span>
              </div>
              <span
                data-testid="demo-lock-indicator"
                className={`text-[11px] font-medium shrink-0 ${
                  unlocked ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {unlocked ? 'Đã mở khóa' : 'Đang khóa'}
              </span>
            </div>

            <iframe
              key={resetNonce}
              ref={iframeRef}
              src={iframeSrc}
              title="Xem trước trực tiếp TaxCap Extension Side Panel"
              data-testid="extension-demo-iframe"
              className="w-full h-[650px] border-0 block bg-slate-50"
            />
          </div>
        </div>

        {/* Right: Companion Interactive Guide & Feature Breakdown */}
        <div className="xl:col-span-7 space-y-4">
          {/* Contextual Try-It Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {!unlocked
                    ? 'Đang xem: Màn hình khóa bản quyền chung cả 3 tab'
                    : activeTab === 'hddt'
                      ? 'Đang xem: Tab 1 — Tải Hóa đơn điện tử hàng loạt'
                      : activeTab === 'hoso'
                        ? 'Đang xem: Tab 2 — Tải Hồ sơ thuế hàng loạt'
                        : 'Đang xem: Tab 3 — Tự điền Captcha (46 cổng cục bộ)'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Đây là giao diện thật 100% từ mã nguồn Extension, chạy qua dữ liệu doanh nghiệp mẫu để bạn tương tác thử ngay.
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-slate-600 shrink-0">
                Hôm nay: <strong className="text-slate-900">{demoSolved}</strong> đọc /{' '}
                <strong className="text-slate-900">{demoFailed}</strong> lỗi
              </span>
            </div>

            {!unlocked ? (
              <div className="space-y-3 text-xs leading-relaxed text-slate-600">
                <p>
                  Khi người dùng chưa nhập mã kích hoạt (hoặc mã hết hạn / bị khóa trên Google Sheets), toàn bộ 3 tab đều bị khóa đồng thời. Bạn có thể tự nhập mã mẫu{' '}
                  <code className="font-mono font-semibold text-slate-900">{DEMO_SAMPLE_KEY}</code> rồi bấm{' '}
                  <strong className="text-slate-900">Kích hoạt &amp; Mở khóa</strong> ngay trong khung bên trái, hoặc nhập{' '}
                  <code className="font-mono font-semibold text-amber-800">LOCKED</code> để xem thông báo lỗi khi mã bị khóa.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="demo-fill-key-btn"
                    onClick={handleFillDemoKey}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-800"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Điền sẵn mã mẫu ({DEMO_SAMPLE_KEY})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleLock(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    <span>Mở khóa nhanh</span>
                  </button>
                </div>
              </div>
            ) : activeTab === 'hddt' ? (
              <div className="space-y-2.5 text-xs leading-relaxed text-slate-600">
                <p>
                  Bản Demo đã giả lập sẵn kết nối với phiên{' '}
                  <span className="font-mono font-medium text-slate-800">0101234567 – CÔNG TY TNHH KẾ TOÁN MINH ANH</span>. Hãy thử trực tiếp trong khung Side Panel:
                </p>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>
                    Chọn khoảng ngày bằng 4 nút nhanh (<strong>Tháng này</strong>, <strong>Tháng trước</strong>, <strong>Quý này</strong>, <strong>Quý trước</strong>) hoặc mở lịch chọn ngày.
                  </li>
                  <li>
                    Tích chọn <strong>HĐ máy tính tiền</strong>, các định dạng <strong>Excel / XML / HTML / PDF</strong> và các sheet báo cáo rủi ro.
                  </li>
                  <li>
                    Bấm <strong>Tìm kiếm</strong> để chạy thanh tiến trình + nhật ký từng bước; thử bấm <strong>Dừng</strong> giữa chừng để kiểm tra cơ chế ngắt tức thì.
                  </li>
                </ul>
              </div>
            ) : activeTab === 'hoso' ? (
              <div className="space-y-2.5 text-xs leading-relaxed text-slate-600">
                <p>
                  Bản Demo mô phỏng đồng thời 2 nguồn <strong>Dịch vụ công Thuế (từ 01/07/2025)</strong> và <strong>Thuế điện tử (trước 01/07/2025)</strong>:
                </p>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>
                    Thử gõ tìm kiếm trong ô <strong>Loại tờ khai</strong> (ví dụ <code className="font-mono">GTGT</code>, <code className="font-mono">TNDN</code>, <code className="font-mono">BCTC</code>).
                  </li>
                  <li>
                    Bấm <strong>Tìm kiếm</strong> để nạp danh sách 6 hồ sơ mẫu (gồm cả hồ sơ <em>Được chấp nhận</em> và <em>Không chấp nhận</em> để kiểm thử bộ lọc trạng thái).
                  </li>
                  <li>
                    Bấm <strong>Tải xuống</strong> từng dòng hoặc <strong>Tải tất cả</strong> để xem tiến trình tải theo từng cột <em>Hồ sơ khai thuế</em> và <em>Thông báo</em>.
                  </li>
                </ul>
              </div>
            ) : (
              <div className="space-y-3 text-xs leading-relaxed text-slate-600">
                <p>
                  Tab Captcha đã được tinh gọn còn đúng <strong>2 tab con</strong> (<strong className="text-slate-900">Captcha</strong> và <strong className="text-slate-900">Cấu hình</strong>), bỏ hoàn toàn Kho dữ liệu, Nhật ký và Trí nhớ mẫu nhưng vẫn giữ bộ đếm <strong>Hôm nay</strong>.
                </p>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>
                    Bật/tắt 4 cổng Thuế chính, 3 nhóm <strong>42 cổng mở rộng</strong> và bấm <em>Xem danh sách 42 tên miền mở rộng</em>.
                  </li>
                  <li>
                    Chuyển sang tab con <strong>Cấu hình</strong> để xem thông tin bản quyền, bấm <strong>Kiểm tra nạp mô hình ONNX</strong> hoặc thử <strong>Hủy kích hoạt máy này</strong> để khóa lại cả 3 tab.
                  </li>
                </ul>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="demo-sim-solve-ok"
                    onClick={() => handleSimulateSolve(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <PlusCircle className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Mô phỏng +1 lượt Đã đọc</span>
                  </button>
                  <button
                    type="button"
                    data-testid="demo-sim-solve-err"
                    onClick={() => handleSimulateSolve(false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <PlusCircle className="h-3.5 w-3.5 text-amber-600" />
                    <span>Mô phỏng +1 lượt Lỗi</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3-Tab Capability Summary Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tổng quan 3 phân hệ trong Extension thật
              </h3>
              <span className="text-[11px] text-slate-500">Chế độ Demo không ghi tệp ra máy</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="px-5 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">1. Tải HĐĐT (hoadondientu.gdt.gov.vn)</div>
                  <p className="mt-0.5 text-slate-600">
                    Tải hàng loạt hóa đơn mua vào/bán ra, HĐ máy tính tiền (tự giải captcha SVG 3 tầng → ONNX), xuất Excel có sheet kiểm tra rủi ro, XML, HTML và PDF tiếng Việt.
                  </p>
                </div>
              </div>
              <div className="px-5 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">2. Tải Hồ sơ thuế (DVC &amp; Thuế điện tử)</div>
                  <p className="mt-0.5 text-slate-600">
                    Tra cứu và tải hàng loạt tờ khai thuế + thông báo chấp nhận từ cả Dịch vụ công và Thuế điện tử với bộ lọc trạng thái và tên tờ khai.
                  </p>
                </div>
              </div>
              <div className="px-5 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">3. Tự điền Captcha cục bộ (46 cổng)</div>
                  <p className="mt-0.5 text-slate-600">
                    Chạy hoàn toàn offline bằng SVG + ONNX WASM (<code className="font-mono">ddddocr_old.onnx</code>) trên 4 cổng Thuế chính và 42 cổng BHXH, Hải quan, Ngân hàng, NCC Hóa đơn; chỉ điền, không tự gửi form.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA to Packager */}
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              <div className="font-semibold text-slate-900">Muốn cài đặt bản chính thức vào Chrome / Edge?</div>
              <div className="mt-0.5 text-slate-500">
                Đóng gói file <code className="font-mono">.zip</code> sạch (không kèm lớp mô phỏng Demo), nhúng sẵn ONNX WASM.
              </div>
            </div>
            <button
              type="button"
              onClick={onGoToPackager}
              className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Tải &amp; Cài Extension</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
