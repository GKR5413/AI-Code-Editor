import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Index from './pages/Index';
import GitHubCallback from './pages/GitHubCallback';
import { ThemeProvider } from './contexts/ThemeContext';
import { IDEProvider } from './contexts/IDEContext';
import { GitHubProvider } from './contexts/GitHubContext';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <IDEProvider>
        <GitHubProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/github/callback" element={<GitHubCallback />} />
            </Routes>
          </Router>
        </GitHubProvider>
      </IDEProvider>
    </ThemeProvider>
  );
}

export default App;
