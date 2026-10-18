#!/usr/bin/env python3
"""
BorealisExtra multi-platform packaging and GitHub release script.
Builds:
  - Windows: BorealisExtra-win-x64.exe (All-in-one single-file executable)
  - Linux:   BorealisExtra-linux-x64 (Standalone single-file executable)
             BorealisExtra-x86_64.AppImage (All-in-one AppImage)
  - macOS:   BorealisExtra-osx-arm64.zip (Apple Silicon .app bundle)

Optimizes assemblies with trimming and compression for minimal binary size.
Outputs all assets to releases/BorealisExtra/ and conditionally publishes
to GitHub Releases when version tags do not already exist.
"""

import argparse
import datetime
import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

PLUGIN_DIR = Path(__file__).resolve().parent
REPO_ROOT = PLUGIN_DIR.parent.parent
RELEASES_DIR = REPO_ROOT / "releases" / "BorealisExtra"
CSPROJ_FILE = PLUGIN_DIR / "BorealisExtra.csproj"
META_FILE = PLUGIN_DIR / "meta.json"
ASSETS_DIR = PLUGIN_DIR / "Assets"
MANIFEST_FILE = RELEASES_DIR / "manifest.json"

GITHUB_REPO = "rrHakushi/IRIS"
APPIMAGETOOL_URL = "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"


