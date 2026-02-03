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
