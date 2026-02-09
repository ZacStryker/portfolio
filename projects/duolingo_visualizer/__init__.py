import json
from pathlib import Path

from flask import Blueprint, render_template, jsonify

PROJECT_META = {
    'id': 'duolingo-visualizer',
    'name': 'Duolingo Visualizer',
    'description': 'Interactive dashboard visualizing Dutch language learning progress from Duolingo, with stats and charts.',
    'icon': 'language',
    'color': '#58cc02',
    'category': 'Data Visualization',
    'nav_group': 'Data & Visualization',
    'tags': ['chart.js', 'data visualization', 'duolingo'],
}

bp = Blueprint(
    'duolingo_visualizer',
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='static',
    url_prefix='/duolingo-visualizer',
)

_DATA_PATH = Path(__file__).resolve().parent / 'data' / 'duolingo-progress.json'


@bp.route('/')
def index():
    return render_template('duolingo_visualizer/index.html')


@bp.route('/api/data')
def data():
    with open(_DATA_PATH) as f:
        return jsonify(json.load(f))