def read_meta():
    if not META_FILE.exists():
        return {
            "id": "BorealisExtra",
            "name": "Borealis Extra",
            "version": "1.0.0",
            "description": "Borealis desktop game playtime tracker and process linker."
        }
    with open(META_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def compute_md5(file_path: Path) -> str:
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest().lower()


def compute_sha256(file_path: Path) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest().lower()


def ensure_appimagetool() -> Path:
    which_tool = shutil.which("appimagetool")
    if which_tool:
        return Path(which_tool)

    cache_dir = Path.home() / ".cache" / "borealis_build_tools"
    cache_dir.mkdir(parents=True, exist_ok=True)
    tool_path = cache_dir / "appimagetool-x86_64.AppImage"

    if not tool_path.exists() or tool_path.stat().st_size < 1000000:
        print("  Downloading official appimagetool static runner...")
        req = urllib.request.Request(
            APPIMAGETOOL_URL,
            headers={"User-Agent": "BorealisExtra-Packager"}
        )
        with urllib.request.urlopen(req) as response, open(tool_path, "wb") as out:
            shutil.copyfileobj(response, out)
        tool_path.chmod(tool_path.stat().st_mode | stat.S_IEXEC)

    return tool_path


def build_linux(version: str) -> tuple[Path, Path]:
    print("[1/4] Building Linux binaries (linux-x64)...")
    RELEASES_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="borealis_linux_") as tmp_dir:
        tmp_path = Path(tmp_dir)
        cmd = [
            "dotnet", "publish", str(CSPROJ_FILE),
            "-c", "Release",
            "-r", "linux-x64",
            "--self-contained", "true",
            "-p:PublishSingleFile=true",
            "-p:PublishTrimmed=true",
            "-p:TrimMode=partial",
            "-p:JsonSerializerIsReflectionEnabledByDefault=true",
            "-p:EnableCompressionInSingleFile=true",
            "-p:DebugType=none",
            "-p:DebugSymbols=false",
            "-o", str(tmp_path)
        ]
        res = subprocess.run(cmd, cwd=str(REPO_ROOT), check=False)
        if res.returncode != 0:
            print("Error: dotnet publish for linux-x64 failed", file=sys.stderr)
            sys.exit(res.returncode)

        compiled_bin = tmp_path / "BorealisExtra"
        if not compiled_bin.exists():
            raise FileNotFoundError(f"Linux binary not found at {compiled_bin}")

        # 1. Standalone raw binary
        raw_bin_target = RELEASES_DIR / "BorealisExtra-linux-x64"
        shutil.copy2(compiled_bin, raw_bin_target)
        raw_bin_target.chmod(raw_bin_target.stat().st_mode | stat.S_IEXEC)
        print(f"  ✓ Created standalone binary -> {raw_bin_target.name} ({raw_bin_target.stat().st_size // (1024*1024)} MB)")

        # 2. Build AppImage
        app_dir = tmp_path / "AppDir"
        usr_bin = app_dir / "usr" / "bin"
        usr_bin.mkdir(parents=True, exist_ok=True)

        shutil.copy2(compiled_bin, usr_bin / "BorealisExtra")
        (usr_bin / "BorealisExtra").chmod(0o755)

        # AppRun script
        app_run = app_dir / "AppRun"
        app_run.write_text(
            "#!/bin/sh\n"
            "SELF=$(readlink -f \"$0\")\n"
            "HERE=${SELF%/*}\n"
            "export PATH=\"${HERE}/usr/bin:${PATH}\"\n"
            "exec \"${HERE}/usr/bin/BorealisExtra\" \"$@\"\n",
            encoding="utf-8"
        )
        app_run.chmod(0o755)

        # Desktop entry
        desktop_file = app_dir / "borealis-extra.desktop"
        desktop_content = (
            "[Desktop Entry]\n"
            "Type=Application\n"
            "Version=1.0\n"
            "Name=Borealis Extra\n"
            "GenericName=Game Playtime Tracker\n"
            "Comment=Automatic game playtime tracker for Borealis\n"
            "Exec=BorealisExtra\n"
            "Icon=borealis-extra\n"
            "Terminal=false\n"
            "Categories=Game;Utility;\n"
            "Keywords=iris;borealis;extra;tracker;playtime;game;\n"
            "StartupWMClass=BorealisExtra\n"
        )
        desktop_file.write_text(desktop_content, encoding="utf-8")

        # Copy icons
        icon_src = ASSETS_DIR / "iris.png"
        if icon_src.exists():
            shutil.copy2(icon_src, app_dir / "borealis-extra.png")
            try:
                (app_dir / ".DirIcon").symlink_to("borealis-extra.png")
            except Exception:
                shutil.copy2(icon_src, app_dir / ".DirIcon")

        # Copy installer and desktop files to releases dir
        releases_desktop = RELEASES_DIR / "borealis-extra.desktop"
        releases_desktop.write_text(desktop_content, encoding="utf-8")
        if icon_src.exists():
            shutil.copy2(icon_src, RELEASES_DIR / "borealis-extra.png")
        if (ASSETS_DIR / "iris.ico").exists():
            shutil.copy2(ASSETS_DIR / "iris.ico", RELEASES_DIR / "borealis.ico")

        # Write install.sh
        install_script = RELEASES_DIR / "install.sh"
        install_script.write_text(
            "#!/bin/bash\n"
            "set -e\n\n"
            "DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")\" && pwd)\"\n"
            "BIN_DIR=\"$HOME/.local/bin\"\n"
            "APP_DIR=\"$HOME/.local/share/applications\"\n"
            "ICON_DIR=\"$HOME/.local/share/icons/hicolor/512x512/apps\"\n"
            "ICON_DIR2=\"$HOME/.local/share/icons\"\n\n"
            "echo \"Installing Borealis Extra...\"\n\n"
            "mkdir -p \"$BIN_DIR\" \"$APP_DIR\" \"$ICON_DIR\" \"$ICON_DIR2\"\n\n"
            "if [ -f \"$DIR/BorealisExtra-linux-x64\" ]; then\n"
            "    cp \"$DIR/BorealisExtra-linux-x64\" \"$BIN_DIR/borealis-extra\"\n"
            "elif [ -f \"$DIR/BorealisExtra-x86_64.AppImage\" ]; then\n"
            "    cp \"$DIR/BorealisExtra-x86_64.AppImage\" \"$BIN_DIR/borealis-extra\"\n"
            "fi\n"
            "chmod +x \"$BIN_DIR/borealis-extra\"\n\n"
            "if [ -f \"$DIR/borealis-extra.png\" ]; then\n"
            "    cp \"$DIR/borealis-extra.png\" \"$ICON_DIR2/borealis-extra.png\"\n"
            "    cp \"$DIR/borealis-extra.png\" \"$ICON_DIR/borealis-extra.png\"\n"
            "fi\n\n"
            "cat << EOF > \"$APP_DIR/borealis-extra.desktop\"\n"
            "[Desktop Entry]\n"
            "Type=Application\n"
            "Version=1.0\n"
            "Name=Borealis Extra\n"
            "GenericName=Game Playtime Tracker\n"
            "Comment=Automatic game playtime tracker for Borealis\n"
            "Exec=$BIN_DIR/borealis-extra\n"
            "Icon=borealis-extra\n"
            "Terminal=false\n"
            "Categories=Game;Utility;\n"
            "Keywords=iris;borealis;extra;tracker;playtime;game;\n"
            "StartupWMClass=BorealisExtra\n"
            "EOF\n\n"
            "if command -v update-desktop-database >/dev/null 2>&1; then\n"
            "    update-desktop-database \"$APP_DIR\" >/dev/null 2>&1 || true\n"
            "fi\n\n"
            "if command -v gtk-update-icon-cache >/dev/null 2>&1; then\n"
            "    gtk-update-icon-cache -f -t \"$HOME/.local/share/icons/hicolor\" >/dev/null 2>&1 || true\n"
            "fi\n\n"
            "echo \"Successfully installed Borealis Extra! It is now available in your application menu.\"\n",
            encoding="utf-8"
        )
        install_script.chmod(0o755)

        # Run appimagetool
        appimage_target = RELEASES_DIR / "BorealisExtra-x86_64.AppImage"
        try:
            tool = ensure_appimagetool()
            env = os.environ.copy()
            env["ARCH"] = "x86_64"
            app_cmd = [str(tool), "--appimage-extract-and-run", str(app_dir), str(appimage_target)]
            app_res = subprocess.run(app_cmd, cwd=str(tmp_path), env=env, check=False)
            if app_res.returncode == 0 and appimage_target.exists():
                appimage_target.chmod(0o755)
                print(f"  ✓ Created AppImage -> {appimage_target.name} ({appimage_target.stat().st_size // (1024*1024)} MB)")
            else:
                print(f"  Warning: appimagetool returned code {app_res.returncode}. AppImage generation skipped.")
        except Exception as e:
            print(f"  Warning: Could not build AppImage: {e}")

        return raw_bin_target, appimage_target


