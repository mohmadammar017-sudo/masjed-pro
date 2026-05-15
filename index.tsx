import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminApp from './components/admin/AdminApp';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const isAdminRoute = () => {
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  return params.has('admin') || pathname.endsWith('/admin') || hash.startsWith('#/admin');
};

root.render(
  <React.StrictMode>
    {isAdminRoute() ? <AdminApp /> : <App />}
  </React.StrictMode>
);
