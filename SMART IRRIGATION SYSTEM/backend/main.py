from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.encoders import jsonable_encoder
import os
import io
import wave
import tempfile
from typing import Optional, Any
from pydantic import BaseModel
import joblib
import numpy as np
import warnings
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
import asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from bson import ObjectId

try:
    import ollama
except Exception:
    ollama = None

from loan_routes import router as loan_router
from marketplace_routes import router as market_router
from dependencies import get_database

warnings.filterwarnings("ignore")

load_dotenv()

app = FastAPI(title="Smart Irrigation System API", version="1.0.0")

# CORS Middleware
origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache for dashboard statistics (refreshed every hour)
cache = {
    "last_refresh": None,
    "dashboard_stats": None,
    "sensor_status": None
}

# Load Crop Recommendation Model
try:
    MODEL_PATH = os.path.join(os.path.dirname(__file__), "crop_model.pkl")
    crop_model = joblib.load(MODEL_PATH)
    print(f"✓ Crop recommendation model loaded successfully from {MODEL_PATH}")
except Exception as e:
    print(f"⚠️ Warning: Could not load crop model: {str(e)}")
    crop_model = None

# Pydantic models for request/response
class CropPredictionRequest(BaseModel):
    N: float
    P: float
    K: float
    temperature: float
    humidity: float
    ph: float
    rainfall: float
    land_id: Optional[str] = None

class CropPredictionResponse(BaseModel):
    recommended_crop: str


class IoTReadingRequest(BaseModel):
    device_id: str
    land_id: Optional[str] = None
    ip: Optional[str] = None
    moisture: float
    temperature: float
    humidity: float
    rain: str
    motor: str
    valve: str


class VoiceAgentRequest(BaseModel):
    question: str


class VoiceAgentResponse(BaseModel):
    question: str
    answer: str
    model: str


class VoiceSynthesisRequest(BaseModel):
    text: str


VOICE_AGENT_SYSTEM_PROMPT = (
    "You are Agri Voice Assistant for a Smart Irrigation System. "
    "Reply in 2-3 short practical sentences focused on crops, soil, water usage, "
    "irrigation, and farmer-friendly advice."
)

tts_ready = False
tts_init_error = None
tts_processor = None
tts_model = None
tts_vocoder = None
tts_speaker_embeddings = None
tts_device = "cpu"
tts_torch = None
tts_fallback_engine = None


def _chunk_text(text: str, max_chars: int = 320) -> list[str]:
    chunks = []
    remaining = (text or "").strip()
    while len(remaining) > max_chars:
        split_at = remaining.rfind(".", 0, max_chars)
        if split_at == -1:
            split_at = max_chars
        chunks.append(remaining[: split_at + 1].strip())
        remaining = remaining[split_at + 1 :].strip()
    if remaining:
        chunks.append(remaining)
    return chunks or [""]


def _init_tts_models():
    global tts_ready, tts_init_error, tts_processor, tts_model
    global tts_vocoder, tts_speaker_embeddings, tts_device, tts_torch, tts_fallback_engine

    if tts_ready:
        return

    try:
        import torch
        from transformers import SpeechT5Processor, SpeechT5ForTextToSpeech, SpeechT5HifiGan

        tts_torch = torch
        tts_device = "cuda" if torch.cuda.is_available() else "cpu"
        tts_processor = SpeechT5Processor.from_pretrained("microsoft/speecht5_tts")
        tts_model = SpeechT5ForTextToSpeech.from_pretrained("microsoft/speecht5_tts").to(tts_device)
        tts_vocoder = SpeechT5HifiGan.from_pretrained("microsoft/speecht5_hifigan").to(tts_device)
        tts_speaker_embeddings = torch.randn((1, 512)).to(tts_device)
        tts_ready = True
        return
    except Exception as model_err:
        tts_init_error = str(model_err)

    try:
        import pyttsx3

        tts_fallback_engine = pyttsx3.init()
        tts_ready = True
    except Exception as fallback_err:
        tts_init_error = f"SpeechT5: {tts_init_error}; pyttsx3: {fallback_err}"


