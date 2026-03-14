"""
Starfish - Video Upload Script

Usage:
  python upload.py video.mp4
  python upload.py video1.mp4 video2.mp4
  python upload.py *.mp4

Requires: pip install boto3 python-dotenv
Configure: scripts/.env (see .env.example)
"""

import os
import sys
import threading
import boto3
from pathlib import Path
from dotenv import load_dotenv

# Load .env from same directory as this script
load_dotenv(Path(__file__).parent / ".env")

R2_ACCOUNT_ID = os.environ["R2_ACCOUNT_ID"]
R2_ACCESS_KEY = os.environ["R2_ACCESS_KEY"]
R2_SECRET_KEY = os.environ["R2_SECRET_KEY"]
BUCKET_NAME = os.environ.get("R2_BUCKET_NAME", "starfish-videos")


class ProgressBar:
    def __init__(self, filename, total_size):
        self.filename = filename
        self.total = total_size
        self.uploaded = 0
        self.lock = threading.Lock()

    def __call__(self, bytes_transferred):
        with self.lock:
            self.uploaded += bytes_transferred
            pct = self.uploaded / self.total * 100
            bar_len = 30
            filled = int(bar_len * self.uploaded / self.total)
            bar = "=" * filled + "-" * (bar_len - filled)
            size_mb = self.total / 1048576
            done_mb = self.uploaded / 1048576
            sys.stdout.write(
                f"\r  [{bar}] {pct:5.1f}%  {done_mb:.1f}/{size_mb:.1f} MB"
            )
            sys.stdout.flush()
            if self.uploaded >= self.total:
                print()


def create_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
        region_name="auto",
    )


CONTENT_TYPES = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".m4v": "video/x-m4v",
}


def upload_file(client, file_path):
    path = Path(file_path)
    if not path.exists():
        print(f"  File not found: {file_path}")
        return False

    key = path.name
    size = path.stat().st_size
    ext = path.suffix.lower()
    content_type = CONTENT_TYPES.get(ext, "application/octet-stream")

    print(f"Uploading: {key} ({size / 1048576:.1f} MB)")
    progress = ProgressBar(key, size)

    # boto3 automatically uses multipart upload for large files
    client.upload_file(
        str(path),
        BUCKET_NAME,
        key,
        ExtraArgs={"ContentType": content_type},
        Callback=progress,
        Config=boto3.s3.transfer.TransferConfig(
            multipart_threshold=8 * 1024 * 1024,  # 8MB
            multipart_chunksize=8 * 1024 * 1024,
            max_concurrency=4,
        ),
    )
    print(f"  Done: {key}")
    return True


def list_videos(client):
    print(f"\nVideos in {BUCKET_NAME}:")
    print("-" * 60)
    response = client.list_objects_v2(Bucket=BUCKET_NAME)
    if "Contents" not in response:
        print("  (empty)")
        return
    for obj in sorted(response["Contents"], key=lambda x: x["LastModified"], reverse=True):
        size_mb = obj["Size"] / 1048576
        print(f"  {obj['Key']:<40} {size_mb:>8.1f} MB")


def delete_video(client, key):
    client.delete_object(Bucket=BUCKET_NAME, Key=key)
    print(f"Deleted: {key}")


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python upload.py <file1> [file2] ...   Upload videos")
        print("  python upload.py --list                 List uploaded videos")
        print("  python upload.py --delete <key>         Delete a video")
        sys.exit(1)

    client = create_client()

    if sys.argv[1] == "--list":
        list_videos(client)
    elif sys.argv[1] == "--delete" and len(sys.argv) >= 3:
        delete_video(client, sys.argv[2])
    else:
        for f in sys.argv[1:]:
            upload_file(client, f)
        print(f"\nAll uploads complete.")


if __name__ == "__main__":
    main()
