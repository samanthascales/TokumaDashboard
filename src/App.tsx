import { HashRouter, MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
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
import Home from './pages/Home';
import Reports from './pages/Reports';
import Products from './pages/Products';
import Transactions from './pages/Transactions';
import Circularity from './pages/Circularity';
import SupplyChain from './pages/SupplyChain';
import Funding from './pages/Funding';
import Customers from './pages/Customers';
import Education from './pages/Education';
import Diagnostic from './pages/education/Diagnostic';
import ModulePage from './pages/education/ModulePage';
import Settings from './pages/Settings';
import Investor from './pages/Investor';
import Admin from './pages/Admin';

const Router = IS_EMBEDDED ? MemoryRouter : HashRouter;

/** Old links keep working: they forward to the page's new address, query included. */
function Moved({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={to + search} replace />;
}

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
              <Route index element={<Home />} />
              <Route path="money" element={<Transactions />} />
              <Route path="products" element={<Products view="catalog" />} />
              <Route path="products/inventory" element={<Products view="inventory" />} />
              <Route path="products/suppliers" element={<SupplyChain view="overview" />} />
              <Route path="circularity" element={<Circularity />} />
              <Route path="reports" element={<Reports />} />
              <Route path="learn" element={<Education />} />
              <Route path="learn/diagnostic" element={<Diagnostic />} />
              <Route path="learn/modules/:moduleId" element={<ModulePage />} />
              <Route path="learn/funding" element={<Funding />} />
              <Route path="settings" element={<Settings />} />
              <Route path="supply-chain/reliability" element={<SupplyChain view="reliability" />} />
              <Route path="customers" element={<Customers />} />
              <Route path="investor" element={<Investor />} />
              <Route path="transactions" element={<Moved to="/app/money" />} />
              <Route path="supply-chain" element={<Moved to="/app/products/suppliers" />} />
              <Route path="education" element={<Moved to="/app/learn" />} />
              <Route path="funding" element={<Moved to="/app/learn/funding" />} />
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
