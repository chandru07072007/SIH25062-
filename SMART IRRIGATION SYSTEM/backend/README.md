# Smart Irrigation System - Backend API

Python FastAPI backend for the Smart Irrigation System with chart data APIs.

## Features

- **Soil Analysis Charts API**: Provides data for various chart visualizations
  - NPK Bar Charts
  - Soil Health Radar Charts
  - Comparison Charts (Current vs Optimal)
  - Historical Trend Data
  
- **Crop Recommendations API**: Crop suitability scores and recommendations

- **Dashboard Statistics**: Overall system statistics

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update with your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase URL and Key:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
```

### 3. Run the Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Or use the shortcut:
```bash
python -m uvicorn main:app --reload
```

The API will be available at: `http://localhost:8000`

## API Endpoints

### Soil Analysis

#### `GET /api/soil-analysis/{land_id}/chart-data`
Get soil analysis data formatted for charts.

**Response:**
```json
{
  "land_id": 4,
  "npk_bar_chart": [...],
  "soil_health_radar": [...],
  "comparison_chart": [...],
  "raw_data": {
    "ph_level": 7.0,
    "moisture_level": 40,
    "nitrogen": 82,
    "phosphorus": 58,
    "potassium": 87
  }
}
```

#### `GET /api/soil-analysis/{land_id}/history?limit=10`
Get historical soil analysis data for trend charts.

### Crop Recommendations

#### `GET /api/crop-recommendations/{land_id}/chart-data`
Get crop recommendations with suitability scores.

**Response:**
```json
{
  "land_id": 4,
  "crops": [
    {
      "crop_name": "Barley",
      "suitability_score": 93,
      "is_optimal": true,
      "crop_type": "Cereal"
    }
  ]
}
```

### Dashboard

#### `GET /api/dashboard/stats`
Get overall system statistics.

## Testing

Visit the auto-generated API documentation:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Development

The server runs with auto-reload enabled. Any changes to `main.py` will automatically restart the server.

## Troubleshooting

### Module Not Found
Make sure all dependencies are installed:
```bash
pip install -r requirements.txt
```

### CORS Errors
Check that your frontend URL is listed in the `origins` array in `main.py`.

### Supabase Connection Issues
1. Verify your `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
2. Check that you have internet connectivity
3. Ensure your Supabase project is active

## Chart Data Formats

### NPK Bar Chart
Array of {nutrient, value, color} objects

### Soil Health Radar
Array of {metric, value, optimal} objects for 6 health metrics

### Comparison Chart
Array comparing current values with optimal ranges

### Crop Suitability Chart
Horizontal bar chart data with suitability scores (0-100)

## Future Enhancements
- [ ] Historical trend analysis with multiple data points
- [ ] Weather integration
- [ ] ML-based crop predictions
- [ ] Real-time sensor data streaming
- [ ] Export charts as images (PNG/SVG)


Set-Location "c:\Users\Chandru P\OneDrive\Documents\MIND MAP\DBMS\SIH25062\SMART IRRIGATION SYSTEM\backend"; & "c:\Users\Chandru P\OneDrive\Documents\MIND MAP\DBMS\SIH25062\SMART IRRIGATION SYSTEM\.venv\Scripts\python.exe" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000


Set-Location "c:\Users\Chandru P\OneDrive\Documents\MIND MAP\DBMS\SIH25062\SMART IRRIGATION SYSTEM\frontend"; npm run dev -- --host 0.0.0.0 --port 5173