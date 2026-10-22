"""Who may do what.

Superadmins come from the SUPERADMIN_EMAILS environment variable, which is the
source of truth for them: they are granted on sign-in and removed from the
list on their next sign-in. Teachers are granted by a superadmin in the
database. A superadmin cannot be changed through the API, so the platform can
never lock itself out.
"""

import os
from enum import StrEnum


class Role(StrEnum):
    STUDENT = "student"
    TEACHER = "teacher"
    SUPERADMIN = "superadmin"


TEACHING_ROLES = frozenset({Role.TEACHER, Role.SUPERADMIN})


def superadmin_emails() -> set[str]:
    raw = os.getenv("SUPERADMIN_EMAILS", "")
    return {email.strip().lower() for email in raw.split(",") if email.strip()}


def role_after_sign_in(email: str, current: str) -> str:
    if email.lower() in superadmin_emails():
        return Role.SUPERADMIN

    if current == Role.SUPERADMIN:
        return Role.STUDENT

    return current


def can_teach(role: str) -> bool:
    return role in TEACHING_ROLES
