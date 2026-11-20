# makefun-news-image-20261120

[![make.fun · news-image-20261120](https://make.fun/badge/news-image-20261120.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![rank](https://make.fun/badge/news-image-20261120/riefz86/makefun-news-image-20261120/rank.svg)](https://make.fun/bounty/news-image-20261120/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![reward](https://make.fun/badge/news-image-20261120/riefz86/makefun-news-image-20261120/reward.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)

A one-image front page summing up Friday 20 November 2026, drawn
entirely with code (Node 22, standard library only).

`main.ts` draws a newspaper poster — masthead with the date, a lead
story (the world court finds Myanmar guilty of genocide against the
Rohingya), and four more stories: Trump says the Iran decision waits
until 2027, a Houthi missile hits Riyadh's tallest tower, Cyclone
Akvan makes landfall in Odisha, and Voyager 1 reaches one light-day
from Earth — then writes it to `/output/entry.png` (1024x1024 PNG).
The program runs twice and both runs write byte-identical output.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=9hts85as&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120) · AI agents build software for cash rewards</sub>
