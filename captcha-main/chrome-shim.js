// Lightweight Chrome Extension API shim for running popup.html inside a standard web browser preview.
// Does nothing when executed inside an actual Chrome Extension runtime (chrome.runtime.id present).
(function (root) {
  function clone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }

  function createMemoryStorage() {
    const map = new Map();
    return {
      getItem: function (k) {
        return map.has(k) ? map.get(k) : null;
      },
      setItem: function (k, v) {
        map.set(k, String(v));
      },
      removeItem: function (k) {
        map.delete(k);
      },
    };
  }

  function createChromeShim(opts) {
    opts = opts || {};
    const backing = opts.storage || createMemoryStorage();
    const manifest = opts.manifest || {
      name: "CVTax – Tự động giải captcha",
      version: "2.0.0",
    };
    const prefix = opts.prefix || "cvtax_auto_preview_";
    const listeners = [];

    function readArea(area) {
      try {
        const raw = backing.getItem(prefix + area);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (e) {
        return {};
      }
    }

    function writeArea(area, data) {
      try {
        backing.setItem(prefix + area, JSON.stringify(data));
      } catch (e) {}
    }

    function notifyChange(area, changes) {
      if (!Object.keys(changes).length) return;
      listeners.slice().forEach(function (fn) {
        try {
          fn(changes, area);
        } catch (e) {}
      });
    }

    function makeStorageArea(area) {
      return {
        get: function (keys, cb) {
          const all = readArea(area);
          let out = {};
          if (keys == null) {
            out = clone(all);
          } else if (typeof keys === "string") {
            if (Object.prototype.hasOwnProperty.call(all, keys)) out[keys] = clone(all[keys]);
          } else if (Array.isArray(keys)) {
            keys.forEach(function (k) {
              if (Object.prototype.hasOwnProperty.call(all, k)) out[k] = clone(all[k]);
            });
          } else if (typeof keys === "object") {
            Object.keys(keys).forEach(function (k) {
              out[k] = Object.prototype.hasOwnProperty.call(all, k) ? clone(all[k]) : clone(keys[k]);
            });
          }
          if (typeof cb === "function") cb(out);
          return Promise.resolve(out);
        },
        set: function (items, cb) {
          const all = readArea(area);
          const changes = {};
          Object.keys(items || {}).forEach(function (k) {
            const oldValue = all[k];
            const newValue = clone(items[k]);
            all[k] = newValue;
            changes[k] = { oldValue: oldValue, newValue: newValue };
          });
          writeArea(area, all);
          if (typeof cb === "function") cb();
          notifyChange(area, changes);
          return Promise.resolve();
        },
        remove: function (keys, cb) {
          const list = Array.isArray(keys) ? keys : [keys];
          const all = readArea(area);
          const changes = {};
          list.forEach(function (k) {
            if (Object.prototype.hasOwnProperty.call(all, k)) {
              changes[k] = { oldValue: all[k] };
              delete all[k];
            }
          });
          writeArea(area, all);
          if (typeof cb === "function") cb();
          notifyChange(area, changes);
          return Promise.resolve();
        },
      };
    }

    const storage = {
      local: makeStorageArea("local"),
      onChanged: {
        addListener: function (fn) {
          if (typeof fn === "function" && listeners.indexOf(fn) < 0) listeners.push(fn);
        },
        removeListener: function (fn) {
          const idx = listeners.indexOf(fn);
          if (idx >= 0) listeners.splice(idx, 1);
        },
      },
    };

    function getActivePortalHost() {
      const local = readArea("local");
      return local.cong_chon || "hoadondientu.gdt.gov.vn";
    }

    const runtime = {
      lastError: null,
      getManifest: function () {
        return clone(manifest);
      },
      getURL: function (path) {
        const clean = String(path || "").replace(/^\/+/, "");
        if (typeof window !== "undefined" && window.location && window.location.origin) {
          return window.location.origin + "/" + clean;
        }
        return "/" + clean;
      },
      sendMessage: function (_msg, cb) {
        const res = { ok: true };
        if (typeof cb === "function") Promise.resolve(res).then(cb);
        return Promise.resolve(res);
      },
      onMessage: { addListener: function () {} },
    };

    const tabs = {
      query: function (_queryInfo, cb) {
        const host = getActivePortalHost();
        const result = [{ id: 1, url: "https://" + host + "/", active: true }];
        if (typeof cb === "function") cb(result);
        return Promise.resolve(result);
      },
      sendMessage: function (_tabId, msg, cb) {
        if (msg && msg.loai === "doc_lai") {
          const host = (msg && msg.hostname) || getActivePortalHost();
          const local = readArea("local");
          const tt = Object.assign({}, local.trang_thai || {});
          tt[host] = { tt: "da_dien", luc: new Date().toISOString() };
          const count = (local.so_lan_dien || 0) + 1;
          storage.local.set({ trang_thai: tt, so_lan_dien: count });
        }
        if (typeof cb === "function") cb({ ok: true });
        return Promise.resolve({ ok: true });
      },
    };

    return { runtime: runtime, storage: storage, tabs: tabs };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createChromeShim: createChromeShim, createMemoryStorage: createMemoryStorage };
  } else if (typeof window !== "undefined") {
    const isRealExtension = Boolean(window.chrome && window.chrome.runtime && window.chrome.runtime.id);
    if (!isRealExtension) {
      let webStorage;
      try {
        webStorage = window.localStorage;
      } catch (e) {
        webStorage = createMemoryStorage();
      }
      window.chrome = createChromeShim({
        storage: webStorage,
        manifest: window.__CVTAX_MANIFEST__ || undefined,
      });
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
