"""
AI HR Agent
Manages candidate HR screening parameters: notice period, salary expectations, relocation, and benefit package alignments.
"""
from typing import Dict, Any, List

class HRAgent:
    @staticmethod
    def evaluate_hr_parameters(
        notice_period_days: int,
        expected_salary_usd: float,
        target_budget_usd: float,
        requires_relocation: bool,
        will_relocate: bool,
        shift_availability: List[str]
    ) -> Dict[str, Any]:
        """
        Validates candidate preferences against target budget and policy guidelines.
        """
        score = 100.0
        reasons = []
        
        # 1. Budget Checks
        if expected_salary_usd > target_budget_usd * 1.15:
            # Over 15% budget threshold
            score -= 40.0
            reasons.append("Salary expectations exceed budget threshold by >15%.")
        elif expected_salary_usd > target_budget_usd:
            score -= 15.0
            reasons.append("Salary expectations slightly exceed targeted budget.")
            
        # 2. Relocation check
        if requires_relocation and not will_relocate:
            score -= 30.0
            reasons.append("Candidate requires relocation but is unwilling to relocate.")
            
        # 3. Notice Period check
        if notice_period_days > 90:
            score -= 20.0
            reasons.append("Notice period (>90 days) exceeds company notice policies.")
            
        score = max(score, 0.0)
        
        if score >= 80.0:
            rec = "PASS"
        elif score >= 50.0:
            rec = "REVIEW"
        else:
            rec = "FAIL"
            
        return {
            "score": score,
            "confidence": 0.90,
            "recommendation": rec,
            "reasons": reasons,
            "feedback": "; ".join(reasons) if reasons else "Candidate aligns with all HR policies and budgets."
        }
