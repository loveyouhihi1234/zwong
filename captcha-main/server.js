const express = require("express");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const BLOCKED_FILES = new Set([
  "/server.js",
  "/package.json",
  "/package-lock.json",
  "/metadata.json",
]);

function readManifest() {
  try {
    const raw = fs.readFileSync(path.join(ROOT_DIR, "manifest.json"), "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return {
      name: "CVTax – Tự động giải captcha",
      description: "Tự động giải và điền ô captcha cục bộ trên cổng Thuế, BHXH, Hải quan, Dịch vụ công và tra cứu hóa đơn.",
      version: "2.0.0",
    };
  }
}

function escapeHtmlAttr(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function injectPreviewShell(html, manifest) {
  const safeName = escapeHtmlAttr(manifest.name || "CVTax – Tự động giải captcha");
  const safeDesc = escapeHtmlAttr(manifest.description || "");
  const manifestPayload = JSON.stringify({
    name: manifest.name || "CVTax – Tự động giải captcha",
    description: manifest.description || "",
    version: manifest.version || "2.0.0",
  }).replace(/</g, "\\u003c");

  const headInject = [
    `  <meta name="description" content="${safeDesc}">`,
    `  <meta property="og:title" content="${safeName}">`,
    `  <meta property="og:description" content="${safeDesc}">`,
    `  <link rel="icon" type="image/png" href="/icons/icon32.png">`,
    `  <link rel="preconnect" href="https://fonts.googleapis.com">`,
    `  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    `  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap">`,
  ].join("\n");

  const hostCss = [
    `  <style id="ai-studio-preview-shell">`,
    `    @media (min-width: 420px) {`,
    `      html, body {`,
    `        width: 100%;`,
    `        min-height: 100vh;`,
    `        background-color: #E6EDF5;`,
    `      }`,
    `      body {`,
    `        display: flex;`,
    `        align-items: flex-start;`,
    `        justify-content: center;`,
    `        padding: 32px 16px;`,
    `      }`,
    `      .ext-shell {`,
    `        border-radius: 16px;`,
    `        overflow: hidden;`,
    `        box-shadow: 0 14px 38px rgba(15, 23, 42, 0.14);`,
    `        border: 1px solid #CBD5E1;`,
    `      }`,
    `    }`,
    `  </style>`,
  ].join("\n");

  const shimTag =
    `<script>window.__CVTAX_MANIFEST__ = ${manifestPayload};</script>` +
    `<script src="/chrome-shim.js"></script>`;

  let out = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${safeName}</title>\n${headInject}`
  );
  out = out.replace("</head>", `${hostCss}\n</head>`);
  out = out.replace(
    '<script src="bang_svg.js">',
    `${shimTag}<script src="bang_svg.js">`
  );
  return out;
}

function createApp() {
  const app = express();
  const manifest = readManifest();

  app.use((req, res, next) => {
    const p = req.path;
    if (
      BLOCKED_FILES.has(p) ||
      p.startsWith("/tests/") ||
      p.startsWith("/node_modules/")
    ) {
      return res.status(404).send("Not found");
    }
    next();
  });

  app.get(["/", "/index.html", "/popup.html"], (req, res) => {
    try {
      const rawHtml = fs.readFileSync(path.join(ROOT_DIR, "popup.html"), "utf8");
      res.type("html").send(injectPreviewShell(rawHtml, manifest));
    } catch (err) {
      res.status(500).send("Unable to load popup.html");
    }
  });

  app.use(
    express.static(ROOT_DIR, {
      dotfiles: "ignore",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".mjs")) {
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        } else if (filePath.endsWith(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        }
      },
    })
  );

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`CVTax Captcha server listening on http://${HOST}:${PORT}`);
  });
}

module.exports = { createApp, injectPreviewShell, readManifest };
