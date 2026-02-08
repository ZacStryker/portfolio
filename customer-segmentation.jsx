import React, { useState, useEffect, useRef } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LineChart, Line, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

// K-means++ initialization for better initial centroids
function kMeansPlusPlus(points, k) {
  const centroids = [];
  centroids.push([...points[Math.floor(Math.random() * points.length)]]);
  
  for (let i = 1; i < k; i++) {
    const distances = points.map(point => {
      const minDist = Math.min(...centroids.map(centroid => 
        Math.sqrt(Math.pow(point[0] - centroid[0], 2) + Math.pow(point[1] - centroid[1], 2))
      ));
      return minDist * minDist;
    });
    
    const sum = distances.reduce((a, b) => a + b, 0);
    let rand = Math.random() * sum;
    
    for (let j = 0; j < points.length; j++) {
      rand -= distances[j];
      if (rand <= 0) {
        centroids.push([...points[j]]);
        break;
      }
    }
  }
  
  return centroids;
}

// Enhanced K-means with iteration history
function kMeansWithHistory(data, k, maxIterations = 100, useKMeansPlusPlus = true) {
  const points = data.map(d => [d.x, d.y]);
  const history = [];
  
  let centroids = useKMeansPlusPlus 
    ? kMeansPlusPlus(points, k)
    : points.slice(0, k).map(p => [...p]);
  
  let assignments = new Array(points.length).fill(0);
  let iterations = 0;
  let inertias = [];
  
  while (iterations < maxIterations) {
    history.push({
      iteration: iterations,
      centroids: centroids.map(c => [...c]),
      assignments: [...assignments]
    });
    
    let changed = false;
    
    // Assign points to nearest centroid
    for (let i = 0; i < points.length; i++) {
      let minDist = Infinity;
      let cluster = 0;
      
      for (let j = 0; j < k; j++) {
        const dist = Math.sqrt(
          Math.pow(points[i][0] - centroids[j][0], 2) +
          Math.pow(points[i][1] - centroids[j][1], 2)
        );
        
        if (dist < minDist) {
          minDist = dist;
          cluster = j;
        }
      }
      
      if (assignments[i] !== cluster) {
        changed = true;
        assignments[i] = cluster;
      }
    }
    
    // Calculate inertia (within-cluster sum of squares)
    let inertia = 0;
    for (let i = 0; i < points.length; i++) {
      const centroid = centroids[assignments[i]];
      inertia += Math.pow(points[i][0] - centroid[0], 2) + Math.pow(points[i][1] - centroid[1], 2);
    }
    inertias.push(inertia);
    
    if (!changed) break;
    
    // Update centroids
    for (let j = 0; j < k; j++) {
      const clusterPoints = points.filter((_, i) => assignments[i] === j);
      if (clusterPoints.length > 0) {
        centroids[j] = [
          clusterPoints.reduce((sum, p) => sum + p[0], 0) / clusterPoints.length,
          clusterPoints.reduce((sum, p) => sum + p[1], 0) / clusterPoints.length
        ];
      }
    }
    
    iterations++;
  }
  
  // Final state
  history.push({
    iteration: iterations,
    centroids: centroids.map(c => [...c]),
    assignments: [...assignments]
  });
  
  return { assignments, centroids, iterations, history, inertias };
}

// Calculate silhouette score
function calculateSilhouette(data, assignments, k) {
  const points = data.map(d => [d.x, d.y]);
  let totalScore = 0;
  
  for (let i = 0; i < points.length; i++) {
    const cluster = assignments[i];
    const clusterPoints = points.filter((_, j) => assignments[j] === cluster);
    
    // Calculate a(i) - average distance to points in same cluster
    let a = 0;
    if (clusterPoints.length > 1) {
      for (const p of clusterPoints) {
        a += Math.sqrt(Math.pow(points[i][0] - p[0], 2) + Math.pow(points[i][1] - p[1], 2));
      }
      a /= (clusterPoints.length - 1);
    }
    
    // Calculate b(i) - min average distance to points in other clusters
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === cluster) continue;
      const otherPoints = points.filter((_, j) => assignments[j] === c);
      if (otherPoints.length === 0) continue;
      
      let dist = 0;
      for (const p of otherPoints) {
        dist += Math.sqrt(Math.pow(points[i][0] - p[0], 2) + Math.pow(points[i][1] - p[1], 2));
      }
      dist /= otherPoints.length;
      b = Math.min(b, dist);
    }
    
    const s = (b - a) / Math.max(a, b);
    totalScore += s;
  }
  
  return totalScore / points.length;
}

