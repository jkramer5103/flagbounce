import subprocess
from pathlib import Path

def download_audio_from_vids():
    music_dir = Path("./assets/music")
    music_dir.mkdir(exist_ok=True)
    
    vids_file = Path("vids.txt")
    
    if not vids_file.exists():
        print("Error: vids.txt not found")
        return
    
    with open(vids_file, 'r') as f:
        urls = [line.strip() for line in f if line.strip()]
    
    if not urls:
        print("No URLs found in vids.txt")
        return
    
    print(f"Found {len(urls)} video(s) to download")
    
    for i, url in enumerate(urls, 1):
        print(f"\n[{i}/{len(urls)}] Downloading: {url}")
        
        try:
            subprocess.run([
                "yt-dlp",
                "-x",
                "--audio-format", "mp3",
                "--no-overwrites",
                "-o", str(music_dir / "%(title)s.%(ext)s"),
                url
            ], check=True)
            print(f"✓ Successfully downloaded: {url}")
        except subprocess.CalledProcessError as e:
            print(f"✗ Failed to download: {url}")
            print(f"  Error: {e}")
        except FileNotFoundError:
            print("Error: yt-dlp not found in PATH")
            return

if __name__ == "__main__":
    download_audio_from_vids()