def build_windows(version: str) -> Path:
    print("[2/4] Building Windows executable (win-x64)...")
    RELEASES_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="borealis_win_") as tmp_dir:
        tmp_path = Path(tmp_dir)
        cmd = [
            "dotnet", "publish", str(CSPROJ_FILE),
            "-c", "Release",
            "-r", "win-x64",
            "--self-contained", "true",
            "-p:PublishSingleFile=true",
            "-p:PublishTrimmed=true",
            "-p:TrimMode=partial",
            "-p:JsonSerializerIsReflectionEnabledByDefault=true",
            "-p:EnableCompressionInSingleFile=true",
            "-p:DebugType=none",
            "-p:DebugSymbols=false",
            "-o", str(tmp_path)
        ]
        res = subprocess.run(cmd, cwd=str(REPO_ROOT), check=False)
        if res.returncode != 0:
            print("Error: dotnet publish for win-x64 failed", file=sys.stderr)
            sys.exit(res.returncode)

        compiled_exe = tmp_path / "BorealisExtra.exe"
        if not compiled_exe.exists():
            raise FileNotFoundError(f"Windows binary not found at {compiled_exe}")

        target_exe = RELEASES_DIR / "BorealisExtra-win-x64.exe"
        shutil.copy2(compiled_exe, target_exe)
        print(f"  ✓ Created all-in-one Windows exe -> {target_exe.name} ({target_exe.stat().st_size // (1024*1024)} MB)")
        return target_exe


