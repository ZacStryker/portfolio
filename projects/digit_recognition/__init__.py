from flask import Blueprint, render_template

PROJECT_META = {
    'id': 'digit-recognition',
    'name': 'Digit Recognition',
    'description': 'Draw a digit and watch AI identify it in real-time using a neural network running entirely in your browser.',
    'icon': 'draw',
    'color': '#2563eb',
    'category': 'Computer Vision',
    'tags': ['tensorflow.js', 'neural network', 'canvas'],
}

bp = Blueprint(
    'digit_recognition',
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='static',
    url_prefix='/digit-recognition',
)


@bp.route('/')
def index():
    return render_template('digit_recognition/index.html')
