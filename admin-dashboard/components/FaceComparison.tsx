import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Brain, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface FaceComparisonProps {
  profilePhotoUrl: string;
  selfiePhotoUrl: string;
  onResult?: (matched: boolean, score: number) => void;
}

const MODELS_URL = '/models';
const MATCH_THRESHOLD = 0.5; // distance ≤ 0.5 = same person

let modelsLoaded = false;

const FaceComparison: React.FC<FaceComparisonProps> = ({ profilePhotoUrl, selfiePhotoUrl, onResult }) => {
  const [status, setStatus] = useState<'idle' | 'loading-models' | 'analyzing' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ matched: boolean; distance: number; confidence: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const imgRef1 = useRef<HTMLImageElement>(null);
  const imgRef2 = useRef<HTMLImageElement>(null);
  const ran = useRef(false);

  const loadModels = async () => {
    if (modelsLoaded) return;
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
    modelsLoaded = true;
  };

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  };

  const compare = async () => {
    if (ran.current) return;
    ran.current = true;
    try {
      setStatus('loading-models');
      await loadModels();

      setStatus('analyzing');
      const [img1, img2] = await Promise.all([
        loadImage(profilePhotoUrl),
        loadImage(selfiePhotoUrl),
      ]);

      const opts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });

      const [det1, det2] = await Promise.all([
        faceapi.detectSingleFace(img1, opts).withFaceLandmarks().withFaceDescriptor(),
        faceapi.detectSingleFace(img2, opts).withFaceLandmarks().withFaceDescriptor(),
      ]);

      if (!det1) throw new Error('No face detected in the profile photo.');
      if (!det2) throw new Error('No face detected in the submitted selfie.');

      const distance = faceapi.euclideanDistance(det1.descriptor, det2.descriptor);
      const matched = distance <= MATCH_THRESHOLD;
      const confidence = Math.max(0, Math.min(100, Math.round((1 - distance / 1.2) * 100)));

      const res = { matched, distance, confidence };
      setResult(res);
      setStatus('done');
      onResult?.(matched, confidence);
    } catch (err: any) {
      setErrorMsg(err.message || 'Face comparison failed.');
      setStatus('error');
    }
  };

  useEffect(() => {
    ran.current = false;
    setResult(null);
    setStatus('idle');
    setErrorMsg('');
  }, [profilePhotoUrl, selfiePhotoUrl]);

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-violet-500" />
          <p className="text-xs font-black text-gray-700 dark:text-white uppercase tracking-widest">AI Face Match</p>
          <span className="text-[9px] bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Free · In-Browser</span>
        </div>
        {status === 'idle' && (
          <button
            onClick={compare}
            className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black transition-all"
          >
            Run Analysis
          </button>
        )}
      </div>

      {(status === 'loading-models' || status === 'analyzing') && (
        <div className="flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-violet-500 shrink-0" />
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {status === 'loading-models' ? 'Loading AI models (one-time, ~6 MB)...' : 'Analyzing facial features...'}
          </p>
        </div>
      )}

      {status === 'done' && result && (
        <div className="space-y-3">
          <div className={`flex items-center gap-3 p-3 rounded-xl ${result.matched ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20' : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20'}`}>
            {result.matched ? (
              <CheckCircle size={22} className="text-emerald-500 shrink-0" />
            ) : (
              <XCircle size={22} className="text-rose-500 shrink-0" />
            )}
            <div>
              <p className={`text-sm font-black ${result.matched ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {result.matched ? 'Faces Likely Match' : 'Faces Do Not Match'}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Confidence: {result.confidence}% · Distance: {result.distance.toFixed(3)}
              </p>
            </div>
          </div>

          {/* Confidence bar */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Match Confidence</span>
              <span className={`text-xs font-black ${result.confidence >= 70 ? 'text-emerald-500' : result.confidence >= 45 ? 'text-amber-500' : 'text-rose-500'}`}>{result.confidence}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${result.confidence >= 70 ? 'bg-emerald-500' : result.confidence >= 45 ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${result.confidence}%` }}
              />
            </div>
          </div>

          {!result.matched && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 rounded-xl">
              <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                AI flagged a potential mismatch. Carefully review both photos before approving. You can still approve if you believe it's the same person.
              </p>
            </div>
          )}

          <button
            onClick={() => { ran.current = false; setResult(null); setStatus('idle'); }}
            className="text-xs text-violet-500 hover:text-violet-700 font-semibold underline"
          >
            Re-run analysis
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 rounded-xl">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{errorMsg}</p>
            <p className="text-[10px] text-amber-500 mt-0.5">This may happen if a face isn't clearly visible. Please review photos manually.</p>
            <button
              onClick={() => { ran.current = false; setStatus('idle'); }}
              className="text-xs text-violet-500 hover:text-violet-700 font-semibold underline mt-1"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaceComparison;
