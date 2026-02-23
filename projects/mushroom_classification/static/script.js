(function () {
    'use strict';

    // ── State ──────────────────────────────────────────────────────
    var activeModel    = 'random_forest';
    var importanceChart = null;
    var compareChart    = null;

    // ── Theme helpers ──────────────────────────────────────────────
    function isDark() {
        var t = document.documentElement.getAttribute('data-theme');
        return !t || t === 'dark';
    }
    function gridColor()  { return isDark() ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'; }
    function tickColor()  { return isDark() ? '#94a3b8' : '#475569'; }
    function labelColor() { return isDark() ? '#f1f5f9' : '#0f172a'; }

    // ── Populate metric badges ─────────────────────────────────────
    function populateMetrics(m) {
        document.getElementById('valAccuracy').textContent  = (m.accuracy  * 100).toFixed(2) + '%';
        document.getElementById('valPrecision').textContent = (m.precision * 100).toFixed(2) + '%';
        document.getElementById('valRecall').textContent    = (m.recall    * 100).toFixed(2) + '%';
        document.getElementById('valF1').textContent        = (m.f1        * 100).toFixed(2) + '%';
        document.getElementById('valAUC').textContent       = m.auc !== null ? m.auc.toFixed(4) : 'N/A';
    }

    // ── Populate data strip ────────────────────────────────────────
    function populateDataStrip(nTrain, nTest, label) {
        document.getElementById('dataStrip').innerHTML =
            '<span><strong>Dataset:</strong> UCI Mushrooms</span>' +
            '<span><strong>Total samples:</strong> ' + (nTrain + nTest).toLocaleString() + '</span>' +
            '<span><strong>Train:</strong> ' + nTrain.toLocaleString() + '</span>' +
            '<span><strong>Test:</strong> ' + nTest.toLocaleString() + '</span>' +
            '<span><strong>Features:</strong> 22 categorical (label-encoded)</span>' +
            '<span><strong>Target:</strong> class (e=0 edible, p=1 poisonous)</span>' +
            '<div class="pipeline-steps">' +
                '<span class="step-chip done"><span class="step-num">1</span> Load mushrooms.csv</span>' +
                '<span class="step-chip done"><span class="step-num">2</span> Impute missing (stalk-root)</span>' +
                '<span class="step-chip done"><span class="step-num">3</span> Label encode features</span>' +
                '<span class="step-chip done"><span class="step-num">4</span> Train/test split 80/20</span>' +
                '<span class="step-chip done"><span class="step-num">5</span> StandardScaler</span>' +
                '<span class="step-chip done"><span class="step-num">6</span>' + label + '</span>' +
            '</div>';
    }

    // ── Feature importance chart ───────────────────────────────────
    function renderImportance(featImp) {
        if (importanceChart) { importanceChart.destroy(); importanceChart = null; }
        var gc = gridColor(), tc = tickColor();
        var top = featImp.slice(0, 12);
        var labels = top.map(function (f) { return f.feature; });
        var values = top.map(function (f) { return +(f.importance * 100).toFixed(3); });

        var colors = top.map(function (_, i) {
            var t = i / Math.max(top.length - 1, 1);
            var r = Math.round(16  + (0   - 16)  * t);
            var g = Math.round(185 + (212 - 185) * t);
            var b = Math.round(129 + (255 - 129) * t);
            return 'rgba(' + r + ',' + g + ',' + b + ',0.75)';
        });

        importanceChart = new Chart(
            document.getElementById('importanceChart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Importance (%)',
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors.map(function (c) { return c.replace('0.75', '1'); }),
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) { return ctx.parsed.x.toFixed(3) + '%'; }
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Importance (%)', color: tc },
                        grid: { color: gc },
                        ticks: { color: tc }
                    },
                    y: {
                        grid: { color: gc },
                        ticks: { color: tc, font: { size: 10 } }
                    }
                }
            }
        });
    }

    // ── Model comparison chart ─────────────────────────────────────
    function renderCompare(data) {
        if (compareChart) { compareChart.destroy(); compareChart = null; }
        var gc = gridColor(), tc = tickColor(), lc = labelColor();

        compareChart = new Chart(
            document.getElementById('compareChart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Accuracy',
                        data: data.accuracy.map(function (v) { return +(v * 100).toFixed(3); }),
                        backgroundColor: 'rgba(16, 185, 129, 0.6)',
                        borderColor: 'rgba(16, 185, 129, 0.9)',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'F1 Score',
                        data: data.f1.map(function (v) { return +(v * 100).toFixed(3); }),
                        backgroundColor: 'rgba(0, 212, 255, 0.5)',
                        borderColor: 'rgba(0, 212, 255, 0.85)',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: lc, font: { size: 11 }, boxWidth: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(3) + '%';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gc },
                        ticks: { color: tc }
                    },
                    y: {
                        min: 90,
                        max: 100,
                        grid: { color: gc },
                        ticks: {
                            color: tc,
                            callback: function (v) { return v + '%'; }
                        },
                        title: { display: true, text: 'Score (%)', color: tc }
                    }
                }
            }
        });
    }

    // ── Run pipeline for selected model ───────────────────────────
    function runPipeline(force) {
        var spinner  = document.getElementById('spinner');
        var label    = document.getElementById('runLabel');
        var status   = document.getElementById('runStatus');
        var btnRerun = document.getElementById('btnRerun');

        document.querySelectorAll('.model-btn').forEach(function (b) { b.disabled = true; });
        btnRerun.disabled = true;
        spinner.classList.add('visible');
        label.textContent = 'Training ' + activeModel.replace(/_/g, ' ') + '\u2026';
        status.classList.add('visible');

        var url = '/mushroom-classification/run?model=' + activeModel + (force ? '&force=true' : '');
        fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                populateMetrics(data.metrics);
                populateDataStrip(data.n_train, data.n_test, data.model_label);

                // Server-rendered images
                document.getElementById('imgCM').src  = 'data:image/png;base64,' + data.confusion_matrix;
                document.getElementById('imgROC').src = 'data:image/png;base64,' + data.roc_curve;
                document.getElementById('imgPR').src  = 'data:image/png;base64,' + data.pr_curve;

                renderImportance(data.feature_importance);

                document.getElementById('resultsSection').classList.add('visible');

                spinner.classList.remove('visible');
                label.textContent = 'Pipeline complete \u2014 ' + data.model_label + '.';
                setTimeout(function () { status.classList.remove('visible'); }, 2500);
                btnRerun.disabled = false;
                btnRerun.classList.add('visible');
                document.querySelectorAll('.model-btn').forEach(function (b) { b.disabled = false; });
            })
            .catch(function (err) {
                console.error('Run error:', err);
                spinner.classList.remove('visible');
                label.textContent = 'Error \u2014 check the console.';
                document.querySelectorAll('.model-btn').forEach(function (b) { b.disabled = false; });
                btnRerun.disabled = false;
            });
    }

    // ── Render missing values as styled HTML ───────────────────────
    function renderMissingValues(mv) {
        var cleanLabel = mv.clean_cols + ' / ' + mv.total_cols + ' columns complete';
        var warnLabel  = mv.missing_cols === 0
            ? 'No missing values'
            : mv.missing_cols + ' column' + (mv.missing_cols > 1 ? 's' : '') + ' with missing values';

        var rows = mv.items.map(function (item) {
            return '<tr>' +
                '<td><code style="font-family:\'JetBrains Mono\',monospace;font-size:0.82rem;' +
                     'background:rgba(251,191,36,0.1);color:#fbbf24;padding:.1em .35em;border-radius:3px">' +
                     item.column + '</code></td>' +
                '<td><code style="font-family:\'JetBrains Mono\',monospace;font-size:0.82rem;' +
                     'background:rgba(255,255,255,0.06);color:var(--text-muted);padding:.1em .35em;border-radius:3px">' +
                     '\'?\'</code></td>' +
                '<td>' + item.count.toLocaleString() + '</td>' +
                '<td class="miss-pct">' + item.pct + '%</td>' +
                '<td>Imputed with column mode &rarr; <code style="font-family:\'JetBrains Mono\',monospace;' +
                     'font-size:0.82rem;background:rgba(16,185,129,0.1);color:#34d399;padding:.1em .35em;border-radius:3px">' +
                     '\'' + item.mode + '\'</code></td>' +
            '</tr>';
        }).join('');

        var noteText = mv.missing_cols === 0
            ? 'All ' + mv.total_cols + ' columns have complete data across all ' + mv.total_rows.toLocaleString() + ' rows.'
            : 'The remaining ' + mv.clean_cols + ' features have complete data across all ' +
              mv.total_rows.toLocaleString() + ' rows. The <code>\'?\'</code> character is the UCI dataset\'s ' +
              'original encoding for unknown stalk-root values &mdash; replaced with <code>NaN</code> then imputed before training.';

        document.getElementById('missingContainer').innerHTML =
            '<div class="miss-summary">' +
                '<span class="miss-badge clean">&#10003;&ensp;' + cleanLabel + '</span>' +
                (mv.missing_cols > 0
                    ? '<span class="miss-badge warn">&#9888;&ensp;' + warnLabel + '</span>'
                    : '') +
            '</div>' +
            (mv.items.length > 0
                ? '<table class="miss-table">' +
                    '<thead><tr>' +
                        '<th>Column</th><th>Encoded as</th><th>Missing rows</th>' +
                        '<th>% of total</th><th>Treatment</th>' +
                    '</tr></thead>' +
                    '<tbody>' + rows + '</tbody>' +
                  '</table>'
                : '') +
            '<p class="miss-note">' + noteText + '</p>';
    }

    // ── Load EDA plots ─────────────────────────────────────────────
    function loadPlots() {
        fetch('/mushroom-classification/plots')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                document.getElementById('plotDescribe').src    = 'data:image/png;base64,' + data.describe;
                renderMissingValues(data.missing_values);
                document.getElementById('plotFeature').src     = 'data:image/png;base64,' + data.feature_analysis;
                document.getElementById('plotBivariate').src   = 'data:image/png;base64,' + data.bivariate;
                document.getElementById('plotCorrelation').src = 'data:image/png;base64,' + data.correlation;
                document.getElementById('edaLoading').style.display = 'none';
                document.getElementById('edaGrid').style.display    = 'flex';
            })
            .catch(function (err) {
                console.error('Plots error:', err);
                document.getElementById('edaLoading').textContent = 'Failed to load EDA plots.';
            });
    }

    // ── Load model comparison ──────────────────────────────────────
    function loadCompare() {
        fetch('/mushroom-classification/compare')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                document.getElementById('compareLoading').style.display = 'none';
                document.getElementById('compareWrap').style.display    = 'block';
                renderCompare(data);
            })
            .catch(function (err) {
                console.error('Compare error:', err);
                document.getElementById('compareLoading').textContent = 'Failed to load comparison.';
            });
    }

    // ── Event listeners ────────────────────────────────────────────
    document.querySelectorAll('.model-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.disabled || btn.classList.contains('active')) return;
            document.querySelectorAll('.model-btn').forEach(function (b) {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            activeModel = btn.getAttribute('data-model');
            runPipeline(false);
        });
    });

    document.getElementById('btnRerun').addEventListener('click', function () {
        runPipeline(true);
    });

    // Re-render Chart.js charts on theme toggle
    var themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', function () {
            setTimeout(function () {
                function updateChart(chart) {
                    if (!chart) return;
                    var gc = gridColor(), tc = tickColor(), lc = labelColor();
                    chart.options.scales.x.grid.color  = gc;
                    chart.options.scales.y.grid.color  = gc;
                    chart.options.scales.x.ticks.color = tc;
                    chart.options.scales.y.ticks.color = tc;
                    if (chart.options.plugins.legend) {
                        chart.options.plugins.legend.labels.color = lc;
                    }
                    chart.update('none');
                }
                updateChart(importanceChart);
                updateChart(compareChart);
            }, 50);
        });
    }

    // ── Boot ──────────────────────────────────────────────────────
    runPipeline(false);
    loadPlots();
    loadCompare();
})();
