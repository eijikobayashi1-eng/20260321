/**
 * H01 在庫監視ワーカー
 *
 * 役割：「在庫」シートを定期スキャンし、現在庫数が発注基準値以下になった商品を検知して
 *       「発注候補」シートに登録し、H00（司令塔）へ結果を返す。
 * DMM ：D2-① 需要予測・発注量設定 の前段（在庫確認）
 *
 * 判定ルール
 *   1. 発注対象列が「対象外」の商品はスキップ
 *   2. 現在庫数 ≦ 発注基準値 なら検知
 *   3. 同じ商品で処理中（送信済・手動発注済・取消 以外）の発注候補があれば二重登録しない
 *   4. 数値が入っていない・商品コード重複などはエラーとして記録し、検知はしない
 *   5. メーカーマスタに無いメーカーコードは検知はするが備考に警告を残す
 */

/**
 * 判定ロジック本体（シートに触れない純粋関数。テスト対象）
 * @param {Object[]} items       在庫シートの行
 * @param {Object[]} candidates  発注候補シートの行
 * @param {Object[]} makers      メーカーマスタの行
 * @return {{scanned:number, detections:Object[], skipped:Object[], errors:Object[]}}
 */
function H01_findShortages(items, candidates, makers) {
  var INV = H_CONFIG.COL.INV;
  var CAND = H_CONFIG.COL.CAND;
  var MK = H_CONFIG.COL.MAKER;

  // 処理中の発注候補がある商品コード
  var openCodes = {};
  candidates.forEach(function (c) {
    var status = hStr_(c[CAND.STATUS]);
    if (H_CONFIG.CLOSED_STATUSES.indexOf(status) < 0) openCodes[hStr_(c[CAND.CODE])] = status || '(空欄)';
  });

  var makerByCode = {};
  makers.forEach(function (m) { makerByCode[hStr_(m[MK.CODE])] = m; });

  var result = { scanned: items.length, detections: [], skipped: [], errors: [] };
  var seen = {};

  items.forEach(function (item) {
    var row = item._rowNumber;
    var code = hStr_(item[INV.CODE]);
    var name = hStr_(item[INV.NAME]);

    if (!code) {
      result.errors.push({ row: row, code: '', name: name, reason: '商品コードが空欄' });
      return;
    }
    if (seen[code]) {
      result.errors.push({ row: row, code: code, name: name, reason: '商品コードが重複（' + seen[code] + '行目と同じ）' });
      return;
    }
    seen[code] = row;

    if (H_CONFIG.INACTIVE_VALUES.indexOf(hStr_(item[INV.ACTIVE])) >= 0) {
      result.skipped.push({ row: row, code: code, name: name, reason: '発注対象外' });
      return;
    }

    var stock = hToNumber_(item[INV.STOCK]);
    var reorderPoint = hToNumber_(item[INV.REORDER_POINT]);
    if (isNaN(stock)) {
      result.errors.push({ row: row, code: code, name: name, reason: '現在庫数が数値ではありません（' + hStr_(item[INV.STOCK]) + '）' });
      return;
    }
    if (isNaN(reorderPoint)) {
      result.errors.push({ row: row, code: code, name: name, reason: '発注基準値が数値ではありません（' + hStr_(item[INV.REORDER_POINT]) + '）' });
      return;
    }

    if (stock > reorderPoint) return; // 在庫十分

    if (openCodes[code]) {
      result.skipped.push({ row: row, code: code, name: name, reason: '処理中の発注候補あり（' + openCodes[code] + '）' });
      return;
    }

    var makerCode = hStr_(item[INV.MAKER]);
    var maker = makerByCode[makerCode];
    result.detections.push({
      row: row,
      code: code,
      name: name,
      makerCode: makerCode,
      makerName: maker ? hStr_(maker[MK.NAME]) : '',
      stock: stock,
      reorderPoint: reorderPoint,
      shortage: reorderPoint - stock,
      warning: maker ? '' : 'メーカーマスタ未登録（' + (makerCode || '空欄') + '）'
    });
  });

  return result;
}

/**
 * H01 実行（シート読み込み → 判定 → 発注候補へ登録 → ログ）
 * H00 から呼ばれる。メニューから単体実行も可能。
 */
function H01_run() {
  var S = H_CONFIG.SHEETS;
  var INV = H_CONFIG.COL.INV;
  var CAND = H_CONFIG.COL.CAND;

  var inv = hReadTable_(S.INVENTORY);
  hRequireColumns_(inv, S.INVENTORY, [INV.CODE, INV.NAME, INV.MAKER, INV.STOCK, INV.REORDER_POINT]);
  var cand = hReadTable_(S.CANDIDATES);
  var makers = hReadTable_(S.MAKERS);

  var result = H01_findShortages(inv.rows, cand.rows, makers.rows);

  var now = new Date();
  var stamp = hFormatDate_(now, 'yyyyMMdd-HHmmss');
  var records = result.detections.map(function (d) {
    var r = {};
    r[CAND.ID] = 'C' + stamp + '-' + d.code;
    r[CAND.DETECTED_AT] = now;
    r[CAND.CODE] = d.code;
    r[CAND.NAME] = d.name;
    r[CAND.MAKER] = d.makerCode;
    r[CAND.MAKER_NAME] = d.makerName;
    r[CAND.STOCK] = d.stock;
    r[CAND.REORDER_POINT] = d.reorderPoint;
    r[CAND.SHORTAGE] = d.shortage;
    r[CAND.STATUS] = H_CONFIG.STATUS.DETECTED;
    r[CAND.NOTE] = d.warning;
    return r;
  });
  hAppendObjects_(S.CANDIDATES, records);

  result.errors.forEach(function (e) {
    hLog_('H01', 'WARN', '在庫シート' + e.row + '行目 ' + (e.code || '') + ' ' + e.name + '：' + e.reason);
  });
  result.detections.filter(function (d) { return d.warning; }).forEach(function (d) {
    hLog_('H01', 'WARN', d.code + ' ' + d.name + '：' + d.warning);
  });

  var summary = {
    worker: 'H01',
    scanned: result.scanned,
    detectedIds: records.map(function (r) { return r[CAND.ID]; }),
    skippedCount: result.skipped.length,
    errorCount: result.errors.length
  };
  hLog_('H01', 'INFO', 'スキャン' + summary.scanned + '件／新規検知' + summary.detectedIds.length +
    '件／スキップ' + summary.skippedCount + '件／エラー' + summary.errorCount + '件');
  return summary;
}
