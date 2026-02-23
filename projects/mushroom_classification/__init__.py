import base64
import io
import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from flask import Blueprint, jsonify, render_template, request
from scipy.stats import chi2_contingency
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, average_precision_score,
                              confusion_matrix, f1_score, precision_recall_curve,
                              precision_score, recall_score, roc_auc_score,
                              roc_curve)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier

PROJECT_META = {
    'id': 'mushroom-classification',
    'name': 'Mushroom Classification',
    'description': 'Binary classification pipeline — edible vs poisonous — with EDA, feature engineering, 4 algorithms, confusion matrix, ROC & PR curves, and feature importance.',
    'icon': 'eco',
    'color': '#10b981',
    'category': 'Supervised Classification',
    'nav_group': 'Machine Learning',
    'tags': ['classification', 'random forest', 'gradient boosting', 'logistic regression', 'decision tree'],
}

bp = Blueprint(
    'mushroom_classification',
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='static',
    url_prefix='/mushroom-classification',
)

_DATA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    'mushrooms.csv',
)

_MODELS = {
    'random_forest': {
        'label': 'Random Forest',
        'estimator': lambda: RandomForestClassifier(n_estimators=100, random_state=42),
    },
    'gradient_boosting': {
        'label': 'Gradient Boosting',
        'estimator': lambda: GradientBoostingClassifier(n_estimators=100, random_state=42),
    },
    'logistic_regression': {
        'label': 'Logistic Regression',
        'estimator': lambda: LogisticRegression(max_iter=1000, random_state=42),
    },
    'decision_tree': {
        'label': 'Decision Tree',
        'estimator': lambda: DecisionTreeClassifier(random_state=42),
    },
}

_cache = {}
_preprocessed = None
_plots_cache = None
_compare_cache = None

# ── Dark theme palette ────────────────────────────────────────────
BG      = '#1e293b'
SURFACE = '#334155'
TEXT    = '#f1f5f9'
MUTED   = '#94a3b8'
GREEN   = '#10b981'
CYAN    = '#00d4ff'
PINK    = '#f472b6'
YELLOW  = '#fbbf24'
RED     = '#ef4444'
PURPLE  = '#a78bfa'


def _fig_to_b64(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', dpi=120,
                facecolor=fig.get_facecolor())
    buf.seek(0)
    encoded = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)
    return encoded


def _setup_style():
    sns.set_theme(style='dark', rc={
        'figure.facecolor': BG, 'axes.facecolor': BG,
        'axes.edgecolor': SURFACE, 'axes.labelcolor': TEXT,
        'xtick.color': MUTED, 'ytick.color': MUTED,
        'text.color': TEXT, 'grid.color': SURFACE,
        'font.family': 'sans-serif',
    })


def _cramers_v(x, y):
    ct = pd.crosstab(x, y).values
    chi2_val = chi2_contingency(ct)[0]
    n = ct.sum()
    phi2 = chi2_val / n
    r, k = ct.shape
    phi2corr = max(0.0, phi2 - ((k - 1) * (r - 1)) / (n - 1))
    rcorr = r - ((r - 1) ** 2) / (n - 1)
    kcorr = k - ((k - 1) ** 2) / (n - 1)
    denom = min(kcorr - 1, rcorr - 1)
    return 0.0 if denom <= 0 else float(np.sqrt(phi2corr / denom))


