import { BrowserRouter, Route, Routes } from "react-router";

import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth } from "./auth/RequireAuth";
import { RequireRole } from "./auth/RequireRole";
import { AppShell } from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { UsersPage } from "./pages/admin/UsersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EditScenarioPage } from "./pages/EditScenarioPage";
import { LoginPage } from "./pages/LoginPage";
import { NewScenarioPage } from "./pages/NewScenarioPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ReportPage } from "./pages/ReportPage";
import { ScenarioPage } from "./pages/ScenarioPage";
import { TeacherDashboardPage } from "./pages/teacher/TeacherDashboardPage";
import { ConversationReviewPage } from "./pages/teacher/ConversationReviewPage";
import { ScenarioSubmissionsPage } from "./pages/teacher/ScenarioSubmissionsPage";
import { ThreadPage } from "./pages/thread/ThreadPage";
import { canTeach, isSuperAdmin } from "./lib/roles";

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
                <Route path="scenarios/:id" element={<ScenarioPage />} />
                <Route path="threads/:id" element={<ThreadPage />} />
                <Route path="threads/:id/report" element={<ReportPage />} />

                <Route element={<RequireRole allow={canTeach} />}>
                  <Route path="scenarios/new" element={<NewScenarioPage />} />
                  <Route path="scenarios/:id/edit" element={<EditScenarioPage />} />
                  <Route path="teacher" element={<TeacherDashboardPage />} />
                  <Route path="teacher/scenarios/:id" element={<ScenarioSubmissionsPage />} />
                  <Route path="teacher/conversations/:id" element={<ConversationReviewPage />} />
                </Route>

                <Route element={<RequireRole allow={isSuperAdmin} />}>
                  <Route path="admin/users" element={<UsersPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
