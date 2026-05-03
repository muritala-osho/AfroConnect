const logger = require('./logger');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../models');

let loadingPromise = null;
let modelsLoaded = false;
let faceapi = null;
let tf = null;

async function loadModels() {
  if (modelsLoaded) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      faceapi = require('@vladmandic/face-api/dist/face-api.node.js');
      tf = faceapi.tf || require('@tensorflow/tfjs');
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsDir);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsDir);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsDir);
      modelsLoaded = true;
      logger.log('[FaceVerifier] Models loaded successfully');
      return true;
    } catch (err) {
      logger.error('[FaceVerifier] Failed to load models:', err.message);
      modelsLoaded = false;
      return false;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

module.exports = { loadModels };