def _load_and_preprocess():
    global _preprocessed
    if _preprocessed is not None:
        return _preprocessed

    df = pd.read_csv(_DATA_PATH).replace('?', np.nan)

    # Impute missing values with column mode
    for col in df.columns:
        if df[col].isnull().any():
            df[col] = df[col].fillna(df[col].mode()[0])

    # Encode target: e=0 (edible), p=1 (poisonous)
    le_target = LabelEncoder()
    y = le_target.fit_transform(df['class'])

    # Encode all categorical features with LabelEncoder
    X = df.drop(columns=['class'])
    feature_names = list(X.columns)
    X_enc = X.copy()
    for col in X.columns:
        le = LabelEncoder()
        X_enc[col] = le.fit_transform(X[col])
    X_enc = X_enc.values.astype(float)

    X_train, X_test, y_train, y_test = train_test_split(
        X_enc, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    _preprocessed = {
        'X_train':       X_train_s,
        'X_test':        X_test_s,
        'y_train':       y_train,
        'y_test':        y_test,
        'feature_names': feature_names,
        'n_train':       len(X_train),
        'n_test':        len(X_test),
        'class_names':   list(le_target.classes_),
    }
    return _preprocessed


# ── Routes ────────────────────────────────────────────────────────

@bp.route('/')
def index():
    return render_template('mushroom_classification/index.html')


@bp.route('/plots')
def plots():
    global _plots_cache
    if _plots_cache is not None:
        return jsonify(_plots_cache)

    df_raw = pd.read_csv(_DATA_PATH)
    df_imp = df_raw.replace('?', np.nan)
    for col in df_imp.columns:
        if df_imp[col].isnull().any():
            df_imp[col] = df_imp[col].fillna(df_imp[col].mode()[0])

    feature_cols = [c for c in df_imp.columns if c != 'class']
    _setup_style()

    # ── Plot 1: Class balance + unique values ─────────────────────
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 4))

    cc = df_imp['class'].value_counts()
    n_total = len(df_imp)
    class_vals  = [cc.get('e', 0), cc.get('p', 0)]
    class_names = ['Edible', 'Poisonous']
    bars = ax1.bar(class_names, class_vals, color=[GREEN, RED],
                   alpha=0.85, edgecolor='none', width=0.45)
    for bar, v in zip(bars, class_vals):
        ax1.text(bar.get_x() + bar.get_width() / 2,
                 bar.get_height() + 30,
                 f'{v:,}\n({v/n_total*100:.1f}%)',
                 ha='center', va='bottom', color=TEXT, fontsize=10, fontweight='bold')
    ax1.set_title('Class Distribution', color=TEXT, fontsize=12, pad=10)
    ax1.set_ylabel('Count', color=TEXT)
    ax1.tick_params(colors=MUTED)
    ax1.set_facecolor(BG)
    for sp in ax1.spines.values():
        sp.set_visible(False)

    unique_counts = [(df_imp[c].nunique(), c) for c in feature_cols]
    unique_counts.sort(reverse=True)
    ucnts, ucols = zip(*unique_counts)
    bar_colors = [GREEN if i == 0 else CYAN for i in range(len(ucols))]
    ax2.barh(list(ucols), list(ucnts), color=bar_colors, alpha=0.8, edgecolor='none')
    ax2.set_title('Unique Values per Feature', color=TEXT, fontsize=12, pad=10)
    ax2.set_xlabel('# Unique Values', color=TEXT)
    ax2.tick_params(colors=MUTED, labelsize=8)
    ax2.set_facecolor(BG)
    for sp in ax2.spines.values():
        sp.set_visible(False)

    fig.suptitle(f'Dataset Overview  •  {n_total:,} samples  •  {len(feature_cols)} features',
                 color=TEXT, fontsize=13, y=1.02)
    fig.tight_layout()
    describe_b64 = _fig_to_b64(fig)

    # ── Missing values: structured data (no chart) ───────────────
    miss_q = (df_raw == '?').sum()
    miss_q = miss_q[miss_q > 0]
    missing_items = []
    for col, cnt in miss_q.items():
        mode_val = df_imp[col].mode()[0]
        missing_items.append({
            'column':  col,
            'count':   int(cnt),
            'pct':     round(cnt / n_total * 100, 1),
            'mode':    str(mode_val),
        })
    missing_info = {
        'total_rows':   int(n_total),
        'total_cols':   int(len(df_raw.columns)),
        'missing_cols': int(len(miss_q)),
        'clean_cols':   int(len(df_raw.columns) - len(miss_q)),
        'items':        missing_items,
    }

    # ── Plot 3: Feature analysis (top 9, stacked by class) ────────
    top9 = feature_cols[:9]
    fig, axes = plt.subplots(3, 3, figsize=(15, 10))
    axes = axes.flatten()

    for i, col in enumerate(top9):
        ax = axes[i]
        grp = df_imp.groupby([col, 'class']).size().unstack(fill_value=0)
        bottom = np.zeros(len(grp))
        for cls, color, label in [('e', GREEN, 'Edible'), ('p', RED, 'Poisonous')]:
            if cls in grp.columns:
                vals = grp[cls].values
                ax.bar(range(len(grp)), vals, bottom=bottom,
                       color=color, alpha=0.82, edgecolor='none',
                       label=label if i == 0 else '')
                bottom += vals
        ax.set_title(col, color=TEXT, fontsize=9, pad=6)
        ax.set_xticks(range(len(grp)))
        ax.set_xticklabels(grp.index.tolist(), fontsize=7, color=MUTED,
                           rotation=45, ha='right')
        ax.tick_params(axis='y', colors=MUTED, labelsize=7)
        ax.set_facecolor(BG)
        for sp in ax.spines.values():
            sp.set_visible(False)

    for j in range(len(top9), len(axes)):
        axes[j].set_visible(False)

    fig.legend(['Edible', 'Poisonous'], loc='upper right',
               fontsize=9, framealpha=0.15, labelcolor=TEXT)
    fig.suptitle('Feature Analysis — Stacked Distribution by Class (top 9 features)',
                 color=TEXT, fontsize=13, y=1.01)
    fig.tight_layout()
    feature_analysis_b64 = _fig_to_b64(fig)

    # ── Plot 4: Bivariate — top 6 most discriminative features ───
    cv_class = {col: _cramers_v(df_imp[col], df_imp['class']) for col in feature_cols}
    top6 = sorted(cv_class, key=cv_class.get, reverse=True)[:6]

    fig, axes = plt.subplots(2, 3, figsize=(15, 8))
    axes = axes.flatten()

    for i, col in enumerate(top6):
        ax = axes[i]
        ct = pd.crosstab(df_imp[col], df_imp['class'], normalize='index') * 100
        x = range(len(ct))
        w = 0.38
        if 'e' in ct.columns:
            ax.bar([xi - w / 2 for xi in x], ct['e'], width=w,
                   color=GREEN, alpha=0.85, edgecolor='none',
                   label='Edible %' if i == 0 else '')
        if 'p' in ct.columns:
            ax.bar([xi + w / 2 for xi in x], ct['p'], width=w,
                   color=RED, alpha=0.85, edgecolor='none',
                   label='Poisonous %' if i == 0 else '')
        cv = cv_class[col]
        ax.set_title(f'{col}  (V={cv:.2f})', color=TEXT, fontsize=9, pad=6)
        ax.set_xticks(list(x))
        ax.set_xticklabels(ct.index.tolist(), fontsize=7, color=MUTED,
                           rotation=45, ha='right')
        ax.set_ylabel('%', color=MUTED, fontsize=8)
        ax.tick_params(axis='y', colors=MUTED, labelsize=7)
        ax.set_facecolor(BG)
        for sp in ax.spines.values():
            sp.set_visible(False)

    fig.legend(['Edible %', 'Poisonous %'], loc='upper right',
               fontsize=9, framealpha=0.15, labelcolor=TEXT)
    fig.suptitle("Bivariate Analysis — Top 6 Features by Cramér's V vs Class",
                 color=TEXT, fontsize=13, y=1.01)
    fig.tight_layout()
    bivariate_b64 = _fig_to_b64(fig)

    # ── Plot 5: Cramér's V correlation heatmap ────────────────────
    all_cols = feature_cols
    n = len(all_cols)
    cv_mat = np.zeros((n, n))
    for i in range(n):
        cv_mat[i, i] = 1.0
        for j in range(i + 1, n):
            v = _cramers_v(df_imp[all_cols[i]], df_imp[all_cols[j]])
            cv_mat[i, j] = cv_mat[j, i] = v

    cv_df = pd.DataFrame(cv_mat, index=all_cols, columns=all_cols)
    mask  = np.triu(np.ones_like(cv_mat, dtype=bool))

    fig, ax = plt.subplots(figsize=(15, 13))
    sns.heatmap(cv_df, mask=mask, ax=ax,
                cmap='RdYlGn', vmin=0, vmax=1,
                linewidths=0.25, linecolor=BG,
                annot=True, fmt='.2f', annot_kws={'size': 6.5},
                cbar_kws={'shrink': 0.75})
    ax.set_title("Cramér's V Correlation Heatmap (Categorical Features)",
                 color=TEXT, fontsize=13, pad=12)
    ax.tick_params(labelsize=8, colors=MUTED)
    fig.tight_layout()
    correlation_b64 = _fig_to_b64(fig)

    _plots_cache = {
        'describe':         describe_b64,
        'missing_values':   missing_info,
        'feature_analysis': feature_analysis_b64,
        'bivariate':        bivariate_b64,
        'correlation':      correlation_b64,
    }
    return jsonify(_plots_cache)


