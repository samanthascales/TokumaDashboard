import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppStoreProvider } from './store/AppStore';
import { AppLayout } from './components/layout/AppLayout';
import { Toaster } from './components/ui';
import Landing from './pages/Landing';
import SignIn from './pages/SignIn';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Transactions from './pages/Transactions';
import Circularity from './pages/Circularity';
import SupplyChain from './pages/SupplyChain';
import Funding from './pages/Funding';
import Customers from './pages/Customers';
import Education from './pages/Education';
import Settings from './pages/Settings';
import Investor from './pages/Investor';

export default function App() {
  return (
    <AppStoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products view="catalog" />} />
            <Route path="products/inventory" element={<Products view="inventory" />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="circularity" element={<Circularity />} />
            <Route path="supply-chain" element={<SupplyChain view="overview" />} />
            <Route path="supply-chain/reliability" element={<SupplyChain view="reliability" />} />
            <Route path="funding" element={<Funding />} />
            <Route path="customers" element={<Customers />} />
            <Route path="education" element={<Education />} />
            <Route path="settings" element={<Settings />} />
            <Route path="investor" element={<Investor />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </HashRouter>
    </AppStoreProvider>
  );
}
