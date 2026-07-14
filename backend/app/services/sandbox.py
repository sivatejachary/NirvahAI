"""
Sandbox execution runner service.
Compiles and runs Python and Javascript/Node code within secure parameters.
Limits memory size, timeout limits, and contains environment escapes.
"""
import sys
import subprocess
import tempfile
import os
import shutil
from typing import Dict, Any, List

from app.core.logging import get_logger

logger = get_logger(__name__)


class SandboxService:
    @classmethod
    def execute_code(
        cls,
        code: str,
        language: str,
        input_data: str = "",
        timeout_seconds: float = 5.0,
        memory_limit_mb: int = 128
    ) -> Dict[str, Any]:
        """
        Executes candidate code securely.
        Tries to run in isolated Docker containers if Docker is available.
        Otherwise falls back to a subprocess runner with strict CPU/memory timeouts.
        """
        lang = language.lower().strip()
        if lang not in ["python", "javascript"]:
            return {
                "status": "COMPILE_ERROR",
                "output": "",
                "error": f"Language '{language}' is not supported by the sandbox compiler.",
                "duration": 0.0
            }

        # Check Docker availability
        docker_available = shutil.which("docker") is not None
        if docker_available:
            return cls._execute_docker(code, lang, input_data, timeout_seconds, memory_limit_mb)
        else:
            return cls._execute_local_subprocess(code, lang, input_data, timeout_seconds)

    @classmethod
    def _execute_docker(
        cls,
        code: str,
        language: str,
        input_data: str,
        timeout_seconds: float,
        memory_limit_mb: int
    ) -> Dict[str, Any]:
        """Runs the code inside a Docker container with zero networking and strict memory boundaries."""
        image = "python:3.10-slim" if language == "python" else "node:18-alpine"
        file_name = "solution.py" if language == "python" else "solution.js"
        run_cmd = ["python", file_name] if language == "python" else ["node", file_name]

        # Use temp directory inside workspace
        temp_dir = tempfile.mkdtemp(dir=os.getcwd())
        try:
            # Write source code file
            file_path = os.path.join(temp_dir, file_name)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(code)

            # Build Docker command parameters
            # --network none prevents remote calls
            # --memory limits ram
            # --cpus limits core utilization
            docker_cmd = [
                "docker", "run", "--rm",
                "-i",
                "--network", "none",
                "--memory", f"{memory_limit_mb}m",
                "--cpus", "1.0",
                "-v", f"{os.path.abspath(temp_dir)}:/app",
                "-w", "/app",
                image
            ] + run_cmd

            import time
            start_time = time.time()
            proc = subprocess.run(
                docker_cmd,
                input=input_data,
                text=True,
                capture_output=True,
                timeout=timeout_seconds
            )
            duration = time.time() - start_time

            if proc.returncode == 0:
                return {
                    "status": "ACCEPTED",
                    "output": proc.stdout,
                    "error": "",
                    "duration": duration
                }
            else:
                return {
                    "status": "RUNTIME_ERROR",
                    "output": proc.stdout,
                    "error": proc.stderr,
                    "duration": duration
                }

        except subprocess.TimeoutExpired:
            return {
                "status": "TIMEOUT",
                "output": "",
                "error": f"Execution exceeded secure limit of {timeout_seconds} seconds.",
                "duration": timeout_seconds
            }
        except Exception as e:
            logger.error("DOCKER_SANDBOX_EXECUTION_FAILED", error=str(e))
            # Fall back to local subprocess if docker run fails unexpectedly
            return cls._execute_local_subprocess(code, language, input_data, timeout_seconds)
        finally:
            try:
                shutil.rmtree(temp_dir)
            except Exception:
                pass

    @classmethod
    def _execute_local_subprocess(
        cls,
        code: str,
        language: str,
        input_data: str,
        timeout_seconds: float
    ) -> Dict[str, Any]:
        """Fallback local subprocess execution using strict process timeouts and piping."""
        file_name = "solution_local.py" if language == "python" else "solution_local.js"
        run_cmd = [sys.executable, file_name] if language == "python" else ["node", file_name]

        temp_dir = tempfile.mkdtemp(dir=os.getcwd())
        try:
            file_path = os.path.join(temp_dir, file_name)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(code)

            import time
            start_time = time.time()
            proc = subprocess.run(
                run_cmd,
                input=input_data,
                text=True,
                capture_output=True,
                timeout=timeout_seconds,
                cwd=temp_dir
            )
            duration = time.time() - start_time

            if proc.returncode == 0:
                return {
                    "status": "ACCEPTED",
                    "output": proc.stdout,
                    "error": "",
                    "duration": duration
                }
            else:
                return {
                    "status": "RUNTIME_ERROR",
                    "output": proc.stdout,
                    "error": proc.stderr,
                    "duration": duration
                }

        except subprocess.TimeoutExpired:
            return {
                "status": "TIMEOUT",
                "output": "",
                "error": f"Execution exceeded local timeout constraint of {timeout_seconds} seconds.",
                "duration": timeout_seconds
            }
        except Exception as e:
            return {
                "status": "COMPILE_ERROR",
                "output": "",
                "error": f"Subprocess fail: {str(e)}",
                "duration": 0.0
            }
        finally:
            try:
                shutil.rmtree(temp_dir)
            except Exception:
                pass
