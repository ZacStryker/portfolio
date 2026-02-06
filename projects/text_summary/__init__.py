from flask import Blueprint, render_template, request, jsonify
import time

PROJECT_META = {
    'id': 'text-summary',
    'name': 'Text Summarization',
    'description': 'Transform long texts into concise summaries using extractive and abstractive AI algorithms.',
    'icon': 'text',
    'color': '#8b5cf6',
    'category': 'Natural Language Processing',
    'nav_group': 'Machine Learning',
    'tags': ['nlp', 'bart', 'textrank', 'extractive', 'abstractive'],
}

bp = Blueprint(
    'text_summary',
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='static',
    url_prefix='/text-summary',
)

_summarizer = None


def get_summarizer():
    global _summarizer
    if _summarizer is None:
        from .summarizer import TextSummarizer
        _summarizer = TextSummarizer()
    return _summarizer


@bp.route('/')
def index():
    return render_template('text_summary/index.html')


@bp.route('/api/summarize', methods=['POST'])
def summarize():
    try:
        data = request.get_json()

        text = data.get('text', '')
        method = data.get('method', 'textrank')
        num_sentences = int(data.get('num_sentences', 3))
        max_length = int(data.get('max_length', 130))
        min_length = int(data.get('min_length', 30))

        if not text or len(text.strip()) < 10:
            return jsonify({
                'error': 'Please provide text with at least 10 characters'
            }), 400

        summ = get_summarizer()

        start_time = time.time()

        if method == 'textrank':
            summary = summ.extractive_summarize_textrank(text, num_sentences)
        elif method == 'lsa':
            summary = summ.extractive_summarize_lsa(text, num_sentences)
        elif method == 'luhn':
            summary = summ.extractive_summarize_luhn(text, num_sentences)
        elif method == 'abstractive':
            summary = summ.abstractive_summarize(text, max_length, min_length)
        else:
            return jsonify({'error': 'Invalid method'}), 400

        elapsed_time = time.time() - start_time

        original_words = len(text.split())
        summary_words = len(summary.split())
        compression_ratio = (summary_words / original_words * 100) if original_words > 0 else 0

        return jsonify({
            'summary': summary,
            'metrics': {
                'original_words': original_words,
                'summary_words': summary_words,
                'compression_ratio': round(compression_ratio, 1),
                'time_taken': round(elapsed_time, 2)
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500
