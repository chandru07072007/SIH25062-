const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type EntityName =
  | 'farms'
  | 'lands'
  | 'crops'
  | 'sensors'
  | 'readings'
  | 'water'
  | 'irrigation'
  | 'controls'
  | 'weather'
  | 'soil-analysis'
  | 'crop-recommendations';

export interface Farm {
  farmer_id?: string;
  name: string;
  mobile_number?: string;
  village?: string;
  farm_image?: string;
  location?: string;
}

export interface Land {
  land_id?: string;
  farmer_id?: string;
  land_name?: string;
  area_acres?: number;
  soil_type?: string;
  village?: string;
}

export interface Crop {
  crop_id?: string;
  farmer_id?: string;
  growth_stage?: string;
  water_need?: number;
}

export interface Sensor {
  sensor_id?: string;
  farmer_id?: string;
  sensor_type?: string;
  land_id?: string;
  device_id?: string;
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

export interface SensorReading {
  reading_id?: string;
  sensor_id?: string;
  moisture: number;
  temperature: number;
  humidity?: number;
  recorded_at?: string;
}

export interface WaterResource {
  water_id?: string;
  sensor_id?: string;
  water_level?: number;
}

export interface Irrigation {
  event_id?: string;
  crop_id?: string;
  valve_status?: string;
  water_used?: number;
}

export interface IrrigationControl {
  control_id?: string;
  water_id?: string;
  valve_status?: 'OPEN' | 'CLOSED';
  water_used?: number;
}

export interface Weather {
  weather_id?: string;
  sensor_id?: string;
  water_resource?: string;
}

export interface SoilAnalysis {
  analysis_id?: string;
  land_id?: string;
  ph_level?: number;
  moisture_level?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  organic_matter?: number;
  recorded_at?: string;
  created_at?: string;
}

export interface CropRecommendation {
  recommendation_id?: string;
  land_id?: string;
  crop_id?: string;
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

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      detail = body?.detail || body?.message || detail;
    } catch {
      // Ignore JSON parse errors.
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function buildCrudService<T>(entity: EntityName) {
  return {
    getAll: async () => apiRequest<T[]>(`/api/admin/${entity}`),
    getById: async (id: string | number) => apiRequest<T>(`/api/admin/${entity}/${id}`),
    create: async (payload: Partial<T>) =>
      apiRequest<T>(`/api/admin/${entity}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: async (id: string | number, payload: Partial<T>) =>
      apiRequest<T>(`/api/admin/${entity}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    delete: async (id: string | number) =>
      apiRequest<void>(`/api/admin/${entity}/${id}`, {
        method: 'DELETE',
      }),
  };
}

export const farmService = buildCrudService<Farm>('farms');
export const landService = {
  ...buildCrudService<Land>('lands'),
  getByFarmer: async (farmerId: string) => {
    const all = await apiRequest<Land[]>('/api/admin/lands');
    return all.filter((row) => row.farmer_id === farmerId);
  },
};
export const cropService = buildCrudService<Crop>('crops');
export const sensorService = buildCrudService<Sensor>('sensors');
export const sensorReadingService = {
  ...buildCrudService<SensorReading>('readings'),
  getBySensor: async (sensorId: string, limit = 50) => {
    const all = await apiRequest<SensorReading[]>('/api/admin/readings');
    return all.filter((row) => row.sensor_id === sensorId).slice(0, limit);
  },
};
export const waterResourceService = buildCrudService<WaterResource>('water');
export const irrigationService = buildCrudService<Irrigation>('irrigation');
export const irrigationControlService = buildCrudService<IrrigationControl>('controls');
export const weatherService = buildCrudService<Weather>('weather');
export const soilAnalysisService = {
  ...buildCrudService<SoilAnalysis>('soil-analysis'),
  getByLand: async (landId: string) => {
    const all = await apiRequest<SoilAnalysis[]>('/api/admin/soil-analysis');
    return all.find((row) => row.land_id === landId) || null;
  },
};
export const cropRecommendationService = {
  ...buildCrudService<CropRecommendation>('crop-recommendations'),
  getByLand: async (landId: string) => {
    const all = await apiRequest<CropRecommendation[]>('/api/admin/crop-recommendations');
    return all.filter((row) => row.land_id === landId);
  },
  getOptimalForLand: async (landId: string) => {
    const all = await apiRequest<CropRecommendation[]>('/api/admin/crop-recommendations');
    return all.filter((row) => row.land_id === landId && row.is_optimal);
  },
};

export const analyticsService = {
  getDashboardStats: async () => {
    const data = await apiRequest<any>('/api/dashboard-stats');
    return {
      totalFarmers: data.totalFarmers ?? data.total_farmers ?? 0,
      totalLands: data.totalLands ?? data.total_lands ?? 0,
      totalCrops: data.totalCrops ?? data.total_crops ?? 0,
      totalSensors: data.totalSensors ?? data.total_sensors ?? 0,
      totalReadings: data.totalReadings ?? data.total_readings ?? 0,
    };
  },

  getRecentActivity: async () => {
    const readings = await apiRequest<SensorReading[]>('/api/admin/readings');
    return readings.slice(0, 10);
  },
};

export const seedDemoData = async () => {
  const demoFarmers: Farm[] = [
    {
      name: 'Rajesh Kumar',
      mobile_number: '+91 98765 43210',
      village: 'Panchgani',
      farm_image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400',
      location: 'Panchgani',
    },
    {
      name: 'Priya Sharma',
      mobile_number: '+91 98765 43211',
      village: 'Mahabaleshwar',
      farm_image: 'https://images.unsplash.com/photo-1566328386401-b2980125f6b4?w=400',
      location: 'Mahabaleshwar',
    },
    {
      name: 'Amit Patel',
      mobile_number: '+91 98765 43212',
      village: 'Wai',
      farm_image: 'https://images.unsplash.com/photo-1595656302651-52c04f54affa?w=400',
      location: 'Wai',
    },
    {
      name: 'Kavita Deshmukh',
      mobile_number: '+91 98765 43213',
      village: 'Satara',
      farm_image: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400',
      location: 'Satara',
    },
    {
      name: 'Suresh Jadhav',
      mobile_number: '+91 98765 43214',
      village: 'Karad',
      farm_image: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=400',
      location: 'Karad',
    },
  ];

  const results: Array<{ success: boolean; farmer: Farm; error?: string }> = [];

  for (const farmer of demoFarmers) {
    try {
      await farmService.create(farmer);
      results.push({ success: true, farmer });
    } catch (error: any) {
      results.push({ success: false, farmer, error: error?.message || 'Unknown error' });
    }
  }

  return results;
};

export const seedSoilAnalysisData = async (landId: string) => {
  try {
    const soilAnalysis: SoilAnalysis = {
      land_id: landId,
      ph_level: 6.8,
      moisture_level: 42,
      nitrogen: 80,
      phosphorus: 60,
      potassium: 90,
      organic_matter: 3.5,
      recorded_at: new Date().toISOString(),
    };

    const createdSoilAnalysis = await soilAnalysisService.create(soilAnalysis);

    const cropRecommendations: CropRecommendation[] = [
      {
        land_id: landId,
        crop_name: 'Winter Wheat',
        crop_type: 'Cereal',
        suitability_score: 95,
        growth_duration_days: 120,
        estimated_yield: 'High Yield',
        market_price: '$250/Ton',
        image_url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&q=80&w=1000',
        description: 'Winter wheat is highly suitable for this soil type with excellent pH levels and NPK balance.',
        is_optimal: true,
      },
      {
        land_id: landId,
        crop_name: 'Rice',
        crop_type: 'Wetland',
        suitability_score: 88,
        growth_duration_days: 135,
        estimated_yield: 'Medium-High',
        market_price: '$280/Ton',
        image_url: 'https://images.unsplash.com/photo-1586771107445-d3ca888129ff?auto=format&fit=crop&q=80&w=1000',
        description: 'Paddy rice cultivation is compatible with current moisture levels and soil composition.',
        is_optimal: true,
      },
      {
        land_id: landId,
        crop_name: 'Sweet Corn',
        crop_type: 'Organic',
        suitability_score: 82,
        growth_duration_days: 90,
        estimated_yield: 'Medium',
        market_price: '$340/Ton',
        image_url: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&q=80&w=1000',
        description: 'Sweet corn offers good returns with moderate soil requirements and shorter growing season.',
        is_optimal: false,
      },
    ];

    const recommendations = [];
    for (const recommendation of cropRecommendations) {
      recommendations.push(await cropRecommendationService.create(recommendation));
    }

    return {
      success: true,
      soilAnalysis: createdSoilAnalysis,
      recommendations,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Unknown error',
    };
  }
};
