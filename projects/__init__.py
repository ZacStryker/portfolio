import importlib
import pkgutil

PROJECT_REGISTRY = []


def discover_and_register(app):
    for importer, module_name, is_pkg in pkgutil.iter_modules(__path__):
        if not is_pkg:
            continue

        module = importlib.import_module(f'{__name__}.{module_name}')

        if hasattr(module, 'bp') and hasattr(module, 'PROJECT_META'):
            app.register_blueprint(module.bp)
            PROJECT_REGISTRY.append(module.PROJECT_META)

    _group_order = {'Machine Learning': 0, 'Data & Visualization': 1}
    PROJECT_REGISTRY.sort(key=lambda p: (_group_order.get(p.get('nav_group', ''), 99), p['name']))
