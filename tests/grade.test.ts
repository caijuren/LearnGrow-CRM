import { describe, it, expect } from 'vitest';
import {
  GRADES, gradeLabel, schoolYearStart, schoolYearLabel,
  currentSchoolYearStart, isGradeStale,
} from '../shared/types';

describe('年级枚举', () => {
  it('覆盖入园前到初中，不含高中', () => {
    expect(GRADES.slice(0, 5)).toEqual(['未入园', '小班', '中班', '大班', '幼小衔接']);
    expect(GRADES.filter(g => g.startsWith('高'))).toEqual([]);
    expect(GRADES).toContain('七年级');
    expect(GRADES).not.toContain('初一');
  });

  it('存储值显示成家长熟悉的说法，未知值原样显示不留空白', () => {
    expect(gradeLabel('七年级')).toBe('七年级（初一）');
    expect(gradeLabel('四年级')).toBe('四年级');
    expect(gradeLabel('初一')).toBe('初一');
    expect(gradeLabel(null)).toBe('—');
  });
});

describe('学年与年级过期判定', () => {
  it('9/1 开学，8/31 仍属上一学年', () => {
    expect(schoolYearStart('2026-08-31')).toBe(2025);
    expect(schoolYearStart('2026-09-01')).toBe(2026);
    expect(schoolYearLabel(2025)).toBe('2025/2026 学年');
  });

  it('当前学年按同一条边界划分', () => {
    expect(currentSchoolYearStart(new Date(2026, 7, 30))).toBe(2025);
    expect(currentSchoolYearStart(new Date(2026, 8, 1))).toBe(2026);
  });

  it('新学年第一天就把上学年确认的年级判为待确认', () => {
    const septFirst = new Date(2026, 8, 1);
    expect(isGradeStale('2026-08-31', septFirst)).toBe(true);
    expect(isGradeStale('2026-09-01', septFirst)).toBe(false);
    expect(isGradeStale('2026-08-31', new Date(2026, 7, 29))).toBe(false);
    expect(isGradeStale(null)).toBe(true);
  });
});
