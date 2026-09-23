'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Box, RotateCcw } from 'lucide-react';
import { loadTeachingAsset } from '@/lib/anatomy-assets';
import './model-bootstrap.css';

export default function ModelBootstrap({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'basic'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    loadTeachingAsset().then(() => { if (mounted) setState('ready'); }, () => { if (mounted) setState('error'); });
    return () => { mounted = false; };
  }, [attempt]);
  if (state === 'ready' || state === 'basic') return <>{state === 'basic' && <div className="basic-model-notice" role="status">Built-in anatomy is in use. Reload to retry the refined model after saving your work.</div>}{children}</>;
  return <main className="model-bootstrap"><div className="model-bootstrap-mark"><Box size={36} /></div><span className="model-bootstrap-brand">forma <span>TEACHING STUDIO</span></span><h1>{state === 'loading' ? 'Preparing your teaching model' : 'The refined model could not load'}</h1><p>{state === 'loading' ? 'Loading the separate crowns, roots and gingiva for your interactive workspace.' : 'Retry the download, or open the built-in synthetic anatomy to keep working.'}</p>{state === 'loading' ? <div className="model-loading-track" role="status" aria-label="Loading teaching anatomy"><span /></div> : <div className="model-bootstrap-actions"><button onClick={() => { setState('loading'); setAttempt(value => value + 1); }}><RotateCcw size={16} />Retry model</button><button onClick={() => setState('basic')}>Open basic model</button></div>}<small>Synthetic anatomy · individual teeth · millimetres</small></main>;
}
