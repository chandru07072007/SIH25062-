import React, { useEffect } from 'react';
import { Mic, Leaf, LayoutGrid, Droplets, Landmark, Clock3, Banknote, PlusCircle, Edit2, ToggleLeft, Cpu, Thermometer, Power, CloudRain } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import type { Sector } from '../context/UserContext';
import AppSidebar from '../components/AppSidebar';

interface LoanMatch {
  scheme_id: string;
  title: string;
  organisation: string;
  type: 'gov' | 'pvt';
  interest_label: string | null;
  match_score: number;
  reasons: string[];
}

interface LoanApplication {
  application_id: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'disbursed';
  amount_requested: number;
  applied_at: string;
  scheme?: {
    title?: string;
    organisation?: string;
    type?: 'gov' | 'pvt';
    interest_label?: string;
  };
}

interface MarketplaceListing {
  product_id: string;
  farmer_id: string;
  crop_name: string;
  price_per_unit: number;
  unit: 'kg' | 'piece' | 'bunch';
  stock_quantity: number;
  status: 'active' | 'inactive';
  avg_rating?: number;
  orders_count?: number;
}

interface CropSuggestion {
  _id: string;
  crop_name: string;
}

interface HardwareSensor {
  _id: string;
  device_id: string;
  ip?: string;
  moisture?: number;
  temperature?: number;
  humidity?: number;
  rain_detected?: boolean;
  motor_on?: boolean;
  valve_open?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface ListingFormState {
  crop_name: string;
  category: 'vegetable' | 'grain' | 'fruit' | 'spice' | 'other';
  price_per_unit: string;
  unit: 'kg' | 'piece' | 'bunch';
  stock_quantity: string;
  min_order_qty: string;
  bulk_discount_pct: string;
  bulk_trigger_multiplier: string;
  is_organic: boolean;
  is_freshly_harvested: boolean;
  description: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
type VoicePreference = 'system' | 'female' | 'male' | 'backend';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { currentUser } = useUser();
  const [filter, setFilter] = React.useState<'all' | 'critical'>('all');
  const [voiceStatus, setVoiceStatus] = React.useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [voiceTranscript, setVoiceTranscript] = React.useState('');
  const [voiceAnswer, setVoiceAnswer] = React.useState('');
  const [voiceError, setVoiceError] = React.useState('');
  const [voicePreference, setVoicePreference] = React.useState<VoicePreference>('system');
  const [speechVoices, setSpeechVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const backendAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [sectors, setSectors] = React.useState<Sector[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loanMatches, setLoanMatches] = React.useState<LoanMatch[]>([]);
  const [loanApplications, setLoanApplications] = React.useState<LoanApplication[]>([]);
  const [loanLoading, setLoanLoading] = React.useState(false);
  const [listings, setListings] = React.useState<MarketplaceListing[]>([]);
  const [listingLoading, setListingLoading] = React.useState(false);
  const [listingModalOpen, setListingModalOpen] = React.useState(false);
  const [listingSaving, setListingSaving] = React.useState(false);
  const [cropSuggestions, setCropSuggestions] = React.useState<CropSuggestion[]>([]);
  const [hardwareSensors, setHardwareSensors] = React.useState<HardwareSensor[]>([]);
  const [hardwareLoading, setHardwareLoading] = React.useState(false);
  const [listingForm, setListingForm] = React.useState<ListingFormState>({
    crop_name: '',
    category: 'vegetable',
    price_per_unit: '',
    unit: 'kg',
    stock_quantity: '',
    min_order_qty: '',
    bulk_discount_pct: '0',
    bulk_trigger_multiplier: '3',
    is_organic: false,
    is_freshly_harvested: false,
    description: '',
  });

  // Fetch live data from FastAPI backend
  const loadSectors = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const farmerId = currentUser.id;

      if (!farmerId) {
        console.error('Invalid farmer ID');
        setSectors([]);
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE}/api/farmers/${farmerId}/lands-overview`);
      if (!response.ok) {
        throw new Error('Failed to load farmer lands overview');
      }

      const lands = await response.json();
      if (Array.isArray(lands) && lands.length > 0) {
        const sectorsData: Sector[] = lands.map((land: any) => ({
          id: `L-${land.land_id}`,
          nameKey: land.name || 'Field',
          status: land.status === 'critical' ? 'critical' : 'optimal',
          moisture: Number(land.moisture || 0),
          image: land.image,
          cropType: land.cropType || 'General Farming',
        }));
        setSectors(sectorsData);
      } else {
        setSectors([]);
      }
    } catch (error) {
      console.error('Error loading sectors:', error);
      setSectors([]);
    } finally {
      setLoading(false);
    }
  };

  const getFarmerId = () => {
    if (!currentUser) return null;
    return currentUser.id;
  };

  const loadLoanData = async () => {
    const farmerId = getFarmerId();
    if (!farmerId) {
      setLoanMatches([]);
      setLoanApplications([]);
      return;
    }

    setLoanLoading(true);
    try {
      const [matchesRes, appsRes] = await Promise.all([
        fetch(`${API_BASE}/loans/match/${farmerId}?top_n=3`),
        fetch(`${API_BASE}/loans/applications/${farmerId}`)
      ]);

      if (matchesRes.ok) {
        const matchesJson = await matchesRes.json();
        setLoanMatches((matchesJson?.matches || []) as LoanMatch[]);
      } else {
        setLoanMatches([]);
      }

      if (appsRes.ok) {
        const appsJson = await appsRes.json();
        setLoanApplications((appsJson?.applications || appsJson || []) as LoanApplication[]);
      } else {
        setLoanApplications([]);
      }
    } catch (error) {
      console.error('Error loading loan data:', error);
      setLoanMatches([]);
      setLoanApplications([]);
    } finally {
      setLoanLoading(false);
    }
  };

  const loadCropSuggestions = async () => {
    const farmerId = getFarmerId();
    if (!farmerId) {
      setCropSuggestions([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/market/crops/suggestions`);
      if (!res.ok) {
        throw new Error('Failed to load crop suggestions');
      }
      const crops = await res.json();
      setCropSuggestions(Array.isArray(crops) ? crops : []);
    } catch (error) {
      console.error('Error loading crop suggestions:', error);
      setCropSuggestions([]);
    }
  };

  const loadListings = async () => {
    const farmerId = getFarmerId();
    if (!farmerId) {
      setListings([]);
      return;
    }

    setListingLoading(true);
    try {
      const res = await fetch(`${API_BASE}/market/products/farmer/${farmerId}`);
      if (!res.ok) {
        throw new Error('Failed to load marketplace products');
      }
      const payload = await res.json();
      const products = Array.isArray(payload) ? payload : [];

      const mapped: MarketplaceListing[] = products.map((row: any) => ({
        product_id: row._id,
        farmer_id: row.farmer_id,
        crop_name: row.crop?.crop_name || 'Unknown Crop',
        price_per_unit: Number(row.price_per_unit || 0),
        unit: 'kg',
        stock_quantity: Number(row.quantity_available || 0),
        status: row.status === 'inactive' ? 'inactive' : 'active',
        orders_count: 0,
        avg_rating: 0,
      }));

      setListings(mapped);
    } catch (error) {
      console.error('Error loading listings:', error);
      setListings([]);
    } finally {
      setListingLoading(false);
    }
  };

  const loadHardwareData = async () => {
    setHardwareLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/sensor-status`);
      if (!response.ok) {
        throw new Error('Failed to load hardware sensor status');
      }

      const sensors = await response.json();
      const sortedSensors = Array.isArray(sensors)
        ? [...sensors].sort((left, right) => {
          const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
          const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
          return rightTime - leftTime;
        })
        : [];
      setHardwareSensors(sortedSensors);
    } catch (error) {
      console.error('Error loading hardware data:', error);
      setHardwareSensors([]);
    } finally {
      setHardwareLoading(false);
    }
  };

  const handleListingSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const farmerId = getFarmerId();
    if (!farmerId) return;

    setListingSaving(true);
    try {
      const payload = {
        farmer_id: farmerId,
        crop_id: cropSuggestions.find((crop) => crop.crop_name.toLowerCase() === listingForm.crop_name.trim().toLowerCase())?._id,
        quantity: Number(listingForm.stock_quantity),
        price: Number(listingForm.price_per_unit),
        status: 'active',
      };

      if (!payload.crop_id) {
        throw new Error('Please select a crop from suggestions.');
      }

      const res = await fetch(`${API_BASE}/market/products/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Failed to create listing');
      }

      setListingModalOpen(false);
      setListingForm({
        crop_name: '',
        category: 'vegetable',
        price_per_unit: '',
        unit: 'kg',
        stock_quantity: '',
        min_order_qty: '',
        bulk_discount_pct: '0',
        bulk_trigger_multiplier: '3',
        is_organic: false,
        is_freshly_harvested: false,
        description: '',
      });
      await loadListings();
    } catch (error) {
      console.error('Error creating listing:', error);
    } finally {
      setListingSaving(false);
    }
  };

  const handleToggleStatus = async (productId: string, nextStatus: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/market/products/${productId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus ? 'active' : 'inactive' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Failed to update status');
      }

      setListings((prev) =>
        prev.map((item) => (item.product_id === productId ? { ...item, status: nextStatus ? 'active' : 'inactive' } : item))
      );
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  useEffect(() => {
    loadSectors();
    loadLoanData();
    loadListings();
    loadCropSuggestions();
    loadHardwareData();
    // Auto-refresh every 30 minutes to match backend refresh cycle
    const sectorInterval = setInterval(loadSectors, 1800000); // 30 minutes
    const loanInterval = setInterval(loadLoanData, 300000); // 5 minutes
    const listingInterval = setInterval(loadListings, 300000); // 5 minutes
    const hardwareInterval = setInterval(loadHardwareData, 10000); // 10 seconds
    return () => {
      clearInterval(sectorInterval);
      clearInterval(loanInterval);
      clearInterval(listingInterval);
      clearInterval(hardwareInterval);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  // Loop through languages for the switcher button
  const nextLang = () => {
    const langs: ('en' | 'hi' | 'ta' | 'ne')[] = ['en', 'hi', 'ta', 'ne'];
    const idx = langs.indexOf(language);
    setLanguage(langs[(idx + 1) % langs.length]);
  };

  const getSpeechLocale = () => {
    if (language === 'hi') return 'hi-IN';
    if (language === 'ta') return 'ta-IN';
    if (language === 'ne') return 'ne-NP';
    return 'en-IN';
  };

  const pickPreferredVoice = React.useCallback(() => {
    if (voicePreference === 'system') {
      return undefined;
    }

    const localePrefix = getSpeechLocale().split('-')[0].toLowerCase();
    const byLocale = speechVoices.filter((voice) => voice.lang.toLowerCase().startsWith(localePrefix));
    const pool = byLocale.length > 0 ? byLocale : speechVoices;

    const femaleHints = ['female', 'woman', 'zira', 'susan', 'hazel'];
    const maleHints = ['male', 'man', 'david', 'mark', 'james', 'alex'];
    const hints = voicePreference === 'female' ? femaleHints : maleHints;

    return pool.find((voice) => {
      const label = `${voice.name} ${voice.voiceURI}`.toLowerCase();
      return hints.some((hint) => label.includes(hint));
    }) || pool[0];
  }, [voicePreference, speechVoices, language]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setSpeechVoices(voices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const askVoiceAgent = async (question: string) => {
    const response = await fetch(`${API_BASE}/api/voice-agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.detail || 'Voice assistant request failed');
    }

    return String(data?.answer || '').trim();
  };

  const speakAnswer = async (text: string) => {
    if (!text) {
      setVoiceStatus('idle');
      return;
    }

    if (voicePreference === 'backend') {
      try {
        setVoiceStatus('speaking');
        const response = await fetch(`${API_BASE}/api/voice-agent/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.detail || 'Backend voice generation failed');
        }

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        backendAudioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            reject(new Error('Audio playback failed'));
          };
          audio.play().catch((err) => {
            URL.revokeObjectURL(audioUrl);
            reject(err);
          });
        });
      } catch (error) {
        setVoiceError(error instanceof Error ? error.message : 'Unable to play backend voice audio.');
      } finally {
        setVoiceStatus('idle');
      }
      return;
    }

    if (!('speechSynthesis' in window)) {
      setVoiceStatus('idle');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getSpeechLocale();
    const selectedVoice = pickPreferredVoice();
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.rate = 1;
    utterance.onstart = () => setVoiceStatus('speaking');
    utterance.onend = () => setVoiceStatus('idle');
    utterance.onerror = () => setVoiceStatus('idle');
    window.speechSynthesis.speak(utterance);
  };

  const getVoiceInputErrorMessage = (errorCode?: string) => {
    if (errorCode === 'no-speech') return 'No speech detected. Tap the mic again and speak clearly.';
    if (errorCode === 'audio-capture') return 'Microphone not detected. Please check your mic connection.';
    if (errorCode === 'not-allowed') return 'Microphone permission denied. Allow microphone access in browser settings.';
    return `Voice input error: ${errorCode || 'unknown'}`;
  };

  const toggleListening = () => {
    if (voiceStatus === 'listening') {
      return;
    }

    setVoiceError('');

    const SpeechRecognitionApi = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionApi) {
      setVoiceError('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognitionApi();
    let retriedAfterNoSpeech = false;
    recognition.lang = getSpeechLocale();
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceStatus('listening');
      setVoiceTranscript('');
      setVoiceAnswer('');
    };

    recognition.onerror = (event: any) => {
      const errorCode = event?.error;

      if (errorCode === 'no-speech' && !retriedAfterNoSpeech) {
        retriedAfterNoSpeech = true;
        setVoiceStatus('listening');
        setVoiceError('No speech detected. Listening again...');

        // Retry once automatically to avoid forcing an immediate extra click.
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            setVoiceStatus('idle');
            setVoiceError(getVoiceInputErrorMessage(errorCode));
          }
        }, 150);
        return;
      }

      setVoiceStatus('idle');
      setVoiceError(getVoiceInputErrorMessage(errorCode));
    };

    recognition.onresult = async (event: any) => {
      const transcript = String(event?.results?.[0]?.[0]?.transcript || '').trim();
      if (!transcript) {
        setVoiceStatus('idle');
        setVoiceError('No speech captured. Please try again.');
        return;
      }

      setVoiceTranscript(transcript);
      setVoiceStatus('thinking');

      try {
        const answer = await askVoiceAgent(transcript);
        setVoiceAnswer(answer);
        if (answer) {
          await speakAnswer(answer);
        } else {
          setVoiceStatus('idle');
        }
      } catch (error) {
        setVoiceStatus('idle');
        setVoiceError(error instanceof Error ? error.message : 'Voice agent failed.');
      }
    };

    recognition.onend = () => {
      setVoiceStatus((prev) => (prev === 'listening' ? 'idle' : prev));
    };

    recognition.start();
  };

  const filteredSectors = filter === 'all'
    ? sectors
    : sectors.filter(s => s.status === 'critical');

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <AppSidebar userName={currentUser.name} userRole={currentUser.role} />
        <main className="bg-gray-50 rounded-2xl p-6">
          {/* Navbar */}
          <nav className="flex justify-between items-center mb-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-800 rounded-lg flex items-center justify-center text-white">
                <LayoutGrid size={24} />
              </div>
              <span className="text-xl font-bold text-green-900">AgriMonitor <span className="text-gray-400 font-light">Pro</span></span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/loans')}
                className="px-3 py-2 bg-white rounded-lg border border-gray-200 flex items-center gap-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                title="Open Loan Marketplace"
              >
                <Banknote size={16} className="text-emerald-700" />
                Loans
              </button>
              <div className="px-4 py-2 bg-gray-100 rounded-full flex items-center gap-2">
                <div className={`w-3 h-3 ${voiceStatus === 'listening' ? 'bg-red-500 animate-ping' : voiceStatus === 'thinking' ? 'bg-amber-500 animate-pulse' : voiceStatus === 'speaking' ? 'bg-blue-500 animate-pulse' : 'bg-green-500 animate-pulse'} rounded-full`}></div>
                <span className="text-sm font-semibold text-gray-600">
                  {voiceStatus === 'listening' ? t('listening') : voiceStatus === 'thinking' ? 'Assistant: Thinking' : voiceStatus === 'speaking' ? 'Assistant: Speaking' : t('assistantStandby')}
                </span>
              </div>
              <select
                value={voicePreference}
                onChange={(e) => setVoicePreference(e.target.value as VoicePreference)}
                className="h-10 rounded-full border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700"
                title="Voice Output"
              >
                <option value="system">System Voice</option>
                <option value="female">Female Voice</option>
                <option value="male">Male Voice</option>
                <option value="backend">Backend Voice</option>
              </select>
              <button onClick={nextLang} className="w-10 h-10 bg-white rounded-full border border-gray-200 flex items-center justify-center text-xl hover:bg-gray-50 transition" title="Switch Language">
                {language === 'en' ? '🇺🇸' : language === 'hi' ? '🇮🇳' : language === 'ta' ? '🕉️' : '🇳🇵'}
              </button>
              <div className="flex items-center gap-3 ml-2 bg-white pl-2 pr-4 py-1 rounded-full border border-gray-200 shadow-sm">
                <div className="w-8 h-8 bg-orange-200 rounded-full overflow-hidden border border-orange-300">
                  <img src={currentUser.image} className="w-full h-full object-cover" alt={currentUser.name} />
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-xs font-bold text-gray-800 leading-tight">{currentUser.name}</p>
                  <p className="text-[10px] text-gray-500 leading-tight">{currentUser.role}</p>
                </div>
              </div>
            </div>
          </nav>

          <header className="mb-8 flex justify-between items-end flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">{t('dashboard')}</h1>
              <p className="text-gray-500">{t('realtime')}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${filter === 'all' ? 'bg-green-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {t('allSectors')}
              </button>
              <button
                onClick={() => setFilter('critical')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${filter === 'critical' ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {t('criticalOnly')}
              </button>
            </div>
          </header>

          {/* Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-800"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {filteredSectors.length === 0 ? (
                <div className="col-span-full text-center py-20 text-gray-400">
                  <p>No sectors found for this user.</p>
                </div>
              ) : filteredSectors.map((sector) => (
                <div
                  key={sector.id}
                  className="group relative h-64 rounded-3xl overflow-hidden cursor-pointer shadow-lg hover:shadow-xl transition-all"
                  onClick={() => navigate(`/analysis/${sector.id}`)}
                >
                  {/* Background Image */}
                  <div className="absolute inset-0 bg-gray-900">
                    <img src={sector.image} alt={sector.nameKey} className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" />
                  </div>

                  {/* Status Badge Top Left */}
                  <div className={`absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center ${sector.status === 'critical' ? 'bg-red-500' : 'bg-green-500'} text-white shadow-md`}>
                    <Droplets size={20} fill="white" />
                  </div>

                  {/* Status Attention Top Right */}
                  {sector.status === 'critical' && (
                    <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full text-[10px] font-bold text-red-600 shadow-sm">{t('attention')}</div>
                  )}

                  {/* Content Bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <h3 className="text-2xl font-bold text-white">{sector.nameKey}</h3>
                        <p className="text-gray-300 text-sm">{sector.cropType}</p>
                      </div>
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                        <Leaf size={20} className="text-green-600" />
                      </div>
                    </div>

                    {/* Footer Bar */}
                    <div className={`flex justify-between items-center px-4 py-2 rounded-xl backdrop-blur-md ${sector.status === 'critical' ? 'bg-red-500/90 text-white' : 'bg-green-500/90 text-white'}`}>
                      <span className="font-bold text-xs uppercase">{sector.status === 'critical' ? t('needsWater') : t('optimal')}</span>
                      <span className="font-bold">{sector.moisture}% Moisture</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hardware Data */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Cpu size={22} className="text-indigo-700" />
                <h2 className="text-2xl font-bold text-gray-900">Hardware Data</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open('https://blynk.cloud/dashboard/693723/global/organization/693723/dashboard', '_blank')}
                  className="px-3 py-2 text-sm font-semibold rounded-lg bg-indigo-700 text-white hover:bg-indigo-600"
                  title="Open Hardware Dashboard"
                >
                  Open Hardware Dashboard
                </button>
                <button
                  onClick={loadHardwareData}
                  className="px-3 py-2 text-sm font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              {hardwareLoading ? (
                <div className="flex justify-center items-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-700"></div>
                </div>
              ) : hardwareSensors.length === 0 ? (
                <p className="text-sm text-gray-500">No hardware data yet. Start the ESP32 device and let it POST to FastAPI /api/iot/reading so the newest live readings appear here.</p>
              ) : (
                <div className="space-y-4">
                  {hardwareSensors.map((sensor) => {
                    const updatedTime = sensor.updated_at || sensor.created_at;
                    const updatedMs = updatedTime ? new Date(updatedTime).getTime() : 0;
                    const ageSeconds = updatedMs > 0 ? Math.floor((Date.now() - updatedMs) / 1000) : null;
                    const isStale = ageSeconds !== null && ageSeconds > 30;

                    return (
                      <div key={sensor._id} className="rounded-xl border border-gray-100 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div>
                            <p className="font-semibold text-gray-900">{sensor.device_id || 'ESP32 Device'}</p>
                            <p className="text-xs text-gray-500">IP: {sensor.ip || 'N/A'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isStale && (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800">
                                Stale feed
                              </span>
                            )}
                            <p className="text-xs text-gray-500">
                              Updated: {updatedTime ? new Date(updatedTime).toLocaleString() : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="rounded-lg bg-blue-50 p-3 border border-blue-100">
                            <p className="text-xs text-blue-700 font-semibold flex items-center gap-1">
                              <Droplets size={14} /> Moisture
                            </p>
                            <p className="text-lg font-bold text-blue-900">{Number(sensor.moisture ?? 0).toFixed(1)}%</p>
                          </div>

                          <div className="rounded-lg bg-orange-50 p-3 border border-orange-100">
                            <p className="text-xs text-orange-700 font-semibold flex items-center gap-1">
                              <Thermometer size={14} /> Temperature
                            </p>
                            <p className="text-lg font-bold text-orange-900">{Number(sensor.temperature ?? 0).toFixed(1)} C</p>
                          </div>

                          <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
                            <p className="text-xs text-emerald-700 font-semibold">Humidity</p>
                            <p className="text-lg font-bold text-emerald-900">{Number(sensor.humidity ?? 0).toFixed(1)}%</p>
                          </div>

                          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                            <p className="text-xs text-slate-700 font-semibold">States</p>
                            <div className="mt-1 flex flex-col gap-1 text-xs">
                              <span className={`inline-flex items-center gap-1 ${sensor.rain_detected ? 'text-blue-700' : 'text-slate-600'}`}>
                                <CloudRain size={12} /> Rain: {sensor.rain_detected ? 'YES' : 'NO'}
                              </span>
                              <span className={`inline-flex items-center gap-1 ${sensor.motor_on ? 'text-emerald-700' : 'text-slate-600'}`}>
                                <Power size={12} /> Motor: {sensor.motor_on ? 'ON' : 'OFF'}
                              </span>
                              <span className={`${sensor.valve_open ? 'text-indigo-700' : 'text-slate-600'}`}>
                                Valve: {sensor.valve_open ? 'OPEN' : 'CLOSED'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* My Listings */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Edit2 size={20} className="text-emerald-700" />
                <h2 className="text-2xl font-bold text-gray-900">My Listings</h2>
              </div>
              <button
                onClick={() => setListingModalOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-600"
              >
                <PlusCircle size={16} />
                Add New Listing
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              {listingLoading ? (
                <div className="flex justify-center items-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
                </div>
              ) : listings.length === 0 ? (
                <p className="text-sm text-gray-500">No listings yet. Create your first listing.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-4">Crop</th>
                        <th className="py-2 pr-4">Category</th>
                        <th className="py-2 pr-4">Price / Unit</th>
                        <th className="py-2 pr-4">Stock</th>
                        <th className="py-2 pr-4">Orders</th>
                        <th className="py-2 pr-4">Avg Rating</th>
                        <th className="py-2 pr-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listings.map((item) => (
                        <tr key={item.product_id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-semibold text-gray-900">{item.crop_name}</td>
                          <td className="py-3 pr-4 text-gray-600 capitalize">Produce</td>
                          <td className="py-3 pr-4 text-gray-700">
                            {INR.format(item.price_per_unit)} / {item.unit}
                          </td>
                          <td className="py-3 pr-4 text-gray-700">{item.stock_quantity}</td>
                          <td className="py-3 pr-4 text-gray-700">{item.orders_count ?? 0}</td>
                          <td className="py-3 pr-4 text-gray-700">{item.avg_rating?.toFixed(1) ?? '0.0'}</td>
                          <td className="py-3 pr-4">
                            <button
                              onClick={() => handleToggleStatus(item.product_id, item.status !== 'active')}
                              className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-semibold border ${item.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                                }`}
                            >
                              <ToggleLeft size={14} className={item.status === 'active' ? 'text-emerald-700' : 'text-gray-500'} />
                              {item.status === 'active' ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Loan Marketplace */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Landmark size={22} className="text-emerald-700" />
                <h2 className="text-2xl font-bold text-gray-900">Loan & Scheme Marketplace</h2>
              </div>
              <button
                onClick={loadLoanData}
                className="px-3 py-2 text-sm font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>

            {loanLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Top Matched Schemes</h3>
                  {loanMatches.length === 0 ? (
                    <p className="text-sm text-gray-500">No recommendations available yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {loanMatches.map((match) => (
                        <div key={match.scheme_id} className="border border-gray-100 rounded-xl p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-gray-900">{match.title}</p>
                              <p className="text-xs text-gray-500">{match.organisation} • {match.type.toUpperCase()}</p>
                            </div>
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                              {match.match_score}% Match
                            </span>
                          </div>
                          {match.interest_label && (
                            <p className="text-xs text-gray-600 mt-2">Interest: {match.interest_label}</p>
                          )}
                          {match.reasons?.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">Reason: {match.reasons[0]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">My Loan Applications</h3>
                  {loanApplications.length === 0 ? (
                    <p className="text-sm text-gray-500">No applications submitted yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {loanApplications.slice(0, 5).map((application) => (
                        <div key={application.application_id} className="border border-gray-100 rounded-xl p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {application.scheme?.title || 'Loan Application'}
                              </p>
                              <p className="text-xs text-gray-500">Amount: Rs. {application.amount_requested?.toLocaleString?.() || application.amount_requested}</p>
                            </div>
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 uppercase">
                              {application.status}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                            <Clock3 size={12} />
                            {new Date(application.applied_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Voice Command Button */}
          <div className="flex justify-center mb-12">
            <button
              onClick={toggleListening}
              className={`px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 transition-transform hover:scale-105 ${voiceStatus === 'listening' ? 'bg-red-600 animate-pulse' : voiceStatus === 'thinking' ? 'bg-amber-600' : voiceStatus === 'speaking' ? 'bg-blue-700' : 'bg-green-800 hover:bg-green-700'} text-white`}
            >
              <Mic size={24} />
              <span className="font-bold text-lg">
                {voiceStatus === 'listening' ? `${t('listening')}...` : voiceStatus === 'thinking' ? 'Thinking...' : voiceStatus === 'speaking' ? 'Speaking...' : t('voiceCommand')}
              </span>
            </button>
          </div>

          {(voiceTranscript || voiceAnswer || voiceError) && (
            <section className="mb-12">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                {voiceTranscript && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">You said</p>
                    <p className="text-gray-900">{voiceTranscript}</p>
                  </div>
                )}
                {voiceAnswer && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assistant</p>
                    <p className="text-gray-900">{voiceAnswer}</p>
                  </div>
                )}
                {voiceError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                    {voiceError}
                  </div>
                )}
              </div>
            </section>
          )}

          {listingModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-2xl rounded-2xl bg-white border border-gray-200 shadow-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <PlusCircle size={18} className="text-emerald-700" />
                    <h3 className="text-lg font-bold text-gray-900">Add New Listing</h3>
                  </div>
                  <button
                    onClick={() => setListingModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleListingSubmit} className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Crop name</label>
                      <input
                        list="crop-suggestions"
                        value={listingForm.crop_name}
                        onChange={(e) => setListingForm({ ...listingForm, crop_name: e.target.value })}
                        required
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Eg. Tomato"
                      />
                      <datalist id="crop-suggestions">
                        {cropSuggestions.map((crop) => (
                          <option key={crop._id} value={crop.crop_name} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Category</label>
                      <select
                        value={listingForm.category}
                        onChange={(e) => setListingForm({ ...listingForm, category: e.target.value as ListingFormState['category'] })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="vegetable">Vegetable</option>
                        <option value="grain">Grain</option>
                        <option value="fruit">Fruit</option>
                        <option value="spice">Spice</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Price per unit</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={listingForm.price_per_unit}
                        onChange={(e) => setListingForm({ ...listingForm, price_per_unit: e.target.value })}
                        required
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Unit</label>
                      <select
                        value={listingForm.unit}
                        onChange={(e) => setListingForm({ ...listingForm, unit: e.target.value as ListingFormState['unit'] })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="kg">kg</option>
                        <option value="piece">piece</option>
                        <option value="bunch">bunch</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Stock quantity</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={listingForm.stock_quantity}
                        onChange={(e) => setListingForm({ ...listingForm, stock_quantity: e.target.value })}
                        required
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Min order quantity</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={listingForm.min_order_qty}
                        onChange={(e) => setListingForm({ ...listingForm, min_order_qty: e.target.value })}
                        required
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Bulk discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={listingForm.bulk_discount_pct}
                        onChange={(e) => setListingForm({ ...listingForm, bulk_discount_pct: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Bulk trigger multiplier</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={listingForm.bulk_trigger_multiplier}
                        onChange={(e) => setListingForm({ ...listingForm, bulk_trigger_multiplier: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={listingForm.is_organic}
                        onChange={(e) => setListingForm({ ...listingForm, is_organic: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Is Organic
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={listingForm.is_freshly_harvested}
                        onChange={(e) => setListingForm({ ...listingForm, is_freshly_harvested: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Is Fresh Today
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">Description</label>
                    <textarea
                      value={listingForm.description}
                      onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setListingModalOpen(false)}
                      className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={listingSaving}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-60"
                    >
                      {listingSaving ? 'Saving...' : 'Create Listing'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};


export default Dashboard;
