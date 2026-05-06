
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId
from datetime import datetime, timezone

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME")

async def seed_data():
    """
    Connects to the MongoDB database and populates it with initial data
    for farmers, crops, and lands.
    """
    if not MONGO_URL or not DB_NAME:
        print("❌ MONGO_URL or DB_NAME not found in environment variables. Cannot seed database.")
        return

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"✓ Connected to MongoDB database: {DB_NAME}")

    # -----------------
    # Clear existing data
    # -----------------
    await db.farmers.delete_many({})
    await db.crops.delete_many({})
    await db.lands.delete_many({})
    await db.soil_analysis.delete_many({})
    await db.crop_recommendations.delete_many({})
    await db.loan_schemes.delete_many({})
    await db.loan_applications.delete_many({})
    await db.marketplace_products.delete_many({})
    print("✓ Cleared existing collections: farmers, crops, lands, soil_analysis, crop_recommendations, loan_schemes, loan_applications, marketplace_products")

    # -----------------
    # Seed Farmers
    # -----------------
    farmers_data = [
        {"_id": ObjectId(), "name": "John Doe", "email": "john.doe@example.com", "location": "Valley Farm"},
        {"_id": ObjectId(), "name": "Jane Smith", "email": "jane.smith@example.com", "location": "Hillside Acres"},
    ]
    await db.farmers.insert_many(farmers_data)
    print(f"✓ Seeded {len(farmers_data)} farmers")

    # -----------------
    # Seed Crops
    # -----------------
    # This list should include all possible outputs from your crop_model.pkl
    crops_data = [
        {"_id": ObjectId(), "crop_name": "rice", "image_url": "/images/crops/rice.jpg"},
        {"_id": ObjectId(), "crop_name": "maize", "image_url": "/images/crops/maize.jpg"},
        {"_id": ObjectId(), "crop_name": "chickpea", "image_url": "/images/crops/chickpea.jpg"},
        {"_id": ObjectId(), "crop_name": "kidneybeans", "image_url": "/images/crops/kidneybeans.jpg"},
        {"_id": ObjectId(), "crop_name": "pigeonpeas", "image_url": "/images/crops/pigeonpeas.jpg"},
        {"_id": ObjectId(), "crop_name": "mothbeans", "image_url": "/images/crops/mothbeans.jpg"},
        {"_id": ObjectId(), "crop_name": "mungbean", "image_url": "/images/crops/mungbean.jpg"},
        {"_id": ObjectId(), "crop_name": "blackgram", "image_url": "/images/crops/blackgram.jpg"},
        {"_id": ObjectId(), "crop_name": "lentil", "image_url": "/images/crops/lentil.jpg"},
        {"_id": ObjectId(), "crop_name": "pomegranate", "image_url": "/images/crops/pomegranate.jpg"},
        {"_id": ObjectId(), "crop_name": "banana", "image_url": "/images/crops/banana.jpg"},
        {"_id": ObjectId(), "crop_name": "mango", "image_url": "/images/crops/mango.jpg"},
        {"_id": ObjectId(), "crop_name": "grapes", "image_url": "/images/crops/grapes.jpg"},
        {"_id": ObjectId(), "crop_name": "watermelon", "image_url": "/images/crops/watermelon.jpg"},
        {"_id": ObjectId(), "crop_name": "muskmelon", "image_url": "/images/crops/muskmelon.jpg"},
        {"_id": ObjectId(), "crop_name": "apple", "image_url": "/images/crops/apple.jpg"},
        {"_id": ObjectId(), "crop_name": "orange", "image_url": "/images/crops/orange.jpg"},
        {"_id": ObjectId(), "crop_name": "papaya", "image_url": "/images/crops/papaya.jpg"},
        {"_id": ObjectId(), "crop_name": "coconut", "image_url": "/images/crops/coconut.jpg"},
        {"_id": ObjectId(), "crop_name": "cotton", "image_url": "/images/crops/cotton.jpg"},
        {"_id": ObjectId(), "crop_name": "jute", "image_url": "/images/crops/jute.jpg"},
        {"_id": ObjectId(), "crop_name": "coffee", "image_url": "/images/crops/coffee.jpg"},
    ]
    await db.crops.insert_many(crops_data)
    print(f"✓ Seeded {len(crops_data)} crops")

    # -----------------
    # Seed Lands
    # -----------------
    farmer1_id = farmers_data[0]['_id']
    farmer2_id = farmers_data[1]['_id']
    lands_data = [
        {"_id": ObjectId(), "farmer_id": farmer1_id, "land_name": "North Field", "area_hectares": 10.5, "location_polygon": []},
        {"_id": ObjectId(), "farmer_id": farmer1_id, "land_name": "South Field", "area_hectares": 8.0, "location_polygon": []},
        {"_id": ObjectId(), "farmer_id": farmer2_id, "land_name": "East Slope", "area_hectares": 15.2, "location_polygon": []},
    ]
    await db.lands.insert_many(lands_data)
    print(f"✓ Seeded {len(lands_data)} lands")
    
    # -----------------
    # Seed Initial Soil Analysis for one land
    # -----------------
    land1_id = lands_data[0]['_id']
    soil_data = {
        "land_id": land1_id,
        "recorded_at": datetime.utcnow(),
        "nitrogen": 90,
        "phosphorus": 42,
        "potassium": 43,
        "ph": 6.5,
        "temperature": 20.8,
        "humidity": 82.0,
        "rainfall": 202.9,
    }
    await db.soil_analysis.insert_one(soil_data)
    print(f"✓ Seeded initial soil analysis for land '{lands_data[0]['land_name']}'")

    # -----------------
    # Seed Crop Recommendations
    # -----------------
    crop_by_name = {crop["crop_name"]: crop["_id"] for crop in crops_data}
    crop_recommendations = [
        {
            "land_id": lands_data[0]["_id"],
            "crop_id": crop_by_name["rice"],
            "recommended_crop_name": "rice",
            "confidence_score": 92.5,
            "recommendation_date": datetime.now(timezone.utc),
            "input_parameters": {
                "N": 90,
                "P": 42,
                "K": 43,
                "temperature": 20.8,
                "humidity": 82.0,
                "ph": 6.5,
                "rainfall": 202.9,
            },
        },
        {
            "land_id": lands_data[1]["_id"],
            "crop_id": crop_by_name["maize"],
            "recommended_crop_name": "maize",
            "confidence_score": 88.2,
            "recommendation_date": datetime.now(timezone.utc),
            "input_parameters": {
                "N": 76,
                "P": 35,
                "K": 39,
                "temperature": 24.1,
                "humidity": 68.0,
                "ph": 6.9,
                "rainfall": 123.4,
            },
        },
    ]
    await db.crop_recommendations.insert_many(crop_recommendations)
    print(f"✓ Seeded {len(crop_recommendations)} crop recommendations")

    # -----------------
    # Seed Loan Schemes
    # -----------------
    loan_schemes = [
        {
            "_id": ObjectId(),
            "title": "PM-Kisan Growth Support",
            "organisation": "Government of India",
            "type": "gov",
            "description": "Working capital support for small farmers.",
            "max_amount": 300000,
            "interest_rate": 4.5,
            "interest_label": "4.5% p.a.",
            "tenure_max_months": 36,
            "approval_days": 7,
            "collateral_required": False,
            "is_active": True,
            "tags": ["agri", "quick_approval", "working_capital"],
            "documents": [
                {"doc_label": "Aadhaar", "is_mandatory": True},
                {"doc_label": "Land Record", "is_mandatory": True},
            ],
            "steps": [
                {"step_order": 1, "step_label": "Apply online"},
                {"step_order": 2, "step_label": "Document verification"},
                {"step_order": 3, "step_label": "Disbursal"},
            ],
        },
        {
            "_id": ObjectId(),
            "title": "Agri Infra Loan",
            "organisation": "National Bank",
            "type": "pvt",
            "description": "Loan for irrigation and infrastructure improvements.",
            "max_amount": 750000,
            "interest_rate": 7.2,
            "interest_label": "7.2% p.a.",
            "tenure_max_months": 60,
            "approval_days": 12,
            "collateral_required": True,
            "is_active": True,
            "tags": ["irrigation", "infrastructure"],
            "documents": [
                {"doc_label": "Identity Proof", "is_mandatory": True},
                {"doc_label": "Bank Statement", "is_mandatory": True},
            ],
            "steps": [
                {"step_order": 1, "step_label": "Submit request"},
                {"step_order": 2, "step_label": "Site check"},
                {"step_order": 3, "step_label": "Approval"},
            ],
        },
    ]
    await db.loan_schemes.insert_many(loan_schemes)
    print(f"✓ Seeded {len(loan_schemes)} loan schemes")

    # -----------------
    # Seed Marketplace Products
    # -----------------
    marketplace_products = [
        {
            "_id": ObjectId(),
            "farmer_id": farmer1_id,
            "crop_id": crop_by_name["rice"],
            "quantity_available": 1200,
            "price_per_unit": 36.5,
            "status": "active",
        },
        {
            "_id": ObjectId(),
            "farmer_id": farmer2_id,
            "crop_id": crop_by_name["maize"],
            "quantity_available": 900,
            "price_per_unit": 28.0,
            "status": "active",
        },
    ]
    await db.marketplace_products.insert_many(marketplace_products)
    print(f"✓ Seeded {len(marketplace_products)} marketplace products")


    client.close()
    print("✓ Database seeding complete. Connection closed.")

if __name__ == "__main__":
    asyncio.run(seed_data())
