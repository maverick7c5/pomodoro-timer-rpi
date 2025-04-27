# === OPTIMIZED Flask Backend for Pomodoro Timer ===

from flask import Flask, render_template, jsonify, request
import time
import threading
import os
from werkzeug.utils import secure_filename

# === Config ===
app = Flask(__name__)
app.config.update(
    UPLOAD_FOLDER='static/uploads',
    MAX_CONTENT_LENGTH=20 * 1024 * 1024,
    ALLOWED_EXTENSIONS={'png', 'jpg', 'jpeg', 'gif'},
    DEFAULT_BACKGROUND="su-san-lee-E_eWwM29wfU-unsplash.jpg"
)
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('static/sounds', exist_ok=True)
os.makedirs('static/default_backgrounds', exist_ok=True)

# === Timer State ===
class TimerState:
    def __init__(self):
        self.lock = threading.Lock()
        self.reset()
        self.background_image = app.config['DEFAULT_BACKGROUND']

    def reset(self):
        self.remaining_time = 25 * 0.1
        self.mode = "pomodoro"
        self.pomodoro_count = 0
        self.running = False
        self.last_update = time.time()

    def to_dict(self):
        return {
            'remaining_time': self.remaining_time,
            'is_running': self.running,
            'current_mode': self.mode,
            'pomodoro_count': self.pomodoro_count,
            'background_image': self.background_image,
            'should_play_sound': False
        }

state = TimerState()

# === Helpers ===
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def start_timer():
    def run():
        while state.running:
            with state.lock:
                now = time.time()
                if now - state.last_update >= 1:
                    state.remaining_time -= 1
                    state.last_update = now
                    if state.remaining_time <= 0:
                        if state.mode == "pomodoro":
                            state.pomodoro_count += 1
                            state.mode = "long_break" if state.pomodoro_count % 4 == 0 else "short_break"
                            state.remaining_time = 15 * 0.1 if state.mode == "long_break" else 5 * 0.1
                        else:
                            state.mode = "pomodoro"
                            state.remaining_time = 25 * 0.1
                        state.last_update = time.time()
            time.sleep(0.1)

    threading.Thread(target=run, daemon=True).start()

# === Routes ===
@app.route('/')
def index():
    return render_template('index.html', background_image=state.background_image)

@app.route('/status')
def status():
    with state.lock:
        return jsonify(state.to_dict())

@app.route('/start')
def start():
    with state.lock:
        if not state.running:
            state.running = True
            state.last_update = time.time()
            start_timer()
    return jsonify(status="ok")

@app.route('/pause')
def pause():
    with state.lock:
        state.running = False
    return jsonify(status="ok")

@app.route('/reset')
def reset():
    with state.lock:
        state.reset()
    return jsonify(status="ok")

@app.route('/switch_to_short_break', methods=['POST'])
def short_break():
    with state.lock:
        state.mode = "short_break"
        state.remaining_time = 5 * 0.1
    return jsonify(status="ok")

@app.route('/switch_to_long_break', methods=['POST'])
def long_break():
    with state.lock:
        state.mode = "long_break"
        state.remaining_time = 15 * 0.1
    return jsonify(status="ok")

@app.route('/switch_to_pomodoro', methods=['POST'])
def switch_to_pomodoro():
    with state.lock:
        if state.mode in ["short_break", "long_break"]:
            state.mode = "pomodoro"
            state.remaining_time = 25 * 0.1
            if state.running:
                state.last_update = time.time()
    return jsonify(status="ok")

@app.route('/upload', methods=['POST'])
def upload():
    file = request.files.get('background')
    if not file or file.filename == '' or not allowed_file(file.filename):
        return jsonify({'error': 'Invalid or missing file'}), 400

    filename = secure_filename(file.filename)
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
    state.background_image = filename
    return jsonify(success=True, filename=filename)

@app.route('/remove_background', methods=['POST'])
def remove_background():
    if state.background_image:
        path = os.path.join(app.config['UPLOAD_FOLDER'], state.background_image)
        if os.path.exists(path):
            os.remove(path)
        state.background_image = None
    return jsonify(status="ok")

# === Run App ===
if __name__ == '__main__':
    print("Pomodoro timer running...")
    # app.run(debug=True)
