# Digit Recognition

Interactive handwritten digit recognition using a neural network trained on the MNIST dataset. Draw a digit on the canvas and the model predicts it in real-time with per-class confidence scores.

## How It Works

All inference runs **client-side** via TensorFlow.js -- no server calls required. A pre-trained Keras model is converted to TensorFlow.js format and loaded directly in the browser.

**Model architecture:**

```
Input (28x28) -> Flatten -> Dense(128, ReLU) -> Dense(64, ReLU) -> Dense(10, Softmax)
```

The canvas captures the user's drawing, downsamples it to 28x28 grayscale pixels normalized to [0, 1], and feeds it through the network. The output is a probability distribution over digits 0-9, displayed as confidence bars.

## Tech Stack

- **TensorFlow.js** -- client-side neural network inference
- **Canvas API** -- drawing input and image preprocessing
- **Flask** -- serves the page (no backend inference)

## Project Structure

```
digit_recognition/
├── __init__.py                  # Flask blueprint (GET /)
├── templates/
│   └── digit_recognition/
│       └── index.html           # UI with canvas and prediction display
└── static/
    ├── script.js                # Canvas drawing logic and model inference
    └── tfjs_model/              # Pre-trained model weights and topology
```

## Route

| Method | Path                | Description       |
|--------|---------------------|-------------------|
| GET    | `/digit-recognition/` | Main page       |
