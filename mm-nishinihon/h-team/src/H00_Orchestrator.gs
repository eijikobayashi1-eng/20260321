/**
 * H00 受発注業務 司令塔（オーケストレーター）
 *
 * 役割：定期実行で起動し、各ワーカーを順番に呼び出して全体の進捗を管理する。
 *
 * 処理フロー（Phase 1）
 *   H01 在庫検知 → H02 発注量計算 → H03 発注書作成 → 👤社長承認 → H04 メール送信
 *
 * ※ 現在は H01 のみ実装済み。H02〜H04 は1体ずつ確認しながら追加していく。
 */
function H00_runPipeline() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) {
    hLog_('H00', 'WARN', '前回の処理が実行中のためスキップしました');
    return;
  }
  try {
    hLog_('H00', 'INFO', 'パイプライン開始');

    var h01 = H01_run();
    hLog_('H00', 'INFO', 'H01 完了：新規検知 ' + h01.detectedIds.length + '件' +
      (h01.errorCount ? '（データエラー ' + h01.errorCount + '件あり。実行ログを確認してください）' : ''));

    // TODO: H02 需要予測・発注量計算
    // TODO: H03 発注書作成 → ステータス「承認待ち」
    // （社長承認は人間が操作。H04 は承認済の候補だけを送信する）

    hLog_('H00', 'INFO', 'パイプライン終了');
  } catch (e) {
    hLog_('H00', 'ERROR', '異常終了：' + (e && e.message ? e.message : e));
    throw e;
  } finally {
    lock.releaseLock();
  }
}

/** 毎日 TRIGGER_HOUR 時に H00 を起動するトリガーを設定（既存分は置き換え） */
function H00_installDailyTrigger() {
  H00_removeTriggers();
  ScriptApp.newTrigger('H00_runPipeline')
    .timeBased()
    .everyDays(1)
    .atHour(H_CONFIG.TRIGGER_HOUR)
    .inTimezone(H_CONFIG.TIMEZONE)
    .create();
  hLog_('H00', 'INFO', '定期実行を設定しました（毎日 ' + H_CONFIG.TRIGGER_HOUR + '時台）');
}

/** H00 の定期実行トリガーを解除 */
function H00_removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'H00_runPipeline') ScriptApp.deleteTrigger(t);
  });
}
