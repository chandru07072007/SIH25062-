import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, HelpCircle, User, BarChart3, TrendingUp, Cpu, Droplets, Thermometer, CloudRain, Power, Clock3, Send } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import {
    NPKBarChart,
    ComparisonChart,
    SoilHealthRadar,
    CropSuitabilityChart,
    DonutChart,
    SensorAvailabilityChart,
    WaterLevelsChart,
    SensorReadingsTrendChart
} from '../components/SoilCharts';
import AppSidebar from '../components/AppSidebar';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface SoilAnalysisType {
    land_id: string;
    recorded_at?: string;
    ph_level?: number;
    moisture_level?: number;
    temperature?: number;
    humidity?: number;
    nitrogen?: number;
    phosphorus?: number;
    potassium?: number;
    organic_matter?: number;
}

interface CropRecommendation {
    recommendation_id?: string;
    crop_name?: string;
    crop_type?: string;
    suitability_score?: number;
    growth_duration_days?: number;
    estimated_yield?: string;
    market_price?: string;
    image_url?: string;
    description?: string;
    is_optimal?: boolean;
}

interface LandOverviewRow {
    id: string;
    land_id: string;
    name?: string;
    status?: string;
    moisture?: number;
    image?: string;
}

interface LiveSensorStatus {
    _id: string;
    device_id: string;
    land_id?: string;
    ip?: string;
    moisture?: number;
    temperature?: number;
    humidity?: number;
    rain_detected?: boolean;
    motor_on?: boolean;
    valve_open?: boolean;
    updated_at?: string;
}

type VoicePreference = 'system' | 'female' | 'male' | 'backend';

