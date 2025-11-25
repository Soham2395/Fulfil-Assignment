from __future__ import annotations

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl, field_validator


# Product Schemas
class ProductBase(BaseModel):
    sku: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    active: Optional[bool] = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    active: Optional[bool] = None


class ProductOut(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Pagination/Filtering
class ProductFilters(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[ProductOut]


# Webhook Schemas
class WebhookBase(BaseModel):
    url: HttpUrl  # Validates HTTP/HTTPS URLs
    event_type: str = Field(min_length=1, max_length=128)
    enabled: bool = True


class WebhookCreate(WebhookBase):
    pass


class WebhookUpdate(BaseModel):
    url: Optional[HttpUrl] = None
    event_type: Optional[str] = Field(default=None, min_length=1, max_length=128)
    enabled: Optional[bool] = None


class WebhookOut(WebhookBase):
    id: int
    created_at: datetime
    updated_at: datetime
    last_response_code: Optional[int] = None
    last_response_time_ms: Optional[int] = None

    class Config:
        from_attributes = True
