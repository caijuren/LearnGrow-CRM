import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trash2, ShoppingCart, Calendar, User, Loader2, AlertTriangle,
} from 'lucide-react';
import { useStore } from '@/store';
import {
  ORDER_TYPE_LABELS,
} from '../../shared/types';
import Empty from '@/components/Empty';
import Loading from '@/components/ui/Loading';
import Modal from '@/components/Modal';

export default function OrderList() {
  const navigate = useNavigate();
  const {
    orders,
    totalOrders,
    loading,
    loadOrders,
    removeOrder,
  } = useStore();

  const [deletingOrder, setDeletingOrder] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadOrders({ page: 1, limit: 100 });
  }, [loadOrders]);

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
  );

  const handleDelete = async () => {
    if (!deletingOrder) return;
    setSubmitting(true);
    try {
      await removeOrder(deletingOrder);
      setDeletingOrder(null);
    } catch (e) {
      console.error('删除订单失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="page-shell">
      <div className="page-inner">
        {/* Header */}
        <div className="mb-6">
          <h1
            className="flex items-center gap-2"
            style={{
              fontSize: '1.375rem',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              lineHeight: 1.3,
            }}
          >
            <ShoppingCart size={20} strokeWidth={1.8} style={{ color: 'var(--color-primary)' }} />
            订单记录
          </h1>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-tertiary)',
              marginTop: '4px',
              marginLeft: '28px',
            }}
          >
            共 <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{totalOrders}</span> 笔订单
          </p>
        </div>

        {loading ? (
          <div className="panel py-16">
            <Loading />
          </div>
        ) : sortedOrders.length > 0 ? (
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            <div
              className="min-w-[720px] grid grid-cols-[1.2fr_1.4fr_120px_120px_56px] gap-4 px-4"
              style={{
                paddingTop: '10px',
                paddingBottom: '10px',
                fontSize: '0.6875rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                color: 'var(--color-text-tertiary)',
                backgroundColor: 'var(--color-bg-subtle)',
                borderBottom: '1px solid var(--color-border-default)',
              }}
            >
              <span>客户</span>
              <span>商品</span>
              <span>日期</span>
              <span className="text-right">金额</span>
              <span />
            </div>
            {sortedOrders.map(order => {
              const orderTypeStyles: Record<string, { bg: string; color: string; label: string }> = {
                 first: { bg: 'rgb(59 130 246 / 0.12)', color: 'rgb(37 99 235)', label: ORDER_TYPE_LABELS.first },
                 repurchase: { bg: 'rgb(16 185 129 / 0.12)', color: 'rgb(5 150 105)', label: ORDER_TYPE_LABELS.repurchase },
                 upsell: { bg: 'rgb(249 115 22 / 0.12)', color: 'rgb(234 88 12)', label: ORDER_TYPE_LABELS.upsell },
               };
              const typeStyle = orderTypeStyles[order.order_type] || orderTypeStyles.first;

              return (
                <div
                  key={order.id}
                  className="min-w-[720px] grid grid-cols-[1.2fr_1.4fr_120px_120px_56px] gap-4 items-center px-4 group transition-colors"
                  style={{
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div className="min-w-0">
                    <button
                      onClick={() => navigate(`/customers/${order.customer_id}`)}
                      className="flex items-center gap-1 transition-colors"
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                    >
                      <User size={12} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
                      {order.customer_name}
                    </button>
                    <span
                      className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded-sm"
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 500,
                        backgroundColor: typeStyle.bg,
                        color: typeStyle.color,
                      }}
                    >
                      {typeStyle.label}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ShoppingCart size={13} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                      <span
                        className="truncate"
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--color-text-primary)',
                          fontWeight: 500,
                        }}
                      >
                        {order.product_name}
                      </span>
                    </div>

                    {order.remark && (
                      <p
                        className="mt-2 line-clamp-1 px-2 py-1 rounded-sm"
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--color-text-tertiary)',
                          backgroundColor: 'var(--color-bg-subtle)',
                        }}
                      >
                        {order.remark}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                    <Calendar size={11} strokeWidth={1.8} />
                    {formatDate(order.purchase_date)}
                  </div>

                  <div className="text-right">
                    <div
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: 'var(--color-primary)',
                        lineHeight: 1.2,
                      }}
                    >
                      ¥{order.amount?.toLocaleString() || 0}
                    </div>
                  </div>

                  <button
                    onClick={() => setDeletingOrder(order.id)}
                    className="p-1.5 rounded-sm transition-all opacity-0 group-hover:opacity-100"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgb(239 68 68 / 0.1)';
                      e.currentTarget.style.color = 'rgb(220 38 38)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--color-text-tertiary)';
                    }}
                    title="删除订单"
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            icon={<ShoppingCart size={32} strokeWidth={1.8} style={{ color: 'var(--color-text-quaternary)' }} />}
            title="暂无订单记录"
            description="在客户详情页可以记录订单，所有订单都会在这里显示"
          />
        )}
      </div>

      <Modal
        isOpen={deletingOrder !== null}
        onClose={() => !submitting && setDeletingOrder(null)}
        title="确认删除订单"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeletingOrder(null)} disabled={submitting} className="btn-secondary flex-1">取消</button>
            <button onClick={handleDelete} disabled={submitting} className="btn-danger-solid flex-1">
              {submitting && <Loader2 size={13} strokeWidth={2} className="animate-spin" />}
              确认删除
            </button>
          </>
        }
      >
        <div className="text-center py-1">
          <div
            className="mx-auto mb-3 flex items-center justify-center"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgb(239 68 68 / 0.1)',
            }}
          >
            <AlertTriangle size={22} strokeWidth={1.8} style={{ color: 'rgb(220 38 38)' }} />
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>此操作不可撤销</p>
          <p style={{ fontSize: '0.75rem', color: 'rgb(220 38 38)', marginTop: '4px' }}>删除后相关统计数据也会更新</p>
        </div>
      </Modal>
    </div>
  );
}
