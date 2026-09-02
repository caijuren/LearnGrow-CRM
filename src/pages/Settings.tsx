import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { DatabaseBackup, Download, Loader2, RefreshCw, Clock, HardDriveDownload, Coins, Save } from 'lucide-react';
import { fetchBackups, createBackup, downloadBackup, type BackupFileInfo } from '@/lib/api';
import { fetchPointsConfig, updatePointsConfig, resetPoints } from '@/lib/api';
import type { PointsConfig } from '../../shared/types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function Settings() {
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [pointsConfig, setPointsConfig] = useState<PointsConfig | null>(null);
  const [pointsCheckin, setPointsCheckin] = useState('');
  const [pointsRate, setPointsRate] = useState('');
  const [savingPoints, setSavingPoints] = useState(false);
  const [resettingPoints, setResettingPoints] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setBackups(await fetchBackups());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetchPointsConfig()
      .then((cfg) => {
        setPointsConfig(cfg);
        setPointsCheckin(String(cfg.points_checkin));
        setPointsRate(String(cfg.points_order_rate));
      })
      .catch((e) => setError(errMsg(e)));
  }, []);

  const handleSavePoints = async () => {
    const checkin = parseInt(pointsCheckin, 10);
    const rate = parseInt(pointsRate, 10);
    if (!Number.isFinite(checkin) || checkin <= 0) return setError('打卡积分必须是正整数');
    if (!Number.isFinite(rate) || rate <= 0) return setError('订单积分比例必须是正整数');
    setSavingPoints(true);
    setError('');
    setToast('');
    try {
      const updated = await updatePointsConfig({ points_checkin: checkin, points_order_rate: rate });
      setPointsConfig(updated);
      setToast('积分规则已保存');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSavingPoints(false);
    }
  };

  const handleResetPoints = async () => {
    if (!confirm('确定要清空所有用户的积分吗？此操作会同时清空积分流水，且无法恢复。')) return;
    setResettingPoints(true);
    setError('');
    setToast('');
    try {
      const r = await resetPoints();
      setToast(`积分已清零：${r.users} 个用户、${r.ledger} 条流水`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setResettingPoints(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    setToast('');
    try {
      const b = await createBackup();
      setToast(`备份成功：${b.name}`);
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (name: string) => {
    setDownloading(name);
    setError('');
    try {
      await downloadBackup(name);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-inner">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex items-center justify-between mb-6"
        >
          <motion.div variants={fadeUp}>
            <h1 className="text-[28px] font-bold text-text-primary tracking-tight">系统设置</h1>
            <p className="text-sm text-text-tertiary mt-1">积分规则与数据备份</p>
          </motion.div>
        </motion.div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-danger/30 bg-danger/10 text-danger text-sm">
            {error}
          </div>
        )}
        {toast && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-success/30 bg-success/10 text-success text-sm">
            {toast}
          </div>
        )}

        {/* 积分规则 */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-border-default bg-bg-surface p-6 mb-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Coins size={20} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-text-primary">积分规则</h2>
              <p className="text-sm text-text-tertiary mt-1 leading-relaxed">
                小程序打卡通过后自动加分；后台录入订单后，按订单金额给关联的微信用户加分。
              </p>
              {pointsConfig ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 max-w-xl">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      每次打卡得分（分）
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={pointsCheckin}
                      onChange={(e) => setPointsCheckin(e.target.value)}
                      className="input-base w-full"
                      placeholder="默认 10"
                    />
                    <p className="text-xs text-text-tertiary mt-1">当前规则：每次有效打卡 +{pointsConfig.points_checkin} 分</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      订单积分比例（每 1 元得几分）
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={pointsRate}
                      onChange={(e) => setPointsRate(e.target.value)}
                      className="input-base w-full"
                      placeholder="默认 1"
                    />
                    <p className="text-xs text-text-tertiary mt-1">当前规则：每 1 元得 {pointsConfig.points_order_rate} 分</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-4 text-sm text-text-tertiary">
                  <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
                  加载中...
                </div>
              )}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleSavePoints}
                  disabled={savingPoints || !pointsConfig}
                  className="btn btn-primary"
                >
                  {savingPoints ? (
                    <Loader2 size={15} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <Save size={15} strokeWidth={1.8} />
                  )}
                  {savingPoints ? '保存中...' : '保存规则'}
                </button>
                <button
                  onClick={handleResetPoints}
                  disabled={resettingPoints}
                  className="btn btn-secondary"
                  title="清空所有用户积分余额与流水"
                >
                  {resettingPoints ? (
                    <Loader2 size={15} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <RefreshCw size={15} strokeWidth={1.8} />
                  )}
                  {resettingPoints ? '清零中...' : '清空所有积分'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 备份说明与操作 */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-border-default bg-bg-surface p-6 mb-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl gradient-brand flex items-center justify-center text-white shrink-0 shadow-glow">
              <DatabaseBackup size={20} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-text-primary">数据备份</h2>
              <p className="text-sm text-text-tertiary mt-1 leading-relaxed">
                备份包含全部数据库数据（打卡活动、打卡记录、参与者、点赞、徽章等）和打卡图片/视频媒体文件，可完整还原。
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-xs text-text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={13} strokeWidth={1.8} className="text-text-tertiary" />
                  每天 03:30 自动备份一次
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <HardDriveDownload size={13} strokeWidth={1.8} className="text-text-tertiary" />
                  服务器保留最近 14 份
                </span>
              </div>
              <div className="mt-4">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="btn btn-primary"
                >
                  {creating ? (
                    <Loader2 size={15} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <Download size={15} strokeWidth={1.8} />
                  )}
                  {creating ? '备份中...' : '立即备份'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 备份列表 */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-border-default bg-bg-surface p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">
              服务器备份列表
              <span className="text-xs font-normal text-text-tertiary">
                （{backups.length} 份）
              </span>
            </h2>
            <button
              onClick={load}
              disabled={loading}
              className="btn btn-secondary"
              title="刷新"
            >
              <RefreshCw size={14} strokeWidth={1.8} className={loading ? 'animate-spin' : ''} />
              刷新
            </button>
          </div>

          {loading && backups.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-text-tertiary">
              <Loader2 size={16} strokeWidth={1.8} className="animate-spin mr-2" />
              加载中...
            </div>
          ) : backups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
              <div className="w-14 h-14 rounded-2xl bg-bg-subtle flex items-center justify-center mb-3">
                <DatabaseBackup size={22} strokeWidth={1.6} />
              </div>
              <p className="text-sm">暂无备份记录</p>
              <p className="text-xs mt-1">点击上方「立即备份」创建第一份备份</p>
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {backups.map((b) => (
                <li key={b.name} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-bg-subtle flex items-center justify-center text-text-secondary shrink-0">
                      <HardDriveDownload size={16} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-text-primary font-medium truncate">
                        {b.name}
                      </div>
                      <div className="text-xs text-text-tertiary mt-0.5">
                        {b.createdAt} · {formatFileSize(b.size)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(b.name)}
                    disabled={downloading === b.name}
                    className="btn btn-secondary shrink-0"
                  >
                    {downloading === b.name ? (
                      <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
                    ) : (
                      <Download size={14} strokeWidth={1.8} />
                    )}
                    下载
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>
    </div>
  );
}
