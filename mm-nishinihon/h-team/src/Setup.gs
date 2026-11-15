/**
 * スプレッドシートのメニューと初期セットアップ
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Hチーム')
    .addItem('▶ 今すぐ実行（H00 司令塔）', 'H00_runPipeline')
    .addItem('H01 在庫チェックのみ実行', 'menuRunH01_')
    .addSeparator()
    .addItem('初期セットアップ（シート作成）', 'hSetup')
    .addItem('サンプルデータ投入（テスト用）', 'hInsertSampleData')
    .addSeparator()
    .addItem('定期実行を設定（毎日）', 'H00_installDailyTrigger')
    .addItem('定期実行を解除', 'H00_removeTriggers')
    .addToUi();
}

function menuRunH01_() {
  var r = H01_run();
  SpreadsheetApp.getUi().alert(
    'H01 在庫チェック完了\n\n' +
    'スキャン：' + r.scanned + '件\n' +
    '新規検知：' + r.detectedIds.length + '件\n' +
    'スキップ：' + r.skippedCount + '件（対象外・処理中）\n' +
    'エラー　：' + r.errorCount + '件' + (r.errorCount ? '（「実行ログ」シートを確認）' : ''));
}

/** 必要なシートとヘッダー行を作成（既存シートのデータは消さない） */
function hSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var S = H_CONFIG.SHEETS;
  var C = H_CONFIG.COL;
  var defs = [
    [S.INVENTORY, values_(C.INV)],
    [S.MAKERS, values_(C.MAKER)],
    [S.HISTORY, values_(C.HISTORY)],
    [S.CANDIDATES, values_(C.CAND)],
    [S.LOG, values_(C.LOG)]
  ];
  defs.forEach(function (d) {
    var sh = ss.getSheetByName(d[0]) || ss.insertSheet(d[0]);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, d[1].length).setValues([d[1]])
        .setFontWeight('bold').setBackground('#1A3D7C').setFontColor('#FFFFFF');
      sh.setFrozenRows(1);
    }
  });
  hLog_('SETUP', 'INFO', '初期セットアップ完了');
}

/** テスト用サンプルデータ（在庫・メーカーマスタが空のときだけ投入） */
function hInsertSampleData() {
  var S = H_CONFIG.SHEETS;
  if (hSheet_(S.INVENTORY).getLastRow() > 1 || hSheet_(S.MAKERS).getLastRow() > 1) {
    SpreadsheetApp.getUi().alert('在庫またはメーカーマスタにデータがあるため、サンプル投入を中止しました。');
    return;
  }
  var INV = H_CONFIG.COL.INV, MK = H_CONFIG.COL.MAKER;
  hAppendObjects_(S.MAKERS, [
    obj_(MK, { CODE: 'M001', NAME: 'Aメーカー（サンプル）', METHOD: 'メール', EMAIL: 'order-a@example.com', CONTACT: '担当A' }),
    obj_(MK, { CODE: 'M002', NAME: 'Bメーカー（サンプル）', METHOD: 'メール', EMAIL: 'order-b@example.com', CONTACT: '担当B' }),
    obj_(MK, { CODE: 'M003', NAME: 'Cメーカー（サンプル）', METHOD: 'FAX', EMAIL: '', CONTACT: '担当C', NOTE: 'FAX専用' })
  ]);
  hAppendObjects_(S.INVENTORY, [
    obj_(INV, { CODE: 'P001', NAME: '牛乳 1000ml', MAKER: 'M001', STOCK: 12, REORDER_POINT: 30, UNIT: '本' }),
    obj_(INV, { CODE: 'P002', NAME: '低脂肪乳 1000ml', MAKER: 'M001', STOCK: 40, REORDER_POINT: 20, UNIT: '本' }),
    obj_(INV, { CODE: 'P003', NAME: 'ヨーグルト 400g', MAKER: 'M002', STOCK: 15, REORDER_POINT: 15, UNIT: '個' }),
    obj_(INV, { CODE: 'P004', NAME: '乳酸菌飲料 65ml×10', MAKER: 'M002', STOCK: 50, REORDER_POINT: 25, UNIT: 'P' }),
    obj_(INV, { CODE: 'P005', NAME: '豆乳 200ml', MAKER: 'M003', STOCK: 8, REORDER_POINT: 24, UNIT: '本' }),
    obj_(INV, { CODE: 'P006', NAME: 'コーヒー牛乳 500ml', MAKER: 'M003', STOCK: 30, REORDER_POINT: 10, UNIT: '本' }),
    obj_(INV, { CODE: 'P007', NAME: '季節限定プリン', MAKER: 'M002', STOCK: 0, REORDER_POINT: 10, UNIT: '個', ACTIVE: '停止' })
  ]);
  SpreadsheetApp.getUi().alert('サンプルデータを投入しました。\nメニュー「H01 在庫チェックのみ実行」で、P001・P003・P005 の3件が検知されれば正常です。');
}

function values_(colDef) {
  return Object.keys(colDef).map(function (k) { return colDef[k]; });
}

function obj_(colDef, data) {
  var o = {};
  Object.keys(data).forEach(function (k) { o[colDef[k]] = data[k]; });
  return o;
}
