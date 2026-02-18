(function () {
    'use strict';

    // ── State ──────────────────────────────────────────────────────
    var k = 4;
    var customers = [];
    var history = [];
    var currentStep = 0;
    var isPlaying = false;
    var playbackSpeed = 500;
    var playbackTimer = null;
    var activeMetric = 'monetary-frequency';
    var useKMeansPlusPlus = true;
    var showCentroids = true;

    var iterations = 0;
    var silhouetteScore = 0;
    var convergenceData = [];
    var elbowData = [];
    var clusterStats = [];

    var scatterChart = null;
    var convergenceChart = null;
    var elbowChart = null;

    var COLORS = ['#00d4ff', '#ff3366', '#ffcc00', '#7c3aed', '#10b981', '#f97316', '#ec4899', '#14b8a6'];
    var CLUSTER_NAMES = [
        'Champions', 'Loyal Customers', 'Potential Loyalists', 'New Customers',
        'At Risk', 'Need Attention', 'About to Sleep', 'Lost'
    ];

    // ── DOM refs ───────────────────────────────────────────────────
    var elKValue = document.getElementById('kValue');
    var elKSlider = document.getElementById('kSlider');
    var elIterations = document.getElementById('metricIterations');
    var elSilhouette = document.getElementById('metricSilhouette');
    var elAlgorithm = document.getElementById('metricAlgorithm');
    var elStepCurrent = document.getElementById('stepCurrent');
    var elStepTotal = document.getElementById('stepTotal');
    var elClusterStats = document.getElementById('clusterStats');
    var elSpeedValue = document.getElementById('speedValue');

    // ── Helpers ────────────────────────────────────────────────────
    function isDark() {
        return !document.documentElement.hasAttribute('data-theme') ||
               document.documentElement.getAttribute('data-theme') === 'dark';
    }

    function gridColor() { return isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'; }
    function tickColor() { return isDark() ? '#94a3b8' : '#475569'; }

    function formatCompact(v) {
        if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(Math.abs(v) % 1e9 === 0 ? 0 : 1) + 'B';
        if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(Math.abs(v) % 1e6 === 0 ? 0 : 1) + 'M';
        if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(Math.abs(v) % 1e3 === 0 ? 0 : 1) + 'K';
        return v;
    }

    // ── K-means++ initialization ──────────────────────────────────
    function kMeansPlusPlus(points, numK) {
        var centroids = [];
        centroids.push(points[Math.floor(Math.random() * points.length)].slice());

        for (var i = 1; i < numK; i++) {
            var distances = points.map(function (point) {
                var minDist = Infinity;
                for (var c = 0; c < centroids.length; c++) {
                    var d = Math.sqrt(
                        Math.pow(point[0] - centroids[c][0], 2) +
                        Math.pow(point[1] - centroids[c][1], 2)
                    );
                    if (d < minDist) minDist = d;
                }
                return minDist * minDist;
            });

            var sum = 0;
            for (var s = 0; s < distances.length; s++) sum += distances[s];
            var rand = Math.random() * sum;

            for (var j = 0; j < points.length; j++) {
                rand -= distances[j];
                if (rand <= 0) {
                    centroids.push(points[j].slice());
                    break;
                }
            }
        }
        return centroids;
    }

    // ── K-means with history ──────────────────────────────────────
    function kMeansWithHistory(data, numK, maxIter, usePP) {
        var points = data.map(function (d) { return [d.x, d.y]; });
        var hist = [];

        var centroids = usePP
            ? kMeansPlusPlus(points, numK)
            : points.slice(0, numK).map(function (p) { return p.slice(); });

        var assignments = new Array(points.length).fill(0);
        var iter = 0;
        var inertias = [];

        while (iter < maxIter) {
            hist.push({
                iteration: iter,
                centroids: centroids.map(function (c) { return c.slice(); }),
                assignments: assignments.slice()
            });

            var changed = false;

            for (var i = 0; i < points.length; i++) {
                var minDist = Infinity;
                var cluster = 0;
                for (var j = 0; j < numK; j++) {
                    var dist = Math.sqrt(
                        Math.pow(points[i][0] - centroids[j][0], 2) +
                        Math.pow(points[i][1] - centroids[j][1], 2)
                    );
                    if (dist < minDist) { minDist = dist; cluster = j; }
                }
                if (assignments[i] !== cluster) {
                    changed = true;
                    assignments[i] = cluster;
                }
            }

            var inertia = 0;
            for (var ii = 0; ii < points.length; ii++) {
                var cen = centroids[assignments[ii]];
                inertia += Math.pow(points[ii][0] - cen[0], 2) + Math.pow(points[ii][1] - cen[1], 2);
            }
            inertias.push(inertia);

            if (!changed) break;

            for (var jj = 0; jj < numK; jj++) {
                var cx = 0, cy = 0, cnt = 0;
                for (var pi = 0; pi < points.length; pi++) {
                    if (assignments[pi] === jj) {
                        cx += points[pi][0];
                        cy += points[pi][1];
                        cnt++;
                    }
                }
                if (cnt > 0) {
                    centroids[jj] = [cx / cnt, cy / cnt];
                }
            }
            iter++;
        }

        hist.push({
            iteration: iter,
            centroids: centroids.map(function (c) { return c.slice(); }),
            assignments: assignments.slice()
        });

        return { assignments: assignments, centroids: centroids, iterations: iter, history: hist, inertias: inertias };
    }

    // ── Silhouette score ──────────────────────────────────────────
    function calculateSilhouette(data, assignments, numK) {
        var points = data.map(function (d) { return [d.x, d.y]; });
        var total = 0;

        for (var i = 0; i < points.length; i++) {
            var cluster = assignments[i];

            // a(i)
            var a = 0, aCnt = 0;
            for (var ai = 0; ai < points.length; ai++) {
                if (assignments[ai] === cluster && ai !== i) {
                    a += Math.sqrt(Math.pow(points[i][0] - points[ai][0], 2) + Math.pow(points[i][1] - points[ai][1], 2));
                    aCnt++;
                }
            }
            if (aCnt > 0) a /= aCnt;

            // b(i)
            var b = Infinity;
            for (var c = 0; c < numK; c++) {
                if (c === cluster) continue;
                var bd = 0, bCnt = 0;
                for (var bi = 0; bi < points.length; bi++) {
                    if (assignments[bi] === c) {
                        bd += Math.sqrt(Math.pow(points[i][0] - points[bi][0], 2) + Math.pow(points[i][1] - points[bi][1], 2));
                        bCnt++;
                    }
                }
                if (bCnt > 0) {
                    bd /= bCnt;
                    if (bd < b) b = bd;
                }
            }

            var s = (b - a) / Math.max(a, b);
            total += s;
        }
        return total / points.length;
    }

    // ── Elbow method ──────────────────────────────────────────────
    function calculateElbowData(data, maxK) {
        var results = [];
        for (var ek = 1; ek <= maxK; ek++) {
            if (ek === 1) {
                var pts = data.map(function (d) { return [d.x, d.y]; });
                var mx = 0, my = 0;
                for (var m = 0; m < pts.length; m++) { mx += pts[m][0]; my += pts[m][1]; }
                mx /= pts.length; my /= pts.length;
                var inertia = 0;
                for (var p = 0; p < pts.length; p++) {
                    inertia += Math.pow(pts[p][0] - mx, 2) + Math.pow(pts[p][1] - my, 2);
                }
                results.push({ k: 1, inertia: inertia, silhouette: 0 });
            } else {
                var res = kMeansWithHistory(data, ek, 50, true);
                var sil = calculateSilhouette(data, res.assignments, ek);
                results.push({
                    k: ek,
                    inertia: res.inertias[res.inertias.length - 1],
                    silhouette: Math.max(0, sil)
                });
            }
        }
        return results;
    }

    // ── Generate RFM data ─────────────────────────────────────────
    function generateRFMData(count) {
        var segments = [
            { recency: 5, frequency: 25, monetary: 5000, spread: 1.2 },
            { recency: 30, frequency: 15, monetary: 3000, spread: 1.5 },
            { recency: 60, frequency: 8, monetary: 1500, spread: 1.8 },
            { recency: 15, frequency: 35, monetary: 8000, spread: 1.0 }
        ];

        var out = [];
        for (var i = 0; i < count; i++) {
            var seg = segments[Math.floor(Math.random() * segments.length)];
            var recency = Math.max(1, seg.recency + (Math.random() - 0.5) * 30 * seg.spread);
            var frequency = Math.max(1, seg.frequency + (Math.random() - 0.5) * 15 * seg.spread);
            var monetary = Math.max(100, seg.monetary + (Math.random() - 0.5) * 2000 * seg.spread);
            out.push({
                id: i + 1,
                recency: Math.round(recency),
                frequency: Math.round(frequency),
                monetary: Math.round(monetary)
            });
        }
        return out;
    }

    // ── Metric helpers ────────────────────────────────────────────
    function getMetricValues(customer) {
        switch (activeMetric) {
            case 'monetary-frequency':
                return { x: customer.monetary, y: customer.frequency };
            case 'recency-monetary':
                return { x: 90 - customer.recency, y: customer.monetary };
            case 'recency-frequency':
                return { x: 90 - customer.recency, y: customer.frequency };
            default:
                return { x: customer.monetary, y: customer.frequency };
        }
    }

    function getMetricLabels() {
        switch (activeMetric) {
            case 'monetary-frequency':
                return { x: 'Annual Spending ($)', y: 'Purchase Frequency' };
            case 'recency-monetary':
                return { x: 'Recency Score (90 - days)', y: 'Annual Spending ($)' };
            case 'recency-frequency':
                return { x: 'Recency Score (90 - days)', y: 'Purchase Frequency' };
            default:
                return { x: 'X Axis', y: 'Y Axis' };
        }
    }

    // ── Perform clustering ────────────────────────────────────────
    function performClustering() {
        var dataWithMetrics = customers.map(function (c) {
            var mv = getMetricValues(c);
            return { id: c.id, recency: c.recency, frequency: c.frequency, monetary: c.monetary, x: mv.x, y: mv.y };
        });

        var result = kMeansWithHistory(dataWithMetrics, k, 100, useKMeansPlusPlus);
        iterations = result.iterations;
        history = result.history;
        currentStep = history.length - 1;

        silhouetteScore = calculateSilhouette(dataWithMetrics, result.assignments, k);

        convergenceData = result.inertias.map(function (inertia, i) {
            return { iteration: i, inertia: Math.round(inertia) };
        });

        // Cluster statistics
        clusterStats = [];
        for (var ci = 0; ci < k; ci++) {
            var members = [];
            for (var mi = 0; mi < customers.length; mi++) {
                if (result.assignments[mi] === ci) members.push(customers[mi]);
            }
            if (members.length > 0) {
                var sumR = 0, sumF = 0, sumM = 0;
                for (var si = 0; si < members.length; si++) {
                    sumR += members[si].recency;
                    sumF += members[si].frequency;
                    sumM += members[si].monetary;
                }
                var avgR = sumR / members.length;
                var avgF = sumF / members.length;
                var avgM = sumM / members.length;
                clusterStats.push({
                    cluster: ci,
                    name: '',
                    count: members.length,
                    avgRecency: Math.round(avgR),
                    avgFrequency: Math.round(avgF),
                    avgMonetary: Math.round(avgM),
                    totalValue: Math.round(sumM),
                    rfmScore: (avgM * avgF) / Math.max(avgR, 1)
                });
            }
        }
        // Assign names by RFM score so best cluster = "Champions"
        clusterStats.sort(function (a, b) { return b.rfmScore - a.rfmScore; });
        for (var ni = 0; ni < clusterStats.length; ni++) {
            clusterStats[ni].name = CLUSTER_NAMES[ni % CLUSTER_NAMES.length];
        }

        updateMetrics();
        renderScatter();
        renderConvergence();
        renderClusterCards();
    }

    // ── Update metric badges ──────────────────────────────────────
    function updateMetrics() {
        elIterations.textContent = iterations;
        elSilhouette.textContent = silhouetteScore.toFixed(3);
        elAlgorithm.textContent = useKMeansPlusPlus ? 'K-MEANS++' : 'RANDOM';
        elStepCurrent.textContent = currentStep + 1;
        elStepTotal.textContent = history.length;
    }

    // Build a lookup from cluster index → assigned name
    function clusterNameMap() {
        var map = {};
        for (var i = 0; i < clusterStats.length; i++) {
            map[clusterStats[i].cluster] = clusterStats[i].name;
        }
        return map;
    }

    // ── Scatter chart ─────────────────────────────────────────────
    function renderScatter() {
        var state = history[currentStep] || { centroids: [], assignments: [] };
        var labels = getMetricLabels();
        var nameMap = clusterNameMap();

        // Build datasets per cluster
        var datasets = [];
        for (var ci = 0; ci < k; ci++) {
            var pts = [];
            for (var pi = 0; pi < customers.length; pi++) {
                if (state.assignments[pi] === ci) {
                    var mv = getMetricValues(customers[pi]);
                    pts.push({ x: mv.x, y: mv.y, id: customers[pi].id, cluster: ci,
                               recency: customers[pi].recency, frequency: customers[pi].frequency,
                               monetary: customers[pi].monetary });
                }
            }
            datasets.push({
                label: nameMap[ci] || ('Cluster ' + (ci + 1)),
                data: pts,
                backgroundColor: COLORS[ci] + 'B3',
                borderColor: COLORS[ci],
                borderWidth: 1,
                pointRadius: 5,
                pointHoverRadius: 7
            });
        }

        // Centroid datasets
        if (showCentroids && state.centroids.length) {
            for (var cc = 0; cc < state.centroids.length; cc++) {
                datasets.push({
                    label: 'Centroid ' + (cc + 1),
                    data: [{ x: state.centroids[cc][0], y: state.centroids[cc][1] }],
                    backgroundColor: '#fff',
                    borderColor: COLORS[cc],
                    borderWidth: 3,
                    pointRadius: 10,
                    pointStyle: 'crossRot',
                    pointHoverRadius: 12,
                    showLine: false
                });
            }
        }

        var gc = gridColor(), tc = tickColor();

        if (scatterChart) {
            scatterChart.data.datasets = datasets;
            scatterChart.options.scales.x.title.text = labels.x;
            scatterChart.options.scales.y.title.text = labels.y;
            scatterChart.options.scales.x.grid.color = gc;
            scatterChart.options.scales.y.grid.color = gc;
            scatterChart.options.scales.x.ticks.color = tc;
            scatterChart.options.scales.y.ticks.color = tc;
            scatterChart.update('none');
        } else {
            scatterChart = new Chart(document.getElementById('scatterChart').getContext('2d'), {
                type: 'scatter',
                data: { datasets: datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 300 },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                title: function (items) {
                                    var d = items[0].raw;
                                    if (!d.id) return '';
                                    var nm = clusterNameMap();
                                    return 'Customer #' + d.id + ' \u2022 ' + (nm[d.cluster] || 'Cluster ' + (d.cluster + 1));
                                },
                                label: function (ctx) {
                                    var d = ctx.raw;
                                    if (!d.id) return 'Centroid';
                                    return [
                                        'Recency: ' + d.recency + ' days',
                                        'Frequency: ' + d.frequency + 'x',
                                        'Monetary: $' + d.monetary.toLocaleString()
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: labels.x, color: tc },
                            grid: { color: gc },
                            ticks: { color: tc }
                        },
                        y: {
                            title: { display: true, text: labels.y, color: tc },
                            grid: { color: gc },
                            ticks: { color: tc }
                        }
                    }
                }
            });
        }

        elStepCurrent.textContent = currentStep + 1;
        elStepTotal.textContent = history.length;
    }

    // ── Convergence chart ─────────────────────────────────────────
    function renderConvergence() {
        var gc = gridColor(), tc = tickColor();
        var labels = convergenceData.map(function (d) { return d.iteration; });
        var values = convergenceData.map(function (d) { return d.inertia; });

        if (convergenceChart) {
            convergenceChart.data.labels = labels;
            convergenceChart.data.datasets[0].data = values;
            convergenceChart.options.scales.x.grid.color = gc;
            convergenceChart.options.scales.y.grid.color = gc;
            convergenceChart.options.scales.x.ticks.color = tc;
            convergenceChart.options.scales.y.ticks.color = tc;
            convergenceChart.update('none');
        } else {
            convergenceChart = new Chart(document.getElementById('convergenceChart').getContext('2d'), {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Inertia',
                        data: values,
                        borderColor: '#00d4ff',
                        backgroundColor: 'rgba(0, 212, 255, 0.1)',
                        borderWidth: 2,
                        pointRadius: 3,
                        pointBackgroundColor: '#00d4ff',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            title: { display: true, text: 'Iteration', color: tc, font: { size: 11 } },
                            grid: { color: gc },
                            ticks: { color: tc, font: { size: 10 } }
                        },
                        y: {
                            title: { display: true, text: 'Inertia', color: tc, font: { size: 11 } },
                            grid: { color: gc },
                            ticks: { color: tc, font: { size: 10 }, callback: formatCompact }
                        }
                    }
                }
            });
        }
    }

    // ── Elbow chart ───────────────────────────────────────────────
    function renderElbow() {
        var gc = gridColor(), tc = tickColor();
        var labels = elbowData.map(function (d) { return d.k; });
        var inertias = elbowData.map(function (d) { return d.inertia; });
        var silhouettes = elbowData.map(function (d) { return d.silhouette; });

        if (elbowChart) {
            elbowChart.data.labels = labels;
            elbowChart.data.datasets[0].data = inertias;
            elbowChart.data.datasets[1].data = silhouettes;
            elbowChart.options.scales.x.grid.color = gc;
            elbowChart.options.scales.y.grid.color = gc;
            elbowChart.options.scales.y2.grid.color = gc;
            elbowChart.options.scales.x.ticks.color = tc;
            elbowChart.options.scales.y.ticks.color = tc;
            elbowChart.options.scales.y2.ticks.color = tc;
            elbowChart.update('none');
        } else {
            elbowChart = new Chart(document.getElementById('elbowChart').getContext('2d'), {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Inertia',
                            data: inertias,
                            borderColor: '#ff3366',
                            backgroundColor: 'rgba(255, 51, 102, 0.1)',
                            borderWidth: 2,
                            pointRadius: 4,
                            pointBackgroundColor: '#ff3366',
                            yAxisID: 'y',
                            tension: 0.3
                        },
                        {
                            label: 'Silhouette',
                            data: silhouettes,
                            borderColor: '#ffcc00',
                            backgroundColor: 'rgba(255, 204, 0, 0.1)',
                            borderWidth: 2,
                            pointRadius: 4,
                            pointBackgroundColor: '#ffcc00',
                            yAxisID: 'y2',
                            tension: 0.3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            labels: { color: tc, font: { size: 10 }, boxWidth: 12 }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: 'K (clusters)', color: tc, font: { size: 11 } },
                            grid: { color: gc },
                            ticks: { color: tc, font: { size: 10 } }
                        },
                        y: {
                            position: 'left',
                            title: { display: true, text: 'Inertia', color: tc, font: { size: 11 } },
                            grid: { color: gc },
                            ticks: { color: tc, font: { size: 10 }, callback: formatCompact }
                        },
                        y2: {
                            position: 'right',
                            title: { display: true, text: 'Silhouette', color: tc, font: { size: 11 } },
                            grid: { drawOnChartArea: false },
                            ticks: { color: tc, font: { size: 10 } },
                            min: 0,
                            max: 1
                        }
                    }
                }
            });
        }
    }

    // ── Cluster stat cards ────────────────────────────────────────
    function renderClusterCards() {
        var html = '';
        clusterStats.forEach(function (stat) {
            var color = COLORS[stat.cluster];
            var r = parseInt(color.slice(1, 3), 16);
            var g = parseInt(color.slice(3, 5), 16);
            var b = parseInt(color.slice(5, 7), 16);

            html += '<div class="cluster-card" style="' +
                'background: linear-gradient(135deg, rgba(' + r + ',' + g + ',' + b + ',0.12), var(--surface-light));' +
                'border: 1px solid ' + color + '60;' +
                'box-shadow: 0 4px 16px ' + color + '20;">' +
                '<div class="cluster-card-header">' +
                    '<span class="cluster-card-name" style="color:' + color + '">' + stat.name + '</span>' +
                    '<span class="cluster-dot" style="background:' + color + ';box-shadow:0 0 10px ' + color + '"></span>' +
                '</div>' +
                '<div class="cluster-card-body">' +
                    '<div class="cluster-row"><span class="row-label">Count:</span><span class="row-value">' + stat.count + '</span></div>' +
                    '<div class="cluster-row"><span class="row-label">Avg Recency:</span><span class="row-value">' + stat.avgRecency + 'd</span></div>' +
                    '<div class="cluster-row"><span class="row-label">Avg Frequency:</span><span class="row-value">' + stat.avgFrequency + 'x</span></div>' +
                    '<div class="cluster-row"><span class="row-label">Avg Monetary:</span><span class="row-value" style="color:#00d4ff;font-weight:700">$' + stat.avgMonetary.toLocaleString() + '</span></div>' +
                    '<div class="cluster-row cluster-total-row"><span class="row-label" style="font-weight:600">Total:</span><span class="row-value" style="color:' + color + ';font-weight:700">$' + stat.totalValue.toLocaleString() + '</span></div>' +
                '</div>' +
            '</div>';
        });
        elClusterStats.innerHTML = html;
    }

    // ── Regenerate data ───────────────────────────────────────────
    function regenerateData() {
        var btn = document.getElementById('btnRegenerate');
        btn.disabled = true;
        btn.textContent = 'Calculating\u2026';

        customers = generateRFMData(200);
        performClustering();

        setTimeout(function () {
            var dataWithMetrics = customers.map(function (c) {
                var mv = getMetricValues(c);
                return { x: mv.x, y: mv.y };
            });
            elbowData = calculateElbowData(dataWithMetrics, 8);
            renderElbow();
            btn.disabled = false;
            btn.textContent = 'Regenerate Data';
        }, 50);
    }

    // ── Animation ─────────────────────────────────────────────────
    function playAnimation() {
        currentStep = 0;
        isPlaying = true;
        document.getElementById('btnPlay').disabled = true;
        document.getElementById('btnPause').disabled = false;

        playbackTimer = setInterval(function () {
            if (currentStep >= history.length - 1) {
                pauseAnimation();
                return;
            }
            currentStep++;
            renderScatter();
        }, playbackSpeed);
    }

    function pauseAnimation() {
        isPlaying = false;
        clearInterval(playbackTimer);
        document.getElementById('btnPlay').disabled = false;
        document.getElementById('btnPause').disabled = true;
    }

    function resetAnimation() {
        pauseAnimation();
        currentStep = history.length - 1;
        renderScatter();
    }

    // ── Event listeners ───────────────────────────────────────────
    elKSlider.addEventListener('input', function () {
        k = parseInt(this.value);
        elKValue.textContent = k;
        performClustering();
    });

    document.querySelectorAll('.metric-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.metric-btn').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            activeMetric = btn.getAttribute('data-metric');
            performClustering();

            // Recalculate elbow for new feature space
            var dataWithMetrics = customers.map(function (c) {
                var mv = getMetricValues(c);
                return { x: mv.x, y: mv.y };
            });
            elbowData = calculateElbowData(dataWithMetrics, 8);
            renderElbow();
        });
    });

    document.getElementById('chkKMeansPP').addEventListener('change', function () {
        useKMeansPlusPlus = this.checked;
        performClustering();
    });

    document.getElementById('chkCentroids').addEventListener('change', function () {
        showCentroids = this.checked;
        renderScatter();
    });

    document.getElementById('btnRegenerate').addEventListener('click', regenerateData);
    document.getElementById('btnPlay').addEventListener('click', playAnimation);
    document.getElementById('btnPause').addEventListener('click', pauseAnimation);
    document.getElementById('btnReset').addEventListener('click', resetAnimation);

    document.getElementById('speedSlider').addEventListener('input', function () {
        playbackSpeed = parseInt(this.value);
        elSpeedValue.textContent = (1000 / playbackSpeed).toFixed(1) + 'x';

        if (isPlaying) {
            clearInterval(playbackTimer);
            playbackTimer = setInterval(function () {
                if (currentStep >= history.length - 1) {
                    pauseAnimation();
                    return;
                }
                currentStep++;
                renderScatter();
            }, playbackSpeed);
        }
    });

    // Theme change observer — re-render charts on toggle
    var themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', function () {
            setTimeout(function () {
                renderScatter();
                renderConvergence();
                if (elbowData.length) renderElbow();
            }, 50);
        });
    }

    // ── Boot ──────────────────────────────────────────────────────
    regenerateData();
})();
