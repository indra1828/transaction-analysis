import { BrowserRouter, Route, Routes } from "react-router";

import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { NewScenarioPage } from "./pages/NewScenarioPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ReportPage } from "./pages/ReportPage";
import { ScenarioPage } from "./pages/ScenarioPage";
import { ThreadPage } from "./pages/thread/ThreadPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="scenarios/new" element={<NewScenarioPage />} />
                <Route path="scenarios/:id" element={<ScenarioPage />} />
                <Route path="threads/:id" element={<ThreadPage />} />
                <Route path="threads/:id/report" element={<ReportPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