def _numpy_to_wav_bytes(audio: np.ndarray, sample_rate: int) -> bytes:
    pcm = (np.clip(audio, -1.0, 1.0) * 32767.0).astype(np.int16)
    with io.BytesIO() as buffer:
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(pcm.tobytes())
        return buffer.getvalue()


def _synthesize_with_pyttsx3(text: str) -> tuple[np.ndarray, int, str]:
    if tts_fallback_engine is None:
        raise RuntimeError("pyttsx3 engine is not available")

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    path = tmp.name
    tmp.close()

    try:
        tts_fallback_engine.save_to_file(text, path)
        tts_fallback_engine.runAndWait()

        with wave.open(path, "rb") as wav_file:
            sample_rate = wav_file.getframerate()
            channels = wav_file.getnchannels()
            frames = wav_file.readframes(wav_file.getnframes())

        audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32767.0
        if channels > 1:
            audio = audio.reshape(-1, channels).mean(axis=1)

        return audio, sample_rate, "pyttsx3"
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def _synthesize_speech(text: str) -> tuple[bytes, str]:
    _init_tts_models()
    if not tts_ready:
        raise RuntimeError(tts_init_error or "No TTS engine available")

    cleaned = text.strip()
    if not cleaned:
        raise RuntimeError("Text is empty")

    if tts_processor is not None and tts_model is not None and tts_vocoder is not None and tts_torch is not None:
        clips = []
        with tts_torch.no_grad():
            for chunk in _chunk_text(cleaned):
                if not chunk:
                    continue
                inputs = tts_processor(text=chunk, return_tensors="pt").to(tts_device)
                speech = tts_model.generate_speech(
                    inputs["input_ids"],
                    tts_speaker_embeddings,
                    vocoder=tts_vocoder,
                )
                clips.append(speech.detach().cpu().numpy().astype(np.float32))

        if clips:
            pause = np.zeros(2400, dtype=np.float32)
            stitched = []
            for i, clip in enumerate(clips):
                stitched.append(clip)
                if i < len(clips) - 1:
                    stitched.append(pause)
            audio = np.concatenate(stitched)
            return _numpy_to_wav_bytes(audio, 16000), "speecht5"

    audio, sample_rate, engine = _synthesize_with_pyttsx3(cleaned)
    return _numpy_to_wav_bytes(audio, sample_rate), engine


def _state_to_bool(value: str) -> bool:
    return str(value).strip().lower() in {"on", "open", "yes", "true", "1"}

# Include routers
app.include_router(loan_router)
app.include_router(market_router)

scheduler = AsyncIOScheduler()

async def get_dashboard_statistics(db: AsyncIOMotorDatabase):
    total_farmers = await db.farmers.count_documents({})
    total_lands = await db.lands.count_documents({})
    total_crops = await db.crops.count_documents({})
    total_sensors = await db.sensors.count_documents({})
    total_readings = await db.sensor_readings.count_documents({})
    active_loans = await db.loan_applications.count_documents({"status": "approved"})
    total_products = await db.marketplace_products.count_documents({"status": "active"})
    return {
        "total_farmers": total_farmers,
        "total_lands": total_lands,
        "total_crops": total_crops,
        "total_sensors": total_sensors,
        "total_readings": total_readings,
        "totalFarmers": total_farmers,
        "totalLands": total_lands,
        "totalCrops": total_crops,
        "totalSensors": total_sensors,
        "totalReadings": total_readings,
        "active_loans": active_loans,
        "total_products": total_products,
    }

async def get_all_sensor_status(db: AsyncIOMotorDatabase):
    sensors = await db.sensors.find().sort([("updated_at", -1), ("created_at", -1)]).to_list(length=None)
    for sensor in sensors:
        sensor["_id"] = str(sensor["_id"])
    return sensors

