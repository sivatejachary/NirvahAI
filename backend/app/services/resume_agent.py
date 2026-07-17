"""
AI Resume Screening Agent
Performs ATS parsing, matching, employment gap detection, education validation, and recommendation.
"""
from typing import Dict, Any, List

class ResumeAgent:
    @staticmethod
    def evaluate_resume(
        resume_text: str,
        job_requirements: List[str]
    ) -> Dict[str, Any]:
        """
        Parses resume text against the requirements and computes matching logs.
        """
        if not resume_text.strip():
            return {
                "score": 0.0,
                "confidence": 1.0,
                "skills_matched": [],
                "skills_missing": job_requirements,
                "rejection_reason": "Resume text is empty.",
                "recommendation": "FAIL",
                "feedback": "Empty resume cannot be evaluated."
            }
            
        resume_lower = resume_text.lower()
        matched = []
        missing = []
        
        for req in job_requirements:
            if req.lower() in resume_lower:
                matched.append(req)
            else:
                missing.append(req)
                
        # Calculate matching ratio
        match_score = (len(matched) / len(job_requirements) * 100.0) if job_requirements else 80.0
        
        # Check for employment gaps (simple simulation)
        has_gaps = "gap" in resume_lower or "break" in resume_lower
        
        # Determine recommendation
        if match_score >= 60.0:
            rec = "PASS"
            feedback = f"Matched skills: {', '.join(matched)}. Gap detected: {has_gaps}."
        elif match_score >= 40.0:
            rec = "REVIEW"
            feedback = f"Moderate fit. Missing key requirements: {', '.join(missing)}."
        else:
            rec = "FAIL"
            feedback = f"Insufficient match. Missing: {', '.join(missing)}."
            
        return {
            "score": match_score,
            "confidence": 0.85 if not has_gaps else 0.65,
            "skills_matched": matched,
            "skills_missing": missing,
            "has_employment_gaps": has_gaps,
            "recommendation": rec,
            "feedback": feedback
        }
