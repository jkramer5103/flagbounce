from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)

MUSIC_DIR = os.path.join(os.path.dirname(__file__), 'assets', 'music')
COUNTRIES_FILE = os.path.join(os.path.dirname(__file__), 'assets', 'countries.json')

# Shared game state (in-memory, resets on server restart)
game_state = {
    'command': None,  # Commands to send to game: 'reset', 'new_round', 'skip_track', 'toggle_music'
    'volume': 30,
    'music_playing': True,
    'total_rounds': 0,
    'leaderboard': {},
    'rigged_country': None  # Country code that will be guaranteed to win
}

@app.route('/api/music', methods=['GET'])
def get_music_list():
    """Return list of all music files in assets/music folder"""
    try:
        if not os.path.exists(MUSIC_DIR):
            return jsonify({'error': 'Music directory not found'}), 404
        
        music_files = []
        for filename in os.listdir(MUSIC_DIR):
            if filename.endswith(('.mp3', '.wav', '.ogg', '.m4a')):
                music_files.append(f'assets/music/{filename}')
        
        return jsonify({'tracks': music_files})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================
# Admin API Endpoints
# ============================================

@app.route('/api/admin/ping', methods=['GET'])
def admin_ping():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

@app.route('/api/admin/reset', methods=['POST'])
def admin_reset():
    """Reset the current game round"""
    game_state['command'] = 'reset'
    return jsonify({'success': True, 'message': 'Reset command sent'})

@app.route('/api/admin/new-round', methods=['POST'])
def admin_new_round():
    """Force a new round"""
    game_state['command'] = 'new_round'
    game_state['total_rounds'] += 1
    return jsonify({'success': True, 'message': 'New round command sent'})

@app.route('/api/admin/clear-leaderboard', methods=['POST'])
def admin_clear_leaderboard():
    """Clear the leaderboard"""
    game_state['leaderboard'] = {}
    game_state['command'] = 'clear_leaderboard'
    return jsonify({'success': True, 'message': 'Leaderboard cleared'})

@app.route('/api/admin/skip-track', methods=['POST'])
def admin_skip_track():
    """Skip the current music track"""
    game_state['command'] = 'skip_track'
    return jsonify({'success': True, 'message': 'Skip track command sent'})

@app.route('/api/admin/toggle-music', methods=['POST'])
def admin_toggle_music():
    """Toggle music play/pause"""
    game_state['music_playing'] = not game_state['music_playing']
    game_state['command'] = 'toggle_music'
    return jsonify({'success': True, 'playing': game_state['music_playing']})

@app.route('/api/admin/volume', methods=['POST'])
def admin_set_volume():
    """Set music volume"""
    data = request.get_json()
    if data and 'volume' in data:
        game_state['volume'] = max(0, min(100, int(data['volume'])))
        game_state['command'] = 'set_volume'
        return jsonify({'success': True, 'volume': game_state['volume']})
    return jsonify({'success': False, 'error': 'Volume not provided'}), 400

@app.route('/api/admin/leaderboard', methods=['GET'])
def admin_get_leaderboard():
    """Get current leaderboard"""
    return jsonify({'leaderboard': game_state['leaderboard']})

@app.route('/api/admin/leaderboard', methods=['POST'])
def admin_update_leaderboard():
    """Update leaderboard from game client"""
    data = request.get_json()
    if data and 'leaderboard' in data:
        game_state['leaderboard'] = data['leaderboard']
        return jsonify({'success': True})
    return jsonify({'success': False}), 400

@app.route('/api/admin/leaderboard/update', methods=['POST'])
def admin_update_score():
    """Update a specific country's score"""
    data = request.get_json()
    if data and 'code' in data and 'wins' in data:
        code = data['code']
        wins = int(data['wins'])
        
        if code in game_state['leaderboard']:
            game_state['leaderboard'][code]['wins'] = wins
            game_state['command'] = 'sync_leaderboard'
            return jsonify({'success': True, 'message': f'Updated {code} to {wins} wins'})
        else:
            return jsonify({'success': False, 'error': 'Country not found in leaderboard'}), 404
    return jsonify({'success': False, 'error': 'Invalid data'}), 400

@app.route('/api/admin/leaderboard/delete', methods=['POST'])
def admin_delete_score():
    """Delete a specific country from the leaderboard"""
    data = request.get_json()
    if data and 'code' in data:
        code = data['code']
        
        if code in game_state['leaderboard']:
            del game_state['leaderboard'][code]
            game_state['command'] = 'sync_leaderboard'
            return jsonify({'success': True, 'message': f'Deleted {code} from leaderboard'})
        else:
            return jsonify({'success': False, 'error': 'Country not found in leaderboard'}), 404
    return jsonify({'success': False, 'error': 'Invalid data'}), 400

@app.route('/api/admin/stats', methods=['GET'])
def admin_get_stats():
    """Get game statistics"""
    total_countries = 0
    try:
        if os.path.exists(COUNTRIES_FILE):
            with open(COUNTRIES_FILE, 'r', encoding='utf-8') as f:
                countries = json.load(f)
                total_countries = len(countries)
    except:
        pass
    
    return jsonify({
        'totalRounds': game_state['total_rounds'],
        'totalCountries': total_countries,
        'musicPlaying': game_state['music_playing'],
        'volume': game_state['volume']
    })

@app.route('/api/admin/command', methods=['GET'])
def admin_get_command():
    """Get pending command for game client (polling endpoint)"""
    command = game_state['command']
    volume = game_state['volume']
    # Clear command after reading
    game_state['command'] = None
    return jsonify({
        'command': command,
        'volume': volume,
        'musicPlaying': game_state['music_playing'],
        'riggedCountry': game_state['rigged_country']
    })

@app.route('/api/admin/rig', methods=['POST'])
def admin_set_rigged():
    """Set a country to be guaranteed winner"""
    data = request.get_json()
    if data and 'code' in data:
        game_state['rigged_country'] = data['code'] if data['code'] else None
        return jsonify({'success': True, 'riggedCountry': game_state['rigged_country']})
    return jsonify({'success': False, 'error': 'Country code not provided'}), 400

@app.route('/api/admin/rig', methods=['GET'])
def admin_get_rigged():
    """Get current rigged country"""
    return jsonify({'riggedCountry': game_state['rigged_country']})

@app.route('/api/admin/round-complete', methods=['POST'])
def admin_round_complete():
    """Called by game when a round completes"""
    game_state['total_rounds'] += 1
    data = request.get_json()
    if data and 'winner' in data:
        code = data['winner']['code']
        name = data['winner']['name']
        if code not in game_state['leaderboard']:
            game_state['leaderboard'][code] = {'name': name, 'wins': 0}
        game_state['leaderboard'][code]['wins'] += 1
    return jsonify({'success': True})

# ============================================
# Static file serving
# ============================================

@app.route('/')
def index():
    """Serve the main HTML file"""
    return send_from_directory('.', 'index.html')

@app.route('/admin')
def admin():
    """Serve the admin panel"""
    return send_from_directory('.', 'admin.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('.', path)

if __name__ == '__main__':
    app.run(debug=True, port=5000, host="0.0.0.0")
