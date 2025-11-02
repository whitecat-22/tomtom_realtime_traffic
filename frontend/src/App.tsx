import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MapDashboard from './MapDashboard';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<MapDashboard />} />
          {/* 将来的に他のページ（例: 分析ページ）を追加できる */}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
