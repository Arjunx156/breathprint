# Accessibility

The bar is WCAG 2.2 AA. The people Breathprint is for include a grandparent on an old phone, a parent reading in Hindi, and someone in Windows high contrast because the glare of a smog-white sky hurts. This page says what the app does for them, what the tests prove on every push, and what hasn't been checked yet.

## What the app does

- **Never colour alone.** Every AQI level carries a word and a number next to its colour. The chosen option in a set of choices is filled, and in high contrast it takes the system's own selection colours.
- **Charts have a table.** The 48-hour forecast is a captioned figure whose chart is read out as one summary sentence, and one button turns it into a data table.
- **Landmarks and order.** A skip link is the first Tab stop. Every page has a banner, one main navigation with the same five places in the same order, a main region with one level-1 heading, and a footer.
- **Live updates are announced, not sprung.** Streamed answers, plan progress and save confirmations go through `aria-live` regions. The personalised plan only replaces the instant one when the user asks for it.
- **Focus is always visible and always placed.** Focus rings are 2 px outlines, which high contrast redraws in the system colour. After a room scan, focus moves to the results heading; after saving, it stays on the button.
- **Targets are at least 44 px tall**, and the layout holds at 320 px wide without sideways scrolling.
- **Language is real.** English and Hindi throughout, and the page's `lang` attribute follows the choice so a screen reader switches voice.
- **Voice both ways.** Questions can be dictated where the browser supports speech recognition, and every answer can be read aloud in English or Hindi. Neither is required to use any feature.
- **Motion respects the system.** With reduced motion requested, nothing animates or transitions.
- **Low-end devices.** Under 120 KB of JavaScript on first load, Hindi strings only for those who choose Hindi, and the app works offline after one visit.

## What the tests prove

Every push runs these in a real browser (`tests/e2e/`), and any failure blocks the build:

| Check                                                                | Pages                              |
| -------------------------------------------------------------------- | ---------------------------------- |
| axe with every WCAG 2.0, 2.1 and 2.2 A and AA rule, zero violations  | All 8 pages, light and dark themes |
| axe again under forced colours (Windows high contrast)               | Today, Ask, Indoors, Community     |
| The chosen option looks different from the rest under forced colours | Settings                           |
| Keyboard focus keeps a visible 2 px outline under forced colours     | Today                              |
| Landmarks and navigation match the expected accessibility tree       | Today, Ask, Indoors                |
| First Tab reaches the skip link, and it moves focus to the page      | Today                              |
| No horizontal scroll at 320 px                                       | Today                              |
| No animation or transition when reduced motion is requested          | Today                              |
| Switching to Hindi changes the words and the page's `lang`           | Settings                           |
| Pages open offline after one visit                                   | Today, Ask, Indoors, Community     |

Component tests (`bun test`) cover the live regions, focus after saving a room's fixes, and the voice controls with a scripted recogniser.

## What hasn't been checked

- **No manual screen reader pass yet.** Nothing here has been heard through NVDA, JAWS, VoiceOver or TalkBack. The structure tests make a good result likely, not certain, and a real pass with NVDA and TalkBack is the next step.
- **Voice input on real devices.** Dictation is tested against a scripted recogniser, not a real microphone. Read-aloud has been checked in a desktop browser.
- **Zoom at 400 percent** is covered by the 320 px test in principle, but it hasn't been checked by eye on every page.
- **Hindi readability.** The Hindi strings are written for plain reading, but no native reader has reviewed them for tone.

If something here gets in your way, please open an issue on the repository and say what you were using.
