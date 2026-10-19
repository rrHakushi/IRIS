#!/usr/bin/env python3
"""
JellyBorealis packaging and manifest generation script.
Builds the Release .dll, packages the zip archive into releases/JellyBorealis/,
computes the MD5 checksum, and updates releases/JellyBorealis/manifest.json
for automated installation in Jellyfin.
"""

import argparse
import datetime
import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

PLUGIN_DIR = Path(__file__).resolve().parent
REPO_ROOT = PLUGIN_DIR.parent.parent
RELEASES_DIR = REPO_ROOT / "releases" / "JellyBorealis"
CSPROJ_FILE = PLUGIN_DIR / "Jellyfin.Plugin.Borealis.csproj"
META_FILE = PLUGIN_DIR / "meta.json"
THUMB_FILE = PLUGIN_DIR / "thumb.png"
MANIFEST_FILE = RELEASES_DIR / "manifest.json"

GITHUB_REPO = "rrHakushi/IRIS"
TARGET_ABI = "10.11.11.0"


def read_meta():
    if not META_FILE.exists():
        raise FileNotFoundError(f"meta.json not found at {META_FILE}")
    with open(META_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def build_plugin():
    print("[1/4] Building Jellyfin.Plugin.Borealis (Release)...")
    cmd = ["dotnet", "build", str(CSPROJ_FILE), "-c", "Release"]
    result = subprocess.run(cmd, cwd=str(REPO_ROOT), check=False)
    if result.returncode != 0:
        print("Error: dotnet build failed", file=sys.stderr)
        sys.exit(result.returncode)


def create_release_zip(version: str) -> Path:
    import zipfile

    bin_dir = PLUGIN_DIR / "bin" / "Release" / "net10.0"
    if not bin_dir.exists():
        bin_dir = PLUGIN_DIR / "bin" / "Release" / "net9.0"
    dll_file = bin_dir / "Jellyfin.Plugin.Borealis.dll"
    if not dll_file.exists():
        raise FileNotFoundError(f"Compiled dll not found at {dll_file}")

    RELEASES_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = RELEASES_DIR / f"JellyBorealis_v{version}.zip"

    print(f"[2/4] Packaging release zip -> {zip_path.relative_to(REPO_ROOT)}...")
    # Normalize zip timestamps and file permissions for reproducible/deterministic checksums
    fixed_dt = (2026, 1, 1, 0, 0, 0)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for file_path, arcname in [
            (dll_file, "Jellyfin.Plugin.Borealis.dll"),
            (META_FILE, "meta.json"),
            (THUMB_FILE, "thumb.png"),
        ]:
            if file_path.exists():
                zinfo = zipfile.ZipInfo(filename=arcname, date_time=fixed_dt)
                zinfo.compress_type = zipfile.ZIP_DEFLATED
                zinfo.external_attr = 0o644 << 16
                with open(file_path, "rb") as f:
                    zf.writestr(zinfo, f.read())

    return zip_path


def compute_md5(file_path: Path) -> str:
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest().lower()


def update_manifest(meta: dict, version: str, zip_path: Path, checksum: str) -> None:
    print(f"[3/4] Updating Jellyfin manifest -> {MANIFEST_FILE.relative_to(REPO_ROOT)}...")

    tag_name = f"jellyborealis-v{version}"
    source_url = f"https://github.com/{GITHUB_REPO}/releases/download/{tag_name}/{zip_path.name}"
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    version_entry = {
        "version": version,
        "changelog": f"Release v{version} for modern IRIS/Borealis API.",
        "targetAbi": TARGET_ABI,
        "sourceUrl": source_url,
        "checksum": checksum,
        "timestamp": timestamp,
    }

    plugin_entry = {
        "guid": meta.get("guid", "f9a4c810-7213-4d43-9821-2e65d8a9b12d"),
        "name": meta.get("name", "JellyBorealis"),
        "description": meta.get("description", "Integrates Jellyfin with Borealis media tracking platform."),
        "overview": meta.get("overview", "Borealis integration plugin for Jellyfin"),
        "owner": meta.get("owner", "rrHakushi"),
        "category": meta.get("category", "General"),
        "imageUrl": f"https://raw.githubusercontent.com/{GITHUB_REPO}/main/plugins/JellyBorealis/thumb.png",
        "versions": [version_entry],
    }

    manifest_data = []
    if MANIFEST_FILE.exists():
        try:
            with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
                manifest_data = json.load(f)
        except Exception as e:
            print(f"Warning: Could not parse existing manifest: {e}. Recreating...")
            manifest_data = []

    if not isinstance(manifest_data, list):
        manifest_data = []

    # Find existing plugin by guid or name
    matched_plugin = None
    for item in manifest_data:
        if isinstance(item, dict) and item.get("guid") == plugin_entry["guid"]:
            matched_plugin = item
            break

    if matched_plugin:
        # Update metadata fields
        matched_plugin["name"] = plugin_entry["name"]
        matched_plugin["description"] = plugin_entry["description"]
        matched_plugin["overview"] = plugin_entry["overview"]
        matched_plugin["owner"] = plugin_entry["owner"]
        matched_plugin["category"] = plugin_entry["category"]
        matched_plugin["imageUrl"] = plugin_entry["imageUrl"]

        versions_list = matched_plugin.get("versions", [])
        updated = False
        for idx, ver in enumerate(versions_list):
            if isinstance(ver, dict) and ver.get("version") == version:
                if ver.get("checksum") == checksum and "timestamp" in ver:
                    version_entry["timestamp"] = ver["timestamp"]
                versions_list[idx] = version_entry
                updated = True
                break

        if not updated:
            versions_list.insert(0, version_entry)
        matched_plugin["versions"] = versions_list
    else:
        manifest_data.append(plugin_entry)

    with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)
        f.write("\n")

    print(f"  Checksum (MD5): {checksum}")
    print(f"  Target ABI:     {TARGET_ABI}")
    print(f"  Source URL:     {source_url}")


