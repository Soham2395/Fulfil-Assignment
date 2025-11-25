from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    Index,
    func,
)

from .db import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    sku = Column(String(128), nullable=False)  # Case-insensitive unique enforced via migration index on LOWER(sku)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(12, 2), nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_products_name", "name"),
        Index("ix_products_active", "active"),
        # Functional unique index on LOWER(sku) will be created via Alembic migration for PostgreSQL
    )


class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    url = Column(String(2048), nullable=False)
    event_type = Column(String(128), nullable=False)  # e.g., product.created, product.updated, product.deleted, import.completed
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # For UI visibility on test runs
    last_response_code = Column(Integer, nullable=True)
    last_response_time_ms = Column(Integer, nullable=True)
