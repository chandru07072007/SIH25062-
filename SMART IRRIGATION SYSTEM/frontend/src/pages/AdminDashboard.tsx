import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, MapPin, Sprout, Activity, Droplets, Cloud,
    Plus, Edit2, Trash2, BarChart3, RefreshCw, X, Save,
    ChevronDown, Search, Filter, Eye
} from 'lucide-react';
import {
    farmService, landService, cropService, sensorService,
    sensorReadingService, waterResourceService, irrigationService,
    irrigationControlService, weatherService, analyticsService, seedDemoData,
    type Farm, type Land, type Crop, type Sensor, type SensorReading,
    type WaterResource, type Irrigation, type IrrigationControl, type Weather
} from '../services/mongodbService';

type EntityType = 'farms' | 'lands' | 'crops' | 'sensors' | 'readings' | 'water' | 'irrigation' | 'controls' | 'weather';

const AdminDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'manage'>('dashboard');
    const [activeEntity, setActiveEntity] = useState<EntityType>('farms');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Stats
    const [stats, setStats] = useState({
        totalFarmers: 0,
        totalLands: 0,
        totalCrops: 0,
        totalSensors: 0,
        totalReadings: 0
    });

    // Data states
    const [farms, setFarms] = useState<any[]>([]);
    const [lands, setLands] = useState<any[]>([]);
    const [crops, setCrops] = useState<any[]>([]);
    const [sensors, setSensors] = useState<any[]>([]);
    const [readings, setReadings] = useState<any[]>([]);
    const [waterResources, setWaterResources] = useState<any[]>([]);
    const [irrigations, setIrrigations] = useState<any[]>([]);
    const [controls, setControls] = useState<any[]>([]);
    const [weathers, setWeathers] = useState<any[]>([]);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [formData, setFormData] = useState<any>({});

    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadDashboardStats();
    }, []);

    useEffect(() => {
        if (activeTab === 'manage') {
            loadEntityData(activeEntity);
        }
    }, [activeTab, activeEntity]);

    const loadDashboardStats = async () => {
        try {
            setLoading(true);
            const data = await analyticsService.getDashboardStats();
            setStats(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadEntityData = async (entity: EntityType) => {
        try {
            setLoading(true);
            setError(null);

            switch (entity) {
                case 'farms':
                    const farmData = await farmService.getAll();
                    setFarms(farmData);
                    break;
                case 'lands':
                    const landData = await landService.getAll();
                    setLands(landData);
                    break;
                case 'crops':
                    const cropData = await cropService.getAll();
                    setCrops(cropData);
                    break;
                case 'sensors':
                    const sensorData = await sensorService.getAll();
                    setSensors(sensorData);
                    break;
                case 'readings':
                    const readingData = await sensorReadingService.getAll();
                    setReadings(readingData);
                    break;
                case 'water':
                    const waterData = await waterResourceService.getAll();
                    setWaterResources(waterData);
                    break;
                case 'irrigation':
                    const irrigationData = await irrigationService.getAll();
                    setIrrigations(irrigationData);
                    break;
                case 'controls':
                    const controlData = await irrigationControlService.getAll();
                    setControls(controlData);
                    break;
                case 'weather':
                    const weatherData = await weatherService.getAll();
                    setWeathers(weatherData);
                    break;
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = (entity: EntityType) => {
        setModalMode('create');
        setSelectedItem(null);
        setFormData({});
        setShowModal(true);
    };

    const handleEdit = (item: any) => {
        setModalMode('edit');
        setSelectedItem(item);
        setFormData(item);
        setShowModal(true);
    };

    const handleDelete = async (entity: EntityType, id: string | number) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;

        try {
            setLoading(true);

            switch (entity) {
                case 'farms':
                    await farmService.delete(id);
                    break;
                case 'lands':
                    await landService.delete(id);
                    break;
                case 'crops':
                    await cropService.delete(id);
                    break;
                case 'sensors':
                    await sensorService.delete(id);
                    break;
                case 'readings':
                    await sensorReadingService.delete(id);
                    break;
                case 'water':
                    await waterResourceService.delete(id);
                    break;
                case 'irrigation':
                    await irrigationService.delete(id);
                    break;
                case 'controls':
                    await irrigationControlService.delete(id);
                    break;
                case 'weather':
                    await weatherService.delete(id);
                    break;
            }

            await loadEntityData(entity);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);

            if (modalMode === 'create') {
                switch (activeEntity) {
                    case 'farms':
                        await farmService.create(formData);
                        break;
                    case 'lands':
                        await landService.create(formData);
                        break;
                    case 'crops':
                        await cropService.create(formData);
                        break;
                    case 'sensors':
                        await sensorService.create(formData);
                        break;
                    case 'readings':
                        await sensorReadingService.create(formData);
                        break;
                    case 'water':
                        await waterResourceService.create(formData);
                        break;
                    case 'irrigation':
                        await irrigationService.create(formData);
                        break;
                    case 'controls':
                        await irrigationControlService.create(formData);
                        break;
                    case 'weather':
                        await weatherService.create(formData);
                        break;
                }
            } else {
                const id = getIdFromItem(selectedItem);
                switch (activeEntity) {
                    case 'farms':
                        await farmService.update(id, formData);
                        break;
                    case 'lands':
                        await landService.update(id, formData);
                        break;
                    case 'crops':
                        await cropService.update(id, formData);
                        break;
                    case 'sensors':
                        await sensorService.update(id, formData);
                        break;
                    case 'water':
                        await waterResourceService.update(id, formData);
                        break;
                    case 'irrigation':
                        await irrigationService.update(id, formData);
                        break;
                    case 'controls':
                        await irrigationControlService.update(id, formData);
                        break;
                    case 'weather':
                        await weatherService.update(id, formData);
                        break;
                }
            }

            setShowModal(false);
            await loadEntityData(activeEntity);
            await loadDashboardStats();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getIdFromItem = (item: any) => {
        return item.farmer_id || item.land_id || item.crop_id || item.sensor_id ||
            item.reading_id || item.water_id || item.event_id || item.control_id ||
            item.weather_id;
    };

    const getCurrentData = () => {
        switch (activeEntity) {
            case 'farms': return farms;
            case 'lands': return lands;
            case 'crops': return crops;
            case 'sensors': return sensors;
            case 'readings': return readings;
            case 'water': return waterResources;
            case 'irrigation': return irrigations;
            case 'controls': return controls;
            case 'weather': return weathers;
            default: return [];
        }
    };

    const handleSeedDemoData = async () => {
        if (!window.confirm('This will create 5 demo farmers. Continue?')) return;

        try {
            setLoading(true);
            setError(null);
            const results = await seedDemoData();
            const successCount = results.filter((r) => r.success).length;
            const failCount = results.filter((r) => !r.success).length;

            if (successCount > 0) {
                alert(`Successfully created ${successCount} farmers!`);
                await loadDashboardStats();
                if (activeEntity === 'farms') {
                    await loadEntityData('farms');
                }
            }

            if (failCount > 0) {
                const errors = results.filter((r) => !r.success).map((r) => r.error).join(', ');
                setError(`Failed to create ${failCount} farmers: ${errors}`);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const entityConfig = {
        farms: { name: 'Farmers', icon: Users, color: 'blue', idField: 'farmer_id' },
        lands: { name: 'Lands', icon: MapPin, color: 'green', idField: 'land_id' },
        crops: { name: 'Crops', icon: Sprout, color: 'emerald', idField: 'crop_id' },
        sensors: { name: 'Sensors', icon: Activity, color: 'purple', idField: 'sensor_id' },
        readings: { name: 'Sensor Readings', icon: BarChart3, color: 'orange', idField: 'reading_id' },
        water: { name: 'Water Resources', icon: Droplets, color: 'cyan', idField: 'water_id' },
        irrigation: { name: 'Irrigation Events', icon: Droplets, color: 'teal', idField: 'event_id' },
        controls: { name: 'Irrigation Controls', icon: Activity, color: 'indigo', idField: 'control_id' },
        weather: { name: 'Weather', icon: Cloud, color: 'sky', idField: 'weather_id' }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <header className="mb-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
                        <p className="text-gray-600">Manage all irrigation system data</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/users')}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                        >
                            <Eye size={18} />
                            View Users
                        </button>
                        <button
                            onClick={handleSeedDemoData}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                            disabled={loading}
                        >
                            <Users size={18} />
                            Seed 5 Farmers
                        </button>
                        <button
                            onClick={() => loadDashboardStats()}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            disabled={loading}
                        >
                            <RefreshCw size={18} />
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-6 py-3 font-semibold transition ${activeTab === 'dashboard'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    <BarChart3 className="inline mr-2" size={18} />
                    Analytics
                </button>
                <button
                    onClick={() => setActiveTab('manage')}
                    className={`px-6 py-3 font-semibold transition ${activeTab === 'manage'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    <Edit2 className="inline mr-2" size={18} />
                    Manage Data
                </button>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <strong>Error:</strong> {error}
                    <button onClick={() => setError(null)} className="float-right text-red-900 hover:text-red-700">
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    <StatCard
                        title="Total Farmers"
                        value={stats.totalFarmers}
                        icon={Users}
                        color="blue"
                    />
                    <StatCard
                        title="Total Lands"
                        value={stats.totalLands}
                        icon={MapPin}
                        color="green"
                    />
                    <StatCard
                        title="Total Crops"
                        value={stats.totalCrops}
                        icon={Sprout}
                        color="emerald"
                    />
                    <StatCard
                        title="Total Sensors"
                        value={stats.totalSensors}
                        icon={Activity}
                        color="purple"
                    />
                    <StatCard
                        title="Sensor Readings"
                        value={stats.totalReadings}
                        icon={BarChart3}
                        color="orange"
                    />
                </div>
            )}

            {/* Manage Tab */}
            {activeTab === 'manage' && (
                <div>
                    {/* Entity Selector */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {(Object.keys(entityConfig) as EntityType[]).map((entity) => {
                            const config = entityConfig[entity];
                            const Icon = config.icon;
                            return (
                                <button
                                    key={entity}
                                    onClick={() => setActiveEntity(entity)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${activeEntity === entity
                                        ? `bg-${config.color}-600 text-white`
                                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    style={activeEntity === entity ? { backgroundColor: `var(--${config.color}-600)` } : {}}
                                >
                                    <Icon size={18} />
                                    {config.name}
                                </button>
                            );
                        })}
                    </div>

                    {/* Actions Bar */}
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleCreate(activeEntity)}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                            >
                                <Plus size={18} />
                                Add New
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Data Table */}
                    {loading ? (
                        <div className="text-center py-12">
                            <RefreshCw className="animate-spin mx-auto mb-4 text-blue-600" size={32} />
                            <p className="text-gray-600">Loading...</p>
                        </div>
                    ) : (
                        <DataTable
                            entity={activeEntity}
                            data={getCurrentData()}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            searchTerm={searchTerm}
                        />
                    )}
                </div>
            )}

            {/* Modal for Create/Edit */}
            {showModal && (
                <Modal
                    title={`${modalMode === 'create' ? 'Create' : 'Edit'} ${entityConfig[activeEntity].name}`}
                    onClose={() => setShowModal(false)}
                    onSave={handleSave}
                    loading={loading}
                >
                    <EntityForm
                        entity={activeEntity}
                        data={formData}
                        onChange={setFormData}
                        mode={modalMode}
                    />
                </Modal>
            )}
        </div>
    );
};

// Stat Card Component
const StatCard: React.FC<{
    title: string;
    value: number;
    icon: React.ComponentType<any>;
    color: string;
}> = ({ title, value, icon: Icon, color }) => {
    return (
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: `var(--${color}-600)` }}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-gray-600 text-sm mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                </div>
                <div className={`p-3 bg-${color}-100 rounded-lg`}>
                    <Icon className={`text-${color}-600`} size={24} />
                </div>
            </div>
        </div>
    );
};

// Data Table Component
const DataTable: React.FC<{
    entity: EntityType;
    data: any[];
    onEdit: (item: any) => void;
    onDelete: (entity: EntityType, id: string | number) => void;
    searchTerm: string;
}> = ({ entity, data, onEdit, onDelete, searchTerm }) => {
    const filteredData = data.filter((item) =>
        JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filteredData.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
                <p>No data found</p>
            </div>
        );
    }

    const renderTableContent = () => {
        switch (entity) {
            case 'farms':
                return (
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Object ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Photo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mobile</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Village</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredData.map((item) => (
                                <tr key={item.farmer_id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{item.farmer_id}</td>
                                    <td className="px-6 py-4">
                                        {item.farm_image ? (
                                            <img
                                                src={item.farm_image}
                                                alt={item.name}
                                                className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/50/4169e1/ffffff?text=' + item.name.charAt(0);
                                                }}
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                                                {item.name.charAt(0)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{item.mobile_number}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{item.village}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <ActionButtons item={item} entity={entity} onEdit={onEdit} onDelete={onDelete} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );

            case 'lands':
                return (
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Land Object ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Land Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Farmer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Area (acres)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Soil Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredData.map((item) => (
                                <tr key={item.land_id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.land_id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.land_name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.farm?.name || item.farmer_id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.area_acres}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.soil_type}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <ActionButtons item={item} entity={entity} onEdit={onEdit} onDelete={onDelete} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );

            case 'crops':
                return (
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Crop Object ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Farmer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Growth Stage</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Water Need</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredData.map((item) => (
                                <tr key={item.crop_id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.crop_id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.farm?.name || item.farmer_id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.growth_stage}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.water_need}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <ActionButtons item={item} entity={entity} onEdit={onEdit} onDelete={onDelete} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );

            case 'sensors':
                return (
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sensor Object ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Land</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Farmer ObjectId</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredData.map((item) => (
                                <tr key={item.sensor_id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.sensor_id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.sensor_type}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.land?.land_name || item.land_id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.farmer_id}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <ActionButtons item={item} entity={entity} onEdit={onEdit} onDelete={onDelete} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );

            case 'readings':
                return (
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reading Object ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sensor ObjectId</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Moisture</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Temperature</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded At</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredData.map((item) => (
                                <tr key={item.reading_id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.reading_id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.sensor_id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.moisture}%</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.temperature}°C</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{new Date(item.recorded_at).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <ActionButtons item={item} entity={entity} onEdit={onEdit} onDelete={onDelete} allowEdit={false} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );

            default:
                return (
                    <div className="overflow-x-auto">
                        <pre className="text-xs">{JSON.stringify(filteredData, null, 2)}</pre>
                    </div>
                );
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {renderTableContent()}
        </div>
    );
};

// Action Buttons Component
const ActionButtons: React.FC<{
    item: any;
    entity: EntityType;
    onEdit: (item: any) => void;
    onDelete: (entity: EntityType, id: string | number) => void;
    allowEdit?: boolean;
}> = ({ item, entity, onEdit, onDelete, allowEdit = true }) => {
    const getId = () => {
        return item.farmer_id || item.land_id || item.crop_id || item.sensor_id ||
            item.reading_id || item.water_id || item.event_id || item.control_id ||
            item.weather_id;
    };

    return (
        <div className="flex gap-2">
            {allowEdit && (
                <button
                    onClick={() => onEdit(item)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                    title="Edit"
                >
                    <Edit2 size={16} />
                </button>
            )}
            <button
                onClick={() => onDelete(entity, getId())}
                className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                title="Delete"
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
};

// Modal Component
const Modal: React.FC<{
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    onSave: () => void;
    loading: boolean;
}> = ({ title, children, onClose, onSave, loading }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {children}
                </div>
                <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                        disabled={loading}
                    >
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

// Entity Form Component
const EntityForm: React.FC<{
    entity: EntityType;
    data: any;
    onChange: (data: any) => void;
    mode: 'create' | 'edit';
}> = ({ entity, data, onChange, mode }) => {
    const handleChange = (field: string, value: any) => {
        onChange({ ...data, [field]: value });
    };

    const renderForm = () => {
        switch (entity) {
            case 'farms':
                return (
                    <>
                        <InputField label="Name" value={data.name || ''} onChange={(v) => handleChange('name', v)} required />
                        <InputField label="Mobile Number" value={data.mobile_number || ''} onChange={(v) => handleChange('mobile_number', v)} />
                        <InputField label="Village" value={data.village || ''} onChange={(v) => handleChange('village', v)} />
                        <InputField label="Farm Image URL" value={data.farm_image || ''} onChange={(v) => handleChange('farm_image', v)} />
                    </>
                );

            case 'lands':
                return (
                    <>
                        <InputField label="Farmer ObjectId" value={data.farmer_id || ''} onChange={(v) => handleChange('farmer_id', v)} />
                        <InputField label="Land Name" value={data.land_name || ''} onChange={(v) => handleChange('land_name', v)} />
                        <InputField label="Area (acres)" type="number" step="0.01" value={data.area_acres || ''} onChange={(v) => handleChange('area_acres', Number(v))} />
                        <InputField label="Soil Type" value={data.soil_type || ''} onChange={(v) => handleChange('soil_type', v)} />
                        <InputField label="Village" value={data.village || ''} onChange={(v) => handleChange('village', v)} />
                    </>
                );

            case 'crops':
                return (
                    <>
                        <InputField label="Farmer ObjectId" value={data.farmer_id || ''} onChange={(v) => handleChange('farmer_id', v)} />
                        <InputField label="Growth Stage" value={data.growth_stage || ''} onChange={(v) => handleChange('growth_stage', v)} />
                        <InputField label="Water Need" type="number" step="0.01" value={data.water_need || ''} onChange={(v) => handleChange('water_need', Number(v))} />
                    </>
                );

            case 'sensors':
                return (
                    <>
                        <InputField label="Farmer ObjectId" value={data.farmer_id || ''} onChange={(v) => handleChange('farmer_id', v)} />
                        <InputField label="Sensor Type" value={data.sensor_type || ''} onChange={(v) => handleChange('sensor_type', v)} />
                        <InputField label="Land ObjectId" value={data.land_id || ''} onChange={(v) => handleChange('land_id', v)} />
                    </>
                );

            case 'readings':
                return (
                    <>
                        <InputField label="Sensor ObjectId" value={data.sensor_id || ''} onChange={(v) => handleChange('sensor_id', v)} required />
                        <InputField label="Moisture (%)" type="number" step="0.01" value={data.moisture || ''} onChange={(v) => handleChange('moisture', Number(v))} required />
                        <InputField label="Temperature (°C)" type="number" step="0.01" value={data.temperature || ''} onChange={(v) => handleChange('temperature', Number(v))} required />
                    </>
                );

            case 'water':
                return (
                    <>
                        <InputField label="Sensor ObjectId" value={data.sensor_id || ''} onChange={(v) => handleChange('sensor_id', v)} />
                        <InputField label="Water Level" type="number" step="0.01" value={data.water_level || ''} onChange={(v) => handleChange('water_level', Number(v))} />
                    </>
                );

            case 'irrigation':
                return (
                    <>
                        <InputField label="Crop ObjectId" value={data.crop_id || ''} onChange={(v) => handleChange('crop_id', v)} />
                        <InputField label="Valve Status" value={data.valve_status || ''} onChange={(v) => handleChange('valve_status', v)} />
                        <InputField label="Water Used" type="number" step="0.01" value={data.water_used || ''} onChange={(v) => handleChange('water_used', Number(v))} />
                    </>
                );

            case 'controls':
                return (
                    <>
                        <InputField label="Water ObjectId" value={data.water_id || ''} onChange={(v) => handleChange('water_id', v)} />
                        <SelectField
                            label="Valve Status"
                            value={data.valve_status || 'CLOSED'}
                            onChange={(v) => handleChange('valve_status', v)}
                            options={[{ value: 'OPEN', label: 'OPEN' }, { value: 'CLOSED', label: 'CLOSED' }]}
                        />
                        <InputField label="Water Used" type="number" step="0.01" value={data.water_used || ''} onChange={(v) => handleChange('water_used', Number(v))} />
                    </>
                );

            case 'weather':
                return (
                    <>
                        <InputField label="Sensor ObjectId" value={data.sensor_id || ''} onChange={(v) => handleChange('sensor_id', v)} />
                        <InputField label="Water Resource" value={data.water_resource || ''} onChange={(v) => handleChange('water_resource', v)} />
                    </>
                );

            default:
                return <p>Form not implemented for this entity</p>;
        }
    };

    return <div className="space-y-4">{renderForm()}</div>;
};

// Input Field Component
const InputField: React.FC<{
    label: string;
    value: any;
    onChange: (value: string) => void;
    type?: string;
    step?: string;
    required?: boolean;
}> = ({ label, value, onChange, type = 'text', step, required = false }) => {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                type={type}
                step={step}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={required}
            />
        </div>
    );
};

// Select Field Component
const SelectField: React.FC<{
    label: string;
    value: any;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default AdminDashboard;
