import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trash2, ShoppingCart, Calendar, User, Loader2, AlertTriangle,
} from 'lucide-react';
import { useStore } from '@/store';
import {
  ORDER_TYPE_LABELS, ORDER_TYPE_COLORS,
} from '../../shared/types';
import Empty from '@/components/Empty';

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
  }, []);

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
    <div className="min-h-screen bg-gradient-to-b from-rose-50/30 to-white p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-pink-500 bg-clip-text text-transparent">
            订单记录
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            共 <span className="font-semibold text-rose-600">{totalOrders}</span> 笔订单
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
            <p className="text-sm text-slate-500 mt-3">加载中...</p>
          </div>
        ) : sortedOrders.length > 0 ? (
          <div className="space-y-3">
            {sortedOrders.map(order => (
              <div
                key={order.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md hover:border-rose-200 transition-all duration-300 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <button
                        onClick={() => navigate(`/customers/${order.customer_id}`)}
                        className="flex items-center gap-1 text-sm font-semibold text-slate-800 hover:text-rose-600 transition-colors"
                      >
                        <User className="w-3.5 h-3.5" />
                        {order.customer_name}
                      </button>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${ORDER_TYPE_COLORS[order.order_type]}`}>
                        {ORDER_TYPE_LABELS[order.order_type]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingCart className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-700 font-medium">{order.product_name}</span>
                    </div>

                    {order.remark && (
                      <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-2 line-clamp-2">
                        {order.remark}
                      </p>
                    )}

                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {formatDate(order.purchase_date)}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-lg font-bold bg-gradient-to-r from-rose-600 to-pink-500 bg-clip-text text-transparent">
                      ¥{order.amount?.toLocaleString() || 0}
                    </div>
                    <button
                      onClick={() => setDeletingOrder(order.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      title="删除订单"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={<ShoppingCart className="w-10 h-10 text-rose-300" />}
            title="暂无订单记录"
            description="在客户详情页可以记录订单，所有订单都会在这里显示"
          />
        )}
      </div>

      {deletingOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !submitting && setDeletingOrder(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">确认删除订单？</h3>
              <p className="text-sm text-slate-500 mb-1">此操作不可撤销</p>
              <p className="text-xs text-red-500">删除后相关统计数据也会更新</p>
            </div>
            <div className="flex items-center gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setDeletingOrder(null)}
                disabled={submitting}
                className="flex-1 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
