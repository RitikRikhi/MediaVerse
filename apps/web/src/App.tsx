import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { FieldCrewPortalPage } from './pages/FieldCrewPortalPage';
import { EditorWorkspacePage } from './pages/EditorWorkspacePage';
import { ReviewApprovalPage } from './pages/ReviewApprovalPage';
import { MediaLibraryPage } from './pages/MediaLibraryPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { DriveSettingsPage } from './pages/DriveSettingsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { TutorialPage } from './pages/TutorialPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/assignments" element={<AssignmentsPage />} />
            <Route path="/field-crew" element={<FieldCrewPortalPage />} />
            <Route path="/upload" element={<Navigate to="/field-crew" replace />} />
            <Route path="/editor" element={<EditorWorkspacePage />} />
            <Route path="/reviews" element={<ReviewApprovalPage />} />
            <Route path="/media" element={<MediaLibraryPage />} />
            <Route path="/ai" element={<AIAssistantPage />} />
            <Route path="/tutorial" element={<TutorialPage />} />
            <Route path="/drive" element={<DriveSettingsPage />} />
            <Route path="/audit" element={<AuditLogsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
