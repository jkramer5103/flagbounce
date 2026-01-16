from gtts import gTTS
from pathlib import Path

def generate_event_tts():
    """Generate TTS audio files for special game events"""
    tts_dir = Path("./assets/tts")
    tts_dir.mkdir(parents=True, exist_ok=True)
    
    # Define special event messages
    events = {
        # Remaining countries milestones
        "100_remaining": "Half are out!",
        "50_remaining": "Only 50 Are Left!",
        "15_remaining": "Only 15 countries left! The tension is rising!",
        "3_remaining": "Down to the final 3!",
        
        # Win streaks
        "2_streak": "2 wins in a row! Unstoppable!",
        "3_streak": "3 wins in a row! Dominating!",
        "5_streak": "5 wins in a row! Legendary!",
        
        # Exciting moments
        "intense_round": "What an intense round!",
        "nail_biter": "That was a nail biter!",
        "spectacular": "Spectacular performance!",
        "unbelievable": "Unbelievable!",
        "amazing": "Amazing!",
        "incredible": "Incredible victory!",
        
        # Champion celebration (4 wins)
        "champion": "We have a champion! 4 victories! Absolutely dominant performance! This country has proven themselves the ultimate champion!",
    }
    
    print(f"Generating {len(events)} TTS audio files...")
    
    for filename, text in events.items():
        output_path = tts_dir / f"{filename}.mp3"
        
        try:
            print(f"Generating: {filename}.mp3 - '{text}'")
            tts = gTTS(text=text, lang='en', slow=False)
            tts.save(str(output_path))
            print(f"✓ Saved: {output_path}")
        except Exception as e:
            print(f"✗ Failed to generate {filename}.mp3: {e}")
    
    print(f"\n✓ Successfully generated {len(events)} event TTS files in {tts_dir}")

if __name__ == "__main__":
    generate_event_tts()
