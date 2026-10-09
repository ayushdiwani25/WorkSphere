
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthProvider from './components/AuthContext';
import DashboardLayout from './components/DashboardLayout';
import Login from './components/Login';
import WorkflowBoard from './components/WorkflowBoard';
import TeamMembers from './components/TeamMembers';
import LandingPage from './components/LandingPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<WorkflowBoard />} />
            <Route path="board/:boardId" element={<WorkflowBoard />} />
            <Route path="members" element={<TeamMembers />} />
          </Route>
          <Route path="/login" element={<Login />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}


