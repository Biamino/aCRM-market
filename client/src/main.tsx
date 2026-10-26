import { lazy, StrictMode, Suspense, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
// шрифты с нашего домена: без блокирующего запроса к Google Fonts, кириллица по unicode-range
import "@fontsource/cormorant/400.css";
import "@fontsource/cormorant/500.css";
import "@fontsource/cormorant/500-italic.css";
import "@fontsource-variable/montserrat";
import "./index.css";
import { StoreProvider, useAuth } from "./store";
import Layout from "./components/Layout";
import CatalogPage from "./pages/CatalogPage";
import ProductPage from "./pages/ProductPage";
import CartPage from "./pages/CartPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OrdersPage from "./pages/OrdersPage";
import LegalPage from "./pages/LegalPage";

// Админ-панель (вместе с recharts) грузится отдельным чанком
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AnalyticsPage = lazy(() => import("./pages/admin/AnalyticsPage"));
const InsightsPage = lazy(() => import("./pages/admin/InsightsPage"));
const RegistrationsPage = lazy(() => import("./pages/admin/RegistrationsPage"));
const AdminOrdersPage = lazy(() => import("./pages/admin/AdminOrdersPage"));
const AdminProductsPage = lazy(() => import("./pages/admin/AdminProductsPage"));

function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return null;
  // после входа вернём туда, куда шли (например, по ссылке на модель из WhatsApp)
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (admin && user.role !== "ADMIN") return <Navigate to="/" replace />;
  return <>{children}</>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<CatalogPage />} />
            <Route
              path="product/:id"
              element={
                <RequireAuth>
                  <ProductPage />
                </RequireAuth>
              }
            />
            <Route path="cart" element={<CartPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="legal/:slug" element={<LegalPage />} />
            <Route path="legal" element={<Navigate to="/legal/terms" replace />} />
            <Route
              path="orders"
              element={
                <RequireAuth>
                  <OrdersPage />
                </RequireAuth>
              }
            />
            <Route
              path="admin"
              element={
                <RequireAuth admin>
                  <Suspense fallback={<p className="py-10 text-sm text-dim">Загружаем…</p>}>
                    <AdminLayout />
                  </Suspense>
                </RequireAuth>
              }
            >
              <Route index element={<AnalyticsPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="registrations" element={<RegistrationsPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="orders" element={<AdminOrdersPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  </StrictMode>,
);
