# PromptWars 6 brief

PromptWars Virtual 2026, run by Hack2skill with Google for Developers. Official page: https://hack2skill.com/event/pwvirtual1. Support: promptwarssupport@hack2skill.com.

## Problem statement, as given

> Create a GenAI-powered assistant that helps families and communities navigate severe winter smog and urban air pollution. The application should suggest low-emission daily routines, indoor air quality hacks, and sustainable alternatives tailored to their location and lifestyle, while clearly explaining the direct impact of their choices.

## Judging criteria, as given

1. Code quality (high impact)
2. Security (medium impact)
3. Efficiency (medium impact)
4. Testing (low impact)
5. Accessibility
6. Problem Statement Alignment (highest impact)

An AI evaluator reads the public repository against these; a human sees the live link and the video.

## Submission rules

From promptwars.in, checked 18 November 2026: a "dual submission" of the technical part (the code and a live preview of the app) and a narrative (a technical blog post, plus a LinkedIn post on the build-in-public journey). Plagiarism and multiple accounts disqualify.

The page contradicts itself on tools. One line says "You must use Google Antigravity or other AI tools", but the FAQ says "using Google Antigravity is a requirement for all submissions". Ask promptwarssupport@hack2skill.com before submitting.

Carried over from Challenge 5 and not seen on this season's page: a public repository under 10 MB, a demo video, two write-ups of at most 1,024 characters, and at most three submissions.

## Deadline

Not yet confirmed. Each challenge runs a 14-day cycle: released on a Monday, submissions by day 13, results on day 14. Challenge 6 is live, and its Friday explainer session isn't in the archive yet, which points to a release on Monday 16 November and submissions closing around Saturday 28 November. Copy the exact closing time from the dashboard before the first submission, and push nothing after it.

## Demo path

Meera lives in Rohini, Delhi with Rohan, their children Kabir (9, asthma) and Anya, and Dadi (68). She drives 14 km to work, cooks on LPG with no chimney and lights an agarbatti every morning. A November morning at India AQI 417, "severe".

1. Twenty-second setup: place, household, travel, home. Today shows the AQI, the 48-hour ribbon and the clean window.
2. A rule-checked plan is on screen at once; "Personalised plan ready" swaps in Gemini's version.
3. Tap "Metro instead of car": dose change, PM2.5 and CO2 kept off the street, rupees saved, and how it was worked out.
4. Ask in Hindi whether the children can play in the park, by voice or typed; the answer streams with source chips and can be read aloud.
5. Indoors: scan the sample kitchen photo. Gemini spots the stove with no chimney, the engine ranks the fixes, and saving adds them to today's plan.
6. A WhatsApp advisory in Hindi for the housing society, and what 120 households carpooling the school run would keep out of the air.

`?demo=meera` replays this path on a fixed forecast and labelled cached model answers.
