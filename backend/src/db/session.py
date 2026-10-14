
import os
from typing import Annotated

from fastapi import Depends
from sqlalchemy import DateTime, create_engine, event, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from .db import Base


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./conversation.db")

engine = create_engine(
    DATABASE_URL,
    connect_args=(
        {"check_same_thread": False}
        if DATABASE_URL.startswith("sqlite")
        else {}
    ),
)

if DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine)


def _add_missing_columns() -> None:
    """Add columns that newer code expects but an existing table lacks.

    create_all only creates missing tables, so an existing database needs its
    new columns added. Each entry is (table, column, type).
    """
    additions = [
        ("messages", "archived_at", DateTime(timezone=True)),
    ]
    inspector = inspect(engine)

    with engine.begin() as conn:
        for table, column, column_type in additions:
            existing = {col["name"] for col in inspector.get_columns(table)}

            if column not in existing:
                sql_type = column_type.compile(dialect=engine.dialect)
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {sql_type}'))


def init_db():
    Base.metadata.create_all(engine)
    _add_missing_columns()


def get_db():
    with SessionLocal() as session:
        yield session

DbSession = Annotated[Session, Depends(get_db)]