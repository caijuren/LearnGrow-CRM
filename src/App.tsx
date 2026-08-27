import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useStore } from '@/store';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const CustomerList = lazy(() => import('@/pages/CustomerList'));
const CustomerDetail = lazy(() => import('@/pages/CustomerDetail'));
const ChildDetail = lazy(() => import('@/pages/ChildDetail'));
const GroupManagement = lazy(() => import('@/pages/GroupManagement'));
const ProductList = lazy(() => import('@/pages/ProductList'));
const OrderList = lazy(() => import('@/pages/OrderList'));
const LearningPathConfig = lazy(() => import('@/pages/LearningPathConfig'));
const LiveDesk = lazy(() => import('@/pages/LiveDesk'));
const UserManagement = lazy(() => import('@/pages/UserManagement'));
const WxUserList = lazy(() => import('@/pages/WxUserList'));
const MaterialLibrary = lazy(() => import('@/pages/MaterialLibrary'));
const Login = lazy(() => import('@/pages/Login'));
const CheckinList = lazy(() => import('@/pages/CheckinList'));
const CheckinDetail = lazy(() => import('@/pages/CheckinDetail'));
const Settings = lazy(() => import('@/pages/Settings'));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="h-10 w-10 rounded-full border-4 border-brand-100 border-t-rose-500 animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useStore(s => s.isAuthenticated);
  const restoreAuth = useStore(s => s.restoreAuth);

  useEffect(() => {
    if (!isAuthenticated) restoreAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppLayout() {
  const loadDashboard = useStore(s => s.loadDashboard);
  const loadCurrentUser = useStore(s => s.loadCurrentUser);
  const isAuthenticated = useStore(s => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      loadCurrentUser();
      loadDashboard();
    }
  }, [isAuthenticated, loadCurrentUser, loadDashboard]);

  return <Layout />;
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<CustomerList />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="customers/:id/children/:childId" element={<ChildDetail />} />
            <Route path="groups" element={<GroupManagement />} />
            <Route path="products" element={<ProductList />} />
            <Route path="orders" element={<OrderList />} />
            <Route path="learning-paths" element={<LearningPathConfig />} />
            <Route path="live" element={<LiveDesk />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="wx-users" element={<WxUserList />} />
            <Route path="materials" element={<MaterialLibrary />} />
            <Route path="checkin" element={<CheckinList />} />
            <Route path="checkin/:id" element={<CheckinDetail />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}
