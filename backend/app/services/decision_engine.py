"""
AI Decision Engine
Evaluates candidate stage attempts and determines outcomes (PASS, FAIL, REVIEW, RETRY)
"""
from typing import Dict, Any, Optional

class DecisionEngine:
    @staticmethod
    def evaluate(
        score: float,
        pass_mark: float,
        ai_confidence: float,
        confidence_threshold: float,
        require_human_approval: bool,
        retry_allowed: bool = False,
        max_retries: int = 1,
        current_retries: int = 0
    ) -> Dict[str, Any]:
        """
        Processes candidate results and calculates workflow execution directives.
        """
        decision = "PASS"
        human_review_required = False
        retry_eligible = False
        
        # 1. Check AI confidence thresholds & compliance approvals
        if ai_confidence < confidence_threshold or require_human_approval:
            decision = "REVIEW"
            human_review_required = True
            reason = "AI confidence score below configured threshold or stage requires human approval."
        
        # 2. Check score matching
        elif score >= pass_mark:
            decision = "PASS"
            reason = f"Candidate score of {score}% meets or exceeds pass mark of {pass_mark}%."
        
        else:
            # 3. Check Retry eligibility
            if retry_allowed and current_retries < max_retries:
                decision = "RETRY"
                retry_eligible = True
                reason = f"Candidate score of {score}% failed to meet pass mark of {pass_mark}%, but retry attempt is allowed."
            else:
                decision = "FAIL"
                reason = f"Candidate score of {score}% failed to meet pass mark of {pass_mark}%."

        return {
            "decision": decision,
            "score": score,
            "confidence": ai_confidence,
            "reason": reason,
            "retry_eligible": retry_eligible,
            "human_review_required": human_review_required,
            "feedback": reason
        }
