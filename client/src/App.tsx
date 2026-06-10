// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

const Landing        = React.lazy(() => import('./pages/Landing'));
const Login          = React.lazy(() => import('./pages/Login'));
const Dashboard      = React.lazy(() => import('./pages/Dashboard'));
const Editor         = React.lazy(() => import('./pages/Editor'));
const Create         = React.lazy(() => import('./pages/Create'));
const ProjectPodcasts = React.lazy(() => import('./components/ProjectPodcasts'));
const PodcastEditor  = React.lazy(() => import('./components/PodcastEditor'));
const Guide          = React.lazy(() => import('./pages/Guide'));

const Loader = () => (
  <div className="flex items-center justify-center h-screen">Chargement...</div>
);

function App() {
  const location = useLocation();
  return (
    <AuthProvider>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/guide" element={<Guide />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard key={location.key} />} />
            <Route path="/new-project" element={<Create />} />
            <Route path="/editor/:projectId" element={<Editor />} />
            <Route path="/project/:projectId/podcasts" element={<ProjectPodcasts />} />
            <Route path="/project/:projectId/podcast/:podcastId/edit" element={<PodcastEditor />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
