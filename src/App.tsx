import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { ProviderPage } from './pages/ProviderPage';
import { TemplatePage } from './pages/TemplatePage';
import { OrdersPage } from './pages/OrdersPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="providers/:id" element={<ProviderPage />} />
          <Route path="templates/:name" element={<TemplatePage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="notifications" element={<OrdersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
