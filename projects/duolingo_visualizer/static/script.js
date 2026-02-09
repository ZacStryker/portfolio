(async function () {
    const response = await fetch('/duolingo-visualizer/api/data');
    if (!response.ok) {
        document.getElementById('statsGrid').innerHTML =
            '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center">Failed to load data.</p>';
        return;
    }
    const data = await response.json();

    const dates = Object.keys(data);
    const sortedDates = dates.sort();

    const totalSessions = dates.reduce((s, d) => s + data[d].number_of_sessions, 0);
    const totalTimeMin = dates.reduce((s, d) => s + data[d].session_time, 0) / 60;
    const currentStreak = data[sortedDates[sortedDates.length - 1]].streak;

    // Latest session
    const latestDate = sortedDates[sortedDates.length - 1];
    const latestData = data[latestDate];
    const latestTimeMin = Math.round(latestData.session_time / 60);

    // First session
    const firstDate = sortedDates[0];

    // Averages
    const activeDays = dates.filter(d => data[d].number_of_sessions > 0);
    const avgLessonsPerDay = (totalSessions / activeDays.length).toFixed(1);
    const avgSessionLen = Math.round(totalTimeMin / activeDays.length);

    function formatDate(dateStr) {
        const parts = dateStr.split('/');
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return parts[2] + ' ' + months[parseInt(parts[1], 10) - 1] + ', ' + parts[0];
    }

    const totalHours = Math.floor(totalTimeMin / 60);
    const totalRemMin = Math.floor(totalTimeMin % 60);

    const stats = [
        { label: 'Current Streak',        value: currentStreak, unit: 'days' },
        { label: 'Total Lessons Complete', value: totalSessions, unit: '' },
        { label: 'Total Session Time',    value: totalHours + 'h ' + String(totalRemMin).padStart(2, '0') + 'm', unit: '' },
        { label: 'Latest Session Date',   value: formatDate(latestDate), unit: '' },
        { label: 'Latest Lessons',        value: latestData.number_of_sessions, unit: '' },
        { label: 'Latest Session Time',   value: latestTimeMin + 'm', unit: '' },
        { label: 'First Session Date',    value: formatDate(firstDate), unit: '' },
        { label: 'Avg Lessons/Day',       value: avgLessonsPerDay, unit: '' },
        { label: 'Avg Session Length',    value: avgSessionLen + 'm', unit: '' },
    ];

    const grid = document.getElementById('statsGrid');
    stats.forEach(function (s) {
        grid.innerHTML +=
            '<div class="stat-card">' +
                '<div class="stat-label">' + s.label + '</div>' +
                '<div class="stat-value">' + s.value + '<span class="stat-unit">' + s.unit + '</span></div>' +
            '</div>';
    });

    // Chart — running total of lessons by month
    const monthlyData = {};
    let runningTotal = 0;
    sortedDates.forEach(function (d) {
        const monthKey = d.slice(0, 7);
        runningTotal += data[d].number_of_sessions;
        monthlyData[monthKey] = runningTotal;
    });

    const months = Object.keys(monthlyData).sort();
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const labels = months.map(function (m) {
        var parts = m.split('/');
        var mon = monthNames[parseInt(parts[1], 10) - 1];
        return mon === 'Jan' ? [parts[0], mon] : ['', mon];
    });
    const values = months.map(function (m) { return monthlyData[m]; });

    // Theme-aware colors
    const isDark = !document.documentElement.hasAttribute('data-theme') ||
                   document.documentElement.getAttribute('data-theme') === 'dark';
    const lineColor = '#58cc02';
    const fillColor = isDark ? 'rgba(88, 204, 2, 0.15)' : 'rgba(88, 204, 2, 0.25)';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const tickColor = isDark ? '#94a3b8' : '#475569';

    new Chart(document.getElementById('lessonsChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Lessons',
                data: values,
                backgroundColor: fillColor,
                borderColor: lineColor,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: lineColor,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (ctx) { return 'Total Lessons: ' + ctx.parsed.y; },
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: tickColor, precision: 0 },
                },
                x: {
                    grid: { display: false },
                    ticks: { color: tickColor, maxRotation: 0 },
                },
            },
        },
    });

    // --- Calendar Heatmap ---
    (function renderHeatmap() {
        var canvas = document.getElementById('heatmapCanvas');
        var tooltip = document.getElementById('heatmapTooltip');
        if (!canvas || !tooltip) return;
        var ctx = canvas.getContext('2d');

        // Polyfill roundRect for older browsers
        if (!ctx.roundRect) {
            CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
                this.moveTo(x + r, y);
                this.lineTo(x + w - r, y);
                this.arcTo(x + w, y, x + w, y + r, r);
                this.lineTo(x + w, y + h - r);
                this.arcTo(x + w, y + h, x + w - r, y + h, r);
                this.lineTo(x + r, y + h);
                this.arcTo(x, y + h, x, y + h - r, r);
                this.lineTo(x, y + r);
                this.arcTo(x, y, x + r, y, r);
                return this;
            };
        }

        var cellSize = 14;
        var cellGap = 2;
        var step = cellSize + cellGap;
        var dayLabelWidth = 32;
        var yearLabelHeight = 14;
        var monthLabelHeight = 16;
        var headerHeight = yearLabelHeight + monthLabelHeight;

        // Build daily XP map keyed by YYYY-MM-DD
        var xpMap = {};
        var maxXp = 0;
        sortedDates.forEach(function (d) {
            var key = d.replace(/\//g, '-');
            var xp = data[d].xp_today || 0;
            xpMap[key] = xp;
            if (xp > maxXp) maxXp = xp;
        });

        // Determine date range: from first Sunday on or before the first date
        // to last Saturday on or after the last date
        var firstRaw = sortedDates[0].replace(/\//g, '-');
        var lastRaw = sortedDates[sortedDates.length - 1].replace(/\//g, '-');
        var startDate = new Date(firstRaw + 'T00:00:00');
        var endDate = new Date(lastRaw + 'T00:00:00');

        // Adjust start to previous Sunday
        var startDay = startDate.getDay();
        if (startDay !== 0) startDate.setDate(startDate.getDate() - startDay);

        // Adjust end to next Saturday
        var endDay = endDate.getDay();
        if (endDay !== 6) endDate.setDate(endDate.getDate() + (6 - endDay));

        // Build grid of cells
        var cells = [];
        var weekIndex = 0;
        var cursor = new Date(startDate);
        while (cursor <= endDate) {
            var dayOfWeek = cursor.getDay();
            var isoStr = cursor.getFullYear() + '-' +
                String(cursor.getMonth() + 1).padStart(2, '0') + '-' +
                String(cursor.getDate()).padStart(2, '0');
            cells.push({
                date: new Date(cursor),
                iso: isoStr,
                xp: xpMap[isoStr] || 0,
                week: weekIndex,
                day: dayOfWeek
            });
            if (dayOfWeek === 6) weekIndex++;
            cursor.setDate(cursor.getDate() + 1);
        }

        var totalWeeks = weekIndex + (cells.length > 0 && cells[cells.length - 1].day < 6 ? 1 : 0);
        var canvasWidth = dayLabelWidth + totalWeeks * step + 2;
        var canvasHeight = headerHeight + 7 * step + 6;

        var dpr = window.devicePixelRatio || 1;
        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
        canvas.style.width = canvasWidth + 'px';
        canvas.style.height = canvasHeight + 'px';
        ctx.scale(dpr, dpr);

        // Color helpers
        function getCellColor(xp) {
            if (xp === 0) return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
            var ratio = Math.min(xp / maxXp, 1);
            // 4-stop scale
            if (ratio < 0.25) {
                var t = ratio / 0.25;
                return isDark
                    ? 'rgba(88, 204, 2, ' + (0.15 + t * 0.2) + ')'
                    : 'rgba(88, 204, 2, ' + (0.15 + t * 0.2) + ')';
            }
            if (ratio < 0.5) {
                var t = (ratio - 0.25) / 0.25;
                return isDark
                    ? 'rgba(88, 204, 2, ' + (0.35 + t * 0.25) + ')'
                    : 'rgba(88, 204, 2, ' + (0.35 + t * 0.25) + ')';
            }
            if (ratio < 0.75) {
                var t = (ratio - 0.5) / 0.25;
                return isDark
                    ? 'rgba(88, 204, 2, ' + (0.6 + t * 0.2) + ')'
                    : 'rgba(88, 204, 2, ' + (0.6 + t * 0.2) + ')';
            }
            var t = (ratio - 0.75) / 0.25;
            return isDark
                ? 'rgba(88, 204, 2, ' + (0.8 + t * 0.2) + ')'
                : 'rgba(88, 204, 2, ' + (0.8 + t * 0.2) + ')';
        }

        // Draw day labels (Mon, Wed, Fri)
        ctx.font = '10px "Outfit", sans-serif';
        ctx.fillStyle = tickColor;
        ctx.textBaseline = 'middle';
        var dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
        for (var i = 0; i < 7; i++) {
            if (dayLabels[i]) {
                ctx.fillText(dayLabels[i], 0, headerHeight + i * step + cellSize / 2);
            }
        }

        // Draw year and month labels
        var monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var drawnMonths = {};
        var drawnYears = {};
        cells.forEach(function (c) {
            if (c.day === 0) {
                var mKey = c.date.getFullYear() + '-' + c.date.getMonth();
                if (!drawnMonths[mKey]) {
                    drawnMonths[mKey] = true;
                    var x = dayLabelWidth + c.week * step;
                    // Draw year label above January
                    if (c.date.getMonth() === 0 && !drawnYears[c.date.getFullYear()]) {
                        drawnYears[c.date.getFullYear()] = true;
                        ctx.fillStyle = tickColor;
                        ctx.font = 'bold 11px "Outfit", sans-serif';
                        ctx.textBaseline = 'top';
                        ctx.fillText(String(c.date.getFullYear()), x, 0);
                    }
                    ctx.fillStyle = tickColor;
                    ctx.font = '10px "Outfit", sans-serif';
                    ctx.textBaseline = 'top';
                    ctx.fillText(monthShort[c.date.getMonth()], x, yearLabelHeight);
                }
            }
        });

        // Draw cells
        cells.forEach(function (c) {
            var x = dayLabelWidth + c.week * step;
            var y = headerHeight + c.day * step;
            ctx.fillStyle = getCellColor(c.xp);
            ctx.beginPath();
            ctx.roundRect(x, y, cellSize, cellSize, 2);
            ctx.fill();
        });

        // Build HTML legend outside the scroll area
        var legendEl = document.getElementById('heatmapLegend');
        if (legendEl) {
            var legendStops = [0, 0.25, 0.5, 0.75, 1.0];
            var html = '<span class="heatmap-legend-label">Less</span>';
            legendStops.forEach(function (ratio) {
                html += '<span class="heatmap-legend-cell" style="background:' + getCellColor(ratio * maxXp) + '"></span>';
            });
            html += '<span class="heatmap-legend-label">More</span>';
            legendEl.innerHTML = html;
        }

        // Tooltip on hover
        canvas.addEventListener('mousemove', function (e) {
            var rect = canvas.getBoundingClientRect();
            var mx = e.clientX - rect.left;
            var my = e.clientY - rect.top;

            var col = Math.floor((mx - dayLabelWidth) / step);
            var row = Math.floor((my - headerHeight) / step);

            if (col < 0 || col >= totalWeeks || row < 0 || row > 6) {
                tooltip.style.display = 'none';
                return;
            }

            var cellX = dayLabelWidth + col * step;
            var cellY = headerHeight + row * step;
            if (mx < cellX || mx > cellX + cellSize || my < cellY || my > cellY + cellSize) {
                tooltip.style.display = 'none';
                return;
            }

            // Find matching cell
            var match = null;
            for (var i = 0; i < cells.length; i++) {
                if (cells[i].week === col && cells[i].day === row) {
                    match = cells[i];
                    break;
                }
            }
            if (!match) {
                tooltip.style.display = 'none';
                return;
            }

            var d = match.date;
            var tipText = d.getDate() + ' ' + monthShort[d.getMonth()] + ' ' + d.getFullYear() + ': ' + match.xp + ' XP';
            tooltip.textContent = tipText;
            tooltip.style.display = 'block';

            var tipLeft = cellX + cellSize / 2;
            var tipTop = cellY - 6;
            // Prevent overflow on the right
            var tipWidth = tooltip.offsetWidth;
            if (tipLeft + tipWidth / 2 > canvasWidth) tipLeft = canvasWidth - tipWidth / 2 - 4;
            if (tipLeft - tipWidth / 2 < 0) tipLeft = tipWidth / 2 + 4;

            tooltip.style.left = tipLeft + 'px';
            tooltip.style.top = tipTop + 'px';
            tooltip.style.transform = 'translate(-50%, -100%)';
        });

        canvas.addEventListener('mouseleave', function () {
            tooltip.style.display = 'none';
        });

        // Scroll to the right so most recent data is visible
        var container = canvas.parentElement;
        container.scrollLeft = container.scrollWidth;
    })();
})();
