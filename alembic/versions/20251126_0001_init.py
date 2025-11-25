"""Initial tables and case-insensitive SKU index

Revision ID: 20251126_0001
Revises: 
Create Date: 2025-11-26 00:38:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20251126_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # products table
    op.create_table(
        "products",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("sku", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index("ix_products_name", "products", ["name"], unique=False)
    op.create_index("ix_products_active", "products", ["active"], unique=False)

    # Case-insensitive unique index on LOWER(sku)
    op.execute("CREATE UNIQUE INDEX ux_products_sku_ci ON products (LOWER(sku));")

    # webhooks table
    op.create_table(
        "webhooks",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_response_code", sa.Integer(), nullable=True),
        sa.Column("last_response_time_ms", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("webhooks")
    op.execute("DROP INDEX IF EXISTS ux_products_sku_ci;")
    op.drop_index("ix_products_active", table_name="products")
    op.drop_index("ix_products_name", table_name="products")
    op.drop_table("products")
