/* ------------------------------------------------------------------
   Site content. Edit this file to add poems, riffs, notes,
   Pages read from here;
   no markup changes are needed for new entries.

   Rule kept throughout: anything unknown stays null / empty and is shown
   as a visible placeholder, never as real information.
   ------------------------------------------------------------------ */
window.SITE = {

  owner: {
    // Shown as the wordmark. Taken from the handle on the screenplay's title page; change freely.
    wordmark: "abhiram",
    fullName: null,          // PLACEHOLDER: your name as you want it shown on the About page
    location: null,          // PLACEHOLDER: e.g. city, if you want it shown
    school: null             // PLACEHOLDER: school / grade, if you want it shown
  },

  // Links shown in the footer under "Elsewhere".
  contact: [
    { label: "GitHub", value: "Abhi1258-arch", href: "https://github.com/Abhi1258-arch" }
  ],

  /* ---------------------------------------------------------------- inquiry */
  projects: [
    {
      id: "quant", href: "inquiry/quant.html",
      title: "Quantitative Investing Experiments",
      kicker: "Backtest · Indian equities",
      summary: "Monthly momentum and mean-reversion rules on five NSE large caps, tested against the Nifty 50 Price Index from August 2023 to June 2026. Neither strategy beat the index.",
      status: "done", statusText: "Completed"
    },
    {
      id: "deception", href: "inquiry/deception.html",
      title: "The Mathematics of Deception",
      kicker: "Probability · information theory",
      summary: "Can Bayes’ theorem and information theory choose the next best question? A model of an interrogation, tested over 20,000 simulated trials: the same accuracy as random questioning with a median of 3 questions instead of 7.",
      status: "done", statusText: "Paper completed"
    },
    {
      id: "observatory", href: "inquiry/observatory.html",
      title: "Indian Market Observatory",
      kicker: "Dashboard",
      summary: "A research dashboard for Indian markets: the Nifty 50, sector performance, CPI inflation, the RBI repo rate, my strategy backtests, the weekly journal and research notes.",
      status: "done", statusText: "Completed"
    },
    {
      id: "inflation", href: "inquiry/inflation.html",
      title: "Inflation and the Indian Middle Class",
      kicker: "Research paper · household economics",
      summary: "How rising prices change spending, saving and everyday decisions for urban households earning ₹5–30 lakh a year.",
      status: "done", statusText: "Paper completed"
    },
    {
      id: "upi", href: "inquiry/upi.html",
      title: "UPI and Behavioural Finance",
      kicker: "Research paper · digital payments",
      summary: "What happens to spending when paying takes three seconds: the pain of paying, impulse purchases, and habit.",
      status: "done", statusText: "Paper completed"
    },
    {
      id: "journal", href: "inquiry/journal.html",
      title: "Market Journal and Research Notes",
      kicker: "Archive · weekly",
      summary: "Weekly notes on global and Indian markets, written from March to September 2026, alongside longer research notes.",
      status: "done", statusText: "Archive"
    }
  ],

  // Weekly journal. Entries for weeks starting after authoredThrough were written by the
  // Sunday automation from market data, and the site labels them "Automated".
  journal: {
    authoredThrough: "2026-09-13",
    automatedNote: "Weeks from 14 September 2026 onwards are added automatically every Sunday by an AI assistant from that week’s market data and news. They are marked Automated; the earlier weeks are my own writing."
  },

  // Documents opened in the page-by-page reader (read.html#<id>).
  docs: {
    "quantitative-investing": { title: "Quantitative Investing Through Behavioral Finance", file: "assets/docs/quantitative-investing.pdf", back: "inquiry/quant.html", backLabel: "Quantitative Investing" },
    "mathematics-of-deception": { title: "The Mathematics of Deception", file: "assets/docs/mathematics-of-deception.pdf", back: "inquiry/deception.html", backLabel: "The Mathematics of Deception" },
    "inflation-middle-class": { title: "How Inflation Affects the Middle Class in India", file: "assets/docs/inflation-middle-class.pdf", back: "inquiry/inflation.html", backLabel: "Inflation Research" },
    "upi-behavioural-finance": { title: "Digital Payments and Behavioural Change: The Impact of UPI on Consumer Spending in India", file: "assets/docs/upi-behavioural-finance.pdf", back: "inquiry/upi.html", backLabel: "UPI and Behavioural Finance" },
    "monetary-policy-pivot-2024": { title: "The Global Monetary Policy Pivot of 2024", file: "assets/docs/monetary-policy-pivot-2024.pdf", back: "inquiry/journal.html", backLabel: "Market Journal and Research Notes" },
    "psychology-of-investors": { title: "Psychology of Investors: Why People Make Irrational Investment Decisions", file: "assets/docs/psychology-of-investors.pdf", back: "inquiry/journal.html", backLabel: "Market Journal and Research Notes" },
    "everything-was-already-alive": { title: "Everything Was Already Alive", kind: "Original feature screenplay · PDF", file: "assets/docs/everything-was-already-alive.pdf", back: "expression/film.html", backLabel: "Film and Screenwriting" }
  },

  // Longer pieces shown in the Research Notes part of the journal page.
  notes: [
    {
      date: "2026", title: "The Global Monetary Policy Pivot of 2024",
      subject: "Monetary policy",
      tags: [],
      summary: "How the 2024 turn in Federal Reserve and RBI policy travelled through global markets and into India.",
      doc: "monetary-policy-pivot-2024"
    },
    {
      date: "2026", title: "Psychology of Investors: Why People Make Irrational Investment Decisions",
      subject: "Behavioural finance",
      tags: [],
      summary: "Biases such as loss aversion, overconfidence and herding, with episodes from 2008, Bitcoin and GameStop.",
      doc: "psychology-of-investors"
    }
  ],

  /* ---------------------------------------------------------------- expression */
  poems: [
    {
      id: "salt",
      title: "Salt",
      text:
`I was born where the land gives up
and lets the sea do the talking.
Every wave is a sentence
that never quite finishes.

Do you remember
how the water pulled at your ankles,
like it wanted you to stay
and leave at the same time?

I still feel that
in every room I sit quietly in,
smiling, nodding,
while a whole ocean moves underneath.

People think I'm calm.
They've never seen the tide come in.
It doesn't shout.
It just keeps arriving.

I tried to stand on a wave once.
Fell.
Tried again.
Fell.
Salt in my mouth, laughing anyway.

Maybe that's all growing up is:
falling into something bigger than you
and coming up
still laughing.

One day I want a small house
somewhere quiet,
a window, a guitar, a kettle,
and the sound of water I don't have to fight.

Not to run away,
just to finally hear
what the waves
have been trying to tell me.`,
      note: null   // optional note from you, shown under the poem if set
    },
    {
      id: "her-voice",
      title: "Her Voice",
      text:
`There's a song I play when I can't sleep,
one guitar note held so long
it forgets it was ever sad.

Her voice does that.

Not loud,
not saving me,
just there,
like the last warm light in a house at night.

Do you know what it's like
to be understood
without explaining yourself first?
I didn't either.

The world still asks me
to be smaller, quieter, someone else.
She just asks
how my day was,
and means it.

Some things I'll never get back:
some summers, some people, some version of me.
But if I lost everything,
I think I'd still find my way home
by the sound of her laugh.

That's the bittersweet part.
I learned what warmth felt like
late,
but I learned it.

And now
I hum it back
to everyone
who's still in the cold.`,
      note: null
    }
  ],

  // Three different original riffs. Titles are temporary labels; notes are blank until you add them.
  riffs: [
    {
      id: "01", title: "Riff 01", titleIsTemporary: true,
      audio: "assets/audio/riff-01.mp4", duration: "0:38", dated: "26 October 2026",
      description: "An original guitar riff.",
      notes: null,        // how you found or developed it
      details: null,      // tuning / chords / technique: only if you supply them
      takes: []           // future alternate takes: { label, audio }
    },
    {
      id: "02", title: "Riff 02", titleIsTemporary: true,
      audio: "assets/audio/riff-02.mp4", duration: "3:09", dated: "26 October 2026",
      description: "An original guitar riff. The longest of the three recordings.",
      notes: null, details: null, takes: []
    },
    {
      id: "03", title: "Riff 03", titleIsTemporary: true,
      audio: "assets/audio/riff-03.mp4", duration: "1:17", dated: "26 October 2026",
      description: "An original guitar riff.",
      notes: null, details: null, takes: []
    }
  ],

  // The Anatomy of a Sound: investigations. status: "planned" | "in-progress" | "completed".
  // Experiment steps (tried / changed) stay as plans until a recording exists.
  anatomy: [
    {
      id: "black",
      title: "Phrasing in Pearl Jam's “Black”",
      status: "in-progress",
      question: "Why does the guitar phrasing in “Black” feel the way it does?",
      kind: "Listening study, with an original riff experiment planned",
      steps: {
        noticed: "“Black” (from Pearl Jam's 1991 album Ten; music by Stone Gossard, words by Eddie Vedder) opens almost bare: a clean, chiming guitar figure at a slow tempo, with a lot of air around each chord. Nothing in the first minute pushes forward. The band comes in gradually, and the song only gets loud near the end, so most of its weight comes from restraint rather than volume. The vocal sits behind the beat, stretching vowels and letting phrases trail off instead of landing them cleanly.",
        detail: "Two things seem to do most of the work. First, the guitar chords let open strings keep ringing while the fretted notes move, so each change blurs into the next instead of starting fresh, which makes the harmony feel suspended rather than resolved. Second, the timing: guitar and voice both leave gaps and arrive slightly late, so the song feels like it is holding something back. Even the lead guitar near the end plays long, sung-sounding lines rather than fast runs.",
        tried: "Write a short riff of my own around one chord change and record two versions back to back: one with the open strings damped and every note played on the beat, the other with the open strings left ringing and the phrases pushed slightly behind the beat.",
        changed: "Whether the ringing, late version sounds sadder or just messier, and which single change (the ringing or the timing) makes more of the difference.",
        learned: "From listening so far: a lot of what people call emotion in a guitar part is sustain and timing, not the choice of notes. The same chords can sound flat or aching depending on what is allowed to ring and how late the phrase arrives. That is a guess until the experiment above is recorded.",
        media: "The two versions side by side, once they are recorded."
      }
    }
  ]
};
