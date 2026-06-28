import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import CustomerList from '@/pages/CustomerList';
import CustomerDetail from '@/pages/CustomerDetail';
import ChildDetail from '@/pages/ChildDetail';
import GroupManagement from '@/pages/GroupManagement';
import ProductList from '@/pages/ProductList';
import OrderList from '@/pages/OrderList';
import LearningPathConfig from '@/pages/LearningPathConfig';
import LiveDesk from '@/pages/LiveDesk';
import UserManagement from '@/pages/UserManagement';
import MaterialLibrary from '@/pages/MaterialLibrary';
import Login from '@/pages/Login';
import CheckinList from '@/pages/CheckinList';
import CheckinDetail from '@/pages/CheckinDetail';
import { useStore } from '@/store';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useStore(s => s.isAuthenticated);
  const restoreAuth = useStore(s => s.restoreAuth);

  useEffect(() => {
    if (!isAuthenticated) restoreAuth();
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
  }, [isAuthenticated]);

  return <Layout />;
}

export default function App() {
  return (
    <Router>
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
          <Route path="materials" element={<MaterialLibrary />} />
          <Route path="checkin" element={<CheckinList />} />
          <Route path="checkin/:id" element={<CheckinDetail />} />
        </Route>
      </Routes>
    </Router>
  );
}
