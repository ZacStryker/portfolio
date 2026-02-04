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
        return monthNames[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
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
                    ticks: { color: tickColor, maxRotation: 45, minRotation: 45 },
                },
            },
        },
    });
})();
