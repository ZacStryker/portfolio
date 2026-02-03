const apiUrl = document.getElementById('app-data').dataset.apiUrl;
let currentSummary = '';

// File upload handler
document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('inputText').value = e.target.result;
            document.getElementById('fileName').textContent = file.name;
        };
        reader.readAsText(file);
    }
});

function updateControls() {
    const method = document.getElementById('method').value;
    const extractiveControls = document.getElementById('extractiveControls');
    const abstractiveControls = document.getElementById('abstractiveControls');

    if (method === 'abstractive') {
        extractiveControls.style.display = 'none';
        abstractiveControls.style.display = 'block';
    } else {
        extractiveControls.style.display = 'block';
        abstractiveControls.style.display = 'none';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

async function summarize() {
    const text = document.getElementById('inputText').value.trim();

    if (!text || text.length < 10) {
        showError('Please provide text with at least 10 characters');
        return;
    }

    const method = document.getElementById('method').value;
    const numSentences = document.getElementById('numSentences').value;
    const maxLength = document.getElementById('maxLength').value;
    const minLength = document.getElementById('minLength').value;

    // Show loading
    document.getElementById('loading').style.display = 'block';
    document.getElementById('summaryOutput').textContent = 'Generating summary...';
    document.getElementById('metrics').style.display = 'none';

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                method: method,
                num_sentences: numSentences,
                max_length: maxLength,
                min_length: minLength
            })
        });

        const data = await response.json();

        if (response.ok) {
            currentSummary = data.summary;
            document.getElementById('summaryOutput').textContent = data.summary;

            document.getElementById('originalWords').textContent = data.metrics.original_words;
            document.getElementById('summaryWords').textContent = data.metrics.summary_words;
            document.getElementById('compression').textContent = data.metrics.compression_ratio + '%';
            document.getElementById('timeTaken').textContent = data.metrics.time_taken + 's';
            document.getElementById('metrics').style.display = 'grid';

            document.getElementById('downloadBtn').disabled = false;
        } else {
            showError(data.error || 'An error occurred');
            document.getElementById('summaryOutput').textContent = 'Error generating summary. Please try again.';
        }
    } catch (error) {
        showError('Network error: ' + error.message);
        document.getElementById('summaryOutput').textContent = 'Error generating summary. Please try again.';
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function clearText() {
    document.getElementById('inputText').value = '';
    document.getElementById('summaryOutput').textContent = 'Your summary will appear here...';
    document.getElementById('metrics').style.display = 'none';
    document.getElementById('downloadBtn').disabled = true;
    document.getElementById('fileName').textContent = '';
    currentSummary = '';
}

function downloadSummary() {
    if (!currentSummary) {
        showError('No summary to download');
        return;
    }

    const blob = new Blob([currentSummary], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'summary.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Ctrl+Enter to summarize
document.getElementById('inputText').addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') {
        summarize();
    }
});
