import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { loadConnection } from "../core/connection";
import { RepositoriesContext } from "../core/repositories";
import { createRepositories } from "./container";
import LoginPage from "../feature/auth/LoginPage";
import CoordinationPage from "../feature/coordination/CoordinationPage";
import UserDetailPage from "../feature/users/UserDetailPage";
import UsersPage from "../feature/users/UsersPage";
import AppLayout from "../feature/shared/AppLayout";
import RequireAuth from "../feature/shared/RequireAuth";

// 接続先はアプリ起動時に 1 回決まる (切り替えるとリロードが走る)
const repositories = createRepositories(loadConnection());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ハッカソン向け: 画面に戻るたびに勝手に叩きに行かない
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RepositoriesContext value={repositories}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* コーデ提案はデモ用にログイン不要 */}
            <Route path="/coordinate" element={<CoordinationPage />} />
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route path="/" element={<UsersPage />} />
              <Route path="/users/:id" element={<UserDetailPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </RepositoriesContext>
    </QueryClientProvider>
  );
}
