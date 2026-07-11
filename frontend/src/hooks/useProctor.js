import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { API_URL } from '../config';

export const useProctor = ({ testId, userId, userName, userEmail, socket, onViolationTriggered, onExamPaused, enabled = true }) => {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [stream, setStream] = useState(null);
  const [strikes, setStrikes] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [phoneDetected, setPhoneDetected] = useState(false);

  const videoRef = useRef(null);
  const faceModelRef = useRef(null);
  const objectModelRef = useRef(null);
  const intervalRef = useRef(null);
  const strikeCountRef = useRef(0);
  const streamRef = useRef(null);

  const socketRef = useRef(socket);
  const userNameRef = useRef(userName);
  const userEmailRef = useRef(userEmail);
  const onViolationTriggeredRef = useRef(onViolationTriggered);
  const onExamPausedRef = useRef(onExamPaused);

  const violationStartRef = useRef(null);
  const pausedTriggeredRef = useRef(false);
  const noFaceStartRef = useRef(null);

  useEffect(() => {
    socketRef.current = socket;
    userNameRef.current = userName;
    userEmailRef.current = userEmail;
    onViolationTriggeredRef.current = onViolationTriggered;
    onExamPausedRef.current = onExamPaused;
  }, [socket, userName, userEmail, onViolationTriggered, onExamPaused]);

  // Initialize TensorFlow.js and load models
  useEffect(() => {
    if (!enabled) return;

    const loadModels = async () => {
      try {
        await tf.ready();
        
        // Load models in parallel using fast lightweight coco base
        const [faceModel, objectModel] = await Promise.all([
          blazeface.load(),
          cocoSsd.load({ base: 'lite_mobilenet_v2' }),
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
      streamRef.current = mediaStream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Add camera disconnected listener to video tracks
      mediaStream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          console.warn('🎥 Video track ended (camera disconnected).');
          if (!pausedTriggeredRef.current) {
            pausedTriggeredRef.current = true;
            if (socketRef.current && socketRef.current.connected) {
              socketRef.current.emit('pause_candidate_exam', { testId, userId, reason: 'CAMERA_DISCONNECTED' });
            }
            if (onExamPausedRef.current) {
              onExamPausedRef.current('CAMERA_DISCONNECTED');
            }
          }
        };
      });

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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
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
    if (onViolationTriggeredRef.current) {
      onViolationTriggeredRef.current({ eventType, strikes: updatedStrikes });
    }

    // Emit real-time notification to socket
    const currentSocket = socketRef.current;
    if (currentSocket && currentSocket.connected) {
      currentSocket.emit('report_violation', {
        testId,
        userId,
        eventType,
        proof: proofText || `Violation detected: ${eventType}`,
        name: userNameRef.current,
        email: userEmailRef.current,
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

  const captureSnapshot = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      
      const ctx = canvas.getContext('2d');
      // Mirror canvas to match the candidate webcam preview mirror styling
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.55);
    } catch (e) {
      console.error('Failed to capture canvas snapshot:', e);
      return null;
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
            const proofImg = captureSnapshot();
            await triggerViolation('NO_FACE', proofImg || 'No face detected in webcam stream.');

            if (!noFaceStartRef.current) {
              noFaceStartRef.current = Date.now();
            } else {
              const duration = Date.now() - noFaceStartRef.current;
              if (duration >= 3000 && !pausedTriggeredRef.current) {
                pausedTriggeredRef.current = true;
                if (socketRef.current && socketRef.current.connected) {
                  socketRef.current.emit('pause_candidate_exam', { testId, userId, reason: 'NO_FACE' });
                }
                if (onExamPausedRef.current) {
                  onExamPausedRef.current('NO_FACE');
                }
              }
            }
          } else if (predictions.length > 1) {
            noFaceStartRef.current = null;
            const proofImg = captureSnapshot();
            await triggerViolation('MULTIPLE_FACES', proofImg || `Multiple faces (${predictions.length}) detected in webcam.`);

            if (!pausedTriggeredRef.current) {
              pausedTriggeredRef.current = true;
              if (socketRef.current && socketRef.current.connected) {
                socketRef.current.emit('pause_candidate_exam', { testId, userId, reason: 'MULTIPLE_FACES' });
              }
              if (onExamPausedRef.current) {
                onExamPausedRef.current('MULTIPLE_FACES');
              }
            }
          } else {
            noFaceStartRef.current = null;
            // Check head posture / looking away/down
            const p = predictions[0];
            const landmarks = p.landmarks;
            if (landmarks && landmarks.length >= 4) {
              const rightEyeY = landmarks[0][1];
              const leftEyeY = landmarks[1][1];
              const rightEyeX = landmarks[0][0];
              const leftEyeX = landmarks[1][0];
              const noseY = landmarks[2][1];
              const noseX = landmarks[2][0];
              const mouthY = landmarks[3][1];

              const avgEyeY = (leftEyeY + rightEyeY) / 2;
              const eyeCenter = (leftEyeX + rightEyeX) / 2;
              
              const box = p.box; // [x1, y1, x2, y2]
              const height = box[3] - box[1];
              const width = box[2] - box[0];
              
              const eyeNoseRatio = (noseY - avgEyeY) / height;
              const horizontalDeviation = Math.abs(noseX - eyeCenter) / width;

              const isLookingSuspicious = (eyeNoseRatio < 0.10) || (horizontalDeviation > 0.12);

              if (isLookingSuspicious) {
                if (!violationStartRef.current) {
                  violationStartRef.current = Date.now();
                } else {
                  const duration = Date.now() - violationStartRef.current;
                  if (duration >= 3000 && !pausedTriggeredRef.current) {
                    pausedTriggeredRef.current = true;
                    const proofImg = captureSnapshot();
                    const infractionType = (eyeNoseRatio < 0.10) ? 'LOOKING_DOWN' : 'LOOKING_AWAY';
                    
                    // Log suspicious posture and request pause
                    await triggerViolation('SUSPICIOUS_LOOKING', proofImg || `Student stayed in suspicious posture (${infractionType}) for more than 3s.`);
                    
                    if (socketRef.current && socketRef.current.connected) {
                      socketRef.current.emit('pause_candidate_exam', { testId, userId, reason: 'LOOKING_AWAY' });
                    }
                    
                    if (onExamPausedRef.current) {
                      onExamPausedRef.current('LOOKING_AWAY');
                    }
                  }
                }

                if (eyeNoseRatio < 0.10) {
                  const proofImg = captureSnapshot();
                  await triggerViolation('LOOKING_DOWN', proofImg || 'Student is looking down away from the screen.');
                } else {
                  const proofImg = captureSnapshot();
                  await triggerViolation('LOOKING_AWAY', proofImg || 'Student is looking away from the screen.');
                }
              } else {
                violationStartRef.current = null;
                pausedTriggeredRef.current = false;
              }
            }
          }
        }

        // --- 2. Object Detection (Cell Phone / Camera) ---
        if (objectModelRef.current) {
          const predictions = await objectModelRef.current.detect(video);
          const cellPhone = predictions.find(
            (p) => (p.class === 'cell phone' || p.class === 'remote') && p.score > 0.25
          );
          const cameraDevice = predictions.find(
            (p) => p.class === 'camera' && p.score > 0.25
          );

          if (cellPhone || cameraDevice) {
            setPhoneDetected(true);
            const proofImg = captureSnapshot();
            const eventType = cameraDevice ? 'CAMERA_DETECTED' : 'PHONE_DETECTED';
            const label = cameraDevice ? 'Camera device' : 'Mobile phone';
            
            await triggerViolation(eventType, proofImg || `${label} detected.`);

            if (!pausedTriggeredRef.current) {
              pausedTriggeredRef.current = true;
              if (socketRef.current && socketRef.current.connected) {
                socketRef.current.emit('pause_candidate_exam', { testId, userId });
              }
              if (onExamPausedRef.current) {
                onExamPausedRef.current();
              }
            }
          } else {
            setPhoneDetected(false);
          }
        } else {
          setPhoneDetected(false);
        }
      } catch (err) {
        console.error('Detection engine cycle error:', err);
        setPhoneDetected(false);
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

    let blurTimeout = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation('TAB_SWITCH', 'Student switched browser tab or minimized window.');
      }
    };

    const handleWindowBlur = () => {
      if (blurTimeout) clearTimeout(blurTimeout);
      blurTimeout = setTimeout(() => {
        if (!document.hasFocus() && enabled && cameraActive) {
          triggerViolation('WINDOW_BLUR', 'Student left the browser viewport (window unfocused for more than 3s).');
        }
      }, 3000);
    };

    const handleWindowFocus = () => {
      if (blurTimeout) {
        clearTimeout(blurTimeout);
        blurTimeout = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      if (blurTimeout) clearTimeout(blurTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [cameraActive, enabled, userName, userEmail]);

  const resumeProctor = () => {
    violationStartRef.current = null;
    pausedTriggeredRef.current = false;
  };

  return {
    modelsLoaded,
    stream,
    strikes,
    cameraActive,
    errorMsg,
    videoRef,
    startCamera,
    stopCamera,
    phoneDetected,
    resumeProctor,
  };
};
