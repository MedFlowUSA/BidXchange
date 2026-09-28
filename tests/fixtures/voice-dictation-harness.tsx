import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import VoiceDictation from '../../apps/web/components/voice-dictation';
import '../../apps/web/app/globals.css';
function Harness() {
  const [value, setValue] = useState('Existing question');
  const [busy, setBusy] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [scope, setScope] = useState('one');
  const [open, setOpen] = useState(true);
  const [sent, setSent] = useState(0);
  return (
    <main style={{ maxWidth: 800, margin: 'auto', padding: 16 }}>
      <button onClick={() => setOpen(!open)}>Toggle panel</button>
      <button onClick={() => setScope(scope === 'one' ? 'two' : 'one')}>Switch workspace</button>
      <button onClick={() => setDisabled(!disabled)}>Toggle access</button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) setSent(sent + 1);
        }}
      >
        <label htmlFor="voice-test-question">Question</label>
        <textarea
          id="voice-test-question"
          value={value}
          maxLength={1500}
          onChange={(event) => setValue(event.target.value)}
          style={{ width: '100%' }}
        />
        {open && (
          <VoiceDictation
            key={scope}
            value={value}
            onChange={setValue}
            onBusyChange={setBusy}
            disabled={disabled}
            maxLength={1500}
          />
        )}
        <button disabled={busy || disabled}>Ask BidBuddy</button>
      </form>
      <output aria-label="Messages sent">{sent}</output>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
