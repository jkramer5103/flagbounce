# Flag Bounce Game

A physics-based flag race game with dynamic background music.

## Running the Game

1. Install dependencies:
```bash
uv sync
```

2. Start the Flask server:
```bash
uv run python server.py
```

3. Open your browser and navigate to:
```
http://localhost:5000
```

## Adding Music

Simply add any `.mp3`, `.wav`, `.ogg`, or `.m4a` files to the `assets/music/` folder. The game will automatically detect and play them randomly - no code changes needed!

## Features

- Dynamic background music that automatically loads all songs from `assets/music/`
- Random song selection on start and when songs end
- Flask backend for dynamic music file discovery
