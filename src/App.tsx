import { HashRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { IS_EMBEDDED } from './env';
import { I18nProvider } from './i18n';
import { AppStoreProvider } from './store/AppStore';
import { CloudProvider } from './store/CloudProvider';
import { AppLayout } from './components/layout/AppLayout';
import { PasswordRecovery, RequireAccount } from './components/layout/Account';
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
import Admin from './pages/Admin';

const Router = IS_EMBEDDED ? MemoryRouter : HashRouter;

export default function App() {
  return (
    <I18nProvider>
    <AppStoreProvider>
      <CloudProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/signin" element={<SignIn />} />
            <Route
              path="/onboarding"
              element={
                <RequireAccount>
                  <Onboarding />
                </RequireAccount>
              }
            />
            <Route
              path="/app"
              element={
                <RequireAccount>
                  <AppLayout />
                </RequireAccount>
              }
            >
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
              <Route path="admin" element={<Admin />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <PasswordRecovery />
          <Toaster />
        </Router>
      </CloudProvider>
    </AppStoreProvider>
    </I18nProvider>
  );
}
