"""
Compliance, Consent, and Privacy (DSAR) Router — Phase 2
Handles GDPR consent, accommodations, and NYC Bias audit rules.
"""
from typing import Optional, List
from pydantic import BaseModel, EmailStr

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import DBSession, TenantId, CurrentUserId, require_role
from app.services import compliance as compliance_svc
from app.services.audit import AuditService

router = APIRouter(prefix="/compliance", tags=["Compliance"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ComplianceProfileUpdate(BaseModel):
    jurisdictions: List[str]
    ai_risk_classification: Optional[str] = "HIGH"
    bias_audit_requirements: Optional[dict] = None
    strict_consent_required: Optional[bool] = True


class ConsentRecordCreate(BaseModel):
    candidate_id: str
    workflow_stage: str
    consent_status: bool
    consent_method: Optional[str] = "WEB_FORM"
    verification_metadata: Optional[dict] = None


class AccommodationRequestCreate(BaseModel):
    candidate_id: str
    request_type: str
    details: str


class AccommodationRequestReview(BaseModel):
    status: str  # APPROVED | REJECTED | IMPLEMENTED
    review_notes: str


class PrivacyRequestCreate(BaseModel):
    request_type: str  # ACCESS | PORTABILITY | DELETION | RESTRICTION
    candidate_email: EmailStr


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/profile", dependencies=[Depends(require_role("tenant_admin", "hr_manager"))])
async def get_compliance_profile(
    db: DBSession,
    tenant_id: TenantId
):
    profile = await compliance_svc.get_compliance_profile(db, tenant_id)
    if not profile:
        # Return default profile if not set up
        return {
            "tenant_id": tenant_id,
            "jurisdictions": [],
            "ai_risk_classification": "HIGH",
            "bias_audit_requirements": {},
            "strict_consent_required": True
        }
    return profile


@router.put("/profile", dependencies=[Depends(require_role("tenant_admin"))])
async def update_compliance_profile(
    db: DBSession,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    profile_data: ComplianceProfileUpdate
):
    profile = await compliance_svc.upsert_compliance_profile(
        db,
        tenant_id=tenant_id,
        jurisdictions=profile_data.jurisdictions,
        ai_risk_classification=profile_data.ai_risk_classification,
        bias_audit_requirements=profile_data.bias_audit_requirements,
        strict_consent_required=profile_data.strict_consent_required
    )
    
    # Audit log entry
    audit = AuditService(db)
    await audit.log(
        tenant_id=tenant_id,
        actor_id=user_id,
        actor_type="user",
        action="compliance.profile_update",
        entity_type="compliance_profile",
        entity_id=str(profile.id),
        reason_code="COMPLIANCE_CONFIG_CHANGE",
        reason_summary=f"Compliance profile updated. Jurisdictions: {', '.join(profile_data.jurisdictions)}"
    )
    
    return profile


@router.post("/consent")
async def record_consent(
    db: DBSession,
    tenant_id: TenantId,
    consent_data: ConsentRecordCreate
):
    record = await compliance_svc.log_consent(
        db,
        tenant_id=tenant_id,
        candidate_id=consent_data.candidate_id,
        workflow_stage=consent_data.workflow_stage,
        consent_status=consent_data.consent_status,
        consent_method=consent_data.consent_method,
        verification_metadata=consent_data.verification_metadata
    )
    
    # Audit log consent submission
    audit = AuditService(db)
    await audit.log(
        tenant_id=tenant_id,
        actor_id=consent_data.candidate_id,
        actor_type="candidate",
        action="compliance.consent_registered",
        entity_type="consent_record",
        entity_id=str(record.id),
        reason_code="CONSENT_RECORDED",
        reason_summary=f"Candidate {consent_data.candidate_id} consent for {consent_data.workflow_stage} set to {consent_data.consent_status}"
    )
    
    return record


@router.get("/consent/{candidate_id}/{stage}")
async def check_consent(
    db: DBSession,
    tenant_id: TenantId,
    candidate_id: str,
    stage: str
):
    status_val = await compliance_svc.get_consent_status(db, tenant_id, candidate_id, stage)
    return {"candidate_id": candidate_id, "workflow_stage": stage, "consent_status": status_val}


@router.post("/accommodations")
async def request_accommodation(
    db: DBSession,
    tenant_id: TenantId,
    acc_data: AccommodationRequestCreate
):
    req = await compliance_svc.create_accommodation_request(
        db,
        tenant_id=tenant_id,
        candidate_id=acc_data.candidate_id,
        request_type=acc_data.request_type,
        details=acc_data.details
    )
    
    # Audit log request
    audit = AuditService(db)
    await audit.log(
        tenant_id=tenant_id,
        actor_id=acc_data.candidate_id,
        actor_type="candidate",
        action="compliance.accommodation_requested",
        entity_type="accommodation_request",
        entity_id=str(req.id),
        reason_code="ACCOMMODATION_SUBMITTED",
        reason_summary=f"Candidate requested {acc_data.request_type} accommodation."
    )
    
    return req


@router.get("/accommodations", dependencies=[Depends(require_role("tenant_admin", "hr_manager"))])
async def list_accommodations(
    db: DBSession,
    tenant_id: TenantId,
    status: Optional[str] = None
):
    return await compliance_svc.list_accommodation_requests(db, tenant_id, status)


@router.patch("/accommodations/{request_id}/review", dependencies=[Depends(require_role("tenant_admin", "hr_manager"))])
async def review_accommodation(
    db: DBSession,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    request_id: str,
    review: AccommodationRequestReview
):
    req = await compliance_svc.review_accommodation_request(
        db,
        tenant_id=tenant_id,
        request_id=request_id,
        status=review.status,
        review_notes=review.review_notes,
        user_id=user_id
    )
    if not req:
        raise HTTPException(status_code=404, detail="Accommodation request not found.")
        
    # Audit log review
    audit = AuditService(db)
    await audit.log(
        tenant_id=tenant_id,
        actor_id=user_id,
        actor_type="user",
        action="compliance.accommodation_reviewed",
        entity_type="accommodation_request",
        entity_id=str(req.id),
        reason_code="ACCOMMODATION_REVIEWED",
        reason_summary=f"Accommodation request {request_id} set to {review.status}"
    )
    
    return req


@router.post("/privacy-requests")
async def request_privacy_action(
    db: DBSession,
    tenant_id: TenantId,
    dsar: PrivacyRequestCreate
):
    req = await compliance_svc.create_privacy_request(
        db,
        tenant_id=tenant_id,
        request_type=dsar.request_type,
        candidate_email=dsar.candidate_email
    )
    return {
        "request_id": str(req.id),
        "status": req.status,
        "message": "Privacy request initiated. Verification code has been issued."
    }


@router.post("/privacy-requests/{request_id}/verify")
async def verify_privacy_action(
    db: DBSession,
    tenant_id: TenantId,
    request_id: str,
    token: str
):
    verified = await compliance_svc.verify_privacy_request(db, tenant_id, request_id, token)
    if not verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token or request already verified."
        )
    return {"status": "VERIFIED", "message": "Email ownership verified successfully."}


@router.post("/privacy-requests/{request_id}/execute", dependencies=[Depends(require_role("tenant_admin"))])
async def execute_privacy_action(
    db: DBSession,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    request_id: str
):
    success = await compliance_svc.execute_privacy_deletion(db, tenant_id, request_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request is not verified or could not be executed."
        )
        
    # Audit log execution
    audit = AuditService(db)
    await audit.log(
        tenant_id=tenant_id,
        actor_id=user_id,
        actor_type="user",
        action="compliance.dsar_executed",
        entity_type="privacy_request",
        entity_id=request_id,
        reason_code="PRIVACY_REQUEST_COMPLETED",
        reason_summary=f"DSAR privacy execution completed for request ID: {request_id}"
    )
    
    return {"status": "COMPLETED", "message": "Privacy request deletion executed successfully."}
