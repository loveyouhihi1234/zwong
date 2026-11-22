import React, { useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import {
  ALL_PORTALS,
  PORTAL_GROUP_LABELS,
  getPortalGroupCounts,
  type PortalGroupId,
  type PortalSolverKind,
} from '../utils/allPortals';

type GroupFilter = 'all' | PortalGroupId;

function solverKindLabel(kind: PortalSolverKind): string {
  if (kind === 'svg-3tier') return 'SVG 3 tầng (<5ms) → ONNX';
  if (kind === 'text') return 'Đọc văn bản DOM (<1ms)';
  if (kind === 'svg-text') return 'Đọc thẻ <text> SVG (<1ms)';
  return 'ONNX cục bộ (ddddocr)';
}

export const PortalsPanel: React.FC = () => {
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [query, setQuery] = useState<string>('');

  const counts = useMemo(() => getPortalGroupCounts(), []);

  const filteredPortals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_PORTALS.filter((item) => {
      if (groupFilter !== 'all' && item.group !== groupFilter) return false;
      if (!q) return true;
      return (
        item.hostname.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.cong.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q)
      );
    });
  }, [groupFilter, query]);

  const filterTabs: Array<{ id: GroupFilter; label: string }> = [
    { id: 'all', label: `Tất cả (${counts.all})` },
    { id: 'main', label: `${PORTAL_GROUP_LABELS.main} (${counts.main})` },
    { id: 'ext_gov', label: `${PORTAL_GROUP_LABELS.ext_gov} (${counts.ext_gov})` },
    { id: 'ext_bank', label: `${PORTAL_GROUP_LABELS.ext_bank} (${counts.ext_bank})` },
    { id: 'ext_invoice', label: `${PORTAL_GROUP_LABELS.ext_invoice} (${counts.ext_invoice})` },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Quy tắc nhận diện {counts.all} Cổng Thuế, BHXH, Hải quan, Ngân hàng &amp; Hóa đơn
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Mỗi cổng dùng bộ selector riêng và giải hoàn toàn cục bộ trên trình duyệt: Hóa đơn điện tử dùng chuỗi 3 tầng (SVG mẫu → SVG chữ ký → ONNX), các cổng còn lại dùng ONNX <code className="font-mono">ddddocr_old.onnx</code> hoặc đọc trực tiếp văn bản DOM/SVG.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Lọc nhóm cổng"
              className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
            >
              {filterTabs.map((tab) => {
                const active = groupFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setGroupFilter(tab.id)}
                    className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tên miền hoặc tên cổng..."
                aria-label="Tìm kiếm cổng hỗ trợ"
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {filteredPortals.length === 0 ? (
          <div className="px-6 py-10 text-center text-xs text-slate-500">
            Không tìm thấy cổng nào khớp với từ khóa "{query}".
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredPortals.map((portal) => (
              <div
                key={portal.hostname}
                className="px-6 py-4 grid grid-cols-1 gap-3 lg:grid-cols-12 items-start"
              >
                <div className="lg:col-span-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{portal.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <a
                      href={`https://${portal.hostname}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-sky-700 hover:underline"
                    >
                      <span>{portal.hostname}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {PORTAL_GROUP_LABELS[portal.group]} · Mã hậu xử lý:{' '}
                    <code className="font-mono text-slate-700">{portal.cong}</code>
                  </p>
                </div>

                <div className="lg:col-span-5 space-y-1.5 text-xs">
                  <div>
                    <span className="font-medium text-slate-500">Selector ảnh: </span>
                    <code className="font-mono text-slate-800 break-all">{portal.imgSelector}</code>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500">Selector ô nhập: </span>
                    <code className="font-mono text-slate-800 break-all">{portal.inputSelector}</code>
                  </div>
                </div>

                <div className="lg:col-span-3 text-xs space-y-1">
                  <div className="font-medium text-slate-800">{solverKindLabel(portal.solverKind)}</div>
                  <p className="text-slate-600 leading-relaxed">{portal.notes}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
