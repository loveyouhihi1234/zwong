import { useCallback, useEffect, useState } from 'react';
import { Download, FlaskConical, Globe, Menu, PanelRight, Users, X } from 'lucide-react';
import { SandboxPanel } from './components/SandboxPanel';
import { ExtensionDemoPanel } from './components/ExtensionDemoPanel';
import { ExtensionPackagerPanel } from './components/ExtensionPackagerPanel';
import { UsersAdminPanel } from './components/UsersAdminPanel';
import { PortalsPanel } from './components/PortalsPanel';

type NavTab = 'sandbox' | 'demo' | 'extension' | 'users' | 'portals';

interface HealthState {
  mode: string;
  model: string;
  onnxReady: boolean;
  wasmReady: boolean;
  portalCount: number;
}

const NAV_ITEMS: { id: NavTab; label: string; title: string; icon: typeof FlaskConical }[] = [
  { id: 'sandbox', label: 'Mô phỏng & Kiểm thử', title: 'Mô phỏng & Kiểm thử Captcha cục bộ', icon: FlaskConical },
  { id: 'demo', label: 'Extension Demo', title: 'Trải nghiệm trực tiếp Extension Side Panel (3 Tab)', icon: PanelRight },
  { id: 'extension', label: 'Tải & Cài Extension', title: 'Đóng gói & Cài đặt Chrome Extension', icon: Download },
  { id: 'users', label: 'Quản lý User', title: 'Quản lý Người dùng & Google Sheets', icon: Users },
  { id: 'portals', label: '46 Cổng hỗ trợ', title: 'Quy tắc nhận diện 46 Cổng Thuế, BHXH, Hải quan, Ngân hàng & Hóa đơn', icon: Globe },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('sandbox');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [staticHosting, setStaticHosting] = useState<boolean>(false);
  const [health, setHealth] = useState<HealthState>({
    mode: 'local-onnx',
    model: 'ddddocr_old.onnx',
    onnxReady: true,
    wasmReady: true,
    portalCount: 46,
  });

  const loadHealth = useCallback(async () => {
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')) {
      setStaticHosting(true);
      return;
    }
    try {
      const res = await fetch('/api/health');
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) {
        setStaticHosting(true);
        return;
      }
      const data = await res.json();
      setStaticHosting(false);
      setHealth({
        mode: String(data.mode || 'local-onnx'),
        model: String(data.model || 'ddddocr_old.onnx'),
        onnxReady: data.onnxReady !== false,
        wasmReady: data.wasmReady !== false,
        portalCount: typeof data.portalCount === 'number' ? data.portalCount : 46,
      });
    } catch {
      setStaticHosting(true);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const solverReady = health.onnxReady && health.wasmReady;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:shrink-0 border-r border-slate-200 bg-white">
        <div className="h-14 flex items-center px-5 border-b border-slate-200">
          <span className="text-base font-bold tracking-tight text-slate-900">TaxCap Studio</span>
        </div>

        <nav aria-label="Điều hướng chính" className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeTab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-sky-50 text-sky-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-sky-700' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 text-xs text-slate-500 space-y-1">
          {staticHosting ? (
            <>
              <div className="font-medium text-slate-700">Chế độ Web tĩnh</div>
              <div>
                Bộ giải: <span className="text-emerald-700 font-medium">SVG + ONNX cục bộ</span>
              </div>
              <div>
                Quản lý User: <span className="font-medium text-slate-700">Google Sheets</span>
              </div>
            </>
          ) : (
            <>
              <div className="font-medium text-slate-700">Bộ giải cục bộ (OFFLINE)</div>
              <div>
                Model: <span className="font-mono text-slate-800">{health.model}</span>
              </div>
              <div>
                Trạng thái:{' '}
                <span
                  className={
                    solverReady ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'
                  }
                >
                  {solverReady ? `Sẵn sàng (${health.portalCount} cổng)` : 'Thiếu tệp .onnx/.wasm'}
                </span>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200">
              <span className="text-base font-bold text-slate-900">TaxCap Studio</span>
              <button
                type="button"
                aria-label="Đóng menu"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeTab;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium ${
                      active ? 'bg-sky-50 text-sky-800 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-slate-200 bg-white px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Mở menu điều hướng"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
              {currentNav.title}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => handleSelectTab('extension')}
            className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tải Extension</span>
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          {activeTab === 'sandbox' && (
            <SandboxPanel onnxReady={health.onnxReady} wasmReady={health.wasmReady} />
          )}
          {activeTab === 'demo' && (
            <ExtensionDemoPanel onGoToPackager={() => handleSelectTab('extension')} />
          )}
          {activeTab === 'extension' && <ExtensionPackagerPanel />}
          {activeTab === 'users' && <UsersAdminPanel />}
          {activeTab === 'portals' && <PortalsPanel />}
        </main>
      </div>
    </div>
  );
}