// Calculate elbow method data
function calculateElbowData(data, maxK = 8) {
  const results = [];
  
  for (let k = 1; k <= maxK; k++) {
    if (k === 1) {
      // For k=1, inertia is just variance
      const points = data.map(d => [d.x, d.y]);
      const mean = [
        points.reduce((sum, p) => sum + p[0], 0) / points.length,
        points.reduce((sum, p) => sum + p[1], 0) / points.length
      ];
      const inertia = points.reduce((sum, p) => 
        sum + Math.pow(p[0] - mean[0], 2) + Math.pow(p[1] - mean[1], 2), 0
      );
      results.push({ k: 1, inertia, silhouette: 0 });
    } else {
      const result = kMeansWithHistory(data, k, 50, true);
      const silhouette = calculateSilhouette(data, result.assignments, k);
      results.push({ 
        k, 
        inertia: result.inertias[result.inertias.length - 1],
        silhouette: Math.max(0, silhouette) // Clamp to 0 minimum for display
      });
    }
  }
  
  return results;
}

// Generate RFM customer data
function generateRFMData(count = 200) {
  const segments = [
    { recency: 5, frequency: 25, monetary: 5000, spread: 1.2 },
    { recency: 30, frequency: 15, monetary: 3000, spread: 1.5 },
    { recency: 60, frequency: 8, monetary: 1500, spread: 1.8 },
    { recency: 15, frequency: 35, monetary: 8000, spread: 1.0 },
  ];
  
  const customers = [];
  for (let i = 0; i < count; i++) {
    const segment = segments[Math.floor(Math.random() * segments.length)];
    const recency = Math.max(1, segment.recency + (Math.random() - 0.5) * 30 * segment.spread);
    const frequency = Math.max(1, segment.frequency + (Math.random() - 0.5) * 15 * segment.spread);
    const monetary = Math.max(100, segment.monetary + (Math.random() - 0.5) * 2000 * segment.spread);
    
    customers.push({
      id: i + 1,
      recency: Math.round(recency),
      frequency: Math.round(frequency),
      monetary: Math.round(monetary),
      x: Math.round(monetary),
      y: Math.round(frequency)
    });
  }
  
  return customers;
}

