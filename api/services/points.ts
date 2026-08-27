import db from '../db.js';

const POINTS_DEFAULTS: Record<string, string> = {
  points_checkin: '10',
  points_order_rate: '1',
};

export function getSettingValue(key: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (row) return row.value;
  return POINTS_DEFAULTS[key] ?? '';
}

export function getIntSetting(key: string): number {
  const v = parseInt(getSettingValue(key), 10);
  if (Number.isFinite(v)) return v;
  return parseInt(POINTS_DEFAULTS[key] || '0', 10);
}

interface GrantPointsParams {
  wxUserId: number;
  amount: number;
  type: 'checkin' | 'order' | 'adjust';
  refType: 'none' | 'checkin_record' | 'order';
  refId?: number | null;
  note?: string | null;
  operatorId?: number | null;
  strict?: boolean;
}

export function grantPoints(p: GrantPointsParams): { ledgerId: number } | null {
  const { wxUserId, amount, type, refType, refId = null, note = null, operatorId = null, strict = false } = p;
  if (!wxUserId || !Number.isFinite(amount) || amount === 0) return null;

  const checkDup = db.prepare('SELECT id FROM points_ledger WHERE ref_type = ? AND ref_id = ?');
  const insertLedger = db.prepare(`
    INSERT INTO points_ledger (wx_user_id, amount, type, ref_type, ref_id, note, operator_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateBalance = db.prepare('UPDATE wx_users SET points = points + ? WHERE id = ?');

  const run = db.transaction((): { ledgerId: number } | null => {
    if (refType !== 'none' && checkDup.get(refType, refId)) {
      if (strict) throw new Error('积分流水已存在，不能重复加分');
      return null;
    }
    let ledgerId: number;
    try {
      const r = insertLedger.run(wxUserId, amount, type, refType, refId, note, operatorId);
      ledgerId = r.lastInsertRowid as number;
    } catch (err: any) {
      if (!strict && err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') return null;
      throw err;
    }
    updateBalance.run(amount, wxUserId);
    return { ledgerId };
  });

  return run();
}

export function grantCheckinPoints(wxUserId: number, recordId: number): { points_earned: number } | null {
  const amount = getIntSetting('points_checkin');
  if (amount <= 0) return null;
  const result = grantPoints({ wxUserId, amount, type: 'checkin', refType: 'checkin_record', refId: recordId });
  return result ? { points_earned: amount } : null;
}

export function grantOrderPoints(wxUserId: number, orderId: number, amount: number): { points_earned: number } | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const result = grantPoints({ wxUserId, amount: Math.floor(amount), type: 'order', refType: 'order', refId: orderId });
  return result ? { points_earned: Math.floor(amount) } : null;
}

// 按已存在流水的金额反向更新余额（不删流水，保留审计记录）
export function revokeByRef(wxUserId: number, refType: 'checkin_record' | 'order', refId: number): void {
  const ledger = db.prepare('SELECT amount FROM points_ledger WHERE wx_user_id = ? AND ref_type = ? AND ref_id = ?')
    .get(wxUserId, refType, refId) as { amount: number } | undefined;
  if (!ledger) return;
  db.prepare('UPDATE wx_users SET points = points - ? WHERE id = ?').run(ledger.amount, wxUserId);
}
