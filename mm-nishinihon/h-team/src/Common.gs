/**
 * 共通ユーティリティ（全ワーカーで使用）
 */

/** 値を数値に変換。全角数字・カンマ・空白に対応。変換できなければ NaN */
function hToNumber_(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'number') return v;
  var s = String(v)
    .replace(/[０-９．－]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
    .replace(/[,，\s]/g, '');
  if (s === '') return NaN;
  return Number(s);
}

/** 空白を除いた文字列 */
function hStr_(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** 日付を Asia/Tokyo で整形 */
function hFormatDate_(d, fmt) {
  return Utilities.formatDate(d, H_CONFIG.TIMEZONE, fmt);
}

function hSheet_(sheetName) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sh) throw new Error('シートが見つかりません：「' + sheetName + '」。メニュー「Hチーム > 初期セットアップ」を実行してください。');
  return sh;
}

/**
 * シートを読み込み、1行＝1オブジェクト（キーはヘッダー名）の配列で返す。
 * 各オブジェクトには _rowNumber（シート上の行番号）が付く。空行は除外。
 */
function hReadTable_(sheetName) {
  var sh = hSheet_(sheetName);
  var values = sh.getDataRange().getValues();
  if (values.length === 0) return { sheet: sh, headers: [], rows: [] };
  var headers = values[0].map(hStr_);
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = { _rowNumber: i + 1 };
    var hasValue = false;
    for (var j = 0; j < headers.length; j++) {
      if (!headers[j]) continue;
      obj[headers[j]] = values[i][j];
      if (values[i][j] !== '' && values[i][j] !== null) hasValue = true;
    }
    if (hasValue) rows.push(obj);
  }
  return { sheet: sh, headers: headers, rows: rows };
}

/** 必須列がそろっているか確認。不足があれば例外 */
function hRequireColumns_(table, sheetName, requiredCols) {
  var missing = requiredCols.filter(function (c) { return table.headers.indexOf(c) < 0; });
  if (missing.length) {
    throw new Error('「' + sheetName + '」シートに必要な列がありません：' + missing.join('、'));
  }
}

/** オブジェクト配列をシート末尾に追記（ヘッダー名で列を合わせる） */
function hAppendObjects_(sheetName, objects) {
  if (!objects.length) return;
  var sh = hSheet_(sheetName);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(hStr_);
  var data = objects.map(function (o) {
    return headers.map(function (h) { return o[h] !== undefined ? o[h] : ''; });
  });
  sh.getRange(sh.getLastRow() + 1, 1, data.length, headers.length).setValues(data);
}

/** 実行ログシートに1行記録（console にも出力） */
function hLog_(worker, level, message) {
  var L = H_CONFIG.COL.LOG;
  console.log('[' + worker + '][' + level + '] ' + message);
  try {
    var row = {};
    row[L.AT] = new Date();
    row[L.WORKER] = worker;
    row[L.LEVEL] = level;
    row[L.MESSAGE] = message;
    hAppendObjects_(H_CONFIG.SHEETS.LOG, [row]);
  } catch (e) {
    console.error('ログ書き込み失敗: ' + e);
  }
}
