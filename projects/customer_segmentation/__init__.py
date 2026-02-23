from flask import Blueprint, render_template

PROJECT_META = {
    'id': 'customer-segmentation',
    'name': 'Customer Segmentation',
    'description': 'Interactive K-means++ clustering with RFM analysis, animated convergence, and silhouette scoring.',
    'icon': 'scatter_plot',
    'color': '#00d4ff',
    'category': 'Unsupervised Clustering',
    'nav_group': 'Machine Learning',
    'tags': ['k-means++', 'clustering', 'rfm analysis'],
}

bp = Blueprint(
    'customer_segmentation',
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='static',
    url_prefix='/customer-segmentation',
)


@bp.route('/')
def index():
    return render_template('customer_segmentation/index.html')
