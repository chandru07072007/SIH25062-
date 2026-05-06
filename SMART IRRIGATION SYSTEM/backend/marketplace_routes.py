from fastapi import APIRouter, HTTPException, Depends
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase
from dependencies import get_database
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter(
    prefix="/market",
    tags=["market"],
)

class ProductCreate(BaseModel):
    farmer_id: str
    crop_id: str
    quantity: float
    price: float
    status: str = 'active'

class ProductStatusUpdate(BaseModel):
    status: str


class CartAddRequest(BaseModel):
    seller_id: str
    product_id: str
    quantity: int


class PlaceOrderRequest(BaseModel):
    seller_id: str
    delivery_address: Optional[str] = None
    notes: Optional[str] = None


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_product_for_client(product: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "product_id": str(product.get("_id")),
        "farmer_id": str(product.get("farmer_id")) if product.get("farmer_id") else None,
        "crop_id": str(product.get("crop_id")) if product.get("crop_id") else None,
        "crop_name": (product.get("crop") or {}).get("crop_name", "Unknown Crop"),
        "category": product.get("category", "other"),
        "price_per_unit": _to_float(product.get("price_per_unit"), 0),
        "unit": product.get("unit", "kg"),
        "stock_quantity": _to_float(product.get("quantity_available"), 0),
        "min_order_qty": _to_float(product.get("min_order_qty"), 1),
        "bulk_discount_pct": _to_float(product.get("bulk_discount_pct"), 0),
        "bulk_trigger_multiplier": _to_float(product.get("bulk_trigger_multiplier"), 3),
        "is_organic": bool(product.get("is_organic", False)),
        "is_freshly_harvested": bool(product.get("is_freshly_harvested", False)),
        "description": product.get("description"),
        "image_url": (product.get("crop") or {}).get("image_url") or product.get("image_url"),
        "is_active": product.get("status", "active") == "active",
        "status": product.get("status", "active"),
        "farmer": product.get("farmer", {}),
    }

