from flask import Flask, render_template, abort
from projects import discover_and_register, PROJECT_REGISTRY

BLOG_POSTS = [
    {
        'slug': 'bi-to-ml-engineering',
        'title': 'From BI Dashboards to ML Pipelines: Changing Career Tracks',
        'date': '2026-02-03',
        'summary': 'Reflections on transitioning from business intelligence to machine learning engineering, and why the jump is smaller than you think.',
    },
]


def create_app():
    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

    discover_and_register(app)

    @app.context_processor
    def inject_projects():
        return {'projects': PROJECT_REGISTRY}

    @app.route('/')
    def landing():
        return render_template('landing.html')

    @app.route('/projects/')
    def projects():
        return render_template('home.html')

    @app.route('/resume/')
    def resume():
        return render_template('resume.html')

    @app.route('/about/')
    def about():
        return render_template('about.html')

    @app.route('/contact/')
    def contact():
        return render_template('contact.html')

    @app.route('/blog/')
    def blog():
        return render_template('blog.html', posts=BLOG_POSTS)

    @app.route('/blog/<slug>/')
    def blog_post(slug):
        post = next((p for p in BLOG_POSTS if p['slug'] == slug), None)
        if post is None:
            abort(404)
        return render_template(f'blog/{slug}.html', post=post)

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
