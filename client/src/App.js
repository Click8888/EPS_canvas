import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import Navbar from './components/Navbar';
import Graph from './Graph.js';
import Admin from './Admin.js';
import { ThemeProvider } from './components/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <div className='erd-container d-flex flex-column vh-100'>
        <Navbar />
        <Routes>

          <Route path="/" element={<Graph />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/graph" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </ThemeProvider>
  );
}

export default App;