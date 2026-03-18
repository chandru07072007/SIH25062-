import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Camera, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import type { User } from '../context/UserContext';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { t, setLanguage, language } = useLanguage();
  const { login } = useUser();
  const [recognizing, setRecognizing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Define a static list of users with local images
  const staticUsers: User[] = [
    { id: '1', name: 'YOKESH', role: 'Farmer', image: '/images/USER 1.jpeg' },
    { id: '2', name: 'ARIVU', role: 'Farmer', image: '/images/USER 2.jpeg' },
    { id: '3', name: 'MUNISAMY', role: 'Farmer', image: 'public/images/USER 3.jpeg' },
    { id: '4', name: 'PUSHPAM', role: 'Farmer', image: 'public/images/USER 4.jpeg' },
    { id: '5', name: 'PALANISAMY', role: 'Farmer', image: 'public/images/USER 5.jpeg' },
  ];

  // Load users from Supabase (or use static data as a fallback)
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { data: farmers, error } = await supabase
          .from('farm')
          .select('farmer_id, name, mobile_number, village, farm_image')
          .order('farmer_id', { ascending: true });

        if (error) throw error;

        if (farmers && farmers.length > 0) {
          // Map farmers to User format
          const mappedUsers: User[] = farmers.map((farmer, index) => ({
            id: `farmer-${farmer.farmer_id}`,
            name: farmer.name || 'Unknown Farmer',
            role: farmer.village ? `Farmer (${farmer.village})` : 'Farmer',
            // Use farm_image or fallback to a unique placeholder
            image: farmer.farm_image || `https://picsum.photos/seed/}/200`
          }));
          setUsers(mappedUsers);
        } else {
          // Fallback to static users if no users in DB
          setUsers(staticUsers);
        }
      } catch (error) {
        console.error('Error loading users, falling back to static data:', error);
        // Fallback to static users on error
        setUsers(staticUsers);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  const startCamera = async (user: User | null = null) => {
    setSelectedUser(user);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      setRecognizing(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(e => console.error(e));
        }
      }, 100);

      // Simulate scanning and verification
      setTimeout(() => {
        // If user was selected by clicking profile, use that.
        // If "Quick Login" was clicked without selecting a user, default to the first user
        const userToLogin = user || users[0];

        stopCamera();
        login(userToLogin);
        navigate('/dashboard');
      }, 3000);

    } catch (err) {
      console.error("Error asking for camera permission:", err);
      alert("Camera access required for login simulation. Proceeding to dashboard...");
      setRecognizing(false);
      // Fallback login
      const userToLogin = user || users[0];
      login(userToLogin);
      setTimeout(() => navigate('/dashboard'), 500);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setRecognizing(false);
    setSelectedUser(null);
  };

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    }
  }, [stream]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-between p-8 relative font-sans">
      {/* Camera Modal */}
      {recognizing && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white p-2 rounded-3xl relative w-full max-w-lg shadow-2xl overflow-hidden">
            <button onClick={stopCamera} className="absolute top-4 right-4 z-20 bg-black/40 p-2 rounded-full text-white hover:bg-black/60 transition">
              <X size={24} />
            </button>
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-black">
              <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" playsInline muted />

              {/* Scanning UI */}
              <div className="absolute inset-0 border-4 border-green-500/30 m-4 rounded-xl"></div>
              <div className="absolute inset-x-8 top-0 h-1 bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)] animate-scan z-10" style={{ animation: 'scan 2s linear infinite' }}></div>

              <div className="absolute bottom-8 left-0 right-0 text-center">
                <span className="bg-green-600/90 text-white px-6 py-2 rounded-full text-sm font-mono tracking-widest shadow-lg backdrop-blur-sm">
                  {selectedUser ? `VERIFYING: ${selectedUser.name.toUpperCase()}` : t('scanning').toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 text-center text-white">
            <h3 className="text-2xl font-bold mb-2">{t('verifying')}...</h3>
            <p className="text-gray-400 text-sm">{t('lookAtCamera')}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="w-full max-w-6xl flex justify-between items-center mb-12 flex-wrap gap-4">
        <div className="flex items-center gap-2 text-green-800 font-bold text-2xl tracking-tight">
          <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center text-white shadow-md">🌿</div>
          AgriTrust
        </div>
        <div className="flex bg-white rounded-full p-1 shadow-sm border border-gray-200 overflow-x-auto max-w-full">
          {(['en', 'hi', 'ta', 'ne'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${language === lang
                ? 'bg-green-700 text-white shadow-md'
                : 'text-gray-500 hover:text-green-700 hover:bg-green-50'
                }`}
            >
              {lang === 'en' && 'English'}
              {lang === 'hi' && 'हिंदी'}
              {lang === 'ta' && 'தமிழ்'}
              {lang === 'ne' && 'नेपाली'}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center w-full max-w-5xl text-center animate-in slide-in-from-bottom-5 duration-700">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">{t('welcome')}</h1>
        <p className="text-lg md:text-xl text-gray-500 mb-12 md:mb-16">{t('selectProfile')}</p>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-800"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-12 mb-16 w-full px-4 justify-items-center">
            {users.map((user, idx) => (
              <button
                key={user.id}
                onClick={() => startCamera(user)}
                className="flex flex-col items-center group relative p-4 rounded-3xl hover:bg-white hover:shadow-xl transition-all duration-300 w-full max-w-[200px]"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="w-24 h-24 md:w-36 md:h-36 rounded-full overflow-hidden mb-4 md:mb-6 border-4 border-white shadow-lg group-hover:border-green-500 transition-all duration-300 transform group-hover:scale-110 relative aspect-square">
                  <img
                    src={user.image}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                  <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                    <Camera size={20} className="text-white drop-shadow-md" />
                  </div>
                </div>
                <h3 className="font-bold text-base md:text-lg text-gray-800 group-hover:text-green-700 transition-colors">{user.name}</h3>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <button
            onClick={() => startCamera()}
            className="w-full group relative bg-green-800 hover:bg-green-700 text-white font-bold py-4 md:py-5 px-10 rounded-full shadow-2xl flex items-center justify-center gap-4 transition-all hover:-translate-y-1 hover:shadow-green-900/30 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 group-hover:translate-x-full transition-transform duration-700 transform -skew-x-12 -translate-x-64"></div>
            <Camera size={24} />
            <span className="text-lg md:text-xl tracking-wide">{t('quickLogin')}</span>
          </button>

          <p className="text-xs md:text-sm text-gray-400 flex items-center gap-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            {t('placeFace')}
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center md:items-end mt-12 relative border-t border-gray-100 pt-8 gap-6 md:gap-0">
        <span className="text-xs font-semibold text-gray-400">© 2024 AgriTrust Digital Portal</span>

        <div className="md:absolute md:left-1/2 md:-translate-x-1/2 md:-top-6 order-first md:order-none">
          <button className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-green-700 to-green-900 rounded-2xl rotate-45 flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform group">
            <Mic className="w-6 h-6 md:w-8 md:h-8 -rotate-45 group-hover:text-green-200 transition-colors" />
          </button>
        </div>

        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-300"></span>
          {t('footer')}
        </span>
      </footer>
    </div>
  );
};

export default Login;