def build_macos(version: str) -> Path:
    print("[3/4] Building macOS Apple Silicon bundle (osx-arm64)...")
    RELEASES_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="borealis_mac_") as tmp_dir:
        tmp_path = Path(tmp_dir)
        cmd = [
            "dotnet", "publish", str(CSPROJ_FILE),
            "-c", "Release",
            "-r", "osx-arm64",
            "--self-contained", "true",
            "-p:PublishSingleFile=true",
            "-p:PublishTrimmed=true",
            "-p:TrimMode=partial",
            "-p:JsonSerializerIsReflectionEnabledByDefault=true",
            "-p:EnableCompressionInSingleFile=true",
            "-p:DebugType=none",
            "-p:DebugSymbols=false",
            "-o", str(tmp_path)
        ]
        res = subprocess.run(cmd, cwd=str(REPO_ROOT), check=False)
        if res.returncode != 0:
            print("Error: dotnet publish for osx-arm64 failed", file=sys.stderr)
            sys.exit(res.returncode)

        compiled_bin = tmp_path / "BorealisExtra"
        if not compiled_bin.exists():
            raise FileNotFoundError(f"macOS binary not found at {compiled_bin}")

        # Construct .app bundle structure
        bundle_dir = tmp_path / "BorealisExtra.app"
        contents_dir = bundle_dir / "Contents"
        macos_dir = contents_dir / "MacOS"
        resources_dir = contents_dir / "Resources"
        macos_dir.mkdir(parents=True, exist_ok=True)
        resources_dir.mkdir(parents=True, exist_ok=True)

        app_bin = macos_dir / "BorealisExtra"
        shutil.copy2(compiled_bin, app_bin)
        app_bin.chmod(0o755)

        icon_src = ASSETS_DIR / "iris.ico"
        if icon_src.exists():
            shutil.copy2(icon_src, resources_dir / "app.ico")

        plist_content = (
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n"
            "<plist version=\"1.0\">\n"
            "<dict>\n"
            "    <key>CFBundleExecutable</key>\n"
            "    <string>BorealisExtra</string>\n"
            "    <key>CFBundleIdentifier</key>\n"
            "    <string>org.runerra.borealisextra</string>\n"
            "    <key>CFBundleName</key>\n"
            "    <string>Borealis Extra</string>\n"
            "    <key>CFBundleDisplayName</key>\n"
            "    <string>Borealis Extra</string>\n"
            "    <key>CFBundlePackageType</key>\n"
            "    <string>APPL</string>\n"
            f"    <key>CFBundleShortVersionString</key>\n"
            f"    <string>{version}</string>\n"
            f"    <key>CFBundleVersion</key>\n"
            f"    <string>{version}</string>\n"
            "    <key>LSMinimumSystemVersion</key>\n"
            "    <string>11.0</string>\n"
            "    <key>NSHighResolutionCapable</key>\n"
            "    <true/>\n"
            "</dict>\n"
            "</plist>\n"
        )
        (contents_dir / "Info.plist").write_text(plist_content, encoding="utf-8")

        # Zip bundle
        zip_target = RELEASES_DIR / "BorealisExtra-osx-arm64.zip"
        with zipfile.ZipFile(zip_target, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(bundle_dir):
                for f in files:
                    full_p = Path(root) / f
                    rel_p = full_p.relative_to(tmp_path)
                    zinfo = zipfile.ZipInfo.from_file(full_p, arcname=str(rel_p))
                    if full_p == app_bin:
                        zinfo.external_attr = 0o755 << 16
                    zf.writestr(zinfo, full_p.read_bytes())

        print(f"  ✓ Created zipped macOS app bundle -> {zip_target.name} ({zip_target.stat().st_size // (1024*1024)} MB)")
        return zip_target


def update_manifest(meta: dict, version: str, artifacts: list[Path]) -> None:
    print("[4/4] Updating release manifest and metadata...")
    tag_name = f"borealisextra-v{version}"
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    files_info = []
    for art in artifacts:
        if art.exists():
            files_info.append({
                "name": art.name,
                "size": art.stat().st_size,
                "md5": compute_md5(art),
                "sha256": compute_sha256(art),
                "downloadUrl": f"https://github.com/{GITHUB_REPO}/releases/download/{tag_name}/{art.name}"
            })

    manifest_entry = {
        "id": meta.get("id", "BorealisExtra"),
        "name": meta.get("name", "Borealis Extra"),
        "version": version,
        "description": meta.get("description", "Borealis desktop game playtime tracker."),
        "releaseDate": timestamp,
        "releaseTag": tag_name,
        "files": files_info
    }

    with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
        json.dump(manifest_entry, f, indent=2)
        f.write("\n")

    print(f"  Manifest written -> {MANIFEST_FILE.relative_to(REPO_ROOT)}")


def publish_github_release(version: str, artifacts: list[Path]):
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("Note: GITHUB_TOKEN not set. Skipping automated GitHub release creation.")
        print(f"Release artifacts are preserved locally in {RELEASES_DIR.relative_to(REPO_ROOT)}/")
        return

    tag_name = f"borealisextra-v{version}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "BorealisExtra-Packager",
    }

    # Check if release tag already exists
    api_url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/tags/{tag_name}"
    req = urllib.request.Request(api_url, headers=headers, method="GET")
    release = None
    try:
        with urllib.request.urlopen(req) as resp:
            release = json.loads(resp.read().decode("utf-8"))
            print(f"Release tag {tag_name} already exists (ID: {release.get('id')}). Updating assets...")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"Release tag {tag_name} does not exist. Creating new GitHub release...")
            create_url = f"https://api.github.com/repos/{GITHUB_REPO}/releases"
            payload = json.dumps({
                "tag_name": tag_name,
                "target_commitish": "main",
                "name": f"Borealis Extra v{version}",
                "body": (
                    f"## Borealis Extra v{version}\n\n"
                    f"Automated release companion for Borealis game playtime tracking.\n\n"
                    f"### Downloads\n"
                    f"- **Windows (x64)**: `BorealisExtra-win-x64.exe` (Standalone 1-file executable)\n"
                    f"- **Linux (x86_64)**: `BorealisExtra-x86_64.AppImage` or `BorealisExtra-linux-x64`\n"
                    f"- **macOS (Apple Silicon)**: `BorealisExtra-osx-arm64.zip`\n\n"
                    f"### Installation on Linux\n"
                    f"```bash\n"
                    f"chmod +x BorealisExtra-x86_64.AppImage\n"
                    f"./BorealisExtra-x86_64.AppImage\n"
                    f"```\n"
                ),
                "draft": False,
                "prerelease": False,
            }).encode("utf-8")
            post_req = urllib.request.Request(
                create_url,
                data=payload,
                headers={**headers, "Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(post_req) as post_res:
                release = json.loads(post_res.read().decode("utf-8"))
                print(f"Release {tag_name} created successfully! (ID: {release.get('id')})")
        else:
            print(f"GitHub API Error: {e}", file=sys.stderr)
            return

    if release and "id" in release:
        release_id = release["id"]
        existing_assets = {a["name"]: a["url"] for a in release.get("assets", [])}

        for art in artifacts:
            if not art.exists():
                continue

            if art.name in existing_assets:
                print(f"  Deleting existing asset {art.name}...")
                del_req = urllib.request.Request(existing_assets[art.name], headers=headers, method="DELETE")
                try:
                    urllib.request.urlopen(del_req)
                except Exception as ex:
                    print(f"  Warning deleting asset: {ex}")

            print(f"  Uploading {art.name} to release {tag_name}...")
            upload_url = f"https://uploads.github.com/repos/{GITHUB_REPO}/releases/{release_id}/assets?name={art.name}"
            with open(art, "rb") as f:
                data = f.read()
            up_req = urllib.request.Request(
                upload_url,
                data=data,
                headers={**headers, "Content-Type": "application/octet-stream"},
                method="POST"
            )
            try:
                with urllib.request.urlopen(up_req) as up_res:
                    print(f"  ✓ Uploaded {art.name} successfully!")
            except Exception as e:
                print(f"  Error uploading {art.name}: {e}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Package BorealisExtra cross-platform binaries and releases.")
    parser.add_argument("--ci", action="store_true", help="Publish to GitHub Releases if GITHUB_TOKEN is present.")
    parser.add_argument("--skip-build", action="store_true", help="Skip dotnet build step.")
    parser.add_argument("--skip-linux", action="store_true", help="Skip Linux builds.")
    parser.add_argument("--skip-windows", action="store_true", help="Skip Windows build.")
    parser.add_argument("--skip-macos", action="store_true", help="Skip macOS build.")
    args = parser.parse_args()

    meta = read_meta()
    version = meta.get("version", "1.0.0")
    print(f"=== Packaging Borealis Extra v{version} ===")

    artifacts = []

    if not args.skip_build:
        if not args.skip_linux:
            linux_raw, appimage = build_linux(version)
            artifacts.extend([linux_raw, appimage])

        if not args.skip_windows:
            win_exe = build_windows(version)
            artifacts.append(win_exe)

        if not args.skip_macos:
            mac_zip = build_macos(version)
            artifacts.append(mac_zip)
    else:
        artifacts = [
            RELEASES_DIR / "BorealisExtra-linux-x64",
            RELEASES_DIR / "BorealisExtra-x86_64.AppImage",
            RELEASES_DIR / "BorealisExtra-win-x64.exe",
            RELEASES_DIR / "BorealisExtra-osx-arm64.zip",
        ]

    update_manifest(meta, version, artifacts)

    if args.ci:
        publish_github_release(version, [a for a in artifacts if a.exists()] + [MANIFEST_FILE])

    print("\n[Done] Borealis Extra packaging complete!")
    print(f"Artifacts output folder: {RELEASES_DIR.relative_to(REPO_ROOT)}/")
    for a in artifacts:
        if a.exists():
            print(f"  - {a.name} ({a.stat().st_size // (1024*1024)} MB)")


if __name__ == "__main__":
    main()
