import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Page Imports
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import CreateTest from './pages/CreateTest';
import ManageTests from './pages/ManageTests';
import LiveMonitoring from './pages/LiveMonitoring';
import ReportsPage from './pages/ReportsPage';
import StudentJoin from './pages/StudentJoin';
import StudentExam from './pages/StudentExam';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/create-test" element={<CreateTest />} />
          <Route path="/admin/manage-tests" element={<ManageTests />} />
          <Route path="/admin/monitoring" element={<LiveMonitoring />} />
          <Route path="/admin/reports" element={<ReportsPage />} />

          {/* Student Entrance and Exam Routes */}
          <Route path="/join" element={<StudentJoin />} />
          <Route path="/exam/:testId" element={<StudentExam />} />

          {/* Fallbacks */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
