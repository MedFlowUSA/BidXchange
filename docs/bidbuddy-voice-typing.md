# BidBuddy voice typing

Available in the workspace/pursuit assistant and public demo composer in browsers exposing SpeechRecognition or webkitSpeechRecognition over a secure connection. This is dictation, not a voice conversation or spoken-answer feature.

## Using it

1. Open BidBuddy and select English (US) or Español (US).
2. Choose **Dictate question** and allow microphone access if prompted.
3. Speak, then choose **Stop dictation**. Recording also stops after one minute.
4. Edit **Review dictated text** if needed, then choose **Add text to question**.
5. Review the combined question and choose **Ask BidBuddy**.

Existing typed text is preserved. **Discard dictation** removes only the pending voice draft. Dictation never sends a message or performs a workspace action. Questions retain the existing 3,000-character workspace and 1,500-character demo limits. Oversized combined text must be shortened before insertion.

## Privacy and browser behavior

The browser's speech service may process audio online under its own privacy practices. BidXchange receives no microphone audio and adds no audio upload, recording, logging, storage, provider credential or dependency. Recognized text remains in component memory until explicitly added to the question; once submitted it follows the same processing as typed prompts. The UI discloses browser processing before capture, and the draft Privacy Policy describes it.

Closing/collapsing the assistant, changing organization/context/mode/conversation, losing availability/access, hiding the page or unmounting discards unfinished dictation and aborts recognition. Late callbacks are ignored. Startup and finalization timeouts prevent a stuck session. Microphone permission, missing devices, service/network failures and unsupported languages have recovery messages. Unsupported browsers retain typing and device-keyboard microphone guidance.

Browser API availability does not guarantee that its speech service works on every device or network. The installed Edge exposed both constructors during the capability check; the microphone was not opened. References: [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) and [Using the Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API).

## Validation — September 28, 2026

- `npx playwright test tests/voice-dictation.spec.ts tests/assistant-stream.spec.ts tests/assistant-ui.spec.ts --reporter=line`: 79 passed. Includes deterministic speech events, cleanup boundaries, interim/final deduplication, length limits, errors/timeouts, unsupported browsers, and both actual chat composers at desktop/mobile viewports.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npx playwright test tests/legal.spec.ts --reporter=line`: 3 passed.
- `npm run build`: passed.
- `npm run test:secrets`: passed across 744 source files.
- Desktop and 390px transcript-review screenshots inspected.

Automated speech events are synthetic. A person still needs to test actual microphone permission and acoustic transcription on their own device, including Spanish, denied permission and retry. No claim of real-microphone accuracy or native iOS/Safari validation is made.
