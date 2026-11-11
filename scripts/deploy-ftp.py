#!/usr/bin/env python3

from ftplib import FTP, error_perm
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env.deploy"
DIST_DIRECTORY = PROJECT_ROOT / "dist"


def load_environment() -> dict[str, str]:
    if not ENV_FILE.is_file():
        raise RuntimeError(
            ".env.deploy fehlt. Bitte .env.deploy.example nach .env.deploy "
            "kopieren und das FTP-Passwort lokal eintragen."
        )

    values: dict[str, str] = {}
    for raw_line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key.strip()] = value

    for key in ("FTP_HOST", "FTP_PORT", "FTP_USER", "FTP_PASSWORD"):
        if not values.get(key):
            raise RuntimeError(f"{key} fehlt oder ist leer in .env.deploy.")

    try:
        port = int(values["FTP_PORT"])
    except ValueError as exc:
        raise RuntimeError("FTP_PORT in .env.deploy ist ungültig.") from exc
    if not 1 <= port <= 65535:
        raise RuntimeError("FTP_PORT in .env.deploy ist ungültig.")

    return values


def validate_dist() -> list[Path]:
    if not DIST_DIRECTORY.is_dir():
        raise RuntimeError("Build-Ausgabe dist/ fehlt. Bitte zuerst npm run build ausführen.")
    if not (DIST_DIRECTORY / "index.html").is_file():
        raise RuntimeError("Build-Ausgabe dist/index.html fehlt.")

    files = sorted(path for path in DIST_DIRECTORY.rglob("*") if path.is_file())
    if not files:
        raise RuntimeError("Build-Ausgabe dist/ ist leer.")
    if any(path.is_symlink() for path in files):
        raise RuntimeError("dist/ enthält symbolische Links; Upload aus Sicherheitsgründen abgebrochen.")
    return files


def enter_remote_directory(ftp: FTP, relative_directory: Path) -> None:
    ftp.cwd("/")
    for part in relative_directory.parts:
        if part in ("", "."):
            continue
        try:
            ftp.cwd(part)
        except error_perm:
            ftp.mkd(part)
            ftp.cwd(part)


def upload_dist(config: dict[str, str], files: list[Path]) -> None:
    ftp = FTP()
    try:
        print(f"Verbinde mit FTP auf {config['FTP_HOST']}:{config['FTP_PORT']} …")
        ftp.connect(config["FTP_HOST"], int(config["FTP_PORT"]), timeout=30)
        ftp.login(config["FTP_USER"], config["FTP_PASSWORD"])

        for local_file in files:
            relative = local_file.relative_to(DIST_DIRECTORY)
            enter_remote_directory(ftp, relative.parent)
            with local_file.open("rb") as source:
                ftp.storbinary(f"STOR {relative.name}", source)

        print(f"FTP-Upload abgeschlossen: {len(files)} Dateien aktualisiert oder ergänzt.")
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()


def main() -> int:
    try:
        config = load_environment()
        files = validate_dist()
        upload_dist(config, files)
        return 0
    except Exception as exc:
        print(f"FTP-Upload abgebrochen: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
