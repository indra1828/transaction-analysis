from typing import Literal

from pydantic import BaseModel, ConfigDict


class UserAdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    role: str


class RoleUpdate(BaseModel):
    # Superadmins are set through SUPERADMIN_EMAILS, never through the API.
    role: Literal["student", "teacher"]
