from flask import Flask, render_template
from projects import discover_and_register, PROJECT_REGISTRY


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

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