@router.post("/products/create", status_code=201)
async def create_product(product: ProductCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    Create a new product listing.
    """
    if not ObjectId.is_valid(product.farmer_id) or not ObjectId.is_valid(product.crop_id):
         raise HTTPException(status_code=400, detail="Invalid farmer or crop ID format.")

    # Check if farmer exists
    farmer = await db.farmers.find_one({"_id": ObjectId(product.farmer_id)})
    if not farmer:
        raise HTTPException(status_code=404, detail=f"Farmer with id {product.farmer_id} not found")

    # Check if crop exists
    crop = await db.crops.find_one({"_id": ObjectId(product.crop_id)})
    if not crop:
        raise HTTPException(status_code=404, detail=f"Crop with id {product.crop_id} not found")

    new_product = {
        "farmer_id": ObjectId(product.farmer_id),
        "crop_id": ObjectId(product.crop_id),
        "quantity_available": product.quantity,
        "price_per_unit": product.price,
        "status": product.status,
    }
    
    result = await db.marketplace_products.insert_one(new_product)
    created_product = await db.marketplace_products.find_one({"_id": result.inserted_id})
    
    created_product["_id"] = str(created_product["_id"])
    created_product["farmer_id"] = str(created_product["farmer_id"])
    created_product["crop_id"] = str(created_product["crop_id"])

    return created_product

@router.get("/products/farmer/{farmer_id}")
async def get_farmer_products(farmer_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    Get all product listings for a specific farmer.
    """
    if not ObjectId.is_valid(farmer_id):
        raise HTTPException(status_code=400, detail="Invalid farmer ID format.")
        
    products = await db.marketplace_products.find({"farmer_id": ObjectId(farmer_id)}).to_list(length=None)
    
    for product in products:
        product["_id"] = str(product["_id"])
        product["farmer_id"] = str(product["farmer_id"])
        product["crop_id"] = str(product["crop_id"])

        crop = await db.crops.find_one({"_id": ObjectId(product["crop_id"])})
        product["crop"] = {"crop_name": crop.get("crop_name", "Unknown")} if crop else {"crop_name": "Unknown"}

    return products

@router.patch("/products/{product_id}/status")
async def update_product_status(product_id: str, status_update: ProductStatusUpdate, db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    Update the status of a product listing (e.g., 'active', 'inactive').
    """
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID format.")

    result = await db.marketplace_products.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {"status": status_update.status}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} not found")

    updated_product = await db.marketplace_products.find_one({"_id": ObjectId(product_id)})
    updated_product["_id"] = str(updated_product["_id"])
    updated_product["farmer_id"] = str(updated_product["farmer_id"])
    updated_product["crop_id"] = str(updated_product["crop_id"])
    
    return updated_product

@router.get("/products")
async def get_all_products(db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    Get all active product listings.
    """
    products = await db.marketplace_products.find({"status": "active"}).to_list(length=None)
    
    for product in products:
        product["_id"] = str(product["_id"])

        farmer_id = product.get("farmer_id")
        if isinstance(farmer_id, ObjectId):
            farmer = await db.farmers.find_one({"_id": farmer_id})
            product["farmer"] = {"name": farmer.get("name"), "location": farmer.get("location")} if farmer else {}
            product["farmer_id"] = str(farmer_id)
        else:
            product["farmer"] = {}

        crop_id = product.get("crop_id")
        if isinstance(crop_id, ObjectId):
            crop = await db.crops.find_one({"_id": crop_id})
            product["crop"] = {"crop_name": crop.get("crop_name"), "image_url": crop.get("image_url")} if crop else {}
            product["crop_id"] = str(crop_id)
        else:
            product["crop"] = {}

    return products


@router.get("/products/{product_id}")
async def get_product_detail(product_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID format.")

    product = await db.marketplace_products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    farmer_id = product.get("farmer_id")
    if isinstance(farmer_id, ObjectId):
        farmer = await db.farmers.find_one({"_id": farmer_id})
        product["farmer"] = {"name": farmer.get("name"), "location": farmer.get("location")} if farmer else {}

    crop_id = product.get("crop_id")
    if isinstance(crop_id, ObjectId):
        crop = await db.crops.find_one({"_id": crop_id})
        product["crop"] = {"crop_name": crop.get("crop_name"), "image_url": crop.get("image_url")} if crop else {}

    detail = _normalize_product_for_client(product)
    detail.update({"avg_rating": 0, "review_count": 0, "reviews": []})
    return detail

@router.get("/farmers")
async def get_market_farmers(db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    Get farmer cards for marketplace browsing.
    """
    farmers = await db.farmers.find().to_list(length=None)
    result = []

    for farmer in farmers:
        farmer_id = farmer.get("_id")
        if not isinstance(farmer_id, ObjectId):
            continue

        lands = await db.lands.find({"farmer_id": farmer_id}).to_list(length=None)
        products = await db.marketplace_products.find({"farmer_id": farmer_id, "status": "active"}).to_list(length=None)

        crop_names = []
        for product in products:
            crop_id = product.get("crop_id")
            if isinstance(crop_id, ObjectId):
                crop = await db.crops.find_one({"_id": crop_id}, {"crop_name": 1})
                if crop and crop.get("crop_name"):
                    crop_names.append(crop["crop_name"])

        result.append({
            "farmer_id": str(farmer_id),
            "name": farmer.get("name", "Unknown Farmer"),
            "village": farmer.get("location", "Unknown"),
            "area_acres": round(sum(float(land.get("area_hectares", 0)) for land in lands) * 2.47105, 2),
            "crops": sorted(list(set(crop_names)))[:6],
            "avg_rating": 0,
            "total_orders_fulfilled": 0,
            "is_certified": True,
        })

    result.sort(key=lambda row: row["name"])
    return result


@router.get("/cart/{seller_id}")
async def get_cart(seller_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    cart_items = await db.marketplace_carts.find({"seller_id": seller_id}).to_list(length=None)

    items = []
    subtotal = 0.0
    total_discount = 0.0

    for item in cart_items:
        product_id = item.get("product_id")
        if not isinstance(product_id, ObjectId):
            continue

        product = await db.marketplace_products.find_one({"_id": product_id})
        if not product:
            continue

        crop_id = product.get("crop_id")
        if isinstance(crop_id, ObjectId):
            crop = await db.crops.find_one({"_id": crop_id})
            product["crop"] = {"crop_name": crop.get("crop_name"), "image_url": crop.get("image_url")} if crop else {}

        normalized_product = _normalize_product_for_client(product)
        qty = _to_float(item.get("quantity"), 0)
        line_total = qty * normalized_product["price_per_unit"]
        threshold = normalized_product["min_order_qty"] * normalized_product["bulk_trigger_multiplier"]
        discount_amount = line_total * (normalized_product["bulk_discount_pct"] / 100.0) if qty >= threshold else 0.0

        subtotal += line_total
        total_discount += discount_amount

        items.append({
            "cart_item_id": str(item.get("_id")),
            "product_id": str(product_id),
            "quantity": qty,
            "product": normalized_product,
            "line_total": round(line_total, 2),
            "discount_amount": round(discount_amount, 2),
        })

    return {
        "seller_id": seller_id,
        "items": items,
        "summary": {
            "subtotal": round(subtotal, 2),
            "total_discount": round(total_discount, 2),
            "grand_total": round(subtotal - total_discount, 2),
        },
    }


@router.post("/cart/add")
async def add_to_cart(payload: CartAddRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(payload.product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID format.")

    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero.")

    product_id = ObjectId(payload.product_id)
    product = await db.marketplace_products.find_one({"_id": product_id, "status": "active"})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or inactive")

    existing = await db.marketplace_carts.find_one({"seller_id": payload.seller_id, "product_id": product_id})
    if existing:
        await db.marketplace_carts.update_one(
            {"_id": existing["_id"]},
            {"$set": {"quantity": int(existing.get("quantity", 0)) + payload.quantity, "updated_at": datetime.now(timezone.utc)}}
        )
    else:
        await db.marketplace_carts.insert_one({
            "seller_id": payload.seller_id,
            "product_id": product_id,
            "quantity": payload.quantity,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })

    return {"message": "Added to cart"}


@router.delete("/cart/{seller_id}/{product_id}")
async def remove_from_cart(seller_id: str, product_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID format.")

    result = await db.marketplace_carts.delete_one({"seller_id": seller_id, "product_id": ObjectId(product_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cart item not found")

    return {"message": "Removed from cart"}


@router.post("/orders/place")
async def place_order(payload: PlaceOrderRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    cart = await get_cart(payload.seller_id, db)
    if not cart["items"]:
        raise HTTPException(status_code=400, detail="Cart is empty")

    order_doc = {
        "seller_id": payload.seller_id,
        "status": "pending",
        "total_amount": cart["summary"]["grand_total"],
        "ordered_at": datetime.now(timezone.utc),
        "delivery_address": payload.delivery_address,
        "notes": payload.notes,
        "items": [
            {
                "product_id": item["product_id"],
                "crop_name": item["product"]["crop_name"],
                "quantity": item["quantity"],
                "unit": item["product"]["unit"],
                "farmer_name": item["product"].get("farmer", {}).get("name"),
            }
            for item in cart["items"]
        ],
    }

    result = await db.marketplace_orders.insert_one(order_doc)
    await db.marketplace_carts.delete_many({"seller_id": payload.seller_id})

    return {"order_id": str(result.inserted_id), "status": "pending"}


@router.get("/orders/{seller_id}")
async def get_orders(seller_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    orders = await db.marketplace_orders.find({"seller_id": seller_id}).sort("ordered_at", -1).to_list(length=None)
    response = []

    for order in orders:
        response.append({
            "order_id": str(order.get("_id")),
            "status": order.get("status", "pending"),
            "total_amount": _to_float(order.get("total_amount"), 0),
            "ordered_at": order.get("ordered_at").isoformat() if order.get("ordered_at") else None,
            "farmers": sorted(list(set([i.get("farmer_name") for i in order.get("items", []) if i.get("farmer_name")]))),
            "items": [
                {
                    "crop_name": i.get("crop_name", "Product"),
                    "quantity": _to_float(i.get("quantity"), 0),
                    "unit": i.get("unit", "kg"),
                }
                for i in order.get("items", [])
            ],
        })

    return response

@router.get("/crops/suggestions")
async def get_crop_suggestions(db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    Get a list of all crops for suggestion dropdowns.
    """
    try:
        crops = await db.crops.find({}, {"crop_name": 1}).sort("crop_name").to_list(length=None)
        
        for crop in crops:
            crop["_id"] = str(crop["_id"])
            
        return crops
    except Exception as e:
        print(f"Error fetching crop suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
