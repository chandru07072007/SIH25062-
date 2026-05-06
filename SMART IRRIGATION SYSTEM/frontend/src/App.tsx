import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SoilAnalysis from './pages/SoilAnalysis';
import CropRecommendation from './pages/CropRecommendation';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/ADMINUserDashboard';
import LoanMarketplace from './pages/LoanMarketplace';
import SellerMarketplace from './pages/SellerMarketplace';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/crop-recommendation" element={<CropRecommendation />} />
        <Route path="/loans" element={<LoanMarketplace />} />
        <Route path="/marketplace" element={<SellerMarketplace />} />
        <Route path="/analysis/:id" element={<SoilAnalysis />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/users" element={<UserDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
