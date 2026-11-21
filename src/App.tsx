import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ui';
import { api } from './lib/api';
import ClientApp from './pages/client/ClientApp';
import AdminApp from './pages/admin/AdminApp';

export default function App() {
  return (
    <ToastProvider>
      {api.mode === 'demo' && (
        <div className="demo-banner">نسخة تجريبية · رمز الدخول <b>1234</b> · لوحة الإدارة على <b>/admin</b> بكلمة المرور <b>admin</b></div>
      )}
      <BrowserRouter>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/*" element={<ClientApp />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
