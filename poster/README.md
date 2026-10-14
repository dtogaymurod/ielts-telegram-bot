# Poster

`render_post.py` draws the daily "1 MINUTE HACK" post as a 1080x1350 branded
poster. `src/poster.js` calls it before each daily post, and the bot sends the
picture with the post text as its caption.

Try it locally:

```bash
pip install -r poster/requirements.txt
node src/index.js --dry-run   # prints the post and the path of the poster preview
```

Brand name, handle and colours are constants at the top of `render_post.py`.
Fonts are Inter (SIL Open Font License), bundled in `fonts/`.

## Writing samples

`render_writing.py` draws the weekly Writing samples from
`content/writing-samples.json`: Task 1 as an exam-style chart (bar, line, pie),
Task 2 as a question card. `src/writing-sample.js` publishes the full Band 8+
answer (useful vocabulary in bold, Uzbek glossary) as a Telegraph page and posts
the poster with a link to it. Schedule: `.github/workflows/writing-samples.yml`
(Monday Task 1, Thursday Task 2, 12:00 Tashkent).

```bash
node src/writing-sample.js --dry-run --task 1
```