// InfoTooltip component
function InfoTooltip({ content }) {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div 
      style={{ position: 'relative', display: 'inline-block', marginLeft: '8px' }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <div style={{
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        background: 'rgba(0, 212, 255, 0.2)',
        border: '1px solid rgba(0, 212, 255, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'help',
        fontSize: '11px',
        fontWeight: '700',
        color: '#00d4ff',
        transition: 'all 0.2s ease'
      }}>
        ?
      </div>
      {isVisible && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '8px',
          background: 'rgba(10, 15, 25, 0.98)',
          border: '1px solid rgba(0, 212, 255, 0.5)',
          borderRadius: '8px',
          padding: '12px 16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          minWidth: '280px',
          maxWidth: '350px',
          pointerEvents: 'none',
          animation: 'fadeInUp 0.2s ease-out'
        }}>
          <div style={{
            position: 'absolute',
            top: '-6px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '0',
            height: '0',
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: '6px solid rgba(0, 212, 255, 0.5)'
          }} />
          <p style={{
            margin: 0,
            fontSize: '12px',
            lineHeight: '1.6',
            color: '#e0e6ed'
          }}>
            {content}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AdvancedCustomerSegmentation() {
  const [k, setK] = useState(4);
  const [customers, setCustomers] = useState([]);
  const [clusteredData, setClusteredData] = useState([]);
  const [centroids, setCentroids] = useState([]);
  const [clusterStats, setClusterStats] = useState([]);
  const [iterations, setIterations] = useState(0);
  const [silhouetteScore, setSilhouetteScore] = useState(0);
  const [elbowData, setElbowData] = useState([]);
  const [history, setHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(500);
  const [convergenceData, setConvergenceData] = useState([]);
  const [activeMetric, setActiveMetric] = useState('monetary-frequency');
  const [useKMeansPlusPlus, setUseKMeansPlusPlus] = useState(true);
  const [showCentroids, setShowCentroids] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  
  const playbackTimer = useRef(null);

  const clusterColors = ['#00d4ff', '#ff3366', '#ffcc00', '#7c3aed', '#10b981', '#f97316', '#ec4899', '#14b8a6'];
  const clusterNames = [
    'Champions', 'Loyal Customers', 'Potential Loyalists', 'New Customers',
    'At Risk', 'Need Attention', 'About to Sleep', 'Lost'
  ];

  useEffect(() => {
    regenerateData();
  }, []);

  useEffect(() => {
    if (customers.length > 0) {
      performClustering();
    }
  }, [k, customers, activeMetric, useKMeansPlusPlus]);

  useEffect(() => {
    if (isPlaying && history.length > 0) {
      playbackTimer.current = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= history.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playbackSpeed);
    }
    return () => clearInterval(playbackTimer.current);
  }, [isPlaying, history, playbackSpeed]);

  async function regenerateData() {
    setIsCalculating(true);
    const newCustomers = generateRFMData(200);
    setCustomers(newCustomers);
    
    // Calculate elbow data
    setTimeout(() => {
      const elbow = calculateElbowData(newCustomers, 8);
      setElbowData(elbow);
      setIsCalculating(false);
    }, 100);
  }

  function getMetricValues(customer) {
    switch(activeMetric) {
      case 'monetary-frequency':
        return { x: customer.monetary, y: customer.frequency };
      case 'recency-monetary':
        return { x: 90 - customer.recency, y: customer.monetary }; // Invert recency
      case 'recency-frequency':
        return { x: 90 - customer.recency, y: customer.frequency };
      default:
        return { x: customer.monetary, y: customer.frequency };
    }
  }

  function performClustering() {
    const dataWithMetrics = customers.map(c => ({
      ...c,
      ...getMetricValues(c)
    }));
    
    const result = kMeansWithHistory(dataWithMetrics, k, 100, useKMeansPlusPlus);
    setIterations(result.iterations);
    setCentroids(result.centroids);
    setHistory(result.history);
    setCurrentStep(result.history.length - 1);
    
    const clustered = customers.map((customer, i) => ({
      ...customer,
      ...getMetricValues(customer),
      cluster: result.assignments[i]
    }));
    
    setClusteredData(clustered);
    
    // Calculate silhouette score
    const silhouette = calculateSilhouette(dataWithMetrics, result.assignments, k);
    setSilhouetteScore(silhouette);
    
    // Convergence data
    const convData = result.inertias.map((inertia, i) => ({
      iteration: i,
      inertia: Math.round(inertia)
    }));
    setConvergenceData(convData);
    
    // Calculate cluster statistics
    const stats = [];
    for (let i = 0; i < k; i++) {
      const clusterCustomers = clustered.filter(c => c.cluster === i);
      if (clusterCustomers.length > 0) {
        stats.push({
          cluster: i,
          name: clusterNames[i % clusterNames.length],
          count: clusterCustomers.length,
          avgRecency: Math.round(clusterCustomers.reduce((sum, c) => sum + c.recency, 0) / clusterCustomers.length),
          avgFrequency: Math.round(clusterCustomers.reduce((sum, c) => sum + c.frequency, 0) / clusterCustomers.length),
          avgMonetary: Math.round(clusterCustomers.reduce((sum, c) => sum + c.monetary, 0) / clusterCustomers.length),
          totalValue: Math.round(clusterCustomers.reduce((sum, c) => sum + c.monetary, 0))
        });
      }
    }
    
    setClusterStats(stats.sort((a, b) => b.totalValue - a.totalValue));
  }

  function playAnimation() {
    setCurrentStep(0);
    setIsPlaying(true);
  }

  function pauseAnimation() {
    setIsPlaying(false);
  }

  function resetAnimation() {
    setIsPlaying(false);
    setCurrentStep(history.length - 1);
  }

  // Get current state from history
  const currentState = history[currentStep] || { centroids: [], assignments: [] };
  const animatedData = customers.map((customer, i) => ({
    ...customer,
    ...getMetricValues(customer),
    cluster: currentState.assignments[i] || 0
  }));

  const getMetricLabel = () => {
    switch(activeMetric) {
      case 'monetary-frequency':
        return { x: 'Annual Spending ($)', y: 'Purchase Frequency' };
      case 'recency-monetary':
        return { x: 'Recency Score (90 - days)', y: 'Annual Spending ($)' };
      case 'recency-frequency':
        return { x: 'Recency Score (90 - days)', y: 'Purchase Frequency' };
      default:
        return { x: 'X Axis', y: 'Y Axis' };
    }
  };

  const metricLabels = getMetricLabel();

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          background: 'rgba(10, 15, 25, 0.98)',
          border: `2px solid ${clusterColors[data.cluster]}`,
          borderRadius: '8px',
          padding: '12px 16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)'
        }}>
          <p style={{ color: clusterColors[data.cluster], fontWeight: '700', marginBottom: '8px', fontSize: '13px' }}>
            Customer #{data.id} • {clusterNames[data.cluster % clusterNames.length]}
          </p>
          <div style={{ fontSize: '11px', color: '#fff', lineHeight: '1.8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: '#8b9bb4' }}>Recency:</span>
              <span style={{ fontWeight: '600' }}>{data.recency} days</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: '#8b9bb4' }}>Frequency:</span>
              <span style={{ fontWeight: '600' }}>{data.frequency}x</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: '#8b9bb4' }}>Monetary:</span>
              <span style={{ color: '#00d4ff', fontWeight: '600' }}>${data.monetary.toLocaleString()}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0f19 0%, #1a1f2e 50%, #0f1419 100%)',
      padding: '48px 24px',
      fontFamily: '"Space Mono", monospace',
      color: '#fff'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Orbitron:wght@400;700;900&display=swap');
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 212, 255, 0.3); }
          50% { box-shadow: 0 0 40px rgba(0, 212, 255, 0.6); }
        }
        
        .fade-in { animation: fadeInUp 0.6s ease-out; }
        .glow { animation: glow 2s ease-in-out infinite; }
        
        .metric-btn {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        
        .metric-btn:hover {
          transform: translateY(-2px);
        }
        
        .metric-btn.active::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(0, 119, 255, 0.2));
          z-index: 0;
        }
        
        .stat-card {
          transition: all 0.3s ease;
        }
        
        .stat-card:hover {
          transform: translateY(-4px) scale(1.02);
        }
      `}</style>

      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <div className="fade-in" style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '56px',
            fontWeight: '900',
            background: 'linear-gradient(90deg, #00d4ff, #0077ff, #00d4ff)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '12px',
            letterSpacing: '2px'
          }}>
            K-MEANS++
          </div>
          <p style={{ fontSize: '14px', color: '#8b9bb4', letterSpacing: '3px', textTransform: 'uppercase' }}>
            Advanced ML Customer Segmentation
          </p>
          
          <div style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            marginTop: '20px',
            flexWrap: 'wrap'
          }}>
            <div style={{
              padding: '8px 20px',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ color: '#8b9bb4', fontSize: '11px' }}>ITERATIONS: </span>
              <span style={{ color: '#00d4ff', fontWeight: '700' }}>{iterations}</span>
              <InfoTooltip content="Number of iterations the K-means algorithm took to converge. Fewer iterations with K-means++ initialization indicates better starting centroids." />
            </div>
            <div style={{
              padding: '8px 20px',
              background: 'rgba(255, 51, 102, 0.1)',
              border: '1px solid rgba(255, 51, 102, 0.3)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ color: '#8b9bb4', fontSize: '11px' }}>SILHOUETTE: </span>
              <span style={{ color: '#ff3366', fontWeight: '700' }}>{silhouetteScore.toFixed(3)}</span>
              <InfoTooltip content="Silhouette score ranges from -1 to 1, measuring how well-defined the clusters are. Scores above 0.5 indicate good clustering, 0.3-0.5 is acceptable, and below 0.3 suggests overlapping clusters. Higher values mean customers within each cluster are similar, while clusters themselves are distinct." />
            </div>
            <div style={{
              padding: '8px 20px',
              background: 'rgba(255, 204, 0, 0.1)',
              border: '1px solid rgba(255, 204, 0, 0.3)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ color: '#8b9bb4', fontSize: '11px' }}>ALGORITHM: </span>
              <span style={{ color: '#ffcc00', fontWeight: '700' }}>
                {useKMeansPlusPlus ? 'K-MEANS++' : 'RANDOM'}
              </span>
              <InfoTooltip content="K-means++ uses smart initialization by selecting starting centroids that are far apart, leading to faster convergence and better clustering quality. Random initialization picks centroids randomly, which can lead to suboptimal results and slower convergence. Try toggling to see the difference!" />
            </div>
          </div>
        </div>

        {/* Controls Section */}
        <div className="fade-in" style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '32px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {/* K Selection */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: '700',
                color: '#00d4ff',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Clusters (K)
              </label>
              <input
                type="range"
                min="2"
                max="8"
                value={k}
                onChange={(e) => setK(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: 'linear-gradient(90deg, #00d4ff, #0077ff)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '11px', color: '#8b9bb4' }}>2</span>
                <span style={{ fontSize: '28px', fontWeight: '700', color: '#00d4ff', fontFamily: 'Orbitron' }}>
                  {k}
                </span>
                <span style={{ fontSize: '11px', color: '#8b9bb4' }}>8</span>
              </div>
            </div>

            {/* Metric Selection */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#00d4ff',
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  Feature Space
                </label>
                <InfoTooltip content="Feature space determines which customer attributes are used for clustering. Different combinations reveal different segmentation patterns: Monetary × Frequency shows spending vs purchase behavior, Recency × Monetary identifies engaged vs dormant high-spenders, and Recency × Frequency finds frequent buyers who may be churning." />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { value: 'monetary-frequency', label: 'Monetary × Frequency' },
                  { value: 'recency-monetary', label: 'Recency × Monetary' },
                  { value: 'recency-frequency', label: 'Recency × Frequency' }
                ].map(metric => (
                  <button
                    key={metric.value}
                    onClick={() => setActiveMetric(metric.value)}
                    className={`metric-btn ${activeMetric === metric.value ? 'active' : ''}`}
                    style={{
                      padding: '10px 16px',
                      background: activeMetric === metric.value 
                        ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(0, 119, 255, 0.2))'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: activeMetric === metric.value 
                        ? '1px solid rgba(0, 212, 255, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textAlign: 'left',
                      position: 'relative'
                    }}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Algorithm Options */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: '700',
                color: '#00d4ff',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Options
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={useKMeansPlusPlus}
                    onChange={(e) => setUseKMeansPlusPlus(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', color: '#e0e6ed' }}>Use K-means++ Initialization</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showCentroids}
                    onChange={(e) => setShowCentroids(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', color: '#e0e6ed' }}>Show Centroids</span>
                </label>
                <button
                  onClick={regenerateData}
                  disabled={isCalculating}
                  style={{
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #00d4ff, #0077ff)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: isCalculating ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    opacity: isCalculating ? 0.6 : 1
                  }}
                >
                  {isCalculating ? '⏳ Calculating...' : '🔄 Regenerate'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
          {/* Main Visualization */}
          <div className="fade-in" style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#00d4ff',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  Cluster Visualization
                </h3>
                <InfoTooltip content="This scatter plot shows how K-means groups customers into distinct clusters based on selected features. Each point represents a customer, colored by their assigned cluster. The cross marks (✕) indicate cluster centroids—the mathematical center of each group. Watch how points migrate between clusters as the algorithm iterates." />
              </div>
              <div style={{ fontSize: '11px', color: '#8b9bb4' }}>
                Step: <span style={{ color: '#00d4ff', fontWeight: '700' }}>{currentStep + 1}</span> / {history.length}
              </div>
            </div>
            
            <ResponsiveContainer width="100%" height={450}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={metricLabels.x}
                  label={{
                    value: metricLabels.x,
                    position: 'bottom',
                    offset: 40,
                    style: { fill: '#8b9bb4', fontSize: '12px', fontWeight: '600' }
                  }}
                  stroke="#8b9bb4"
                  tick={{ fill: '#8b9bb4', fontSize: '11px' }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={metricLabels.y}
                  label={{
                    value: metricLabels.y,
                    angle: -90,
                    position: 'left',
                    offset: 40,
                    style: { fill: '#8b9bb4', fontSize: '12px', fontWeight: '600' }
                  }}
                  stroke="#8b9bb4"
                  tick={{ fill: '#8b9bb4', fontSize: '11px' }}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {Array.from({ length: k }).map((_, i) => (
                  <Scatter
                    key={i}
                    name={clusterNames[i % clusterNames.length]}
                    data={animatedData.filter(d => d.cluster === i)}
                    fill={clusterColors[i]}
                  >
                    {animatedData.filter(d => d.cluster === i).map((entry, index) => (
                      <Cell key={`cell-${index}`} opacity={0.7} />
                    ))}
                  </Scatter>
                ))}
                
                {showCentroids && currentState.centroids.map((centroid, i) => (
                  <Scatter
                    key={`centroid-${i}`}
                    data={[{ x: centroid[0], y: centroid[1] }]}
                    fill={clusterColors[i]}
                    shape="cross"
                  >
                    <Cell stroke={clusterColors[i]} strokeWidth={4} fill="none" />
                  </Scatter>
                ))}
              </ScatterChart>
            </ResponsiveContainer>

            {/* Animation Controls */}
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '12px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <button
                onClick={playAnimation}
                disabled={isPlaying}
                style={{
                  padding: '10px 20px',
                  background: isPlaying ? 'rgba(255, 255, 255, 0.1)' : 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: isPlaying ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                ▶ Play
              </button>
              <button
                onClick={pauseAnimation}
                disabled={!isPlaying}
                style={{
                  padding: '10px 20px',
                  background: !isPlaying ? 'rgba(255, 255, 255, 0.1)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: !isPlaying ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                ⏸ Pause
              </button>
              <button
                onClick={resetAnimation}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                ⏹ Reset
              </button>
              <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#8b9bb4' }}>Speed:</span>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="100"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseInt(e.target.value))}
                  style={{
                    width: '100px',
                    height: '4px',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#00d4ff', fontWeight: '700' }}>
                  {(1000 / playbackSpeed).toFixed(1)}x
                </span>
              </div>
            </div>
          </div>

          {/* Convergence Chart */}
          <div className="fade-in" style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#00d4ff',
                marginBottom: '16px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Convergence History
              </h3>
              <InfoTooltip content="Inertia measures the total within-cluster sum of squared distances—essentially how tightly grouped each cluster is. As K-means iterates, inertia decreases until the algorithm converges (when points stop changing clusters). A steeper drop indicates faster optimization, while a flat line means convergence is reached." />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={convergenceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis
                  dataKey="iteration"
                  stroke="#8b9bb4"
                  tick={{ fill: '#8b9bb4', fontSize: '10px' }}
                  label={{ value: 'Iteration', position: 'bottom', style: { fill: '#8b9bb4', fontSize: '11px' } }}
                />
                <YAxis
                  stroke="#8b9bb4"
                  tick={{ fill: '#8b9bb4', fontSize: '10px' }}
                  label={{ value: 'Inertia', angle: -90, position: 'left', style: { fill: '#8b9bb4', fontSize: '11px' } }}
                />
                <Line
                  type="monotone"
                  dataKey="inertia"
                  stroke="#00d4ff"
                  strokeWidth={3}
                  dot={{ fill: '#00d4ff', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>

            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#ff3366',
                marginTop: '24px',
                marginBottom: '16px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Elbow Method
              </h3>
              <InfoTooltip content="The elbow method helps determine the optimal number of clusters (K). Plot inertia vs K—the 'elbow' point where the curve bends indicates diminishing returns from adding more clusters. Silhouette scores (0-1 scale) measure cluster quality: higher values mean clusters are well-separated and cohesive. Look for high silhouette scores near the elbow point." />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={elbowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis
                  dataKey="k"
                  stroke="#8b9bb4"
                  tick={{ fill: '#8b9bb4', fontSize: '10px' }}
                  label={{ value: 'K (clusters)', position: 'bottom', style: { fill: '#8b9bb4', fontSize: '11px' } }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#8b9bb4"
                  tick={{ fill: '#8b9bb4', fontSize: '10px' }}
                  label={{ value: 'Inertia', angle: -90, position: 'left', style: { fill: '#8b9bb4', fontSize: '11px' } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#8b9bb4"
                  tick={{ fill: '#8b9bb4', fontSize: '10px' }}
                  label={{ value: 'Silhouette', angle: 90, position: 'right', style: { fill: '#8b9bb4', fontSize: '11px' } }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="inertia"
                  stroke="#ff3366"
                  strokeWidth={2}
                  dot={{ fill: '#ff3366', r: 5 }}
                  name="Inertia"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="silhouette"
                  stroke="#ffcc00"
                  strokeWidth={2}
                  dot={{ fill: '#ffcc00', r: 5 }}
                  name="Silhouette"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cluster Statistics */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#00d4ff',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              margin: 0
            }}>
              RFM Cluster Statistics
            </h3>
            <InfoTooltip content="RFM (Recency, Frequency, Monetary) analysis segments customers based on three key behaviors: How recently they purchased (Recency), how often they purchase (Frequency), and how much they spend (Monetary). Each cluster represents a distinct customer segment with different engagement patterns and lifetime value." />
          </div>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {clusterStats.map((stat, index) => (
            <div
              key={stat.cluster}
              className="stat-card"
              style={{
                background: `linear-gradient(135deg, rgba(${parseInt(clusterColors[stat.cluster].slice(1, 3), 16)}, ${parseInt(clusterColors[stat.cluster].slice(3, 5), 16)}, ${parseInt(clusterColors[stat.cluster].slice(5, 7), 16)}, 0.15), rgba(255, 255, 255, 0.03))`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${clusterColors[stat.cluster]}60`,
                borderRadius: '12px',
                padding: '20px',
                boxShadow: `0 4px 16px ${clusterColors[stat.cluster]}20`
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <h4 style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: clusterColors[stat.cluster],
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {stat.name}
                </h4>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: clusterColors[stat.cluster],
                  boxShadow: `0 0 10px ${clusterColors[stat.cluster]}`
                }} />
              </div>
              
              <div style={{ fontSize: '11px', color: '#e0e6ed', lineHeight: '2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8b9bb4' }}>Count:</span>
                  <span style={{ fontWeight: '700' }}>{stat.count}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8b9bb4' }}>Avg Recency:</span>
                  <span style={{ fontWeight: '600' }}>{stat.avgRecency}d</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8b9bb4' }}>Avg Frequency:</span>
                  <span style={{ fontWeight: '600' }}>{stat.avgFrequency}x</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8b9bb4' }}>Avg Monetary:</span>
                  <span style={{ fontWeight: '700', color: '#00d4ff' }}>${stat.avgMonetary.toLocaleString()}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <span style={{ color: '#8b9bb4', fontWeight: '600' }}>Total:</span>
                  <span style={{ fontWeight: '700', fontSize: '12px', color: clusterColors[stat.cluster] }}>
                    ${stat.totalValue.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          padding: '24px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <p style={{ fontSize: '11px', color: '#8b9bb4', margin: 0, letterSpacing: '1px' }}>
            K-MEANS++ INITIALIZATION • EUCLIDEAN DISTANCE • SILHOUETTE ANALYSIS • ELBOW METHOD • RFM SEGMENTATION
          </p>
        </div>
      </div>
    </div>
  );
}
