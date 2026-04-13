import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Create from './pages/Create';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import ProjectPodcasts from './pages/ProjectPodcasts';
import PodcastEditor from './pages/PodcastEditor';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/new-project" element={<Create />} />
          <Route path="/editor/:projectId" element={<Editor />} />
          <Route path="/project/:projectId/podcasts" element={<ProjectPodcasts />} />
          <Route path="/project/:projectId/podcast/:podcastId/edit" element={<PodcastEditor />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
