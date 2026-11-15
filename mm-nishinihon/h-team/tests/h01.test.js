// H01 判定ロジックのテスト（Node.js 18+）: node --test mm-nishinihon/h-team/tests/*.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function load() {
  const src = ['Config.gs', 'Common.gs', 'H01_InventoryMonitor.gs']
    .map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'))
    .join('\n');
  return new Function(src + '\nreturn { H01_findShortages, H_CONFIG, hToNumber_ };')();
}
const { H01_findShortages, hToNumber_ } = load();

const makers = [
  { _rowNumber: 2, 'メーカーコード': 'M001', 'メーカー名': 'Aメーカー' },
  { _rowNumber: 3, 'メーカーコード': 'M002', 'メーカー名': 'Bメーカー' }
];
const item = (row, code, stock, rp, extra = {}) => ({
  _rowNumber: row, '商品コード': code, '商品名': code + '商品', 'メーカーコード': 'M001',
  '現在庫数': stock, '発注基準値': rp, '発注対象': '', ...extra
});

test('在庫が基準値以下なら検知、上回れば検知しない', () => {
  const r = H01_findShortages([item(2, 'P1', 5, 10), item(3, 'P2', 10, 10), item(4, 'P3', 11, 10)], [], makers);
  assert.deepStrictEqual(r.detections.map((d) => d.code), ['P1', 'P2']);
  assert.strictEqual(r.detections[0].shortage, 5);
  assert.strictEqual(r.detections[0].makerName, 'Aメーカー');
});

test('処理中の候補があれば二重登録しない／完了済なら再検知する', () => {
  const cands = [
    { '商品コード': 'P1', 'ステータス': '承認待ち' },
    { '商品コード': 'P2', 'ステータス': '送信済' }
  ];
  const r = H01_findShortages([item(2, 'P1', 0, 10), item(3, 'P2', 0, 10)], cands, makers);
  assert.deepStrictEqual(r.detections.map((d) => d.code), ['P2']);
  assert.match(r.skipped[0].reason, /承認待ち/);
});

test('発注対象外はスキップ', () => {
  const r = H01_findShortages([item(2, 'P1', 0, 10, { '発注対象': '停止' }), item(3, 'P2', 0, 10, { '発注対象': false })], [], makers);
  assert.strictEqual(r.detections.length, 0);
  assert.strictEqual(r.skipped.length, 2);
});

test('数値でない・空欄・重複はエラー', () => {
  const r = H01_findShortages([
    item(2, 'P1', '', 10), item(3, 'P2', 3, 'abc'), item(4, '', 0, 10), item(5, 'P4', 0, 10), item(6, 'P4', 0, 10)
  ], [], makers);
  assert.deepStrictEqual(r.detections.map((d) => d.code), ['P4']);
  assert.strictEqual(r.errors.length, 4);
});

test('メーカーマスタ未登録は警告付きで検知', () => {
  const r = H01_findShortages([item(2, 'P1', 0, 10, { 'メーカーコード': 'M999' })], [], makers);
  assert.strictEqual(r.detections.length, 1);
  assert.match(r.detections[0].warning, /M999/);
});

test('全角数字・カンマ入力を数値として扱う', () => {
  assert.strictEqual(hToNumber_('１２'), 12);
  assert.strictEqual(hToNumber_('1,200'), 1200);
  assert.ok(Number.isNaN(hToNumber_('')));
  const r = H01_findShortages([item(2, 'P1', '５', '１０')], [], makers);
  assert.strictEqual(r.detections[0].shortage, 5);
});
