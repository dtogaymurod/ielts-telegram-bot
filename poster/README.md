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
