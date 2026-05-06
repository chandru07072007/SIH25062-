from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase
from dependencies import get_database
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/loans", tags=["Loans"])

class LoanApplicationCreateRequest(BaseModel):
    farmer_id: str
    scheme_id: str
    land_id: Optional[str] = None
    amount_requested: float = Field(gt=0)

class ApplicationStatusUpdateRequest(BaseModel):
    status: Literal["draft", "submitted", "under_review", "approved", "rejected", "disbursed"]
    bank_reference: Optional[str] = Field(default=None, max_length=100)

def _normalize_tag(value: str) -> str:
    return value.strip().lower().replace("-", "_").replace(" ", "_")

async def _format_application_for_client(app: Dict[str, Any], db: AsyncIOMotorDatabase) -> Dict[str, Any]:
    scheme = None
    scheme_id = app.get("scheme_id")
    if isinstance(scheme_id, ObjectId):
        scheme = await db.loan_schemes.find_one({"_id": scheme_id})

    return {
        "application_id": str(app.get("_id")),
        "farmer_id": str(app.get("farmer_id")) if app.get("farmer_id") else None,
        "scheme_id": str(scheme_id) if scheme_id else None,
        "land_id": str(app.get("land_id")) if app.get("land_id") else None,
        "status": app.get("status"),
        "amount_requested": app.get("amount_requested", 0),
        "applied_at": (app.get("submitted_at") or app.get("updated_at") or datetime.now(timezone.utc)).isoformat(),
        "scheme": {
            "title": (scheme or {}).get("title"),
            "organisation": (scheme or {}).get("organisation"),
            "type": (scheme or {}).get("type"),
            "interest_label": (scheme or {}).get("interest_label"),
        },
    }

@router.get("/schemes")
async def get_schemes(
    type: Optional[Literal["gov", "pvt"]] = Query(default=None),
    tag: Optional[str] = Query(default=None),
    max_rate: Optional[float] = Query(default=None, ge=0),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Return active schemes.
    Supports filters: type, tag, max_rate.
    """
    query = {"is_active": True}

    if type is not None:
        query["type"] = type

    if max_rate is not None:
        query["interest_rate"] = {"$lte": max_rate}
    
    if tag:
        query["tags"] = _normalize_tag(tag)

    schemes = await db.loan_schemes.find(query).to_list(length=None)
    
    for scheme in schemes:
        scheme["scheme_id"] = str(scheme["_id"])
        scheme["_id"] = str(scheme["_id"])

    return {"count": len(schemes), "schemes": schemes}

@router.get("/schemes/{scheme_id}")
async def get_scheme_details(scheme_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    Return details for a specific scheme.
    """
    if not ObjectId.is_valid(scheme_id):
        raise HTTPException(status_code=400, detail="Invalid scheme ID format.")
        
    scheme = await db.loan_schemes.find_one({"_id": ObjectId(scheme_id)})
    
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")
    
    scheme["scheme_id"] = str(scheme["_id"])
    scheme["_id"] = str(scheme["_id"])
    
    return scheme

@router.post("/applications/apply", status_code=201)
async def apply_for_loan(
    application: LoanApplicationCreateRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Submit a new loan application.
    """
    if not ObjectId.is_valid(application.farmer_id) or not ObjectId.is_valid(application.scheme_id):
         raise HTTPException(status_code=400, detail="Invalid farmer or scheme ID format.")

    farmer = await db.farmers.find_one({"_id": ObjectId(application.farmer_id)})
    if not farmer:
        raise HTTPException(status_code=404, detail=f"Farmer with id {application.farmer_id} not found")

    scheme = await db.loan_schemes.find_one({"_id": ObjectId(application.scheme_id)})
    if not scheme:
        raise HTTPException(status_code=404, detail=f"Scheme with id {application.scheme_id} not found")

    new_application = {
        "farmer_id": ObjectId(application.farmer_id),
        "scheme_id": ObjectId(application.scheme_id),
        "land_id": ObjectId(application.land_id) if application.land_id else None,
        "amount_requested": application.amount_requested,
        "status": "submitted",
        "submitted_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    result = await db.loan_applications.insert_one(new_application)
    created_app = await db.loan_applications.find_one({"_id": result.inserted_id})
    created_app["_id"] = str(created_app["_id"])
    created_app["farmer_id"] = str(created_app["farmer_id"])
    created_app["scheme_id"] = str(created_app["scheme_id"])
    if created_app["land_id"]:
        created_app["land_id"] = str(created_app["land_id"])

    return created_app

@router.post("/apply", status_code=201)
async def apply_for_loan_compat(
    application: LoanApplicationCreateRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    created = await apply_for_loan(application=application, db=db)
    return created

@router.get("/applications/farmer/{farmer_id}")
async def get_farmer_applications(farmer_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    Get all loan applications for a specific farmer.
    """
    if not ObjectId.is_valid(farmer_id):
        raise HTTPException(status_code=400, detail="Invalid farmer ID format.")

    applications = await db.loan_applications.find({"farmer_id": ObjectId(farmer_id)}).to_list(length=None)
    formatted = []
    for app in applications:
        formatted.append(await _format_application_for_client(app, db))
    return formatted

@router.get("/applications/{farmer_id}")
async def get_farmer_applications_compat(farmer_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    applications = await get_farmer_applications(farmer_id=farmer_id, db=db)
    return {"applications": applications}

@router.get("/match/{farmer_id}")
async def get_loan_matches(
    farmer_id: str,
    top_n: int = Query(default=3, ge=1, le=20),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    if not ObjectId.is_valid(farmer_id):
        raise HTTPException(status_code=400, detail="Invalid farmer ID format.")

    schemes = await db.loan_schemes.find({"is_active": True}).to_list(length=None)
    matches = []
    for idx, scheme in enumerate(schemes):
        score = max(50, 95 - (idx * 7))
        reasons = ["Based on your active farm profile"]
        matches.append({
            "scheme_id": str(scheme.get("_id")),
            "title": scheme.get("title", "Loan Scheme"),
            "organisation": scheme.get("organisation", "Unknown"),
            "type": scheme.get("type", "gov"),
            "interest_label": scheme.get("interest_label"),
            "match_score": score,
            "reasons": reasons,
        })

    matches.sort(key=lambda x: x["match_score"], reverse=True)
    return {"matches": matches[:top_n]}

@router.patch("/applications/{application_id}/status")
async def update_application_status(
    application_id: str,
    status_update: ApplicationStatusUpdateRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Update the status of a loan application (for bank/admin use).
    """
    if not ObjectId.is_valid(application_id):
        raise HTTPException(status_code=400, detail="Invalid application ID format.")

    update_data = {
        "status": status_update.status,
        "updated_at": datetime.now(timezone.utc),
    }
    if status_update.bank_reference:
        update_data["bank_reference"] = status_update.bank_reference

    result = await db.loan_applications.update_one(
        {"_id": ObjectId(application_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Application with id {application_id} not found")

    updated_app = await db.loan_applications.find_one({"_id": ObjectId(application_id)})
    updated_app["_id"] = str(updated_app["_id"])
    updated_app["farmer_id"] = str(updated_app["farmer_id"])
    updated_app["scheme_id"] = str(updated_app["scheme_id"])
    if updated_app.get("land_id"):
        updated_app["land_id"] = str(updated_app["land_id"])

    return updated_app

