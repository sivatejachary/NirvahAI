"""
Prompt Version Registry Service
Stores, loads, and registers version-controlled templates to guard against prompt injections.
"""
import os
from typing import Dict, Any

from app.core.logging import get_logger

logger = get_logger(__name__)

PROMPTS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "core",
    "prompts"
)


class PromptRegistry:
    @staticmethod
    def load_prompt_template(name: str) -> str:
        """
        Loads a prompt template by name from the file system.
        """
        # Clean name to prevent directory traversal injections
        clean_name = os.path.basename(name).replace("..", "")
        if not clean_name.endswith(".txt"):
            clean_name = f"{clean_name}.txt"
            
        file_path = os.path.join(PROMPTS_DIR, clean_name)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Prompt template {name} not found at {file_path}")
            
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()

    @classmethod
    def render(cls, name: str, **kwargs: Any) -> str:
        """
        Loads the template and formats it with safe kwargs.
        """
        template = cls.load_prompt_template(name)
        try:
            return template.format(**kwargs)
        except KeyError as e:
            logger.error(f"Missing required parameter {e} for prompt template {name}")
            raise ValueError(f"Missing required parameter {e} for prompt rendering")