@app.on_event("startup")
async def startup_event():
    """Initialize scheduler and run first refresh on startup"""
    print("🚀 Starting Smart Irrigation System API...")
    
    db = await get_database()
    await refresh_cache(db)
    
    scheduler.add_job(
        refresh_cache,
        'interval',
        minutes=30,
        id='refresh_cache',
        replace_existing=True,
        args=[db]
    )
    scheduler.start()
    print("✅ Scheduler started: Auto-refresh every 30 minutes")

@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown scheduler gracefully"""
    scheduler.shutdown()
    print("👋 Scheduler stopped")

@app.get("/")
async def root():
    return {
        "message": "Welcome to Smart Irrigation System API",
        "version": "1.0.0",
        "auto_refresh": {
            "enabled": True,
            "interval": "30 minutes",
            "last_refresh": cache.get("last_refresh"),
            "next_refresh": scheduler.get_job('refresh_cache').next_run_time.isoformat() if scheduler.get_job('refresh_cache') else None
        }
    }

async def refresh_cache(db: AsyncIOMotorDatabase):
    """
    Automatic refresh function that runs every 30 minutes
    Updates cached data, sensor status, and system health
    """
    print("--- REFRESHING CACHE ---")
    try:
        cache["dashboard_stats"] = await get_dashboard_statistics(db)
        cache["sensor_status"] = await get_all_sensor_status(db)
        cache["last_refresh"] = datetime.now()
        print("✓ Cache refreshed successfully")
    except Exception as e:
        print(f"❌ Error refreshing cache: {e}")

@app.get("/api/dashboard-stats")
async def get_cached_dashboard_stats():
    if not cache["dashboard_stats"]:
        db = await get_database()
        await refresh_cache(db)
    return cache["dashboard_stats"]

@app.get("/api/sensor-status")
async def get_cached_sensor_status(db: AsyncIOMotorDatabase = Depends(get_database)):
    # Sensor data is expected to be near real-time, so serve directly from DB.
    sensors = await get_all_sensor_status(db)
    cache["sensor_status"] = sensors
    return sensors


@app.post("/api/iot/reading")
async def ingest_iot_reading(payload: IoTReadingRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    now = datetime.utcnow()

    sensor_doc = {
        "device_id": payload.device_id,
        "land_id": payload.land_id,
        "ip": payload.ip,
        "moisture": payload.moisture,
        "temperature": payload.temperature,
        "humidity": payload.humidity,
        "rain_detected": _state_to_bool(payload.rain),
        "motor_on": _state_to_bool(payload.motor),
        "valve_open": _state_to_bool(payload.valve),
        "updated_at": now,
    }

    await db.sensors.update_one(
        {"device_id": payload.device_id},
        {"$set": sensor_doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    await db.sensor_readings.insert_one({
        "device_id": payload.device_id,
        "land_id": payload.land_id,
        "moisture": payload.moisture,
        "temperature": payload.temperature,
        "humidity": payload.humidity,
        "rain_detected": _state_to_bool(payload.rain),
        "motor_on": _state_to_bool(payload.motor),
        "valve_open": _state_to_bool(payload.valve),
        "recorded_at": now,
    })

    if payload.land_id and ObjectId.is_valid(payload.land_id):
        await db.soil_analysis.insert_one({
            "land_id": ObjectId(payload.land_id),
            "recorded_at": now,
            "moisture_level": payload.moisture,
            "temperature": payload.temperature,
            "humidity": payload.humidity,
            "nitrogen": 0,
            "phosphorus": 0,
            "potassium": 0,
        })

    await refresh_cache(db)
    return {"message": "Reading received", "device_id": payload.device_id, "recorded_at": now.isoformat()}

@app.get("/api/farmers/list")
async def get_farmers_list(db: AsyncIOMotorDatabase = Depends(get_database)):
    farmers = await db.farmers.find({}, {"name": 1, "location": 1}).sort("name", 1).to_list(length=None)
    for farmer in farmers:
        farmer["_id"] = str(farmer["_id"])
    return farmers

@app.get("/api/farmers/{farmer_id}/lands-overview")
async def get_farmer_lands_overview(farmer_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(farmer_id):
        raise HTTPException(status_code=400, detail="Invalid farmer ID format.")

    lands = await db.lands.find({"farmer_id": ObjectId(farmer_id)}).to_list(length=None)
    overview = []

    default_images = [
        "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=1000",
        "https://images.unsplash.com/photo-1625246333195-bf5f852be9b8?auto=format&fit=crop&q=80&w=1000",
        "https://images.unsplash.com/photo-1615811361524-6830df586c9a?auto=format&fit=crop&q=80&w=1000",
        "https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&q=80&w=1000",
    ]

    for idx, land in enumerate(lands):
        land_id = land["_id"]
        soil = await db.soil_analysis.find_one({"land_id": land_id}, sort=[("recorded_at", -1)])
        recommendation = await db.crop_recommendations.find_one(
            {"land_id": land_id},
            sort=[("confidence_score", -1)]
        )

        moisture = int(round((soil or {}).get("humidity", (soil or {}).get("moisture_level", 50))))
        status = "critical" if moisture < 30 else "optimal"

        overview.append({
            "id": str(land_id),
            "land_id": str(land_id),
            "name": land.get("land_name") or f"Land {idx + 1}",
            "status": status,
            "moisture": moisture,
            "cropType": (recommendation or {}).get("recommended_crop_name", "General Farming"),
            "image": default_images[idx % len(default_images)],
        })

    return overview


ENTITY_CONFIG = {
    "farms": {"collection": "farmers", "id_field": "farmer_id", "ref_fields": []},
    "lands": {"collection": "lands", "id_field": "land_id", "ref_fields": ["farmer_id"]},
    "crops": {"collection": "crops", "id_field": "crop_id", "ref_fields": ["farmer_id"]},
    "sensors": {"collection": "sensors", "id_field": "sensor_id", "ref_fields": ["farmer_id", "land_id"]},
    "readings": {"collection": "sensor_readings", "id_field": "reading_id", "ref_fields": ["sensor_id", "land_id", "farmer_id"]},
    "water": {"collection": "water_resources", "id_field": "water_id", "ref_fields": ["sensor_id"]},
    "irrigation": {"collection": "irrigation_events", "id_field": "event_id", "ref_fields": ["crop_id"]},
    "controls": {"collection": "irrigation_controls", "id_field": "control_id", "ref_fields": ["water_id"]},
    "weather": {"collection": "weather", "id_field": "weather_id", "ref_fields": ["sensor_id"]},
    "soil-analysis": {"collection": "soil_analysis", "id_field": "analysis_id", "ref_fields": ["land_id"]},
    "crop-recommendations": {"collection": "crop_recommendations", "id_field": "recommendation_id", "ref_fields": ["land_id", "crop_id"]},
}


def _serialize_mongo_doc(doc: dict[str, Any], id_field: str):
    normalized: dict[str, Any] = {}
    for key, value in doc.items():
        if key == "_id":
            normalized[id_field] = str(value)
            continue
        if isinstance(value, ObjectId):
            normalized[key] = str(value)
        else:
            normalized[key] = value
    return jsonable_encoder(normalized)


def _to_mongo_payload(payload: dict[str, Any], id_field: str, ref_fields: list[str]):
    cleaned: dict[str, Any] = {}
    for key, value in payload.items():
        if key in {"_id", id_field}:
            continue
        if value == "":
            continue
        if key in ref_fields and isinstance(value, str) and ObjectId.is_valid(value):
            cleaned[key] = ObjectId(value)
        else:
            cleaned[key] = value
    return cleaned


def _get_entity_or_404(entity: str):
    config = ENTITY_CONFIG.get(entity)
    if not config:
        raise HTTPException(status_code=404, detail=f"Unknown entity '{entity}'")
    return config


@app.get("/api/admin/{entity}")
async def list_admin_entities(entity: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    config = _get_entity_or_404(entity)
    docs = await db[config["collection"]].find().sort([("_id", -1)]).to_list(length=None)
    return [_serialize_mongo_doc(doc, config["id_field"]) for doc in docs]


@app.get("/api/admin/{entity}/{item_id}")
async def get_admin_entity(entity: str, item_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    config = _get_entity_or_404(entity)
    if not ObjectId.is_valid(item_id):
        raise HTTPException(status_code=400, detail="Invalid item ID format")

    doc = await db[config["collection"]].find_one({"_id": ObjectId(item_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Item not found")
    return _serialize_mongo_doc(doc, config["id_field"])


@app.post("/api/admin/{entity}", status_code=201)
async def create_admin_entity(entity: str, payload: dict[str, Any], db: AsyncIOMotorDatabase = Depends(get_database)):
    config = _get_entity_or_404(entity)
    cleaned = _to_mongo_payload(payload, config["id_field"], config["ref_fields"])
    result = await db[config["collection"]].insert_one(cleaned)
    doc = await db[config["collection"]].find_one({"_id": result.inserted_id})
    return _serialize_mongo_doc(doc, config["id_field"])


@app.put("/api/admin/{entity}/{item_id}")
async def update_admin_entity(entity: str, item_id: str, payload: dict[str, Any], db: AsyncIOMotorDatabase = Depends(get_database)):
    config = _get_entity_or_404(entity)
    if not ObjectId.is_valid(item_id):
        raise HTTPException(status_code=400, detail="Invalid item ID format")

    cleaned = _to_mongo_payload(payload, config["id_field"], config["ref_fields"])
    await db[config["collection"]].update_one({"_id": ObjectId(item_id)}, {"$set": cleaned})

    doc = await db[config["collection"]].find_one({"_id": ObjectId(item_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Item not found")
    return _serialize_mongo_doc(doc, config["id_field"])


@app.delete("/api/admin/{entity}/{item_id}", status_code=204)
async def delete_admin_entity(entity: str, item_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    config = _get_entity_or_404(entity)
    if not ObjectId.is_valid(item_id):
        raise HTTPException(status_code=400, detail="Invalid item ID format")

    result = await db[config["collection"]].delete_one({"_id": ObjectId(item_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return JSONResponse(status_code=204, content=None)

@app.post("/predict-crop", response_model=CropPredictionResponse)
async def predict_crop(request: CropPredictionRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not crop_model:
        raise HTTPException(status_code=503, detail="Crop recommendation model is not available.")
    
    try:
        features = np.array([[
            request.N, request.P, request.K,
            request.temperature, request.humidity,
            request.ph, request.rainfall
        ]])
        
        prediction = crop_model.predict(features)
        prediction_proba = crop_model.predict_proba(features)
        confidence = float(max(prediction_proba[0])) * 100
        recommended_crop = prediction[0]
        
        if request.land_id:
            try:
                # Get crop_id for the recommended crop
                crop = await db.crops.find_one({"crop_name": recommended_crop})
                if crop:
                    crop_id = crop['_id']
                    
                    # Check if a recommendation for this land already exists
                    existing_rec = await db.crop_recommendations.find_one({"land_id": ObjectId(request.land_id)})
                    
                    if existing_rec:
                        # Update existing recommendation
                        await db.crop_recommendations.update_one(
                            {"_id": existing_rec['_id']},
                            {"$set": {
                                "crop_id": crop_id,
                                "recommended_crop_name": recommended_crop,
                                "confidence_score": confidence,
                                "recommendation_date": datetime.utcnow(),
                                "input_parameters": request.dict()
                            }}
                        )
                    else:
                        # Insert new recommendation
                        await db.crop_recommendations.insert_one({
                            "land_id": ObjectId(request.land_id),
                            "crop_id": crop_id,
                            "recommended_crop_name": recommended_crop,
                            "confidence_score": confidence,
                            "recommendation_date": datetime.utcnow(),
                            "input_parameters": request.dict()
                        })
                        
                else:
                    print(f"Warning: Crop '{recommended_crop}' not found in the database. Recommendation not saved.")

            except Exception as db_error:
                # Non-fatal error, just log it
                print(f"Database Error: Could not save crop recommendation. Reason: {db_error}")

        return CropPredictionResponse(recommended_crop=recommended_crop)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during crop prediction: {e}")


# New API endpoints for frontend compatibility and richer responses
def _prepare_input_array(request: CropPredictionRequest):
    return np.array([[
        request.N, request.P, request.K,
        request.temperature, request.humidity,
        request.ph, request.rainfall
    ]])


def _format_top_recommendations(classes, proba, top_n=3):
    probs = list(zip(classes, proba[0]))
    probs_sorted = sorted(probs, key=lambda x: x[1], reverse=True)[:top_n]
    return [
        {"rank": idx + 1, "crop_name": name, "probability": float(prob * 100)}
        for idx, (name, prob) in enumerate(probs_sorted)
    ]


@app.post('/api/crop-recommendation/predict')
async def api_predict_crop(request: CropPredictionRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not crop_model:
        raise HTTPException(status_code=503, detail="Crop recommendation model is not available.")

    try:
        features = _prepare_input_array(request)
        prediction = crop_model.predict(features)
        proba = crop_model.predict_proba(features)
        confidence = float(max(proba[0]) * 100)
        recommended_crop = prediction[0]

        top_3 = _format_top_recommendations(getattr(crop_model, 'classes_', []), proba, top_n=3)

        # Optionally persist recommendation as in /predict-crop
        if request.land_id:
            try:
                crop = await db.crops.find_one({"crop_name": recommended_crop})
                if crop:
                    crop_id = crop['_id']
                    existing_rec = await db.crop_recommendations.find_one({"land_id": ObjectId(request.land_id)})
                    payload = {
                        "crop_id": crop_id,
                        "recommended_crop_name": recommended_crop,
                        "confidence_score": confidence,
                        "recommendation_date": datetime.utcnow(),
                        "input_parameters": request.dict()
                    }
                    if existing_rec:
                        await db.crop_recommendations.update_one({"_id": existing_rec['_id']}, {"$set": payload})
                    else:
                        payload.update({"land_id": ObjectId(request.land_id)})
                        await db.crop_recommendations.insert_one(payload)

            except Exception as db_error:
                print(f"Database Error: Could not save crop recommendation. Reason: {db_error}")

        return JSONResponse(content=jsonable_encoder({
            "recommended_crop": recommended_crop,
            "confidence": confidence,
            "top_3_recommendations": top_3,
            "input_parameters": request.dict()
        }))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during crop prediction: {e}")


@app.get('/api/crop-recommendation/model-info')
async def api_model_info(db: AsyncIOMotorDatabase = Depends(get_database)):
    status = 'available' if crop_model is not None else 'unavailable'
    model_type = type(crop_model).__name__ if crop_model is not None else 'none'
    crops = []
    try:
        cursor = db.crops.find({}, {"crop_name": 1})
        docs = await cursor.to_list(length=500)
        crops = [d.get('crop_name') for d in docs if d.get('crop_name')]
    except Exception:
        crops = []

    return JSONResponse(content=jsonable_encoder({
        "status": status,
        "model_type": model_type,
        "supported_crops": crops,
        "total_crops": len(crops)
    }))


@app.get('/api/crop-recommendation/auto-analyze')
async def api_auto_analyze(db: AsyncIOMotorDatabase = Depends(get_database)):
    # Aggregate latest soil records per land and compute averages across all lands
    cursor = db.soil_analysis.find()
    soils = await cursor.to_list(length=None)
    if not soils:
        raise HTTPException(status_code=404, detail='No soil analysis records found for auto-analysis')

    # compute simple averages
    vals = {"nitrogen": [], "phosphorus": [], "potassium": [], "temperature": [], "humidity": [], "ph": [], "rainfall": []}
    for s in soils:
        vals['nitrogen'].append(s.get('nitrogen', 0))
        vals['phosphorus'].append(s.get('phosphorus', 0))
        vals['potassium'].append(s.get('potassium', 0))
        vals['temperature'].append(s.get('temperature', 0))
        vals['humidity'].append(s.get('humidity', s.get('moisture_level', 0)))
        vals['ph'].append(s.get('ph_level', s.get('ph', 7)))
        vals['rainfall'].append(s.get('rainfall', 0))

    avg = {k: float(np.mean(v)) if v else 0.0 for k, v in vals.items()}

    class ReqBase:
        pass

    req = CropPredictionRequest(
        N=avg['nitrogen'], P=avg['phosphorus'], K=avg['potassium'],
        temperature=avg['temperature'], humidity=avg['humidity'], ph=avg['ph'], rainfall=avg['rainfall']
    )

    # reuse prediction logic
    features = _prepare_input_array(req)
    prediction = crop_model.predict(features)
    proba = crop_model.predict_proba(features)
    recommended_crop = prediction[0]
    confidence = float(max(proba[0]) * 100)
    top_5 = _format_top_recommendations(getattr(crop_model, 'classes_', []), proba, top_n=5)

    return JSONResponse(content=jsonable_encoder({
        "analysis_type": "global",
        "total_soil_records": len(soils),
        "recommended_crop": recommended_crop,
        "confidence": confidence,
        "top_5_recommendations": top_5,
        "average_parameters": avg
    }))


@app.get('/api/crop-recommendation/auto-analyze-farmer/{farmer_id}')
async def api_auto_analyze_farmer(farmer_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(farmer_id):
        raise HTTPException(status_code=400, detail="Invalid farmer ID format.")

    lands = await db.lands.find({"farmer_id": ObjectId(farmer_id)}).to_list(length=None)
    if not lands:
        raise HTTPException(status_code=404, detail="No lands found for given farmer.")

    land_ids = [l['_id'] for l in lands]
    soils = await db.soil_analysis.find({"land_id": {"$in": land_ids}}).to_list(length=None)
    if not soils:
        raise HTTPException(status_code=404, detail='No soil analysis records found for this farmer')

    vals = {"nitrogen": [], "phosphorus": [], "potassium": [], "temperature": [], "humidity": [], "ph": [], "rainfall": []}
    for s in soils:
        vals['nitrogen'].append(s.get('nitrogen', 0))
        vals['phosphorus'].append(s.get('phosphorus', 0))
        vals['potassium'].append(s.get('potassium', 0))
        vals['temperature'].append(s.get('temperature', 0))
        vals['humidity'].append(s.get('humidity', s.get('moisture_level', 0)))
        vals['ph'].append(s.get('ph_level', s.get('ph', 7)))
        vals['rainfall'].append(s.get('rainfall', 0))

    avg = {k: float(np.mean(v)) if v else 0.0 for k, v in vals.items()}

    req = CropPredictionRequest(
        N=avg['nitrogen'], P=avg['phosphorus'], K=avg['potassium'],
        temperature=avg['temperature'], humidity=avg['humidity'], ph=avg['ph'], rainfall=avg['rainfall']
    )

    features = _prepare_input_array(req)
    prediction = crop_model.predict(features)
    proba = crop_model.predict_proba(features)
    recommended_crop = prediction[0]
    confidence = float(max(proba[0]) * 100)
    top_5 = _format_top_recommendations(getattr(crop_model, 'classes_', []), proba, top_n=5)

    return JSONResponse(content=jsonable_encoder({
        "analysis_type": "farmer",
        "farmer_id": farmer_id,
        "total_lands": len(lands),
        "land_names": [l.get('land_name') for l in lands],
        "total_soil_records": len(soils),
        "recommended_crop": recommended_crop,
        "confidence": confidence,
        "top_5_recommendations": top_5,
        "average_parameters": avg
    }))

@app.get("/api/soil-analysis/{land_id}/chart-data")
async def get_soil_chart_data(land_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(land_id):
        raise HTTPException(status_code=400, detail="Invalid land ID format.")

    soil_data = await db.soil_analysis.find_one(
        {"land_id": ObjectId(land_id)},
        sort=[("recorded_at", -1)]
    )
    
    if not soil_data:
        raise HTTPException(status_code=404, detail=f"No soil analysis data found for land_id {land_id}")
    
    chart_data = {
        "land_id": land_id,
        "recorded_at": soil_data.get('recorded_at'),
        "npk_bar_chart": [
            {"nutrient": "Nitrogen (N)", "value": soil_data.get('nitrogen', 0), "color": "#15803d"},
            {"nutrient": "Phosphorus (P)", "value": soil_data.get('phosphorus', 0), "color": "#16a34a"},
            {"nutrient": "Potassium (K)", "value": soil_data.get('potassium', 0), "color": "#22c55e"}
        ],
    }
    return JSONResponse(content=jsonable_encoder(chart_data))

@app.get("/api/soil-analysis/{land_id}/history")
async def get_soil_history(land_id: str, limit: int = 10, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(land_id):
        raise HTTPException(status_code=400, detail="Invalid land ID format.")

    history_cursor = db.soil_analysis.find({"land_id": ObjectId(land_id)}).sort('recorded_at', -1).limit(limit)
    history_data = await history_cursor.to_list(length=limit)
    
    if not history_data:
        raise HTTPException(status_code=404, detail=f"No historical data found for land_id {land_id}")
    
    history_data = list(reversed(history_data))
    
    for record in history_data:
        record["_id"] = str(record["_id"])
        record["land_id"] = str(record["land_id"])

    return JSONResponse(content=jsonable_encoder(history_data))

@app.get("/api/crop-recommendations/{land_id}/chart-data")
async def get_crop_recommendations_chart(land_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(land_id):
        raise HTTPException(status_code=400, detail="Invalid land ID format.")

    recommendations_cursor = db.crop_recommendations.find({'land_id': ObjectId(land_id)}).sort('confidence_score', -1)
    recommendations = await recommendations_cursor.to_list(length=None)
    
    if not recommendations:
        raise HTTPException(status_code=404, detail=f"No crop recommendations found for land_id {land_id}")
    
    for rec in recommendations:
        rec["_id"] = str(rec["_id"])
        rec["land_id"] = str(rec["land_id"])

    return JSONResponse(content=jsonable_encoder(recommendations))


@app.post("/api/voice-agent/chat", response_model=VoiceAgentResponse)
async def voice_agent_chat(payload: VoiceAgentRequest):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    if ollama is None:
        return VoiceAgentResponse(
            question=question,
            answer="Voice agent is unavailable because Ollama is not installed on backend.",
            model="unavailable",
        )

    try:
        response = await asyncio.to_thread(
            ollama.chat,
            model=os.environ.get("VOICE_AGENT_MODEL", "tinyllama"),
            messages=[
                {"role": "system", "content": VOICE_AGENT_SYSTEM_PROMPT},
                {"role": "user", "content": question},
            ],
        )
        content = (response.get("message", {}) or {}).get("content", "").strip()
        if not content:
            content = "I could not generate a response right now. Please try again."

        return VoiceAgentResponse(
            question=question,
            answer=content[:800],
            model=response.get("model", os.environ.get("VOICE_AGENT_MODEL", "tinyllama")),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice agent error: {e}")


@app.post("/api/voice-agent/speak")
async def voice_agent_speak(payload: VoiceSynthesisRequest):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required.")

    try:
        wav_bytes, engine = await asyncio.to_thread(_synthesize_speech, text[:800])
        headers = {
            "Cache-Control": "no-store",
            "X-Voice-Engine": engine,
        }
        return StreamingResponse(io.BytesIO(wav_bytes), media_type="audio/wav", headers=headers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice synthesis error: {e}")
    