import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import {
  buildDemoChromeShimScript,
  DEMO_SHIM_URL,
  injectDemoShimIntoHtml,
  resolveSafeDemoPath,
} from './extensionDemo';

test('resolveSafeDemoPath resolves valid extension paths and blocks traversal', () => {
  const base = path.resolve('/tmp/ext-root');
  assert.equal(resolveSafeDemoPath(base, ''), path.join(base, 'sidepanel.html'));
  assert.equal(
    resolveSafeDemoPath(base, 'panels/hddt/index.html'),
    path.join(base, 'panels/hddt/index.html'),
  );
  assert.equal(resolveSafeDemoPath(base, '../server.ts'), null);
  assert.equal(resolveSafeDemoPath(base, '../../etc/passwd'), null);
});

test('injectDemoShimIntoHtml injects shim once inside <head>', () => {
  const html = '<!doctype html><html><head><title>Test</title></head><body></body></html>';
  const once = injectDemoShimIntoHtml(html);
  assert.equal(once.includes(`<script src="${DEMO_SHIM_URL}"></script>`), true);
  assert.equal(once.indexOf(DEMO_SHIM_URL) < once.indexOf('<title>'), true);
  assert.equal(injectDemoShimIntoHtml(once), once);
});

test('buildDemoChromeShimScript is valid JavaScript with required handlers', () => {
  const script = buildDemoChromeShimScript();
  assert.doesNotThrow(() => new vm.Script(script, { filename: 'demo-chrome-shim.js' }));
  assert.equal(script.includes('TAXCAP_DEMO_SET_LOCKED'), true);
  assert.equal(script.includes('TAXCAP_DEMO_SWITCH_TAB'), true);
  assert.equal(script.includes('TAXCAP_DEMO_FILL_KEY'), true);
  assert.equal(script.includes('hddt-job'), true);
  assert.equal(script.includes('hoso-job'), true);
  assert.equal(script.includes('TAXCAP_PING'), true);
});
