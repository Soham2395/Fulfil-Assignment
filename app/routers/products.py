from __future__ import annotations

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Product
from app.schemas import (
    ProductCreate,
    ProductUpdate,
    ProductOut,
    PaginatedResponse,
)
from app.webhooks_service import enqueue_event

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=PaginatedResponse)
def list_products(
    sku: Optional[str] = Query(default=None),
    name: Optional[str] = Query(default=None),
    description: Optional[str] = Query(default=None),
    active: Optional[bool] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = select(Product)

    if sku:
        # Case-insensitive exact match (uses functional index on LOWER(sku))
        query = query.where(func.lower(Product.sku) == func.lower(sku))
    if name:
        query = query.where(Product.name.ilike(f"%{name}%"))
    if description:
        query = query.where(Product.description.ilike(f"%{description}%"))
    if active is not None:
        query = query.where(Product.active == active)

    total = db.execute(
        select(func.count()).select_from(query.subquery())
    ).scalar_one()

    query = query.order_by(Product.id.desc()).offset((page - 1) * page_size).limit(page_size)

    rows = db.execute(query).scalars().all()

    return PaginatedResponse(total=total, page=page, page_size=page_size, items=rows)


@router.post("/", response_model=ProductOut, status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    prod = Product(
        sku=payload.sku,
        name=payload.name,
        description=payload.description,
        price=payload.price,
        active=payload.active if payload.active is not None else True,
    )
    db.add(prod)
    try:
        db.flush()
        db.refresh(prod)
        # Commit transaction before webhook dispatch to avoid blocking
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Product with this SKU already exists (case-insensitive)")
    
    # Fire webhook outside transaction (fire-and-forget)
    try:
        from datetime import datetime
        enqueue_event("product.created", {
            "id": prod.id,
            "sku": prod.sku,
            "name": prod.name,
            "timestamp": datetime.utcnow().isoformat()
        })
    except Exception:
        pass  
    
    return prod


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    prod = db.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    return prod


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    prod = db.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    # Apply changes if provided
    if payload.name is not None:
        prod.name = payload.name
    if payload.description is not None:
        prod.description = payload.description
    if payload.price is not None:
        prod.price = payload.price
    if payload.active is not None:
        prod.active = payload.active

    try:
        # bump updated_at server-side
        prod.updated_at = func.now()
        db.flush()
        db.refresh(prod)
        # Commit transaction before webhook dispatch
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Update failed due to integrity constraints")
    
    # Fire webhook outside transaction
    try:
        from datetime import datetime
        enqueue_event("product.updated", {
            "id": prod.id,
            "sku": prod.sku,
            "name": prod.name,
            "timestamp": datetime.utcnow().isoformat()
        })
    except Exception:
        pass
    
    return prod


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    prod = db.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    # Capture payload before delete
    payload = {"id": prod.id, "sku": prod.sku, "name": prod.name}
    db.delete(prod)
    db.commit()
    
    # Fire webhook outside transaction
    try:
        from datetime import datetime
        payload["timestamp"] = datetime.utcnow().isoformat()
        enqueue_event("product.deleted", payload)
    except Exception:
        pass
    
    return None


@router.delete("/", response_model=dict)
def delete_all_products(confirm: bool = Query(default=False), db: Session = Depends(get_db)):
    if not confirm:
        raise HTTPException(status_code=400, detail="Set confirm=true to delete all products")

    # Get count before delete for webhook payload
    count_before = db.execute(select(func.count()).select_from(Product)).scalar_one()
    
    # Efficient bulk delete
    result = db.execute(delete(Product))
    deleted = result.rowcount or 0
    db.commit()
    
    # Fire bulk delete webhook event
    try:
        from datetime import datetime
        enqueue_event("products.bulk_deleted", {
            "count": deleted,
            "timestamp": datetime.utcnow().isoformat()
        })
    except Exception:
        pass
    
    return {"deleted": deleted}
