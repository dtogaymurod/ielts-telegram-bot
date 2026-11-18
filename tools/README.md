# tools

`multilevel_builders.py` — helpers used to write new posts for
`content/multilevel-posts.json` (Multilevel channel). They build the poster
`art` and the caption together and convert Uzbek text to the new Uzbek Latin
alphabet (ö, ğ, ş, ç), leaving English alone: in mixed text English goes inside
`**bold**` or `{braces}`, `__x__` is bold Uzbek. Not used by the bot at run time.
