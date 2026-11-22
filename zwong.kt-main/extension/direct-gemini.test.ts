import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadLocalHelper() {
  const code = fs.readFileSync(path.resolve(process.cwd(), 'extension', 'direct-gemini.js'), 'utf8');
  const sandbox: Record<string, unknown> = {};
  sandbox.self = sandbox;
  vm.runInNewContext(code, sandbox);
  return sandbox.TaxCapDirect as {
    normalizePortalId: (portal: string) => string;
    sanitizeCaptchaText: (raw: string) => string;
    parseImageDataUrl: (input: string) => { mimeType: string; data: string } | null;
    hashBase64Quick: (str: string) => string;
    createEmptyMemoryState: () => unknown;
    updateLocalLearningState: (prev: unknown, event: Record<string, unknown>) => unknown;
    getExactMemoryMatch: (state: unknown, portal: string, imageHash: string) => string | null;
    getAdaptiveHints: (
      state: unknown,
      portal: string,
    ) => {
      usableCount: number;
      correctedCount: number;
      observedLengths: number[];
      confusions: Array<{ from: string; to: string; count: number }>;
    } | null;
    maskCode: (code: string) => string;
    recordSampleInDataset: (prev: unknown[], entry: Record<string, unknown>) => Array<Record<string, unknown>>;
    applySampleFeedback: (
      prev: unknown[],
      fb: { sampleId: string; outcome: string; finalLabel: string },
    ) => { samples: Array<Record<string, unknown>>; updatedSample: Record<string, unknown> | null };
    computeDatasetSummary: (samples: unknown[]) => {
      total: number;
      usable: number;
      verified: number;
      corrected: number;
      pending: number;
      accuracyPercent: number | null;
      byPortal: Array<{ portal: string; usable: number; total: number }>;
    };
    createLogEntry: (opts: Record<string, unknown>) => Record<string, unknown>;
    appendSolveLog: (prev: unknown[], entry: Record<string, unknown>) => Array<Record<string, unknown>>;
    computeLogStats: (logs: unknown[]) => {
      total: number;
      successCount: number;
      errorCount: number;
      avgLatencyMs: number;
    };
  };
}

const SAMPLE_DATA_URL =
  'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';

test('parseImageDataUrl, normalizePortalId, and sanitizeCaptchaText handle valid, extended, and noisy inputs', () => {
  const d = loadLocalHelper();
  const parsed = d.parseImageDataUrl(SAMPLE_DATA_URL);
  assert.ok(parsed);
  assert.equal(parsed.mimeType, 'image/webp');
  assert.equal(d.parseImageDataUrl('not-an-image'), null);
  assert.equal(d.sanitizeCaptchaText('```AB12C``` \n'), 'AB12C');
  assert.equal(d.normalizePortalId('hddt'), 'hddt');
  assert.equal(d.normalizePortalId('bhxh'), 'bhxh');
  assert.equal(d.normalizePortalId('vninvoice_v50'), 'vninvoice_v50');
  assert.equal(d.normalizePortalId(''), 'hddt');
});

test('local learning state caches exact hashes, learns character confusions, and handles rejections', () => {
  const d = loadLocalHelper();
  const parsed = d.parseImageDataUrl(SAMPLE_DATA_URL)!;
  const h1 = d.hashBase64Quick(`${parsed.mimeType}:${parsed.data}`);

  let state = d.createEmptyMemoryState();
  state = d.updateLocalLearningState(state, {
    portal: 'tdt',
    predicted: 'AB0O1',
    finalLabel: 'AB001',
    outcome: 'corrected',
    imageHash: h1,
    timestamp: 1000,
  });

  assert.equal(d.getExactMemoryMatch(state, 'tdt', h1), 'AB001');
  assert.equal(d.getExactMemoryMatch(state, 'dvc', h1), null);

  const hints = d.getAdaptiveHints(state, 'tdt');
  assert.ok(hints);
  assert.equal(hints.usableCount, 1);
  assert.equal(hints.correctedCount, 1);
  assert.deepEqual(Array.from(hints.observedLengths), [5]);
  assert.equal(hints.confusions[0].from, 'O');
  assert.equal(hints.confusions[0].to, '0');

  state = d.updateLocalLearningState(state, {
    portal: 'tdt',
    outcome: 'rejected',
    imageHash: h1,
  });
  assert.equal(d.getExactMemoryMatch(state, 'tdt', h1), null);
});

test('local Dataset and Logs helpers track main & extended portals, feedback edits, accuracy, and latency stats', () => {
  const d = loadLocalHelper();
  let samples = d.recordSampleInDataset([], {
    sampleId: 's1',
    portal: 'hddt',
    source: 'svg-local',
    predicted: 'E6H3VA',
    latencyMs: 4,
    imageDataUrl: SAMPLE_DATA_URL,
  });
  samples = d.recordSampleInDataset(samples, {
    sampleId: 's2',
    portal: 'tdt',
    source: 'onnx-local',
    predicted: 'AB0O1',
    latencyMs: 120,
    imageDataUrl: SAMPLE_DATA_URL,
  });
  samples = d.recordSampleInDataset(samples, {
    sampleId: 's3',
    portal: 'bhxh',
    source: 'onnx-local',
    predicted: 'A1B2C',
    latencyMs: 95,
    imageDataUrl: SAMPLE_DATA_URL,
  });

  const fb1 = d.applySampleFeedback(samples, { sampleId: 's1', outcome: 'verified', finalLabel: 'E6H3VA' });
  const fb2 = d.applySampleFeedback(fb1.samples, { sampleId: 's2', outcome: 'corrected', finalLabel: 'AB001' });
  const fb3 = d.applySampleFeedback(fb2.samples, { sampleId: 's3', outcome: 'verified', finalLabel: 'A1B2C' });
  const summary = d.computeDatasetSummary(fb3.samples);

  assert.equal(summary.total, 3);
  assert.equal(summary.usable, 3);
  assert.equal(summary.verified, 2);
  assert.equal(summary.corrected, 1);
  assert.equal(summary.accuracyPercent, 67);
  const extBucket = summary.byPortal.find((b) => b.portal === 'extended');
  assert.ok(extBucket, 'Extended portals should be aggregated into extended bucket');
  assert.equal(extBucket!.total, 1);
  assert.equal(extBucket!.usable, 1);

  let logs = d.appendSolveLog([], d.createLogEntry({ portal: 'hddt', status: 'ok', code: 'E6H3VA', latencyMs: 4, message: 'SVG mẫu (<5ms)' }));
  logs = d.appendSolveLog(logs, d.createLogEntry({ portal: 'bhxh', status: 'ok', code: 'A1B2C', latencyMs: 96, message: 'ONNX cục bộ' }));
  logs = d.appendSolveLog(logs, d.createLogEntry({ portal: 'tdt', status: 'error', code: '', latencyMs: 200, message: 'Timeout' }));
  const logStats = d.computeLogStats(logs);

  assert.equal(logStats.total, 3);
  assert.equal(logStats.successCount, 2);
  assert.equal(logStats.errorCount, 1);
  assert.equal(logStats.avgLatencyMs, 100);
  assert.equal(d.maskCode('E6H3VA'), 'E****A');
});
