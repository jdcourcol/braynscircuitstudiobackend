import argparse
import sys
from dataclasses import dataclass
from logging import INFO
from pathlib import Path

from .version import VERSION


@dataclass
class Settings:
    host: str = "0.0.0.0"
    port: int = 8001
    secure: bool = False
    certificate: str = ""
    key: str = ""
    password: str = ""
    max_frame_size: int = 2**31
    log_level: int | str = INFO
    base_directory: Path = Path()


def boolean(value: str) -> bool:
    if value == "true":
        return True
    if value == "false":
        return False
    raise ValueError(f"Expected 'true' or 'false', not {value}")


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog=f"Brayns Circuit Studio Backend {VERSION}",
        description="Backend used by Brayns front-end BCS.",
    )
    parser.add_argument("--version", "-v", action="version", version="%(prog)s")
    parser.add_argument("--host", help="Server allowed hosts")
    parser.add_argument("--port", type=int, help="Server port")
    parser.add_argument("--secure", type=boolean, help="Enable SSL if true")
    parser.add_argument("--certificate", help="Server certificate file")
    parser.add_argument("--key", help="Server private key file")
    parser.add_argument("--password", help="Server private key password")
    parser.add_argument("--max_frame_size", type=int, help="Websocket max frame size")
    parser.add_argument("--log_level", help="[DEBUG, INFO, WARNING, ERROR, CRITICAL]")
    parser.add_argument("--base_directory", type=Path, help="Filesytem base directory")
    return parser


def validate(settings: Settings) -> None:
    if not settings.base_directory.is_dir():
        raise ValueError("Base directory is not a directory")
    settings.base_directory = settings.base_directory.absolute()


def parse_argv(args: list[str] = sys.argv[1:]) -> Settings:
    settings = Settings()
    parser = create_parser()
    parser.parse_args(args, settings)
    validate(settings)
    return settings