const SoilAnalysis: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t, language } = useLanguage();
    const { currentUser } = useUser();
    const [refreshing, setRefreshing] = React.useState(false);
    const [listening, setListening] = React.useState(false);
    const [assistantBusy, setAssistantBusy] = React.useState(false);
    const [assistantInput, setAssistantInput] = React.useState('');
    const [assistantReply, setAssistantReply] = React.useState('');
    const [assistantError, setAssistantError] = React.useState('');
    const [recentCommands, setRecentCommands] = React.useState<string[]>([]);
    const [voicePreference, setVoicePreference] = React.useState<VoicePreference>('system');
    const [speechVoices, setSpeechVoices] = React.useState<SpeechSynthesisVoice[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [soilData, setSoilData] = React.useState<SoilAnalysisType | null>(null);
    const [recommendations, setRecommendations] = React.useState<CropRecommendation[]>([]);
    const [landInfo, setLandInfo] = React.useState<any>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [chartData, setChartData] = React.useState<any>(null);
    const [cropChartData, setCropChartData] = React.useState<any>(null);
    const [sensorData, setSensorData] = React.useState<any>(null);
    const [waterData, setWaterData] = React.useState<any>(null);
    const [readingsData, setReadingsData] = React.useState<any>(null);
    const [liveSensor, setLiveSensor] = React.useState<LiveSensorStatus | null>(null);
    const [resolvedLandId, setResolvedLandId] = React.useState<string | null>(null);
    const [showCharts, setShowCharts] = React.useState(true);
    const recognitionRef = React.useRef<any>(null);
    const backendAudioRef = React.useRef<HTMLAudioElement | null>(null);

    // Extract raw route land identifier from URL
    const getRouteLandId = () => {
        if (!id) return null;
        return id.startsWith('L-') ? id.slice(2) : id;
    };

    const isMongoObjectId = (value: string) => /^[a-fA-F0-9]{24}$/.test(value);

    const resolveLandContext = async (rawLandId: string): Promise<{ landId: string; landInfo: any | null }> => {
        const farmersRes = await fetch(`${API_BASE}/api/farmers/list`);
        if (!farmersRes.ok) {
            return { landId: rawLandId, landInfo: null };
        }

        const farmers = await farmersRes.json();
        const allLands: LandOverviewRow[] = [];

        for (const farmer of (Array.isArray(farmers) ? farmers : [])) {
            const landsRes = await fetch(`${API_BASE}/api/farmers/${farmer._id}/lands-overview`);
            if (!landsRes.ok) continue;
            const lands = await landsRes.json();
            for (const land of (Array.isArray(lands) ? lands : [])) {
                allLands.push(land as LandOverviewRow);
            }
        }

        if (!allLands.length) {
            return { landId: rawLandId, landInfo: null };
        }

        if (isMongoObjectId(rawLandId)) {
            const matched = allLands.find((land) => land.land_id === rawLandId);
            return {
                landId: rawLandId,
                landInfo: matched ? { land_name: matched.name || 'Land', soil_type: 'Field Soil' } : null,
            };
        }

        const numeric = Number.parseInt(rawLandId, 10);
        if (!Number.isNaN(numeric) && numeric > 0) {
            const byIndex = allLands[numeric - 1];
            if (byIndex?.land_id) {
                return {
                    landId: byIndex.land_id,
                    landInfo: { land_name: byIndex.name || `Land ${numeric}`, soil_type: 'Field Soil' },
                };
            }
        }

        const fallback = allLands[0];
        return {
            landId: fallback.land_id,
            landInfo: { land_name: fallback.name || 'Land', soil_type: 'Field Soil' },
        };
    };

    const fetchChartData = async (landId: string) => {
        try {
            // Fetch chart data from Python backend
            const response = await fetch(`${API_BASE}/api/soil-analysis/${landId}/chart-data`);
            if (response.ok) {
                const data = await response.json();
                setChartData({
                    ...data,
                    comparison_chart: data.comparison_chart || [],
                });
            }

            // Fetch crop recommendation chart data
            const cropResponse = await fetch(`${API_BASE}/api/crop-recommendations/${landId}/chart-data`);
            if (cropResponse.ok) {
                const cropRows = await cropResponse.json();
                const crops = (Array.isArray(cropRows) ? cropRows : []).map((row: any, index: number) => ({
                    crop_name: row.recommended_crop_name || row.crop_name || `Crop ${index + 1}`,
                    suitability_score: Number(row.confidence_score ?? row.suitability_score ?? 0),
                    is_optimal: index === 0,
                    crop_type: row.crop_type || 'Recommended',
                }));
                setCropChartData({ crops });

                const mappedRecommendations: CropRecommendation[] = crops.map((crop: any, index: number) => ({
                    recommendation_id: String(index + 1),
                    crop_name: crop.crop_name,
                    crop_type: crop.crop_type,
                    suitability_score: crop.suitability_score,
                    is_optimal: crop.is_optimal,
                }));
                setRecommendations(mappedRecommendations);
            }
        } catch (err) {
            console.error('Error fetching chart data:', err);
            // Chart data is optional, so don't throw error
        }
    };

    const fetchLiveSensorData = async (landId: string) => {
        try {
            const response = await fetch(`${API_BASE}/api/sensor-status`);
            if (!response.ok) {
                setLiveSensor(null);
                return;
            }

            const sensors = await response.json();
            const sensorList = Array.isArray(sensors) ? sensors : [];
            const matched = sensorList.find((sensor: LiveSensorStatus) => sensor.land_id === landId) || sensorList[0] || null;
            setLiveSensor(matched);
        } catch (error) {
            console.error('Error fetching live sensor data:', error);
            setLiveSensor(null);
        }
    };

    const fetchSoilData = async () => {
        const routeLandId = getRouteLandId();
        if (!routeLandId) {
            setError('Invalid land ID');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const resolved = await resolveLandContext(routeLandId);
            const landId = resolved.landId;
            setLandInfo(resolved.landInfo);
            setResolvedLandId(landId);

            // Fetch soil history and use latest entry for summary cards
            const historyResponse = await fetch(`${API_BASE}/api/soil-analysis/${landId}/history?limit=5`);
            if (historyResponse.ok) {
                const historyRows = await historyResponse.json();
                const historyList = Array.isArray(historyRows) ? historyRows : [];
                if (historyList.length > 0) {
                    const latest = historyList[historyList.length - 1];
                    setSoilData({
                        land_id: latest.land_id,
                        recorded_at: latest.recorded_at,
                        ph_level: Number(latest.ph_level ?? 0),
                        moisture_level: Number(latest.moisture_level ?? 0),
                        temperature: Number(latest.temperature ?? 0),
                        humidity: Number(latest.humidity ?? 0),
                        nitrogen: Number(latest.nitrogen ?? 0),
                        phosphorus: Number(latest.phosphorus ?? 0),
                        potassium: Number(latest.potassium ?? 0),
                        organic_matter: Number(latest.organic_matter ?? 0),
                    });
                } else {
                    setSoilData(null);
                }
            } else {
                setSoilData(null);
            }

            // Fetch chart and recommendation data from backend
            await fetchChartData(landId);
            await fetchLiveSensorData(landId);
        } catch (err: any) {
            console.error('Error fetching soil data:', err);
            setError(err.message || 'Failed to fetch soil data');
            // Set default values if no data found
            setSoilData(null);
            setRecommendations([]);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        if (!resolvedLandId) {
            return;
        }

        fetchLiveSensorData(resolvedLandId);
        const sensorInterval = setInterval(() => fetchLiveSensorData(resolvedLandId), 10000);
        return () => clearInterval(sensorInterval);
    }, [resolvedLandId]);

    React.useEffect(() => {
        if (!currentUser) {
            navigate('/');
            return;
        }
        fetchSoilData();
    }, [currentUser, navigate, id]);

    if (!currentUser) return null;

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchSoilData();
        setRefreshing(false);
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

    React.useEffect(() => {
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

    const handleListen = () => {
        const SpeechRecognitionApi = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (listening && recognitionRef.current) {
            recognitionRef.current.stop();
            setListening(false);
            return;
        }

        if (!SpeechRecognitionApi) {
            setAssistantError('Speech recognition is not supported in this browser.');
            return;
        }

        const recognition = new SpeechRecognitionApi();
        let retriedAfterNoSpeech = false;
        recognitionRef.current = recognition;
        recognition.lang = getSpeechLocale();
        recognition.interimResults = false;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setAssistantError('');
            setListening(true);
        };

        recognition.onerror = (event: any) => {
            const errorCode = event?.error;

            if (errorCode === 'no-speech' && !retriedAfterNoSpeech) {
                retriedAfterNoSpeech = true;
                setListening(true);
                setAssistantError('No speech detected. Listening again...');

                // Retry once automatically to avoid forcing an immediate extra click.
                setTimeout(() => {
                    try {
                        recognition.start();
                    } catch {
                        setListening(false);
                        setAssistantError(getVoiceInputErrorMessage(errorCode));
                    }
                }, 150);
                return;
            }

            setListening(false);
            setAssistantError(getVoiceInputErrorMessage(errorCode));
        };

        recognition.onresult = async (event: any) => {
            const transcript = String(event?.results?.[0]?.[0]?.transcript || '').trim();
            if (!transcript) {
                setAssistantError('No speech captured. Please try again.');
                return;
            }

            setAssistantInput(transcript);
            await processAssistantQuestion(transcript, true);
        };

        recognition.onend = () => {
            setListening(false);
            recognitionRef.current = null;
        };

        recognition.start();
    };

    const getVoiceInputErrorMessage = (errorCode?: string) => {
        if (errorCode === 'no-speech') return 'No speech detected. Tap the mic again and speak clearly.';
        if (errorCode === 'audio-capture') return 'Microphone not detected. Please check your mic connection.';
        if (errorCode === 'not-allowed') return 'Microphone permission denied. Allow microphone access in browser settings.';
        return `Voice input error: ${errorCode || 'unknown'}`;
    };

    const speakAnswer = async (text: string) => {
        if (!text) return;

        if (voicePreference === 'backend') {
            try {
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
                setAssistantError(error instanceof Error ? error.message : 'Unable to play backend voice audio.');
            }
            return;
        }

        if (!('speechSynthesis' in window) || !text) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = getSpeechLocale();
        const selectedVoice = pickPreferredVoice();
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    };

    const processAssistantQuestion = async (question: string, shouldSpeak: boolean) => {
        const trimmed = question.trim();
        if (!trimmed) return;

        setAssistantBusy(true);
        setAssistantError('');
        setAssistantReply('');

        try {
            const response = await fetch(`${API_BASE}/api/voice-agent/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: trimmed }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.detail || 'Voice assistant request failed');
            }

            const answer = String(data?.answer || '').trim();
            setAssistantReply(answer || 'No response generated.');
            setRecentCommands((prev) => [trimmed, ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5));

            if (shouldSpeak && answer) {
                await speakAnswer(answer);
            }
        } catch (error) {
            setAssistantError(error instanceof Error ? error.message : 'Assistant request failed.');
        } finally {
            setAssistantBusy(false);
        }
    };

    const handleAssistantSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        await processAssistantQuestion(assistantInput, true);
    };

    React.useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    // Calculate percentage for progress bars
    const getPercentage = (value: number, max: number) => Math.min((value / max) * 100, 100);

    // Get current time formatted
    const getCurrentTime = () => {
        const now = new Date();
        return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-green-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading soil analysis...</p>
                </div>
            </div>
        );
    }

    if (!soilData && !loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md text-center">
                    <div className="text-6xl mb-4">🌾</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">No Soil Data Available</h2>
                    <p className="text-gray-600 mb-4">
                        {landInfo?.land_name || `Land ${id}`} doesn't have soil analysis data yet.
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                        Send IoT readings for this land to generate soil analysis data.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => navigate(-1)}
                            className="px-6 py-3 bg-gray-200 text-gray-800 rounded-full font-bold hover:bg-gray-300 transition"
                        >
                            Go Back
                        </button>
                        <button
                            onClick={handleRefresh}
                            className="px-6 py-3 bg-green-900 text-white rounded-full font-bold hover:bg-green-800 transition"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans">
            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
                <AppSidebar userName={currentUser.name} userRole={currentUser.role} />
                <div className="bg-gray-50 rounded-2xl p-6">
                    {/* Header */}
                    <header className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-4">
                            <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-green-800 transition">
                                <ArrowLeft size={20} className="mr-2" /> {t('backToFields')}
                            </button>
                            <div className="text-2xl font-bold text-green-900 flex items-center gap-2">
                                <span className="w-8 h-8 bg-green-800 rounded-lg flex items-center justify-center text-white text-sm">🌾</span>
                                AgriCrop <span className="text-green-600">Pro</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 text-gray-500">
                            <button onClick={() => alert(t('help'))} className="flex items-center gap-2 cursor-pointer hover:text-green-800 transition">
                                <HelpCircle size={20} /> <span className="font-semibold">{t('help')}</span>
                            </button>
                            <div className="flex items-center gap-2">
                                <div className="text-right">
                                    <p className="font-bold text-gray-900 text-sm">{currentUser.name}</p>
                                    <p className="text-xs text-capitalize text-gray-400">{currentUser.role}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full overflow-hidden border border-orange-200">
                                    <img src={currentUser.image} alt={currentUser.name} className="w-full h-full object-cover" />
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Left Panel: Soil Stats */}
                        <aside className="w-full lg:w-1/4 space-y-6">
                            <div className="bg-white p-6 rounded-3xl shadow-sm">
                                <h2 className="text-xl font-bold text-gray-900 mb-2">{t('soilAnalysis')}</h2>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-6">
                                    {landInfo?.land_name || `SECTOR ${id}`} • {t('today')} {getCurrentTime()}
                                </p>

                                {/* PH Levels */}
                                <div className="mb-6">
                                    <div className="flex justify-between mb-2">
                                        <span className="font-bold text-gray-700 flex items-center gap-2">🧪 {t('phLevels')}</span>
                                        <span className="font-bold text-green-600">
                                            {soilData?.ph_level?.toFixed(1) || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                                        <div
                                            className="bg-green-600 h-2 rounded-full"
                                            style={{ width: `${getPercentage(soilData?.ph_level || 0, 14)}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-400">{t('optimalRange')}: 6.0 - 7.5</p>
                                </div>

                                {/* Moisture */}
                                <div className="mb-6">
                                    <div className="flex justify-between mb-2">
                                        <span className="font-bold text-gray-700 flex items-center gap-2">💧 {t('moisture')}</span>
                                        <span className="font-bold text-blue-600">
                                            {soilData?.moisture_level ? `${soilData.moisture_level}%` : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full"
                                            style={{ width: `${soilData?.moisture_level || 0}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-400">{t('status')}: {t('stable')}</p>
                                </div>

                                {/* NPK Levels */}
                                <div className="mb-6">
                                    <div className="flex justify-between mb-4">
                                        <span className="font-bold text-gray-700 flex items-center gap-2">🌱 {t('npkLevels')}</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-4 font-bold text-xs text-gray-500">N</span>
                                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                                <div
                                                    className="bg-green-700 h-1.5 rounded-full"
                                                    style={{ width: `${soilData?.nitrogen || 0}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs text-gray-500">{soilData?.nitrogen || 0}%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-4 font-bold text-xs text-gray-500">P</span>
                                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                                <div
                                                    className="bg-green-600 h-1.5 rounded-full"
                                                    style={{ width: `${soilData?.phosphorus || 0}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs text-gray-500">{soilData?.phosphorus || 0}%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-4 font-bold text-xs text-gray-500">K</span>
                                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                                <div
                                                    className="bg-green-500 h-1.5 rounded-full"
                                                    style={{ width: `${soilData?.potassium || 0}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs text-gray-500">{soilData?.potassium || 0}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Insight Box */}
                                <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                                    <h4 className="flex items-center gap-2 font-bold text-green-900 text-sm mb-2">ℹ️ {t('soilInsight')}</h4>
                                    <p className="text-xs text-green-800 leading-relaxed">
                                        {landInfo?.soil_type ? `Soil Type: ${landInfo.soil_type}. ` : ''}
                                        {soilData?.organic_matter ? `Organic Matter: ${soilData.organic_matter}%. ` : ''}
                                        {t('soilInsightText')}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleRefresh}
                                className={`w-full py-4 bg-white border border-gray-200 rounded-full font-bold text-green-900 hover:bg-gray-50 shadow-sm transition flex justify-center items-center gap-2 ${refreshing ? 'opacity-75 cursor-wait' : ''}`}
                                disabled={refreshing}
                            >
                                {refreshing ? <div className="w-4 h-4 border-2 border-green-900 border-t-transparent rounded-full animate-spin"></div> : null}
                                {t('refreshSensors')}
                            </button>
                        </aside>

                        {/* Center Panel: Charts and Analysis */}
                        <main className="flex-1 space-y-6">
                            {/* Live Sensor Data */}
                            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between gap-4 mb-5">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Cpu size={20} className="text-green-800" />
                                            <h2 className="text-2xl font-bold text-gray-900">Live Sensor Data</h2>
                                        </div>
                                        <p className="text-sm text-gray-500">Real-time ESP32 telemetry for this land.</p>
                                    </div>
                                    <button
                                        onClick={handleRefresh}
                                        className="px-4 py-2 bg-green-900 text-white rounded-full font-bold hover:bg-green-800 transition"
                                    >
                                        Refresh
                                    </button>
                                </div>

                                {liveSensor ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                        <div className="rounded-2xl bg-green-50 border border-green-100 p-4">
                                            <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Device</p>
                                            <p className="text-lg font-bold text-gray-900">{liveSensor.device_id}</p>
                                            <p className="text-xs text-gray-500 mt-1">IP: {liveSensor.ip || 'N/A'}</p>
                                        </div>

                                        <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                                            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1 flex items-center gap-1"><Droplets size={14} /> Moisture</p>
                                            <p className="text-3xl font-extrabold text-blue-900">{Number(liveSensor.moisture ?? 0).toFixed(1)}%</p>
                                        </div>

                                        <div className="rounded-2xl bg-orange-50 border border-orange-100 p-4">
                                            <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-1 flex items-center gap-1"><Thermometer size={14} /> Temperature</p>
                                            <p className="text-3xl font-extrabold text-orange-900">{Number(liveSensor.temperature ?? 0).toFixed(1)} C</p>
                                        </div>

                                        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1"><Clock3 size={14} /> Status</p>
                                            <div className="space-y-1 text-sm text-gray-700">
                                                <div className={`flex items-center gap-2 ${liveSensor.rain_detected ? 'text-blue-700' : ''}`}>
                                                    <CloudRain size={14} /> Rain: {liveSensor.rain_detected ? 'Detected' : 'Clear'}
                                                </div>
                                                <div className={`flex items-center gap-2 ${liveSensor.motor_on ? 'text-emerald-700' : ''}`}>
                                                    <Power size={14} /> Motor: {liveSensor.motor_on ? 'ON' : 'OFF'}
                                                </div>
                                                <div className={`${liveSensor.valve_open ? 'text-indigo-700' : ''}`}>
                                                    Valve: {liveSensor.valve_open ? 'OPEN' : 'CLOSED'}
                                                </div>
                                                <div className="text-xs text-gray-500 pt-1">
                                                    Updated: {liveSensor.updated_at ? new Date(liveSensor.updated_at).toLocaleString() : 'N/A'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-gray-500">
                                        No live sensor data found yet for this land. Send an ESP32 reading to start streaming values.
                                    </div>
                                )}
                            </section>

                            {/* Chart Toggle Button */}
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-3xl font-bold text-gray-900">{t('soilAnalysis')}</h2>
                                    <p className="text-gray-500">Visual Data Analysis & Insights</p>
                                </div>
                                <button
                                    onClick={() => setShowCharts(!showCharts)}
                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full font-semibold text-gray-700 hover:bg-gray-50 transition"
                                >
                                    {showCharts ? <TrendingUp size={18} /> : <BarChart3 size={18} />}
                                    {showCharts ? 'Hide Charts' : 'Show Charts'}
                                </button>
                            </div>

                            {/* Charts Section */}
                            {showCharts && chartData && (
                                <div className="space-y-6">
                                    {/* Row 1: NPK | Comparison | Water Levels (3 columns) */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <NPKBarChart data={chartData.npk_bar_chart} />
                                        <ComparisonChart data={chartData.comparison_chart} />
                                        {waterData && <WaterLevelsChart data={waterData} />}
                                    </div>

                                    {/* Row 2: Crop Suitability Chart (Full Width) */}
                                    {cropChartData && cropChartData.crops && (
                                        <CropSuitabilityChart crops={cropChartData.crops} />
                                    )}

                                    {/* Row 3: Sensor Availability */}
                                    {sensorData && (
                                        <SensorAvailabilityChart data={sensorData} />
                                    )}
                                </div>
                            )}

                            {/* Separator */}
                            {showCharts && chartData && (
                                <div className="border-t border-gray-200 my-8"></div>
                            )}

                            {/* Crop Recommendations Section */}
                            <div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('topRecommendations')}</h2>
                                <p className="text-gray-500 mb-8">{t('recommendationsSubtitle')}</p>
                            </div>

                            {recommendations.length === 0 ? (
                                <div className="bg-white p-12 rounded-3xl shadow-sm text-center">
                                    <div className="text-6xl mb-4">🌾</div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">No Recommendations Available</h3>
                                    <p className="text-gray-500">Soil analysis data is needed to generate crop recommendations.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                                        {/* Display top 2 recommendations as cards */}
                                        {recommendations.slice(0, 2).map((rec, index) => (
                                            <div key={rec.recommendation_id} className="bg-white p-4 rounded-3xl shadow-sm hover:shadow-md transition">
                                                <div className="h-40 rounded-2xl overflow-hidden mb-4 relative">
                                                    <img
                                                        src={rec.image_url || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&q=80&w=1000'}
                                                        alt={rec.crop_name || 'Crop'}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    {rec.is_optimal && (
                                                        <span className="absolute top-3 left-3 bg-green-900 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                                                            {t('optimalChoice')}
                                                        </span>
                                                    )}
                                                    {!rec.is_optimal && (
                                                        <span className="absolute top-3 left-3 bg-white text-green-900 text-[10px] font-bold px-2 py-1 rounded-full border border-green-200">
                                                            {t('highlyCompatible')}
                                                        </span>
                                                    )}
                                                    <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-xs font-bold text-green-900">
                                                        Score: {rec.suitability_score || 0}%
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="text-xl font-bold text-gray-900">{rec.crop_name || 'Unknown Crop'}</h3>
                                                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-700 text-xs">✔</div>
                                                </div>
                                                <div className="flex gap-4 text-xs text-gray-500 font-medium mb-4">
                                                    {rec.growth_duration_days && (
                                                        <span className="flex items-center gap-1">📅 {rec.growth_duration_days} days</span>
                                                    )}
                                                    {rec.estimated_yield && (
                                                        <span className="flex items-center gap-1">📈 {rec.estimated_yield}</span>
                                                    )}
                                                    {rec.crop_type && (
                                                        <span className="flex items-center gap-1">🌾 {rec.crop_type}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Full Width Card for 3rd recommendation */}
                                    {recommendations.length > 2 && (
                                        <div className="bg-white p-4 rounded-3xl shadow-sm hover:shadow-md transition mt-6 flex flex-col md:flex-row gap-6">
                                            <div className="w-full md:w-1/3 h-40 md:h-auto rounded-2xl overflow-hidden relative">
                                                <img
                                                    src={recommendations[2].image_url || 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&q=80&w=1000'}
                                                    alt={recommendations[2].crop_name || 'Crop'}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 py-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">
                                                    {t('alternative')}
                                                </span>
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="text-2xl font-bold text-gray-900">{recommendations[2].crop_name || 'Unknown Crop'}</h3>
                                                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 text-xs">✔</div>
                                                </div>
                                                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                                                    {recommendations[2].description || t('cornDescription')}
                                                </p>
                                                <div className="flex gap-6">
                                                    {recommendations[2].crop_type && (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-800">🍃</div>
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-900">{recommendations[2].crop_type}</p>
                                                                <p className="text-[10px] text-gray-400">{t('compatible')}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {recommendations[2].market_price && (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-800">💵</div>
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-900">{recommendations[2].market_price}</p>
                                                                <p className="text-[10px] text-gray-400">{t('marketPrice')}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </main>

                        {/* Right Panel: Assistant */}
                        <aside className="w-full lg:w-1/4">
                            <div className="text-center">
                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4 ${assistantBusy ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                                    <div className={`w-2 h-2 ${listening ? 'bg-red-500 animate-ping' : assistantBusy ? 'bg-amber-500 animate-pulse' : 'bg-green-600 animate-pulse'} rounded-full`}></div>
                                    {listening ? t('listening') : assistantBusy ? 'Thinking...' : t('voiceActive')}
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('agriAssistant')}</h2>
                                <p className="text-gray-400 text-sm mb-8">{t('voicePrompt')}</p>

                                <div className="mb-6">
                                    <select
                                        value={voicePreference}
                                        onChange={(e) => setVoicePreference(e.target.value as VoicePreference)}
                                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
                                        title="Voice Output"
                                    >
                                        <option value="system">System Voice</option>
                                        <option value="female">Female Voice</option>
                                        <option value="male">Male Voice</option>
                                        <option value="backend">Backend Voice</option>
                                    </select>
                                </div>

                                <form onSubmit={handleAssistantSubmit} className="mb-6">
                                    <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                                        <input
                                            value={assistantInput}
                                            onChange={(e) => setAssistantInput(e.target.value)}
                                            placeholder="Ask about irrigation, crop, or soil..."
                                            className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                                        />
                                        <button
                                            type="submit"
                                            disabled={assistantBusy}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-green-800 text-white hover:bg-green-700 disabled:opacity-50"
                                            title="Send"
                                        >
                                            <Send size={16} />
                                        </button>
                                    </div>
                                </form>

                                {/* Audio Visualizer Placeholder */}
                                <div className="flex justify-center items-center gap-1 h-12 mb-8">
                                    {listening ? (
                                        // Active animation
                                        [...Array(10)].map((_, i) => (
                                            <div key={i} className="w-1 bg-green-500 rounded-full animate-bounce" style={{ height: `${Math.random() * 40 + 10}px`, animationDelay: `${i * 0.1}s` }}></div>
                                        ))
                                    ) : (
                                        // Static placeholder
                                        [...Array(10)].map((_, i) => (
                                            <div key={i} className="w-1 bg-green-800 rounded-full h-1"></div>
                                        ))
                                    )}
                                </div>

                                {/* Listen Button */}
                                <button
                                    onClick={handleListen}
                                    disabled={assistantBusy}
                                    className={`w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center text-white shadow-2xl transition mx-auto mb-8 ${listening ? 'bg-red-600 border-red-500 animate-pulse' : 'bg-green-900 border-green-800/20 hover:scale-105'} disabled:opacity-60`}
                                >
                                    <Mic size={32} className="mb-2" />
                                    <span className="font-bold tracking-widest text-xs uppercase">{listening ? t('listening') : t('listen')}</span>
                                </button>

                                {(assistantReply || assistantError) && (
                                    <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 text-left">
                                        {assistantReply && <p className="text-sm text-gray-800">{assistantReply}</p>}
                                        {assistantError && <p className="text-sm text-red-600 font-semibold">{assistantError}</p>}
                                    </div>
                                )}
                            </div>

                            {/* Recent Commands */}
                            <div className="space-y-4">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-4">{t('recentCommands')}</p>
                                {(recentCommands.length ? recentCommands : [t('command1'), t('command2')]).map((command, index) => (
                                    <button
                                        key={`${command}-${index}`}
                                        onClick={() => {
                                            setAssistantInput(command);
                                            void processAssistantQuestion(command, true);
                                        }}
                                        className="w-full text-left p-4 bg-gray-100 rounded-2xl text-xs text-gray-600 font-medium hover:bg-gray-200 transition"
                                    >
                                        {command}
                                    </button>
                                ))}
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default SoilAnalysis;