@bp.route('/compare')
def compare():
    global _compare_cache
    if _compare_cache is not None:
        return jsonify(_compare_cache)

    data   = _load_and_preprocess()
    X_tr   = data['X_train']
    X_te   = data['X_test']
    y_tr   = data['y_train']
    y_te   = data['y_test']

    results = {'labels': [], 'accuracy': [], 'f1': []}
    for key, cfg in _MODELS.items():
        clf = cfg['estimator']()
        clf.fit(X_tr, y_tr)
        y_pred = clf.predict(X_te)
        results['labels'].append(cfg['label'])
        results['accuracy'].append(round(float(accuracy_score(y_te, y_pred)), 4))
        results['f1'].append(round(float(f1_score(y_te, y_pred)), 4))

    _compare_cache = results
    return jsonify(results)


@bp.route('/run')
def run():
    model_key = request.args.get('model', 'random_forest')
    if model_key not in _MODELS:
        return jsonify({'error': f'Unknown model: {model_key}'}), 400

    force = request.args.get('force', 'false').lower() == 'true'
    if model_key in _cache and not force:
        return jsonify(_cache[model_key])

    data    = _load_and_preprocess()
    X_train = data['X_train']
    X_test  = data['X_test']
    y_train = data['y_train']
    y_test  = data['y_test']
    fnames  = data['feature_names']

    clf = _MODELS[model_key]['estimator']()
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]

    acc  = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred))
    rec  = float(recall_score(y_test, y_pred))
    f1   = float(f1_score(y_test, y_pred))
    auc  = float(roc_auc_score(y_test, y_prob))

    # Feature importance
    if hasattr(clf, 'feature_importances_'):
        raw = clf.feature_importances_
    else:
        raw = np.abs(clf.coef_[0])
        total = raw.sum()
        raw = raw / total if total > 0 else raw

    feat_imp = sorted(
        [{'feature': f, 'importance': float(v)} for f, v in zip(fnames, raw)],
        key=lambda x: x['importance'],
        reverse=True,
    )

    _setup_style()

    # ── Confusion Matrix ──────────────────────────────────────────
    cm = confusion_matrix(y_test, y_pred)
    fig, ax = plt.subplots(figsize=(5, 4))
    sns.heatmap(cm, annot=True, fmt='d', ax=ax,
                cmap='Blues',
                xticklabels=['Edible', 'Poisonous'],
                yticklabels=['Edible', 'Poisonous'],
                linewidths=0.5, linecolor=BG,
                annot_kws={'size': 16, 'weight': 'bold'})
    ax.set_xlabel('Predicted', color=TEXT, labelpad=8)
    ax.set_ylabel('Actual', color=TEXT, labelpad=8)
    ax.set_title('Confusion Matrix', color=TEXT, fontsize=12, pad=12)
    ax.tick_params(colors=MUTED)
    fig.tight_layout()
    cm_b64 = _fig_to_b64(fig)

    # ── ROC Curve ─────────────────────────────────────────────────
    fpr, tpr, _ = roc_curve(y_test, y_prob)
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.plot(fpr, tpr, color=GREEN, linewidth=2.5, label=f'AUC = {auc:.4f}')
    ax.plot([0, 1], [0, 1], '--', color=MUTED, linewidth=1.2, alpha=0.5, label='Random')
    ax.fill_between(fpr, tpr, alpha=0.10, color=GREEN)
    ax.set_xlabel('False Positive Rate', color=TEXT)
    ax.set_ylabel('True Positive Rate', color=TEXT)
    ax.set_title('ROC Curve', color=TEXT, fontsize=12, pad=12)
    ax.legend(fontsize=9, framealpha=0.15, labelcolor=TEXT,
              facecolor=SURFACE, edgecolor='none')
    ax.tick_params(colors=MUTED)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1.02)
    for sp in ax.spines.values():
        sp.set_color(SURFACE)
    fig.tight_layout()
    roc_b64 = _fig_to_b64(fig)

    # ── Precision-Recall Curve ────────────────────────────────────
    prec_c, rec_c, _ = precision_recall_curve(y_test, y_prob)
    ap = float(average_precision_score(y_test, y_prob))
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.plot(rec_c, prec_c, color=CYAN, linewidth=2.5, label=f'AP = {ap:.4f}')
    ax.fill_between(rec_c, prec_c, alpha=0.10, color=CYAN)
    ax.set_xlabel('Recall', color=TEXT)
    ax.set_ylabel('Precision', color=TEXT)
    ax.set_title('Precision-Recall Curve', color=TEXT, fontsize=12, pad=12)
    ax.legend(fontsize=9, framealpha=0.15, labelcolor=TEXT,
              facecolor=SURFACE, edgecolor='none')
    ax.tick_params(colors=MUTED)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1.02)
    for sp in ax.spines.values():
        sp.set_color(SURFACE)
    fig.tight_layout()
    pr_b64 = _fig_to_b64(fig)

    _cache[model_key] = {
        'metrics': {
            'accuracy':  round(acc,  4),
            'precision': round(prec, 4),
            'recall':    round(rec,  4),
            'f1':        round(f1,   4),
            'auc':       round(auc,  4),
        },
        'confusion_matrix':    cm_b64,
        'roc_curve':           roc_b64,
        'pr_curve':            pr_b64,
        'feature_importance':  feat_imp,
        'n_train':             data['n_train'],
        'n_test':              data['n_test'],
        'model_key':           model_key,
        'model_label':         _MODELS[model_key]['label'],
    }
    return jsonify(_cache[model_key])
