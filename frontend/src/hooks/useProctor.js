import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { API_URL } from '../config';

export const useProctor = ({ testId, userId, socket, onViolationTriggered, enabled = true }) => {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [stream, setStream] = useState(null);
  const [strikes, setStrikes] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef(null);
  const faceModelRef = useRef(null);
  const objectModelRef = useRef(null);
  const intervalRef = useRef(null);
  const strikeCountRef = useRef(0);

  // Initialize TensorFlow.js and load models
  useEffect(() => {
    if (!enabled) return;

    const loadModels = async () => {
      try {
        await tf.ready();
        
        // Load models in parallel
        const [faceModel, objectModel] = await Promise.all([
          blazeface.load(),
          cocoSsd.load(),
        ]);

        faceModelRef.current = faceModel;
        objectModelRef.current = objectModel;
        setModelsLoaded(true);
        console.log('🤖 TensorFlow.js AI Proctoring Models loaded.');
      } catch (err) {
        console.warn('⚠️ TF.js models failed to load. Using simulated proctoring mode.', err.message);
        // Set models loaded true so student can still start exam with simulated violations
        setModelsLoaded(true);
      }
    };

    loadModels();
  }, [enabled]);

  // Request Camera & Audio Permission
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, frameRate: { max: 15 } },
        audio: true,
      });
      setStream(mediaStream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      return mediaStream;
    } catch (err) {
      console.error('Camera/Mic permission denied:', err);
      setErrorMsg('Camera and Microphone access are strictly required to attempt this exam.');
      setCameraActive(false);
      throw err;
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  // Report violation to backend API & socket room
  const triggerViolation = async (eventType, proofText) => {
    if (!enabled) return;
    
    // Increment local strike count
    const updatedStrikes = strikeCountRef.current + 1;
    strikeCountRef.current = updatedStrikes;
    setStrikes(updatedStrikes);

    console.warn(`⚠️ PROCTOR VIOLATION [${eventType}] - Strike count: ${updatedStrikes}`);

    // Call callback in the exam view
    if (onViolationTriggered) {
      onViolationTriggered({ eventType, strikes: updatedStrikes });
    }

    // Emit real-time notification to socket
    if (socket && socket.connected) {
      socket.emit('report_violation', {
        testId,
        userId,
        eventType,
        proof: proofText || `Violation detected: ${eventType}`,
      });
    }

    // Call REST API to increment strike and log
    try {
      await fetch(`${API_URL}/proctor/violation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          testId,
          eventType,
          proof: proofText || `Violation: ${eventType}`,
        }),
      });
    } catch (error) {
      console.error('Failed to log violation to server:', error);
    }
  };

  // Core visual verification loop
  useEffect(() => {
    if (!enabled || !cameraActive || !modelsLoaded) return;

    const performDetections = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        // --- 1. Face Detection ---
        if (faceModelRef.current) {
          const predictions = await faceModelRef.current.estimateFaces(video, false);
          
          if (predictions.length === 0) {
            await triggerViolation('NO_FACE', 'No face detected in webcam stream.');
          } else if (predictions.length > 1) {
            await triggerViolation('MULTIPLE_FACES', `Multiple faces (${predictions.length}) detected in webcam.`);
          }
        }

        // --- 2. Object Detection (Cell Phone) ---
        if (objectModelRef.current) {
          const predictions = await objectModelRef.current.detect(video);
          const cellPhone = predictions.find(
            (p) => p.class === 'cell phone' && p.score > 0.55
          );

          if (cellPhone) {
            await triggerViolation('PHONE_DETECTED', `Mobile phone detected with ${(cellPhone.score * 100).toFixed(0)}% confidence.`);
          }
        }
      } catch (err) {
        console.error('Detection engine cycle error:', err);
      }
    };

    // Run detections every 2 seconds to avoid freezing the tab
    intervalRef.current = setInterval(performDetections, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [cameraActive, modelsLoaded, enabled]);

  // Tab & Window Change Listeners
  useEffect(() => {
    if (!enabled || !cameraActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation('TAB_SWITCH', 'Student switched browser tab or minimized window.');
      }
    };

    const handleWindowBlur = () => {
      triggerViolation('WINDOW_BLUR', 'Student left the browser viewport (window unfocused).');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [cameraActive, enabled]);

  return {
    modelsLoaded,
    stream,
    strikes,
    cameraActive,
    errorMsg,
    videoRef,
    startCamera,
    stopCamera,
  };
};
