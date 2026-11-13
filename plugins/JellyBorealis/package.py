#!/usr/bin/env python3
"""
JellyBorealis packaging and manifest generation script.
Builds the Release .dll, packages the zip archive into releases/JellyBorealis/,
computes the MD5 checksum, and updates releases/JellyBorealis/manifest.json
for automated installation in Jellyfin.
"""

import argparse
import base64
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


def build_version_entry(
    version: str,
    checksum: str,
    timestamp: str | None = None,
) -> dict:
    tag_name = f"jellyborealis-v{version}"
    source_url = (
        f"https://github.com/{GITHUB_REPO}/releases/download/{tag_name}/JellyBorealis_v{version}.zip"
    )
    return {
        "version": version,
        "changelog": f"Release v{version} for modern IRIS/Borealis API.",
        "targetAbi": TARGET_ABI,
        "sourceUrl": source_url,
        "checksum": checksum,
        "timestamp": timestamp
        or datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def download_release_asset_md5(release: dict, asset_name: str) -> str | None:
    assets = release.get("assets", [])
    asset = next((a for a in assets if a.get("name") == asset_name), None)
    if not asset or not asset.get("url"):
        return None

    headers = {
        "Accept": "application/octet-stream",
        "User-Agent": "JellyBorealis-Packager",
    }
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(asset["url"], headers=headers, method="GET")
    try:
        hasher = hashlib.md5()
        with urllib.request.urlopen(req, timeout=30) as response:
            while True:
                chunk = response.read(65536)
                if not chunk:
                    break
                hasher.update(chunk)
        return hasher.hexdigest().lower()
    except Exception as e:
        print(f"Warning: Could not download asset {asset_name} for checksum: {e}")
        return None


def update_manifest(
    meta: dict,
    version: str | None,
    zip_path: Path | None,
    checksum: str | None,
    github_releases: dict[str, dict] | None = None,
) -> bool:
    print(f"[3/4] Updating Jellyfin manifest -> {MANIFEST_FILE.relative_to(REPO_ROOT)}...")

    plugin_entry = {
        "guid": meta.get("guid", "f9a4c810-7213-4d43-9821-2e65d8a9b12d"),
        "name": meta.get("name", "JellyBorealis"),
        "description": meta.get("description", "Integrates Jellyfin with Borealis media tracking platform."),
        "overview": meta.get("overview", "Borealis integration plugin for Jellyfin"),
        "owner": meta.get("owner", "rrHakushi"),
        "category": meta.get("category", "General"),
        "imageUrl": f"https://raw.githubusercontent.com/{GITHUB_REPO}/main/plugins/JellyBorealis/thumb.png",
        "versions": [],
    }

    previous_raw = ""
    manifest_data = []
    if MANIFEST_FILE.exists():
        try:
            previous_raw = MANIFEST_FILE.read_text(encoding="utf-8")
            manifest_data = json.loads(previous_raw)
        except Exception as e:
            print(f"Warning: Could not parse existing manifest: {e}. Recreating...")
            manifest_data = []

    if not isinstance(manifest_data, list):
        manifest_data = []

    matched_plugin = next(
        (
            item
            for item in manifest_data
            if isinstance(item, dict) and item.get("guid") == plugin_entry["guid"]
        ),
        None,
    )

    if matched_plugin:
        for key in ("name", "description", "overview", "owner", "category", "imageUrl"):
            matched_plugin[key] = plugin_entry[key]
        existing_versions = matched_plugin.get("versions", [])
    else:
        matched_plugin = plugin_entry
        manifest_data.append(matched_plugin)
        existing_versions = []

    versions_by_ver: dict[str, dict] = {}
    for ver_obj in existing_versions:
        if isinstance(ver_obj, dict) and ver_obj.get("version"):
            versions_by_ver[ver_obj["version"]] = ver_obj

    # Reconcile against live GitHub releases when available
    if github_releases is not None:
        valid_versions = set(github_releases.keys())
        if version and checksum:
            valid_versions.add(version)

        removed = [v for v in list(versions_by_ver.keys()) if v not in valid_versions]
        for v in removed:
            print(f"  Removing stale manifest version v{v} (release not found on GitHub).")
            versions_by_ver.pop(v, None)

        for rel_ver, rel in github_releases.items():
            if rel_ver == version and checksum:
                continue
            if rel_ver not in versions_by_ver:
                asset_name = f"JellyBorealis_v{rel_ver}.zip"
                rel_checksum = download_release_asset_md5(rel, asset_name)
                if rel_checksum:
                    rel_ts = rel.get("published_at") or rel.get("created_at")
                    print(f"  Adding existing GitHub release v{rel_ver} to manifest.")
                    versions_by_ver[rel_ver] = build_version_entry(rel_ver, rel_checksum, rel_ts)

    if version and zip_path and checksum:
        existing_entry = versions_by_ver.get(version)
        preserved_ts = (
            existing_entry.get("timestamp")
            if existing_entry and existing_entry.get("checksum") == checksum
            else None
        )
        new_entry = build_version_entry(version, checksum, preserved_ts)
        versions_by_ver[version] = new_entry
        print(f"  Checksum (MD5): {checksum}")
        print(f"  Target ABI:     {TARGET_ABI}")
        print(f"  Source URL:     {new_entry['sourceUrl']}")

    sorted_versions = sorted(
        versions_by_ver.values(),
        key=lambda item: parse_version(item.get("version", "0")),
        reverse=True,
    )
    matched_plugin["versions"] = sorted_versions

    RELEASES_DIR.mkdir(parents=True, exist_ok=True)
    new_raw = json.dumps(manifest_data, indent=2) + "\n"
    if new_raw == previous_raw:
        print("  Manifest is already up to date.")
        return False

    MANIFEST_FILE.write_text(new_raw, encoding="utf-8")
    print(f"  Manifest updated ({len(sorted_versions)} version(s)).")
    return True


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


def parse_version(version: str) -> tuple[int, ...]:
    parts = []
    for p in version.lstrip("v").split("."):
        digits = "".join(ch for ch in p if ch.isdigit())
        parts.append(int(digits) if digits else 0)
    return tuple(parts)


def fetch_github_releases(tag_prefix: str) -> dict[str, dict] | None:
    api_url = f"https://api.github.com/repos/{GITHUB_REPO}/releases?per_page=100"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "JellyBorealis-Packager",
    }
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(api_url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            releases = json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"Warning: Could not check existing GitHub releases: {e}")
        return None

    prefix = f"{tag_prefix}-v"
    result: dict[str, dict] = {}
    for rel in releases:
        if rel.get("draft"):
            continue
        tag = rel.get("tag_name", "")
        if tag.startswith(prefix):
            ver_str = tag[len(prefix):]
            result[ver_str] = rel
    return result