def publish_github_release(version: str, zip_path: Path, overwrite: bool = False):
    print("[4/4] Checking GitHub release...")
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("Note: GITHUB_TOKEN not set. Skipping automated GitHub release creation.")
        print(f"To create the release manually, upload {zip_path.name} to tag jellyborealis-v{version} on GitHub.")
        return

    tag_name = f"jellyborealis-v{version}"
    api_url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/tags/{tag_name}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "JellyBorealis-Packager",
    }

    req = urllib.request.Request(api_url, headers=headers, method="GET")
    release = None
    try:
        with urllib.request.urlopen(req) as response:
            release = json.loads(response.read().decode("utf-8"))
            print(f"Release {tag_name} already exists (ID: {release.get('id')}).")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            # Create release
            print(f"Creating new GitHub release {tag_name}...")
            create_url = f"https://api.github.com/repos/{GITHUB_REPO}/releases"
            payload = json.dumps({
                "tag_name": tag_name,
                "target_commitish": "main",
                "name": f"JellyBorealis v{version}",
                "body": (
                    f"## JellyBorealis v{version}\n\n"
                    f"Automated release for Jellyfin server compatibility (minimum ABI {TARGET_ABI}).\n\n"
                    f"### Installation via Jellyfin Dashboard\n"
                    f"Add repository URL in **Dashboard -> Plugins -> Repositories**:\n"
                    f"```\n"
                    f"https://raw.githubusercontent.com/{GITHUB_REPO}/main/releases/JellyBorealis/manifest.json\n"
                    f"```\n"
                    f"Then find **JellyBorealis** in the Plugin Catalog and click Install."
                ),
                "draft": False,
                "prerelease": False,
            }).encode("utf-8")
            post_req = urllib.request.Request(
                create_url,
                data=payload,
                headers={**headers, "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(post_req) as post_res:
                release = json.loads(post_res.read().decode("utf-8"))
                print(f"Release created successfully! (ID: {release.get('id')})")
        else:
            print(f"GitHub API Error checking release: {e}", file=sys.stderr)
            return

    if release and "id" in release:
        release_id = release["id"]
        # Check if asset already uploaded
        assets = release.get("assets", [])
        existing_asset = next((a for a in assets if a.get("name") == zip_path.name), None)
        if existing_asset:
            if not overwrite:
                print(f"Asset {zip_path.name} already exists on release {tag_name}. Skipping re-upload to preserve checksum (pass --overwrite to force).")
                return
            print(f"Asset {zip_path.name} already exists on release {tag_name}. Deleting previous asset...")
            del_req = urllib.request.Request(
                existing_asset["url"],
                headers=headers,
                method="DELETE",
            )
            try:
                urllib.request.urlopen(del_req)
            except Exception as ex:
                print(f"Warning: could not delete existing asset: {ex}")

        print(f"Uploading {zip_path.name} to release {tag_name}...")
        upload_url = f"https://uploads.github.com/repos/{GITHUB_REPO}/releases/{release_id}/assets?name={zip_path.name}"
        with open(zip_path, "rb") as zf:
            zip_bytes = zf.read()
        upload_req = urllib.request.Request(
            upload_url,
            data=zip_bytes,
            headers={**headers, "Content-Type": "application/zip"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(upload_req) as up_res:
                print("Asset uploaded successfully!")
        except Exception as e:
            print(f"Error uploading release asset: {e}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Package JellyBorealis plugin for Jellyfin release.")
    parser.add_argument("--ci", action="store_true", help="Run CI checks and publish to GitHub Releases if GITHUB_TOKEN is present.")
    parser.add_argument("--skip-build", action="store_true", help="Skip dotnet build step.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing release asset if it already exists.")
    args = parser.parse_args()

    meta = read_meta()
    version = meta.get("version", "2.0.0.0")

    if not args.skip_build:
        build_plugin()

    zip_path = create_release_zip(version)
    checksum = compute_md5(zip_path)
    update_manifest(meta, version, zip_path, checksum)

    if args.ci:
        publish_github_release(version, zip_path, overwrite=args.overwrite)

    print("\n[Done] Release packaging completed successfully!")
    print(f"  Artifact: {zip_path}")
    print(f"  Manifest: {MANIFEST_FILE}")


if __name__ == "__main__":
    main()
