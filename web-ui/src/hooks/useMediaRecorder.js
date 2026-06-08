import { useRef, useCallback } from 'react';

export function useMediaRecorder() {
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timeoutRef = useRef(null);

  const startRecording = useCallback(({ onData, onError, maxDuration = 15000 } = {}) => {
    return new Promise((resolve, reject) => {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          streamRef.current = stream;
          chunksRef.current = [];

          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';

          const recorder = new MediaRecorder(stream, { mimeType });

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
          };

          recorder.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            const blob = new Blob(chunksRef.current, { type: mimeType });
            onData?.(blob);
            resolve(blob);
          };

          recorder.onerror = (e) => {
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            const err = new Error('MediaRecorder error');
            onError?.(err);
            reject(err);
          };

          recorder.start(250);
          recorderRef.current = recorder;

          timeoutRef.current = setTimeout(() => {
            if (recorder.state === 'recording') recorder.stop();
          }, maxDuration);
        })
        .catch((err) => {
          onError?.(err);
          reject(err);
        });
    });
  }, []);

  const stopRecording = useCallback(() => {
    clearTimeout(timeoutRef.current);
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  return { startRecording, stopRecording };
}
