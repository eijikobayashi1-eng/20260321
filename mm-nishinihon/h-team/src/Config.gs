/**
 * Hチーム 受発注・在庫管理AIエージェント ― 共通設定
 *
 * 第7回（2026-11-16）の現場確認で、実際のスプレッドシートの列名が判明したら
 * このファイルの COL の右側（'商品コード' など）だけを書き換えれば全ワーカーに反映される。
 */
var H_CONFIG = {
  TIMEZONE: 'Asia/Tokyo',

  // 定期実行の時刻（毎日この時刻に H00 が起動）
  TRIGGER_HOUR: 7,

  // シート名
  SHEETS: {
    INVENTORY: '在庫',
    MAKERS: 'メーカーマスタ',
    HISTORY: '発注実績',
    CANDIDATES: '発注候補',
    LOG: '実行ログ'
  },

  // 列名（ヘッダー行の文字列）
  COL: {
    INV: {
      CODE: '商品コード',
      NAME: '商品名',
      MAKER: 'メーカーコード',
      STOCK: '現在庫数',
      REORDER_POINT: '発注基準値',
      UNIT: '単位',
      ACTIVE: '発注対象'
    },
    MAKER: {
      CODE: 'メーカーコード',
      NAME: 'メーカー名',
      METHOD: '発注方法',       // メール / FAX / 専用システム
      EMAIL: 'メールアドレス',
      CONTACT: '担当者名',
      NOTE: '備考'
    },
    HISTORY: {
      DATE: '発注日',
      CODE: '商品コード',
      QTY: '発注数量'
    },
    CAND: {
      ID: '候補ID',
      DETECTED_AT: '検知日時',
      CODE: '商品コード',
      NAME: '商品名',
      MAKER: 'メーカーコード',
      MAKER_NAME: 'メーカー名',
      STOCK: '現在庫数',
      REORDER_POINT: '発注基準値',
      SHORTAGE: '不足数',
      STATUS: 'ステータス',
      SUGGESTED_QTY: '推奨発注数',   // H02 が記入
      FINAL_QTY: '確定発注数',       // H02 記入 → 社長が修正可
      PO_ID: '発注書ID',             // H03 が記入
      APPROVED_BY: '承認者',         // 社長承認時に記入
      APPROVED_AT: '承認日時',
      SENT_AT: '送信日時',           // H04 が記入
      NOTE: '備考'
    },
    LOG: {
      AT: '日時',
      WORKER: 'ワーカー',
      LEVEL: 'レベル',
      MESSAGE: 'メッセージ'
    }
  },

  // 発注候補のステータス（パイプラインの進行状況）
  STATUS: {
    DETECTED: '検知済',            // H01
    QTY_CALCULATED: '数量計算済',  // H02
    AWAITING_APPROVAL: '承認待ち', // H03（発注書作成済）
    APPROVED: '承認済',            // 社長
    SENT: '送信済',                // H04（メール）
    MANUAL_REQUIRED: '手動発注要', // H04（FAX・専用システム）
    MANUAL_DONE: '手動発注済',     // 担当者
    CANCELLED: '取消'              // 社長・担当者
  },

  // 発注対象列でこれらの値なら「対象外」とみなす（空欄は対象）
  INACTIVE_VALUES: ['FALSE', 'false', '×', '✕', '停止', '対象外', 'いいえ', 'NO', 'no', '0']
};

// 処理が完了した（＝再検知してよい）ステータス
H_CONFIG.CLOSED_STATUSES = [
  H_CONFIG.STATUS.SENT,
  H_CONFIG.STATUS.MANUAL_DONE,
  H_CONFIG.STATUS.CANCELLED
];
