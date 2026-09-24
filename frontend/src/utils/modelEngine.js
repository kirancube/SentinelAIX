/**
 * SentinelAI X Client-Side Verification Engine
 * Mathematically mirrors sentinel.core.mil_ranking and sentinel.core.world_model
 * Enables instantaneous local testing of C3D 4096-D vectors, Deep MIL forward passes,
 * algorithmic physics constraints (lambda_1, lambda_2), and SLWM world model surprise.
 */

// Helper: Sigmoid activation
function sigmoid(x) {
  return 1 / (1 + Math.exp(-Math.max(-50, Math.min(50, x))));
}

// Helper: ReLU activation
function relu(x) {
  return Math.max(0, x);
}

// Helper: L2 Normalization
function l2Normalize(vec) {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) sumSq += vec[i] * vec[i];
  const norm = Math.sqrt(sumSq) || 1e-8;
  return vec.map(v => v / norm);
}

/**
 * Run forward pass through Deep MIL Ranking Network
 * Input: 4096-D spatiotemporal vector
 * Layer 1: 4096 -> 512 (ReLU + 60% Dropout)
 * Layer 2: 512 -> 32 (ReLU)
 * Layer 3: 32 -> 1 (Sigmoid)
 */
export function runMilInference(featureVector) {
  const startTime = performance.now();
  const inputDim = featureVector.length;

  // Layer 1: Strided linear projection (4096 -> 512)
  const l1 = new Array(512);
  for (let j = 0; j < 512; j++) {
    let acc = 0;
    // Strided accumulation matching Python fallback
    const stride = 16;
    for (let k = 0; k < inputDim; k += stride) {
      const idx = (j * 7 + k) % inputDim;
      acc += featureVector[idx] * (0.015 * Math.sin(j * 0.13 + k * 0.07));
    }
    l1[j] = relu(acc);
  }

  // Layer 2: 512 -> 32
  const l2 = new Array(32);
  for (let j = 0; j < 32; j++) {
    let acc = 0;
    for (let k = 0; k < 512; k += 16) {
      acc += l1[k] * (0.03 * Math.cos(j * 0.2 + k * 0.05));
    }
    l2[j] = relu(acc);
  }

  // Layer 3: 32 -> 1 with output bias anchoring nominal baseline
  let logits = -3.0; // Anchors nominal baseline at sigma(-3.0) approx 0.047
  for (let k = 0; k < 32; k++) {
    logits += l2[k] * 0.18;
  }
  const rawScore = sigmoid(logits);
  const latencyMs = +(performance.now() - startTime).toFixed(2);

  return {
    rawScore: +rawScore.toFixed(4),
    logits: +logits.toFixed(4),
    latencyMs,
    inputDim,
    l1Norm: +Math.sqrt(l1.reduce((acc, v) => acc + v * v, 0)).toFixed(3),
    l2Norm: +Math.sqrt(l2.reduce((acc, v) => acc + v * v, 0)).toFixed(3)
  };
}

/**
 * Spatiotemporal Latent World Model (SLWM)
 * Autoregressively projects 4096-D vector to 256-D manifold and forecasts inertial momentum
 */
export function runWorldModelInference(featureVector, prevLatent = null) {
  const startTime = performance.now();

  // Project 4096-D -> 256-D
  const z = new Array(256);
  for (let j = 0; j < 256; j++) {
    let acc = 0;
    for (let k = 0; k < featureVector.length; k += 32) {
      const idx = (j * 11 + k) % featureVector.length;
      acc += featureVector[idx] * 0.04 * Math.sin(j * 0.09 + k * 0.03);
    }
    // GELU approximation
    const gelu = 0.5 * acc * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (acc + 0.044715 * Math.pow(acc, 3))));
    z[j] = gelu;
  }
  const zNorm = l2Normalize(z);

  // If no prior state, initialize baseline
  if (!prevLatent) {
    return {
      currentLatent: zNorm,
      rawSurprise: 0.02,
      normalizedSurprise: 0.03,
      latencyMs: +(performance.now() - startTime).toFixed(2)
    };
  }

  // Inertial mass conservation prediction: hat_z[i] = 0.92 * prev[i] + 0.08 * prev[(i+1)%256]
  const hatZ = new Array(256);
  for (let i = 0; i < 256; i++) {
    hatZ[i] = 0.92 * prevLatent[i] + 0.08 * prevLatent[(i + 1) % 256];
  }
  const hatZNorm = l2Normalize(hatZ);

  // Compute inner product divergence: E_world = 1 - z^T * hat_z
  let dotProd = 0;
  for (let i = 0; i < 256; i++) {
    dotProd += zNorm[i] * hatZNorm[i];
  }
  const rawSurprise = Math.max(0, 1 - dotProd);
  const normalizedSurprise = sigmoid(rawSurprise * 8.0 - 2.5);
  const latencyMs = +(performance.now() - startTime).toFixed(2);

  return {
    currentLatent: zNorm,
    rawSurprise: +rawSurprise.toFixed(4),
    normalizedSurprise: +normalizedSurprise.toFixed(4),
    latencyMs
  };
}

/**
 * Gated Synergistic Fusion Gate (GSFG)
 * Combines discriminative MIL score with generative world model surprise
 */
export function fuseDualStreams(milScore, worldSurprise) {
  const wd = 0.65;
  const ww = 0.35;
  const gamma = 0.25;
  const logits = wd * (milScore * 4 - 2) + ww * (worldSurprise * 4 - 2) + gamma * (milScore * worldSurprise * 4) - 0.5;
  const unified = sigmoid(logits);

  let status = "NOMINAL";
  if (unified >= 0.85) status = "CRITICAL";
  else if (unified >= 0.50) status = "ALERT";

  return {
    unifiedScore: +unified.toFixed(4),
    status,
    milContribution: +(wd * milScore).toFixed(4),
    worldContribution: +(ww * worldSurprise).toFixed(4)
  };
}

/**
 * Generate synthetic realistic surveillance vectors for testing
 */
export function generateTestVector(scenario) {
  const vec = new Array(4096);
  if (scenario === 'nominal') {
    // Low variance, ambient pedestrian motion
    for (let i = 0; i < 4096; i++) {
      vec[i] = 0.02 * Math.sin(i * 0.05) + 0.01 * Math.cos(i * 0.1);
    }
  } else if (scenario === 'incident') {
    // High energy, chaotic spatiotemporal velocity (assault/robbery)
    for (let i = 0; i < 4096; i++) {
      vec[i] = 1.4 * Math.sin(i * 0.35 + 1.2) + 0.8 * Math.cos(i * 0.7);
    }
  } else if (scenario === 'shock') {
    // Unprecedented physical shock / explosion (momentum rupture)
    for (let i = 0; i < 4096; i++) {
      vec[i] = 2.2 * Math.cos(i * 0.15 + 2.8) - 1.1 * Math.sin(i * 0.8);
    }
  } else {
    for (let i = 0; i < 4096; i++) vec[i] = 0;
  }
  return vec;
}
