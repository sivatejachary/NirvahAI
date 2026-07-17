"""
AI Technical Interview Agent
Evaluates technical interview scores, transcript summaries, and communication feedback ratings.
"""
from typing import Dict, Any

class TechnicalInterviewAgent:
    @staticmethod
    def evaluate_interview_attempt(
        transcript: str,
        technical_questions_count: int = 5
    ) -> Dict[str, Any]:
        """
        Analyzes the interview transcript and computes competency scores.
        """
        if not transcript.strip():
            return {
                "score": 0.0,
                "confidence": 1.0,
                "communication_rating": "POOR",
                "strengths": [],
                "weaknesses": ["No transcript recorded."],
                "recommendation": "FAIL"
            }
            
        transcript_lower = transcript.lower()
        score = 50.0
        strengths = []
        weaknesses = []
        
        # Simple keywords matching
        if "o(n)" in transcript_lower or "complexity" in transcript_lower:
            score += 15.0
            strengths.append("Demonstrates solid understanding of algorithms efficiency.")
        if "lock" in transcript_lower or "race" in transcript_lower:
            score += 15.0
            strengths.append("Understand thread safety and resource concurrency issues.")
        if "scale" in transcript_lower or "distributed" in transcript_lower:
            score += 10.0
            strengths.append("Familiar with system design and horizontal scaling.")
            
        if len(strengths) == 0:
            weaknesses.append("Lack of algorithm optimization and complex architectures explanation.")
            
        score = min(score, 100.0)
        
        return {
            "score": score,
            "confidence": 0.80 if len(strengths) > 0 else 0.60,
            "communication_rating": "EXCELLENT" if score >= 80 else "GOOD" if score >= 60 else "AVERAGE",
            "strengths": strengths,
            "weaknesses": weaknesses,
            "recommendation": "PASS" if score >= 60.0 else "REVIEW" if score >= 40.0 else "FAIL"
        }
