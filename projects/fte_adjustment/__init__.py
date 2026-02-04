from flask import Blueprint, render_template

PROJECT_META = {
    'id': 'fte-adjustment',
    'name': 'FTE Adjustment Model',
    'description': 'A four-phase algorithm for modeling productivity ramps during employee leave, with SQL implementation and interactive charts.',
    'icon': 'calculate',
    'color': '#3498db',
    'category': 'Data Analysis',
    'tags': ['sql', 'capacity planning', 'chart.js'],
}

bp = Blueprint(
    'fte_adjustment',
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='static',
    url_prefix='/fte-adjustment',
)


@bp.route('/')
def index():
    return render_template('fte_adjustment/index.html')
