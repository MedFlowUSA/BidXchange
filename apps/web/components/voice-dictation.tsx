'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Mic, Square, X } from 'lucide-react';
import {
  appendDictation,
  speechConstructor,
  speechError,
  speechText,
  type BrowserSpeechRecognition,
} from '../lib/speech-recognition';
import styles from './voice-dictation.module.css';

type Phase = 'idle' | 'starting' | 'listening' | 'stopping' | 'review';
export default function VoiceDictation({
  value,
  onChange,
  maxLength,
  disabled = false,
  onBusyChange,
}: {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const id = useId();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [language, setLanguage] = useState('en-US');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [message, setMessage] = useState('');
  const recognition = useRef<BrowserSpeechRecognition | null>(null);
  const confirmed = useRef('');
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = phase !== 'idle';
  const capturing = phase === 'starting' || phase === 'listening' || phase === 'stopping';

  const clearTimers = useCallback(() => {
    for (const timer of [startTimer, limitTimer, endTimer]) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  const disconnect = useCallback(() => {
    clearTimers();
    const engine = recognition.current;
    recognition.current = null;
    if (engine) {
      engine.onstart = engine.onresult = engine.onerror = engine.onend = null;
      try {
        engine.abort();
      } catch {
        /* Some browsers already ended the session. */
      }
    }
  }, [clearTimers]);
  const discard = useCallback(() => {
    disconnect();
    confirmed.current = '';
    setTranscript('');
    setInterim('');
    setPhase('idle');
    setMessage('Dictation discarded. Your typed question is unchanged.');
  }, [disconnect]);
  useEffect(() => {
    setSupported(!!speechConstructor());
    const hide = () => {
      disconnect();
      confirmed.current = '';
      setTranscript('');
      setInterim('');
      setPhase('idle');
      setMessage('');
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') hide();
    };
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disconnect();
      confirmed.current = '';
      onBusyChange(false);
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [disconnect, onBusyChange]);
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    if (disabled) {
      discard();
      setMessage('');
    }
  }, [disabled, discard]);

  function finish(note?: string) {
    disconnect();
    setInterim('');
    setTranscript(confirmed.current);
    setPhase(confirmed.current.trim() ? 'review' : 'idle');
    setMessage(
      note ??
        (confirmed.current.trim()
          ? 'Review the words below, then add them to your question.'
          : 'No clear speech was captured. Try again or type your question.'),
    );
  }
  function stop(note?: string) {
    const engine = recognition.current;
    if (!engine || endTimer.current) return;
    if (startTimer.current) clearTimeout(startTimer.current);
    if (limitTimer.current) clearTimeout(limitTimer.current);
    setPhase('stopping');
    if (note) setMessage(note);
    endTimer.current = setTimeout(() => {
      if (recognition.current === engine) finish(note);
    }, 4000);
    try {
      engine.stop();
    } catch {
      finish(note);
    }
  }
  function start() {
    if (disabled || busy || recognition.current || value.length >= maxLength) return;
    const Constructor = speechConstructor();
    if (!Constructor) {
      setSupported(false);
      return;
    }
    confirmed.current = '';
    setTranscript('');
    setInterim('');
    setMessage('Allow microphone access if your browser asks.');
    setPhase('starting');
    try {
      const engine = new Constructor();
      recognition.current = engine;
      engine.lang = language;
      engine.continuous = true;
      engine.interimResults = true;
      engine.maxAlternatives = 1;
      let limitNotice = '';
      engine.onstart = () => {
        if (recognition.current !== engine || endTimer.current) return;
        if (startTimer.current) clearTimeout(startTimer.current);
        setPhase('listening');
        setMessage('Listening. Speak your question, then choose Stop.');
      };
      engine.onresult = (event) => {
        if (recognition.current !== engine) return;
        const result = speechText(event.results, maxLength);
        confirmed.current = result.final;
        setTranscript(result.final);
        setInterim(result.interim);
        if (result.limited) {
          limitNotice =
            'The text limit was reached. Only the shown text was kept; review it before adding.';
          stop(limitNotice);
        }
      };
      engine.onerror = (event) => {
        if (recognition.current === engine) finish(speechError(event.error));
      };
      engine.onend = () => {
        if (recognition.current === engine) finish(limitNotice || undefined);
      };
      startTimer.current = setTimeout(() => {
        if (recognition.current === engine)
          finish('Microphone access did not start. Check site permissions and try again.');
      }, 15000);
      limitTimer.current = setTimeout(() => {
        if (recognition.current === engine) {
          limitNotice =
            'The one-minute dictation limit was reached. Review your text before adding it.';
          stop(limitNotice);
        }
      }, 60000);
      engine.start();
    } catch {
      finish('Dictation could not start. Check microphone access or type your question.');
    }
  }
  const combined = appendDictation(value, transcript, maxLength);
  const tooLong = !!transcript.trim() && combined === null;
  return (
    <div className={styles.voice} aria-label="Voice typing" role="group">
      {supported === false ? (
        <p className={styles.hint}>
          Voice typing is not supported in this browser. Use your device’s keyboard microphone or
          type your question.
        </p>
      ) : (
        <>
          <div className={styles.controls}>
            {phase === 'idle' ? (
              <button
                type="button"
                className="button secondary"
                onClick={start}
                disabled={!supported || disabled || value.length >= maxLength}
                aria-describedby={`${id}-privacy`}
              >
                <Mic size={17} aria-hidden="true" /> Dictate question
              </button>
            ) : capturing ? (
              <button
                type="button"
                className="button secondary"
                onClick={() => stop()}
                disabled={phase === 'stopping'}
              >
                <Square size={15} aria-hidden="true" />{' '}
                {phase === 'stopping' ? 'Finishing dictation…' : 'Stop dictation'}
              </button>
            ) : null}
            <label htmlFor={`${id}-language`}>Speech language</label>
            <select
              id={`${id}-language`}
              value={language}
              disabled={busy || disabled}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="en-US">English (US)</option>
              <option value="es-US">Español (US)</option>
            </select>
            {busy && (
              <button type="button" className="button secondary" onClick={discard}>
                <X size={16} aria-hidden="true" /> Discard dictation
              </button>
            )}
          </div>
          <p id={`${id}-privacy`} className={styles.hint}>
            Your browser’s speech service may process audio online. BidXchange does not store
            microphone audio. Review the text before adding it.
          </p>
          {value.length >= maxLength && !busy && (
            <p className={styles.hint}>
              Your question is at its text limit. Shorten it before dictating more.
            </p>
          )}
          {capturing && (
            <div className={styles.preview} aria-label="Live dictation preview">
              <p>{transcript || 'Waiting for speech…'}</p>
              {interim && <p className={styles.interim}>{interim}</p>}
            </div>
          )}
          {phase === 'review' && (
            <div className={styles.review}>
              <label htmlFor={`${id}-transcript`}>Review dictated text</label>
              <textarea
                id={`${id}-transcript`}
                value={transcript}
                maxLength={maxLength}
                rows={3}
                onChange={(event) => setTranscript(event.target.value)}
              />
              {tooLong && (
                <p role="alert">
                  This would exceed the {maxLength}-character question limit. Shorten the dictated
                  text or your question before adding it.
                </p>
              )}
              <button
                type="button"
                className="button secondary"
                disabled={disabled || combined === null}
                onClick={() => {
                  if (disabled || combined === null) return;
                  onChange(combined);
                  confirmed.current = '';
                  setTranscript('');
                  setPhase('idle');
                  setMessage(
                    'Text added. Review your question, then choose Ask BidBuddy when ready.',
                  );
                }}
              >
                Add text to question
              </button>
            </div>
          )}
          <p className={styles.status} role="status" aria-live="polite">
            {message}
          </p>
        </>
      )}
    </div>
  );
}
