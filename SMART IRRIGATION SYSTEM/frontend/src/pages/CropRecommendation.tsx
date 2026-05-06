import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import AppSidebar from '../components/AppSidebar';

interface CropRecommendation {
    rank: number;
    crop_name: string;
    probability: number;
}

interface PredictionResult {
    recommended_crop: string;
    confidence: number;
    top_3_recommendations: CropRecommendation[];
    input_parameters: {
        nitrogen: number;
        phosphorus: number;
        potassium: number;
        temperature: number;
        humidity: number;
        ph: number;
        rainfall: number;
    };
}

interface AutoAnalysisResult {
    analysis_type: string;
    farmer_id?: number;
    total_lands?: number;
    land_names?: string[];
    total_soil_records: number;
    total_sensor_readings: number;
    recommended_crop: string;
    confidence: number;
    top_5_recommendations: CropRecommendation[];
    average_parameters: {
        nitrogen: number;
        phosphorus: number;
        potassium: number;
        temperature: number;
        humidity: number;
        ph_level: number;
        rainfall: number;
    };
}

interface Farmer {
    farmer_id: number;
    name: string;
}

interface ModelInfo {
    status: string;
    model_type: string;
    supported_crops: string[];
    total_crops: number;
}

// Crop images mapping (using emoji representation)
const cropImages: { [key: string]: string } = {
    'rice': '🌾',
    'maize': '🌽',
    'chickpea': '🫘',
    'kidneybeans': '🫘',
    'pigeonpeas': '🫛',
    'mothbeans': '🫘',
    'mungbean': '🫛',
    'blackgram': '🫘',
    'lentil': '🫘',
    'pomegranate': '🍎',
    'banana': '🍌',
    'mango': '🥭',
    'grapes': '🍇',
    'watermelon': '🍉',
    'muskmelon': '🍈',
    'apple': '🍎',
    'orange': '🍊',
    'papaya': '🍈',
    'coconut': '🥥',
    'cotton': '☁️',
    'jute': '🌿',
    'coffee': '☕'
};

const getCropImage = (cropName: string): string => {
    const normalizedName = cropName.toLowerCase().trim();
    return cropImages[normalizedName] || '🌱';
};

