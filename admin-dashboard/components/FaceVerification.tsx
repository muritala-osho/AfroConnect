import React, { useState, useCallback } from 'react';
import {
  ShieldCheck, ShieldX, Cpu, AlertTriangle, Loader2,
  CheckCircle, XCircle, Eye, RefreshCw, Activity,
} from 'lucide-react';
import { adminApi } from '../services/adminApi';

interface LivenessResult {
  passed: boolean;
  issues: string[];
}

interface VerificationResult {
  verified: boolean;
  similarity: number;
  distance?: number;
  liveness: LivenessResult;
  error?: string;
}

interface FaceVerificationProps {
  userId: string;
  selfieUrl: string | null;
  onResult?: (result: VerificationResult) => void;
}

const SimilarityBar: React.FC<{ score: number }> = ({ score }) => {
  const pct   = Math.round(score * 100);
  const color =
    score >= 0.85 ? 'bg-emerald-500' :
    score >= 0.60 ? 'bg-amber-500'   : 'bg-rose-500';
  const label =
    score >= 0.85 ? 'text-emerald-600 dark:text-emerald-400' :
    score >= 0.60 ? 'text-amber-600 dark:text-amber-400'     : 'text-rose-600 dark:text-rose-400';

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Face Similarity</span>
        <span className={`text-sm font-black ${label}`}>{pct}%</span>
      </div>
      <div className="h-2.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-slate-400">0%</span>
        <span className="text-[9px] font-bold text-teal-500">85% threshold</span>
        <span className="text-[9px] text-slate-400">100%</span>
      </div>
      {/* Threshold marker */}
      <div className="relative h-0">
        <div
          className="absolute bottom-1 w-0.5 h-3 bg-teal-500 rounded-full"
          style={{ left: '85%', transform: 'translateX(-50%)' }}
        />
      </div>
    </div>
  );
};

const FaceVerification: React.FC<FaceVerificationProps> = ({ userId, selfieUrl, onResult }) => {
  const [status, setStatus]   = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [result, setResult]   = useState<VerificationResult | null>(null);
  const [errMsg, setErrMsg]   = useState('');

  const run = useCallback(async () => {
    if (!selfieUrl) {
      setErrMsg('No selfie on record — cannot run automated verification.');
      setStatus('error');
      return;
    }

    setStatus('running');
    setResult(null);
    setErrMsg('');

    try {
      const data = await adminApi.verifyFace(userId);

      if (!data.success) {
        setErrMsg(data.message || data.error || 'Verification failed');
        setStatus('error');
        return;
      }

      const r: VerificationResult = {
        verified:   data.verified,
        similarity: data.similarity,
        distance:   data.distance,
        liveness:   data.liveness,
        error:      data.error,
      };

      setResult(r);
      setStatus('done');
      onResult?.(r);
    } catch (err: any) {
      setErrMsg(err?.message || 'Unexpected error during verification');
      setStatus('error');
    }
  }, [userId, selfieUrl, onResult]);

  const reset = () => {
    setStatus('idle');
    setResult(null);
    setErrMsg('');
  };

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-teal-500" />
          <p className="text-xs font-black text-gray-700 dark:text-white uppercase tracking-widest">
            AI Face Verification
          </p>
          <span className="text-[9px] bg-teal-100 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
            Backend · face-api
          </span>
        </div>

        {status === 'idle' && (
          <button
            onClick={run}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition-all shadow shadow-teal-500/20"
          >
            <Activity size={12} />
            Run Verification
          </button>
        )}

        {status === 'done' && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all"
          >
            <RefreshCw size={11} />
            Re-run
          </button>
        )}
      </div>

      {/* Running state */}
      {status === 'running' && (
        <div className="flex items-center gap-3 p-3 bg-teal-50 dark:bg-teal-500/5 rounded-xl border border-teal-100 dark:border-teal-500/20">
          <Loader2 size={18} className="animate-spin text-teal-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-teal-700 dark:text-teal-400">Analysing faces…</p>
            <p className="text-xs text-teal-600/70 dark:text-teal-500 mt-0.5">
              Loading recognition models, comparing embeddings & running liveness checks
            </p>
          </div>
        </div>
      )}

      {/* Done state */}
      {status === 'done' && result && (
        <div className="space-y-3 animate-fadeIn">

          {/* Main verdict banner */}
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${
            result.verified
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
              : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
          }`}>
            {result.verified
              ? <ShieldCheck size={22} className="text-emerald-500 shrink-0" />
              : <ShieldX    size={22} className="text-rose-500 shrink-0"    />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-black ${result.verified ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {result.verified ? 'Face Verified — Identity Confirmed' : 'Verification Failed'}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Similarity: {(result.similarity * 100).toFixed(1)}%
                {result.distance !== undefined && ` · Distance: ${result.distance.toFixed(3)}`}
                {' · '}Threshold: 85%
              </p>
            </div>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest ${
              result.verified
                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'
            }`}>
              {result.verified ? 'PASS' : 'FAIL'}
            </span>
          </div>

          {/* Similarity bar */}
          <SimilarityBar score={result.similarity} />

          {/* Liveness result */}
          <div className={`p-3 rounded-xl border ${
            result.liveness.passed
              ? 'bg-emerald-50/60 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20'
              : 'bg-amber-50 dark:bg-amber-500/5 border-amber-100 dark:border-amber-500/20'
          }`}>
            <div className="flex items-center gap-2 mb-1.5">
              {result.liveness.passed
                ? <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                : <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              }
              <p className={`text-xs font-black ${result.liveness.passed ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                Liveness Check: {result.liveness.passed ? 'Passed' : 'Issues Detected'}
              </p>
            </div>
            {result.liveness.issues.length > 0 && (
              <ul className="space-y-1 ml-5">
                {result.liveness.issues.map((issue, i) => (
                  <li key={i} className="text-[11px] text-amber-700 dark:text-amber-400 list-disc">
                    {issue}
                  </li>
                ))}
              </ul>
            )}
            {result.liveness.passed && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-500 ml-5">
                Face detected with sufficient confidence and natural landmark distribution.
              </p>
            )}
          </div>

          {/* AI warning if there was a soft error */}
          {result.error && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 rounded-xl">
              <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">{result.error}</p>
            </div>
          )}

          {/* Auto-approved notice */}
          {result.verified && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/30 rounded-xl">
              <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                User record has been automatically marked as verified in the database. You may still manually approve/reject below.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-500/5 border border-rose-200 dark:border-rose-500/20 rounded-xl">
          <XCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-rose-700 dark:text-rose-400">{errMsg}</p>
            <p className="text-[10px] text-rose-500 mt-0.5">Review photos manually or ensure the selfie is clearly visible.</p>
          </div>
          <button
            onClick={reset}
            className="text-xs text-rose-500 hover:text-rose-700 font-semibold underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Idle help text */}
      {status === 'idle' && (
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Clicking <strong>Run Verification</strong> sends the stored selfie to the backend where face-api compares it
          against the profile photo using a 128-D face embedding. Liveness checks validate the image is from a real
          capture. A similarity score ≥ 85% automatically marks the user as verified.
        </p>
      )}
    </div>
  );
};

export default FaceVerification;
