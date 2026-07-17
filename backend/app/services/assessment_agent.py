"""
AI Assessment Agent
Generates MCQ questions and coding challenge templates based on job requirements.
"""
from typing import List, Dict, Any

class AssessmentAgent:
    @staticmethod
    def generate_mcq_test(skills: List[str], num_questions: int = 5) -> List[Dict[str, Any]]:
        """
        Dynamically designs MCQ questionnaires.
        """
        questions = []
        topics = skills if skills else ["Python", "SQL", "General Engineering"]
        
        for i in range(num_questions):
            topic = topics[i % len(topics)]
            questions.append({
                "id": i + 1,
                "question": f"Which of the following describes best practices in {topic} execution?",
                "options": [
                    "Option A: Implement thread-safe locks and decoupled handlers",
                    "Option B: Use globally hardcoded thread limits",
                    "Option C: Execute synchronous blocking loops on main threads",
                    "Option D: Avoid concurrency and scale vertically exclusively"
                ],
                "correct_option": "A",
                "topic": topic
            })
        return questions

    @staticmethod
    def generate_coding_challenges(skills: List[str]) -> List[Dict[str, Any]]:
        """
        Dynamically designs code challenges.
        """
        challenges = []
        topics = skills if skills else ["Python", "Algorithms"]
        
        for idx, topic in enumerate(topics[:2]):
            challenges.append({
                "id": idx + 1,
                "title": f"Optimal {topic} Sequence Parser",
                "description": f"Design an efficient parser in {topic} to process sequential event logs. System should run with O(N) complexity.",
                "constraints": "Memory limit: 256MB. Execution time: 1.0s.",
                "testcases": [
                    {"input": "[1,2,3]", "output": "6"},
                    {"input": "[]", "output": "0"}
                ]
            })
        return challenges
