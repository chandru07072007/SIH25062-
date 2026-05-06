import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, MapPin, Sprout, Activity, RefreshCw, ArrowLeft, Edit2 } from 'lucide-react';
import { farmService, landService, cropService, sensorService } from '../services/mongodbService';

interface FarmerDetails {
    farmer_id?: string;
    name: string;
    mobile_number?: string;
    village?: string;
    farm_image?: string;
    lands?: any[];
    crops?: any[];
    sensors?: any[];
}

const UserDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [farmers, setFarmers] = useState<FarmerDetails[]>([]);
    const [selectedFarmer, setSelectedFarmer] = useState<FarmerDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

    useEffect(() => {
        loadFarmers();

        // Auto-refresh every 30 minutes to match backend refresh cycle
        const interval = setInterval(() => {
            loadFarmers();
        }, 1800000); // 30 minutes

        setRefreshInterval(interval);

        return () => {
            if (interval) clearInterval(interval);
        };
    }, []);

    const loadFarmers = async () => {
        try {
            const farmersData = await farmService.getAll();
            const validFarmers = farmersData.filter((farmer): farmer is typeof farmer & { farmer_id: string } => Boolean(farmer.farmer_id));

            // Load related data for each farmer
            const farmersWithDetails = await Promise.all(
                validFarmers.map(async (farmer) => {
                    const [lands, crops, sensors] = await Promise.all([
                        landService.getByFarmer(farmer.farmer_id).catch(() => []),
                        cropService.getAll().then(crops => crops.filter(c => c.farmer_id === farmer.farmer_id)).catch(() => []),
                        sensorService.getAll().then(sensors => sensors.filter(s => s.farmer_id === farmer.farmer_id)).catch(() => [])
                    ]);

                    return {
                        ...farmer,
                        lands,
                        crops,
                        sensors
                    };
                })
            );

            setFarmers(farmersWithDetails);
        } catch (error) {
            console.error('Error loading farmers:', error);
        }
    };

    const handleRefresh = async () => {
        setLoading(true);
        await loadFarmers();
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
            {/* Header */}
            <header className="mb-8">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/admin')}
                            className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 mb-2">Farmer Management</h1>
                            <p className="text-gray-600">Live farmer details and updates from admin</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2 bg-white rounded-lg shadow">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-sm text-gray-600">Live Updates</span>
                            </div>
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            <RefreshCw className={loading ? 'animate-spin' : ''} size={18} />
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-600 text-sm mb-1">Total Farmers</p>
                            <p className="text-3xl font-bold text-gray-900">{farmers.length}</p>
                        </div>
                        <Users className="text-blue-600" size={32} />
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-600 text-sm mb-1">Total Lands</p>
                            <p className="text-3xl font-bold text-gray-900">
                                {farmers.reduce((acc, f) => acc + (f.lands?.length || 0), 0)}
                            </p>
                        </div>
                        <MapPin className="text-green-600" size={32} />
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-emerald-600">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-600 text-sm mb-1">Total Crops</p>
                            <p className="text-3xl font-bold text-gray-900">
                                {farmers.reduce((acc, f) => acc + (f.crops?.length || 0), 0)}
                            </p>
                        </div>
                        <Sprout className="text-emerald-600" size={32} />
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-600">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-600 text-sm mb-1">Total Sensors</p>
                            <p className="text-3xl font-bold text-gray-900">
                                {farmers.reduce((acc, f) => acc + (f.sensors?.length || 0), 0)}
                            </p>
                        </div>
                        <Activity className="text-purple-600" size={32} />
                    </div>
                </div>
            </div>

            {/* Farmers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {farmers.map((farmer) => (
                    <div
                        key={farmer.farmer_id}
                        className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                        onClick={() => setSelectedFarmer(farmer)}
                    >
                        {/* Farmer Image Header */}
                        <div className="h-32 bg-gradient-to-br from-green-400 to-blue-500 relative">
                            {farmer.farm_image ? (
                                <img
                                    src={farmer.farm_image}
                                    alt={farmer.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            ) : null}
                            <div className="absolute -bottom-10 left-6">
                                <div className="w-20 h-20 rounded-full bg-white p-1 shadow-lg">
                                    {farmer.farm_image ? (
                                        <img
                                            src={farmer.farm_image}
                                            alt={farmer.name}
                                            className="w-full h-full rounded-full object-cover"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.src = 'https://via.placeholder.com/80/4169e1/ffffff?text=' + farmer.name.charAt(0);
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-2xl font-bold">
                                            {farmer.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Farmer Details */}
                        <div className="pt-12 px-6 pb-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-1">{farmer.name}</h3>
                                    <p className="text-sm text-gray-500">Farmer ObjectId: {farmer.farmer_id}</p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/admin?edit=${farmer.farmer_id}`);
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                                >
                                    <Edit2 size={18} className="text-gray-600" />
                                </button>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex items-center text-sm text-gray-600">
                                    <span className="font-semibold mr-2">📱</span>
                                    {farmer.mobile_number || 'N/A'}
                                </div>
                                <div className="flex items-center text-sm text-gray-600">
                                    <span className="font-semibold mr-2">📍</span>
                                    {farmer.village || 'N/A'}
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-green-50 rounded-lg p-2 text-center">
                                    <p className="text-xs text-gray-600 mb-1">Lands</p>
                                    <p className="text-lg font-bold text-green-600">{farmer.lands?.length || 0}</p>
                                </div>
                                <div className="bg-emerald-50 rounded-lg p-2 text-center">
                                    <p className="text-xs text-gray-600 mb-1">Crops</p>
                                    <p className="text-lg font-bold text-emerald-600">{farmer.crops?.length || 0}</p>
                                </div>
                                <div className="bg-purple-50 rounded-lg p-2 text-center">
                                    <p className="text-xs text-gray-600 mb-1">Sensors</p>
                                    <p className="text-lg font-bold text-purple-600">{farmer.sensors?.length || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* No Farmers */}
            {farmers.length === 0 && !loading && (
                <div className="text-center py-20">
                    <Users size={64} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg">No farmers found</p>
                    <button
                        onClick={() => navigate('/admin')}
                        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        Go to Admin to Add Farmers
                    </button>
                </div>
            )}

            {/* Detailed Modal */}
            {selectedFarmer && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedFarmer(null)}
                >
                    <div
                        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">{selectedFarmer.name}</h2>
                                    <p className="text-gray-500">Farmer ObjectId: {selectedFarmer.farmer_id}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedFarmer(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Detailed Info */}
                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-semibold text-gray-700 mb-2">Contact Information</h3>
                                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                        <p><span className="font-medium">Mobile:</span> {selectedFarmer.mobile_number || 'N/A'}</p>
                                        <p><span className="font-medium">Village:</span> {selectedFarmer.village || 'N/A'}</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-semibold text-gray-700 mb-2">Lands ({selectedFarmer.lands?.length || 0})</h3>
                                    {selectedFarmer.lands && selectedFarmer.lands.length > 0 ? (
                                        <div className="space-y-2">
                                            {selectedFarmer.lands.map((land: any) => (
                                                <div key={land.land_id} className="bg-green-50 rounded-lg p-3">
                                                    <p className="font-medium">{land.land_name}</p>
                                                    <p className="text-sm text-gray-600">
                                                        {land.area_acres} acres • {land.soil_type}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 text-sm">No lands registered</p>
                                    )}
                                </div>

                                <div>
                                    <h3 className="font-semibold text-gray-700 mb-2">Crops ({selectedFarmer.crops?.length || 0})</h3>
                                    {selectedFarmer.crops && selectedFarmer.crops.length > 0 ? (
                                        <div className="space-y-2">
                                            {selectedFarmer.crops.map((crop: any) => (
                                                <div key={crop.crop_id} className="bg-emerald-50 rounded-lg p-3">
                                                    <p className="font-medium">Growth Stage: {crop.growth_stage}</p>
                                                    <p className="text-sm text-gray-600">
                                                        Water need: {crop.water_need}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 text-sm">No crops registered</p>
                                    )}
                                </div>

                                <div>
                                    <h3 className="font-semibold text-gray-700 mb-2">Sensors ({selectedFarmer.sensors?.length || 0})</h3>
                                    {selectedFarmer.sensors && selectedFarmer.sensors.length > 0 ? (
                                        <div className="space-y-2">
                                            {selectedFarmer.sensors.map((sensor: any) => (
                                                <div key={sensor.sensor_id} className="bg-purple-50 rounded-lg p-3">
                                                    <p className="font-medium">Type: {sensor.sensor_type}</p>
                                                    <p className="text-sm text-gray-600">
                                                        Sensor ObjectId: {sensor.sensor_id} • Land ObjectId: {sensor.land_id}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 text-sm">No sensors deployed</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserDashboard;
