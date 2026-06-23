import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ClientsPage } from "./pages/ClientsPage";
import { ClientDetailPage } from "./pages/ClientDetailPage";
import { ClientFormPage } from "./pages/ClientFormPage";
import { MetricsPage } from "./pages/MetricsPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminTagsPage } from "./pages/admin/AdminTagsPage";
import { AdminSkillsPage } from "./pages/admin/AdminSkillsPage";
import { AdminSipExtensionsPage } from "./pages/admin/AdminSipExtensionsPage";
import { AdminInboundRoutingPage } from "./pages/admin/AdminInboundRoutingPage";
import { AdminParkingPage } from "./pages/admin/AdminParkingPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute roles={["ADMIN"]}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Shell><DashboardPage /></Shell>} />
      <Route path="/dashboard" element={<Shell><DashboardPage /></Shell>} />
      <Route path="/clients" element={<Shell><ClientsPage /></Shell>} />
      <Route path="/clients/new" element={<Shell><ClientFormPage mode="create" /></Shell>} />
      <Route path="/clients/:id" element={<Shell><ClientDetailPage /></Shell>} />
      <Route path="/clients/:id/edit" element={<Shell><ClientFormPage mode="edit" /></Shell>} />
      <Route path="/metrics" element={<Shell><MetricsPage /></Shell>} />
      <Route path="/admin/users" element={<AdminShell><AdminUsersPage /></AdminShell>} />
      <Route path="/admin/tags" element={<AdminShell><AdminTagsPage /></AdminShell>} />
      <Route path="/admin/skills" element={<AdminShell><AdminSkillsPage /></AdminShell>} />
      <Route path="/admin/sip-extensions" element={<AdminShell><AdminSipExtensionsPage /></AdminShell>} />
      <Route path="/admin/inbound-routing" element={<AdminShell><AdminInboundRoutingPage /></AdminShell>} />
      <Route path="/admin/parking" element={<AdminShell><AdminParkingPage /></AdminShell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
