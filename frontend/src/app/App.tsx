import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router";
import { loadConnection } from "../core/connection";
import { RepositoriesContext } from "../core/repositories";
import { createRepositories } from "./container";
import LoginPage from "../feature/auth/LoginPage";
import UserDetailPage from "../feature/users/UserDetailPage";
import AppLayout from "../feature/shared/AppLayout";
import RequireAuth from "../feature/shared/RequireAuth";
import RoomListPage from '../feature/room/RoomListPage';
import RoomStudioPage from "../feature/room/RoomStudioPage";

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

function RoomStudioRoute() {
  const { id } = useParams();
  return <RoomStudioPage key={id} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RepositoriesContext value={repositories}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/rooms/sample-oshi" replace />} />
            <Route path="/rooms" element={<RoomListPage />} />
            <Route path="/coordinate" element={<Navigate to="/rooms/new" replace />} />
            <Route path="/rooms/:id" element={<RoomStudioRoute />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<LoginPage key="signup" />} />
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route path="/account" element={<UserDetailPage />} />
              <Route path="/users" element={<Navigate to="/account" replace />} />
              <Route path="/users/:id" element={<UserDetailPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </RepositoriesContext>
    </QueryClientProvider>
  );
}
