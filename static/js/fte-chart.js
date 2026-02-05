(function () {
    var data = [
        { name: 'Employee 1', month: '202406', fte: 1 },
        { name: 'Employee 1', month: '202407', fte: 0.911 },
        { name: 'Employee 1', month: '202408', fte: 0.073 },
        { name: 'Employee 1', month: '202409', fte: 0 },
        { name: 'Employee 1', month: '202410', fte: 0 },
        { name: 'Employee 1', month: '202411', fte: 0 },
        { name: 'Employee 1', month: '202412', fte: 0 },
        { name: 'Employee 1', month: '202501', fte: 0.161 },
        { name: 'Employee 1', month: '202502', fte: 0.679 },
        { name: 'Employee 1', month: '202503', fte: 1 },
        { name: 'Employee 1', month: '202504', fte: 1 },
        { name: 'Employee 1', month: '202505', fte: 1 },
        { name: 'Employee 1', month: '202506', fte: 1 },
        { name: 'Employee 1', month: '202507', fte: 1 },
        { name: 'Employee 1', month: '202508', fte: 1 },
        { name: 'Employee 1', month: '202509', fte: 1 },
        { name: 'Employee 1', month: '202510', fte: 1 },
        { name: 'Employee 1', month: '202511', fte: 1 },
        { name: 'Employee 1', month: '202512', fte: 1 },
        { name: 'Employee 2', month: '202406', fte: 1 },
        { name: 'Employee 2', month: '202407', fte: 1 },
        { name: 'Employee 2', month: '202408', fte: 1 },
        { name: 'Employee 2', month: '202409', fte: 1 },
        { name: 'Employee 2', month: '202410', fte: 1 },
        { name: 'Employee 2', month: '202411', fte: 1 },
        { name: 'Employee 2', month: '202412', fte: 1 },
        { name: 'Employee 2', month: '202501', fte: 1 },
        { name: 'Employee 2', month: '202502', fte: 1 },
        { name: 'Employee 2', month: '202503', fte: 0.790 },
        { name: 'Employee 2', month: '202504', fte: 0 },
        { name: 'Employee 2', month: '202505', fte: 0 },
        { name: 'Employee 2', month: '202506', fte: 0 },
        { name: 'Employee 2', month: '202507', fte: 0.145 },
        { name: 'Employee 2', month: '202508', fte: 0.694 },
        { name: 'Employee 2', month: '202509', fte: 1 },
        { name: 'Employee 2', month: '202510', fte: 1 },
        { name: 'Employee 2', month: '202511', fte: 1 },
        { name: 'Employee 2', month: '202512', fte: 1 },
        { name: 'Employee 3', month: '202406', fte: 1 },
        { name: 'Employee 3', month: '202407', fte: 1 },
        { name: 'Employee 3', month: '202408', fte: 1 },
        { name: 'Employee 3', month: '202409', fte: 1 },
        { name: 'Employee 3', month: '202410', fte: 1 },
        { name: 'Employee 3', month: '202411', fte: 1 },
        { name: 'Employee 3', month: '202412', fte: 1 },
        { name: 'Employee 3', month: '202501', fte: 1 },
        { name: 'Employee 3', month: '202502', fte: 1 },
        { name: 'Employee 3', month: '202503', fte: 1 },
        { name: 'Employee 3', month: '202504', fte: 1 },
        { name: 'Employee 3', month: '202505', fte: 0.565 },
        { name: 'Employee 3', month: '202506', fte: 0 },
        { name: 'Employee 3', month: '202507', fte: 0 },
        { name: 'Employee 3', month: '202508', fte: 0 },
        { name: 'Employee 3', month: '202509', fte: 0.500 },
        { name: 'Employee 3', month: '202510', fte: 1 },
        { name: 'Employee 3', month: '202511', fte: 1 },
        { name: 'Employee 3', month: '202512', fte: 1 },
    ];

    function formatMonth(m) {
        var year = m.substring(0, 4);
        var mon = m.substring(4, 6);
        var d = new Date(year, mon - 1);
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    var employees = [];
    var seen = {};
    data.forEach(function (d) {
        if (!seen[d.name]) { employees.push(d.name); seen[d.name] = true; }
    });

    var allMonths = [];
    var seenM = {};
    data.forEach(function (d) {
        if (!seenM[d.month]) { allMonths.push(d.month); seenM[d.month] = true; }
    });
    allMonths.sort();
    var labels = allMonths.map(formatMonth);

    var colors = ['#667eea', '#f093fb', '#4facfe'];

    var isDark = !document.documentElement.hasAttribute('data-theme') ||
                 document.documentElement.getAttribute('data-theme') === 'dark';
    var gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    var tickColor = isDark ? '#94a3b8' : '#475569';

    var datasets = employees.map(function (emp, i) {
        var empData = data.filter(function (d) { return d.name === emp; });
        var values = allMonths.map(function (month) {
            var rec = empData.find(function (d) { return d.month === month; });
            return rec ? rec.fte : 0;
        });
        return {
            label: emp,
            data: values,
            borderColor: colors[i % colors.length],
            backgroundColor: colors[i % colors.length] + '20',
            borderWidth: 3,
            tension: 0.3,
            pointRadius: 5,
            pointHoverRadius: 7,
            spanGaps: true,
        };
    });

    new Chart(document.getElementById('fteChart').getContext('2d'), {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: { color: tickColor, font: { size: 13 }, padding: 15 },
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (ctx) {
                            return ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2) + ' FTE';
                        },
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1.2,
                    grid: { color: gridColor },
                    title: { display: true, text: 'Employee FTE', color: tickColor, font: { size: 13 } },
                    ticks: {
                        color: tickColor,
                        callback: function (v) { return (100 * v).toFixed(0) + '%'; },
                    },
                },
                x: {
                    grid: { display: false },
                    title: { display: true, text: 'Month', color: tickColor, font: { size: 13 } },
                    ticks: { color: tickColor },
                },
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
        },
    });
})();
