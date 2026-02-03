const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const predictionDiv = document.getElementById('prediction');
const probBarsDiv = document.getElementById('probBars');
const statusDiv = document.getElementById('status');
const clearBtn = document.getElementById('clearBtn');
const predictBtn = document.getElementById('predictBtn');

let isDrawing = false;
let model = null;

// Initialize canvas
ctx.fillStyle = '#000000';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 20;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// Load the model
async function loadModel() {
    try {
        statusDiv.textContent = 'Loading AI model...';
        statusDiv.className = 'status';

        const modelUrl = document.getElementById('app-data').dataset.modelUrl;
        model = await tf.loadLayersModel(modelUrl);

        statusDiv.textContent = 'Model loaded successfully! Ready to predict.';
        statusDiv.className = 'status success';
        predictBtn.disabled = false;
    } catch (error) {
        console.error('Error loading model:', error);
        statusDiv.textContent = 'Error loading model. Make sure model files are accessible.';
        statusDiv.className = 'status error';
        predictBtn.disabled = true;
    }
}

// Drawing functions
function startDrawing(e) {
    isDrawing = true;
    draw(e);
}

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x, y;

    if (e.type.includes('touch')) {
        x = (e.touches[0].clientX - rect.left) * scaleX;
        y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
        x = (e.clientX - rect.left) * scaleX;
        y = (e.clientY - rect.top) * scaleY;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
}

// Mouse events
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// Touch events
canvas.addEventListener('touchstart', startDrawing);
canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchend', stopDrawing);

// Clear canvas
clearBtn.addEventListener('click', () => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    predictionDiv.innerHTML = '<div class="empty-state">Draw a digit to begin</div>';
    probBarsDiv.innerHTML = '';
});

// Preprocess canvas for prediction
function preprocessCanvas() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 28;
    tempCanvas.height = 28;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(canvas, 0, 0, 28, 28);
    const smallImageData = tempCtx.getImageData(0, 0, 28, 28);

    const data = new Float32Array(28 * 28);

    for (let i = 0; i < 28 * 28; i++) {
        const offset = i * 4;
        const avg = (smallImageData.data[offset] +
                     smallImageData.data[offset + 1] +
                     smallImageData.data[offset + 2]) / 3;
        data[i] = avg / 255.0;
    }

    return tf.tensor4d(data, [1, 28, 28, 1]);
}

// Make prediction
async function predict() {
    if (!model) {
        alert('Model not loaded yet. Please wait...');
        return;
    }

    try {
        const tensor = preprocessCanvas();
        const prediction = await model.predict(tensor);
        const probabilities = await prediction.data();

        const predictedDigit = prediction.argMax(-1).dataSync()[0];
        const confidence = (probabilities[predictedDigit] * 100).toFixed(1);

        predictionDiv.innerHTML = `
            <div class="prediction-value">${predictedDigit}</div>
            <div class="confidence">
                Confidence: <span class="confidence-value">${confidence}%</span>
            </div>
        `;

        displayProbabilities(probabilities);

        tensor.dispose();
        prediction.dispose();
    } catch (error) {
        console.error('Prediction error:', error);
        statusDiv.textContent = 'Error making prediction. Please try again.';
        statusDiv.className = 'status error';
    }
}

// Display probability bars
function displayProbabilities(probabilities) {
    probBarsDiv.innerHTML = '';

    for (let i = 0; i < 10; i++) {
        const prob = (probabilities[i] * 100).toFixed(1);
        const barWidth = probabilities[i] * 100;

        const probItem = document.createElement('div');
        probItem.className = 'prob-item';
        probItem.innerHTML = `
            <div class="prob-digit">${i}</div>
            <div class="prob-bar-container">
                <div class="prob-bar" style="width: ${barWidth}%">
                    ${barWidth > 10 ? `<span class="prob-value">${prob}%</span>` : ''}
                </div>
            </div>
        `;

        probBarsDiv.appendChild(probItem);
    }
}

// Predict button
predictBtn.addEventListener('click', predict);
predictBtn.disabled = true;

// Load model on page load
loadModel();
