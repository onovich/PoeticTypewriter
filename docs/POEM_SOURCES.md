# Classic poetry library

The active shared library contains 504 unique lines from 41 selections by 18 named poets. It replaces the project's invented short lines for new free draws and newly generated daily challenges. Existing database challenges remain unchanged.

Source: [The Golden Treasury, selected by Francis Turner Palgrave, Project Gutenberg edition 19221](https://www.gutenberg.org/ebooks/19221), [full source text](https://www.gutenberg.org/cache/epub/19221/pg19221-images.html), retrieved 2026-09-09. These historical poems and Palgrave's original anthology are public-domain works; no modern translations, editorial notes, illustrations, or Gutenberg branding are incorporated into the game.

`shared/classicPoems.js` retains the exact source line, author, anthology title and numbered selection for each entry. Titles follow this edition (for example, Wordsworth's “The Reaper”); they are not claims about the poet's original title. The interface links to the edition and exposes the source line in the attribution tooltip.

Selections emphasize nature, stillness and reflection, including Wordsworth's daffodils, Shelley's skylark, Keats's autumn and Shakespeare's sonnets. Other authors include Marlowe, Jonson, Herrick, Marvell, Pope, Gray, Rogers, Collins, Moore, Scott, Campbell, Hood, Coleridge and Nashe. Short lines were chosen for the existing keyboard; this is a collection of excerpts, not complete poems or paraphrases.

Typing text is lowercase, with punctuation and hyphens replaced by spaces and accented letters normalized to their base letters. Original wording is retained; contractions with apostrophes were excluded rather than expanded or silently joined. The unmodified source line remains alongside the typing form. Line lengths are approximately 24–44 characters.

Daily generation deterministically shuffles the pool and first selects one line per author, yielding ten distinct lines from ten different authors. Free mode continues its local daily no-repeat cycle across the whole library. No runtime network request is needed for poetry.