const CropRecommendation = () => {
    const { currentUser } = useUser();
    const [formData, setFormData] = useState({
        N: '',
        P: '',
        K: '',
        temperature: '',
        humidity: '',
        ph: '',
        rainfall: '',
    });

    const [prediction, setPrediction] = useState<PredictionResult | null>(null);
    const [autoAnalysis, setAutoAnalysis] = useState<AutoAnalysisResult | null>(null);
    const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [selectedFarmer, setSelectedFarmer] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [autoLoading, setAutoLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showModelInfo, setShowModelInfo] = useState(false);
    const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('auto');

    useEffect(() => {
        fetchModelInfo();
        fetchFarmers();
    }, []);

    const fetchModelInfo = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/crop-recommendation/model-info');
            if (response.ok) {
                const data = await response.json();
                setModelInfo(data);
            }
        } catch (err) {
            console.error('Error fetching model info:', err);
        }
    };

    const fetchFarmers = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/farmers/list');
            if (response.ok) {
                const data = await response.json();
                setFarmers(data.farmers || []);
            }
        } catch (err) {
            console.error('Error fetching farmers:', err);
        }
    };

    const handleAutoAnalyze = async () => {
        setAutoLoading(true);
        setError(null);
        setAutoAnalysis(null);

        try {
            let url = 'http://localhost:8000/api/crop-recommendation/auto-analyze';

            // If a farmer is selected, use farmer-specific endpoint
            if (selectedFarmer) {
                url = `http://localhost:8000/api/crop-recommendation/auto-analyze-farmer/${selectedFarmer}`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Failed to perform auto-analysis');
            }

            const data = await response.json();
            setAutoAnalysis(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred during auto-analysis');
        } finally {
            setAutoLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setPrediction(null);

        try {
            const requestBody = {
                N: parseFloat(formData.N),
                P: parseFloat(formData.P),
                K: parseFloat(formData.K),
                temperature: parseFloat(formData.temperature),
                humidity: parseFloat(formData.humidity),
                ph: parseFloat(formData.ph),
                rainfall: parseFloat(formData.rainfall),
            };

            const response = await fetch('http://localhost:8000/api/crop-recommendation/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error('Failed to get crop recommendation');
            }

            const data = await response.json();
            setPrediction(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            N: '',
            P: '',
            K: '',
            temperature: '',
            humidity: '',
            ph: '',
            rainfall: '',
        });
        setPrediction(null);
        setError(null);
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 80) return 'text-green-600';
        if (confidence >= 60) return 'text-yellow-600';
        return 'text-orange-600';
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
                <AppSidebar userName={currentUser?.name ?? ''} userRole={currentUser?.role ?? ''} />
                <div className="container mx-auto p-6 space-y-6 max-w-7xl bg-white border border-gray-200 rounded-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-2 text-green-700">
                                🌱 Crop Recommendation System
                            </h1>
                            <p className="text-gray-600 mt-2">
                                AI-powered crop suggestions based on soil and environmental conditions
                            </p>
                        </div>
                        <button
                            onClick={() => setShowModelInfo(!showModelInfo)}
                            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                        >
                            ℹ️ Model Info
                        </button>
                    </div>

                    {/* Model Info */}
                    {showModelInfo && modelInfo && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <h3 className="font-semibold text-blue-900">{modelInfo.model_type}</h3>
                            <p className="text-blue-700 mt-2">
                                Status: <span className="font-semibold">{modelInfo.status}</span>
                            </p>
                            <p className="text-blue-700">Supported Crops: {modelInfo.total_crops} varieties</p>
                            <p className="text-sm text-blue-600 mt-2">
                                {modelInfo.supported_crops.slice(0, 10).join(', ')}
                                {modelInfo.supported_crops.length > 10 && '...'}
                            </p>
                        </div>
                    )}

                    {/* Error Alert */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <h4 className="font-semibold text-red-900">❌ Error</h4>
                            <p className="text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Tab Navigation */}
                    <div className="flex gap-4 border-b border-gray-200">
                        <button
                            onClick={() => {
                                setActiveTab('auto');
                                setPrediction(null);
                                setAutoAnalysis(null);
                            }}
                            className={`px-6 py-3 font-semibold transition ${activeTab === 'auto'
                                ? 'border-b-2 border-green-600 text-green-700'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            🤖 Auto Analysis
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('manual');
                                setPrediction(null);
                                setAutoAnalysis(null);
                            }}
                            className={`px-6 py-3 font-semibold transition ${activeTab === 'manual'
                                ? 'border-b-2 border-green-600 text-green-700'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            ✍️ Manual Input
                        </button>
                    </div>

                    {/* Auto Analysis Tab */}
                    {activeTab === 'auto' && (
                        <div className="space-y-6">
                            {/* Auto Analysis Card */}
                            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow-md p-8 text-center">
                                <div className="text-6xl mb-4">🌾</div>
                                <h2 className="text-2xl font-bold mb-3 text-gray-800">
                                    Automatic Crop Analysis
                                </h2>
                                <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                                    Automatically fetch all soil data from your database, calculate average values
                                    for Nitrogen, Phosphorus, Potassium, Temperature, Humidity, pH, and Rainfall,
                                    then get AI-powered crop recommendations.
                                </p>

                                {/* Farmer Selector */}
                                <div className="mb-6 max-w-md mx-auto">
                                    <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                                        👨‍🌾 Select Farmer (Optional - Leave empty for all lands)
                                    </label>
                                    <select
                                        value={selectedFarmer || ''}
                                        onChange={(e) => setSelectedFarmer(e.target.value ? Number(e.target.value) : null)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    >
                                        <option value="">All Farmers (Global Analysis)</option>
                                        {farmers.map((farmer) => (
                                            <option key={farmer.farmer_id} value={farmer.farmer_id}>
                                                {farmer.name} (ID: {farmer.farmer_id})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    onClick={handleAutoAnalyze}
                                    disabled={autoLoading}
                                    className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition font-semibold text-lg shadow-lg"
                                >
                                    {autoLoading ? '🔄 Analyzing Database...' : '🚀 Start Auto Analysis'}
                                </button>
                            </div>

                            {/* Auto Analysis Results */}
                            {autoAnalysis && (
                                <div className="space-y-6">
                                    {/* Farmer Information (shown if farmer-specific analysis) */}
                                    {autoAnalysis.farmer_id && (
                                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md p-6 border-2 border-blue-300">
                                            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-blue-900">
                                                👨‍🌾 Farmer-Specific Analysis
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                                    <p className="text-sm text-gray-600 mb-1">Farmer ID</p>
                                                    <p className="text-2xl font-bold text-blue-700">#{autoAnalysis.farmer_id}</p>
                                                </div>
                                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                                    <p className="text-sm text-gray-600 mb-1">Total Lands</p>
                                                    <p className="text-2xl font-bold text-green-700">{autoAnalysis.total_lands}</p>
                                                </div>
                                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                                    <p className="text-sm text-gray-600 mb-1">Lands</p>
                                                    <p className="text-sm font-semibold text-gray-800">
                                                        {autoAnalysis.land_names?.join(', ')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Top Recommendation with Image */}
                                        <div className="bg-white rounded-lg shadow-lg border-2 border-green-500 overflow-hidden">
                                            <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
                                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                                    🏆 Top Recommended Crop
                                                </h2>
                                            </div>
                                            <div className="p-8">
                                                <div className="text-center mb-6">
                                                    <div className="text-9xl mb-4">
                                                        {getCropImage(autoAnalysis.recommended_crop)}
                                                    </div>
                                                    <h2 className="text-5xl font-bold text-green-700 mb-4 uppercase">
                                                        {autoAnalysis.recommended_crop}
                                                    </h2>
                                                    <div className={`text-3xl font-semibold ${getConfidenceColor(autoAnalysis.confidence)}`}>
                                                        {autoAnalysis.confidence.toFixed(2)}% Confidence
                                                    </div>
                                                </div>
                                                <div className="bg-blue-50 rounded-lg p-4 mt-6">
                                                    <p className="text-sm text-blue-900">
                                                        📊 <strong>{autoAnalysis.analysis_type}</strong>
                                                    </p>
                                                    <p className="text-sm text-blue-700 mt-2">
                                                        Based on {autoAnalysis.total_soil_records} soil records and {autoAnalysis.total_sensor_readings} sensor readings
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Top 5 Recommendations with Images */}
                                        <div className="bg-white rounded-lg shadow-md p-6">
                                            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                                📋 Top 5 Crop Recommendations
                                            </h3>
                                            <div className="space-y-4">
                                                {autoAnalysis.top_5_recommendations.map((rec) => (
                                                    <div
                                                        key={rec.rank}
                                                        className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-green-50 rounded-lg hover:shadow-md transition border border-gray-200"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-600 text-white font-bold text-lg">
                                                                {rec.rank}
                                                            </div>
                                                            <div className="text-5xl">
                                                                {getCropImage(rec.crop_name)}
                                                            </div>
                                                            <span className="font-semibold text-xl capitalize text-gray-800">
                                                                {rec.crop_name}
                                                            </span>
                                                        </div>
                                                        <div className={`font-bold text-xl ${getConfidenceColor(rec.probability)}`}>
                                                            {rec.probability.toFixed(2)}%
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Average Parameters Used */}
                                        <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
                                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                                📊 Average Parameters from Database
                                            </h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                                                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg text-center border border-green-200">
                                                    <div className="text-2xl mb-1">🧪</div>
                                                    <div className="text-sm text-gray-600">Nitrogen</div>
                                                    <div className="text-xl font-bold text-green-700">{autoAnalysis.average_parameters.nitrogen}</div>
                                                </div>
                                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg text-center border border-blue-200">
                                                    <div className="text-2xl mb-1">🧪</div>
                                                    <div className="text-sm text-gray-600">Phosphorus</div>
                                                    <div className="text-xl font-bold text-blue-700">{autoAnalysis.average_parameters.phosphorus}</div>
                                                </div>
                                                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg text-center border border-purple-200">
                                                    <div className="text-2xl mb-1">🧪</div>
                                                    <div className="text-sm text-gray-600">Potassium</div>
                                                    <div className="text-xl font-bold text-purple-700">{autoAnalysis.average_parameters.potassium}</div>
                                                </div>
                                                <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg text-center border border-red-200">
                                                    <div className="text-2xl mb-1">🌡️</div>
                                                    <div className="text-sm text-gray-600">Temperature</div>
                                                    <div className="text-xl font-bold text-red-700">{autoAnalysis.average_parameters.temperature}°C</div>
                                                </div>
                                                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-lg text-center border border-cyan-200">
                                                    <div className="text-2xl mb-1">💧</div>
                                                    <div className="text-sm text-gray-600">Humidity</div>
                                                    <div className="text-xl font-bold text-cyan-700">{autoAnalysis.average_parameters.humidity}%</div>
                                                </div>
                                                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg text-center border border-yellow-200">
                                                    <div className="text-2xl mb-1">⚗️</div>
                                                    <div className="text-sm text-gray-600">pH Level</div>
                                                    <div className="text-xl font-bold text-yellow-700">{autoAnalysis.average_parameters.ph_level}</div>
                                                </div>
                                                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg text-center border border-indigo-200">
                                                    <div className="text-2xl mb-1">🌧️</div>
                                                    <div className="text-sm text-gray-600">Rainfall</div>
                                                    <div className="text-xl font-bold text-indigo-700">{autoAnalysis.average_parameters.rainfall}mm</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Manual Input Tab */}
                    {activeTab === 'manual' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Input Form */}
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h2 className="text-xl font-semibold mb-2">Enter Soil & Environmental Data</h2>
                                <p className="text-gray-600 text-sm mb-6">
                                    Provide the following parameters to get crop recommendations
                                </p>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* NPK Values */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Nitrogen (N)</label>
                                            <input
                                                name="N"
                                                type="number"
                                                step="0.01"
                                                placeholder="0-140"
                                                value={formData.N}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Phosphorus (P)</label>
                                            <input
                                                name="P"
                                                type="number"
                                                step="0.01"
                                                placeholder="5-145"
                                                value={formData.P}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Potassium (K)</label>
                                            <input
                                                name="K"
                                                type="number"
                                                step="0.01"
                                                placeholder="5-205"
                                                value={formData.K}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Environmental Parameters */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Temperature (°C)</label>
                                            <input
                                                name="temperature"
                                                type="number"
                                                step="0.1"
                                                placeholder="8-44"
                                                value={formData.temperature}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Humidity (%)</label>
                                            <input
                                                name="humidity"
                                                type="number"
                                                step="0.1"
                                                placeholder="14-100"
                                                value={formData.humidity}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">pH Level</label>
                                            <input
                                                name="ph"
                                                type="number"
                                                step="0.1"
                                                placeholder="3.5-10"
                                                value={formData.ph}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Rainfall (mm)</label>
                                            <input
                                                name="rainfall"
                                                type="number"
                                                step="0.1"
                                                placeholder="20-300"
                                                value={formData.rainfall}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex gap-4 pt-4">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex-1 bg-green-600 text-white py-3 rounded-md hover:bg-green-700 disabled:bg-gray-400 transition font-semibold"
                                        >
                                            {loading ? '🔄 Analyzing...' : '📊 Get Recommendation'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetForm}
                                            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Results */}
                            <div className="space-y-4">
                                {prediction && (
                                    <>
                                        {/* Main Recommendation */}
                                        <div className="bg-white rounded-lg shadow-md border-2 border-green-500 overflow-hidden">
                                            <div className="bg-green-50 p-4">
                                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                                    🌱 Recommended Crop
                                                </h2>
                                            </div>
                                            <div className="p-6">
                                                <div className="text-center">
                                                    <div className="text-8xl mb-4">
                                                        {getCropImage(prediction.recommended_crop)}
                                                    </div>
                                                    <h2 className="text-4xl font-bold text-green-700 mb-4 uppercase">
                                                        {prediction.recommended_crop}
                                                    </h2>
                                                    <div className={`text-2xl font-semibold ${getConfidenceColor(prediction.confidence)}`}>
                                                        Confidence: {prediction.confidence.toFixed(2)}%
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Top 3 Recommendations */}
                                        <div className="bg-white rounded-lg shadow-md p-6">
                                            <h3 className="text-lg font-semibold mb-4">Top 3 Crop Recommendations</h3>
                                            <div className="space-y-3">
                                                {prediction.top_3_recommendations.map((rec) => (
                                                    <div
                                                        key={rec.rank}
                                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white font-bold">
                                                                {rec.rank}
                                                            </div>
                                                            <div className="text-4xl">
                                                                {getCropImage(rec.crop_name)}
                                                            </div>
                                                            <span className="font-semibold text-lg capitalize">
                                                                {rec.crop_name}
                                                            </span>
                                                        </div>
                                                        <div className={`font-semibold ${getConfidenceColor(rec.probability)}`}>
                                                            {rec.probability.toFixed(2)}%
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Input Parameters Used */}
                                        <div className="bg-white rounded-lg shadow-md p-6">
                                            <h3 className="text-sm font-semibold mb-3">Parameters Used</h3>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div className="p-2 bg-gray-50 rounded">N: {prediction.input_parameters.nitrogen}</div>
                                                <div className="p-2 bg-gray-50 rounded">P: {prediction.input_parameters.phosphorus}</div>
                                                <div className="p-2 bg-gray-50 rounded">K: {prediction.input_parameters.potassium}</div>
                                                <div className="p-2 bg-gray-50 rounded">Temp: {prediction.input_parameters.temperature}°C</div>
                                                <div className="p-2 bg-gray-50 rounded">Humidity: {prediction.input_parameters.humidity}%</div>
                                                <div className="p-2 bg-gray-50 rounded">pH: {prediction.input_parameters.ph}</div>
                                                <div className="p-2 bg-gray-50 rounded">Rainfall: {prediction.input_parameters.rainfall}mm</div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Initial State Message */}
                                {!prediction && !loading && (
                                    <div className="bg-gray-50 rounded-lg p-12 text-center">
                                        <div className="text-6xl mb-4">🌾</div>
                                        <p className="text-gray-600">
                                            Fill in the form to get AI-powered crop recommendations
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CropRecommendation;