def get_latest_released_version(
    tag_prefix: str,
    github_releases: dict[str, dict] | None = None,
) -> str | None:
    releases = (
        github_releases
        if github_releases is not None
        else fetch_github_releases(tag_prefix)
    )
    if not releases:
        return None
    versions = sorted(
        ((parse_version(ver_str), ver_str) for ver_str in releases.keys()),
        key=lambda item: item[0],
        reverse=True,
    )
    return versions[0][1]


def push_manifest_to_github() -> None:
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("Note: GITHUB_TOKEN not set. Skipping manifest push to GitHub.")
        return

    if not MANIFEST_FILE.exists():
        return

    local_bytes = MANIFEST_FILE.read_bytes()
    manifest_rel_path = MANIFEST_FILE.relative_to(REPO_ROOT).as_posix()
    api_url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{manifest_rel_path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "JellyBorealis-Packager",
    }

    remote_sha = None
    get_req = urllib.request.Request(f"{api_url}?ref=main", headers=headers, method="GET")
    try:
        with urllib.request.urlopen(get_req, timeout=15) as response:
            remote_data = json.loads(response.read().decode("utf-8"))
            remote_sha = remote_data.get("sha")
            remote_content = base64.b64decode(remote_data.get("content", ""))
            if remote_content == local_bytes:
                print("Remote manifest.json on main is already up to date.")
                return
    except urllib.error.HTTPError as e:
        if e.code != 404:
            print(f"GitHub API Error fetching manifest.json: {e}", file=sys.stderr)
            return
    except Exception as e:
        print(f"Error checking remote manifest.json: {e}", file=sys.stderr)
        return

    payload: dict = {
        "message": "chore(jellyborealis): update release manifest [skip ci]",
        "content": base64.b64encode(local_bytes).decode("ascii"),
        "branch": "main",
    }
    if remote_sha:
        payload["sha"] = remote_sha

    put_req = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={**headers, "Content-Type": "application/json"},
        method="PUT",
    )
    try:
        with urllib.request.urlopen(put_req, timeout=15) as put_res:
            print("Pushed updated manifest.json to main!")
    except Exception as e:
        print(f"Error pushing manifest.json to GitHub: {e}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Package JellyBorealis plugin for Jellyfin release.")
    parser.add_argument("--ci", action="store_true", help="Run CI checks and publish to GitHub Releases if GITHUB_TOKEN is present.")
    parser.add_argument("--skip-build", action="store_true", help="Skip dotnet build step.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing release asset if it already exists.")
    args = parser.parse_args()

    meta = read_meta()
    version = meta.get("version", "2.0.0.0")

    github_releases = fetch_github_releases("jellyborealis")
    latest_released = get_latest_released_version("jellyborealis", github_releases)
    already_released = (
        not args.overwrite
        and latest_released is not None
        and parse_version(version) <= parse_version(latest_released)
    )

    zip_path: Path | None = None
    if already_released:
        print(
            f"JellyBorealis v{version} is already released (latest: v{latest_released}). "
            "Skipping build and release upload; reconciling manifest..."
        )
        update_manifest(meta, None, None, None, github_releases)
    else:
        if not args.skip_build:
            build_plugin()

        zip_path = create_release_zip(version)
        checksum = compute_md5(zip_path)
        update_manifest(meta, version, zip_path, checksum, github_releases)

        if args.ci:
            publish_github_release(version, zip_path, overwrite=args.overwrite)

    if args.ci:
        push_manifest_to_github()

    print("\n[Done] Release packaging completed successfully!")
    if zip_path:
        print(f"  Artifact: {zip_path}")
    print(f"  Manifest: {MANIFEST_FILE}")


if __name__ == "__main__":
    main()
