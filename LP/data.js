/* ==========================================================
   TECHNO JAPAN — SHARED DATA

   Edit this file to update artists, events, and venues across all pages.
   events.html, artists.html, venues.html, media.html, and map.html
   all read from here.
   ========================================================== */

/* ----------------------------------------------------------
   ARTISTS

   {
     id:       "unique-id",           // URL slug, lowercase, no spaces
     name:     "DJ NAME",
     city:     "TOKYO",
     genre:    "TECHNO",              // TECHNO / HOUSE / MINIMAL / AMBIENT etc.
     bio:      "Short biography...",
     links: {                         // all optional
       instagram: "https://...",
       soundcloud: "https://...",
       bandcamp: "https://...",
       website: "https://...",
     }
   }
   ---------------------------------------------------------- */

const ARTISTS = [
  {
    id: "dj-nobu",
    name: "DJ NOBU",
    city: "CHIBA",
    genre: "TECHNO",
    image: "images/artists/dj-nobu.jpg",
    bio: "One of Japan's most respected techno selectors. Resident at FUTURE TERROR, known for marathon sets that traverse deep, hypnotic, and industrial territories. A bridge between Tokyo's underground and the global techno circuit.",
    links: {
      instagram: "https://www.instagram.com/djnobu_futureterror/",
      soundcloud: "https://soundcloud.com/dj-nobu",
    }
  },
  {
    id: "wata-igarashi",
    name: "WATA IGARASHI",
    city: "TOKYO",
    genre: "TECHNO",
    image: "images/artists/wata-igarashi.jpg",
    bio: "Tokyo-based producer and DJ crafting hypnotic, psychedelic techno. Releases on Midgar, The Bunker NY, and his own Meditate label. His sound is a deep, spiraling journey — transcendent and relentless.",
    links: {
      instagram: "https://www.instagram.com/wataigarashi/",
      soundcloud: "https://soundcloud.com/wataigarashi",
      bandcamp: "https://wataigarashi.bandcamp.com/",
    }
  },
  {
    id: "kotsu",
    name: "KOTSU",
    city: "OSAKA",
    genre: "HOUSE / MINIMAL",
    image: "images/artists/kotsu.jpg",
    bio: "Osaka selector with deep roots in the Kansai underground. Fluid sets moving between deep house, minimal, and micro-house. A fixture at CIRCUS Osaka and a regular across Japan's club circuit.",
    links: {
      instagram: "https://www.instagram.com/kotsu_dj/",
      soundcloud: "https://soundcloud.com/kotsu",
    }
  },
  {
    id: "mayurashka",
    name: "MAYURASHKA",
    city: "TOKYO",
    genre: "HOUSE / TECHNO",
    image: "images/artists/mayurashka.jpg",
    bio: "DJ and producer blending house, techno, and breakbeat with a distinct sense of groove and texture. Known for versatile sets and a deep knowledge of dance music history.",
    links: {
      instagram: "https://www.instagram.com/mayurashka/",
      soundcloud: "https://soundcloud.com/mayurashka",
    }
  },
  {
    id: "ken-ishii",
    name: "KEN ISHII",
    city: "TOKYO",
    genre: "TECHNO",
    image: "images/artists/ken-ishii.jpg",
    bio: "Pioneer of Japanese techno since the early '90s. Internationally recognized through releases on R&S Records and Sublime. A living legend whose influence on Japan's electronic music scene is immeasurable.",
    links: {
      instagram: "https://www.instagram.com/kenishiiofficial/",
      website: "https://kenishii.com",
    }
  },
  {
    id: "cabanne",
    name: "CABANNE",
    city: "KYOTO",
    genre: "MINIMAL / DEEP HOUSE",
    image: "images/artists/cabanne.jpg",
    bio: "Kyoto-based selector specializing in deep, dubby minimal and house. Quiet presence, impeccable taste. Regular at Club Metro and intimate venues across Kansai.",
    links: {
      soundcloud: "https://soundcloud.com/cabanne",
    }
  },
];


/* ----------------------------------------------------------
   EVENTS

   {
     name:     "EVENT NAME",
     date:     "YYYY-MM-DD",
     venue:    "VENUE NAME",
     city:     "CITY",
     time:     "Open - Close",        // optional
     desc:     "Description",         // optional
     lineup:   ["artist-id", ...],    // optional — use artist IDs from above
     link:     "https://...",         // optional — ticket/info URL
   }
   ---------------------------------------------------------- */

const EVENTS = [
  {
    name: "UNDERGROUND FREQUENCY",
    date: "2026-05-17",
    venue: "CONTACT",
    city: "TOKYO",
    time: "23:00 - 05:00",
    desc: "A night of raw, unfiltered techno featuring local and international selectors.",
    lineup: ["dj-nobu", "wata-igarashi"],
  },
  {
    name: "DAWN PATROL",
    date: "2026-05-31",
    venue: "CIRCUS",
    city: "OSAKA",
    time: "22:00 - 06:00",
    desc: "Deep house and minimal techno. Sunrise session on the terrace.",
    lineup: ["kotsu", "mayurashka"],
  },
  {
    name: "RURAL FESTIVAL 2026",
    date: "2026-07-19",
    venue: "NAEBA SKI RESORT",
    city: "NIIGATA",
    time: "ALL DAY",
    desc: "Three-day open-air festival in the mountains. Techno, house, ambient, and beyond.",
    lineup: ["ken-ishii", "dj-nobu", "wata-igarashi", "kotsu"],
  },
  {
    name: "CONCRETE ECHOES",
    date: "2026-06-14",
    venue: "WAREHOUSE 702",
    city: "TOKYO",
    time: "22:00 - 05:00",
    desc: "Industrial space, concrete walls, heavy sound. Warehouse techno at its finest.",
    lineup: ["wata-igarashi"],
  },
  {
    name: "CAPSULE",
    date: "2026-04-05",
    venue: "CONTACT",
    city: "TOKYO",
    time: "23:00 - 05:00",
    desc: "Intimate club night focused on minimal and micro-house.",
    lineup: ["mayurashka", "cabanne"],
  },
  {
    name: "ZERO GRAVITY",
    date: "2026-03-22",
    venue: "CLUB METRO",
    city: "KYOTO",
    time: "22:00 - 04:00",
    desc: "Kyoto's longest-running underground techno night.",
    lineup: ["cabanne"],
  },
  {
    name: "AFTER HOURS COLLECTIVE",
    date: "2026-08-09",
    venue: "VENT",
    city: "TOKYO",
    time: "28:00 - 10:00",
    desc: "After-hours session. Hypnotic, deep, relentless.",
    lineup: ["dj-nobu", "ken-ishii"],
  },
];


/* ----------------------------------------------------------
   VENUES / CLUBS

   {
     id:        "unique-id",
     name:      "VENUE NAME",
     city:      "TOKYO",                 // TOKYO / OSAKA / KYOTO etc.
     area:      "SHIBUYA",               // neighbourhood
     type:      "club",                  // "club" or "bar"
     genre:     ["TECHNO", "HOUSE"],     // array — used for map filters
     capacity:  300,                     // number
     address:   "1-2-3 ...",             // optional — street address
     lat:       35.6564,                 // optional — map pin latitude
     lng:       139.6953,                // optional — map pin longitude
     url:       "https://...",           // optional — website
     instagram: "https://...",           // optional
     desc:      "Description...",
   }
   ---------------------------------------------------------- */

const VENUES = [
  // ── TOKYO ──────────────────────────────────────────────
  {
    id: "womb",
    name: "WOMB",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/womb.jpg",
    genre: ["TECHNO", "HOUSE"],
    capacity: 700,
    address: "2-16 Maruyama-cho, Shibuya-ku, Tokyo",
    lat: 35.6575,
    lng: 139.6941,
    url: "https://www.womb.co.jp",
    desc: "Four floors of sound in the heart of Maruyama-cho. WOMB's main room — a towering LED void — has hosted every name in techno worth knowing. Two decades deep and still essential."
  },
  {
    id: "contact",
    name: "CONTACT",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/contact.jpg",
    genre: ["TECHNO", "HOUSE"],
    capacity: 300,
    address: "2-10-12 Dogenzaka, Shibuya-ku, Tokyo",
    lat: 35.6564,
    lng: 139.6953,
    url: "https://contact-tokyo.com",
    instagram: "https://www.instagram.com/contact_tokyo/",
    desc: "One of Tokyo's most respected techno rooms. A multi-floor operation with a Funktion-One system and bookings that bridge the Tokyo underground with the global circuit."
  },
  {
    id: "circus-tokyo",
    name: "CIRCUS TOKYO",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/circus-tokyo.jpg",
    genre: ["TECHNO", "HOUSE", "EXPERIMENTAL"],
    capacity: 250,
    address: "3-26-16 Shibuya, Shibuya-ku, Tokyo",
    lat: 35.6530,
    lng: 139.7050,
    url: "https://circus-tokyo.jp",
    desc: "The Tokyo outpost of the Osaka original. Intimate, impeccably programmed, and unapologetically underground. A room where the sound does the talking."
  },
  {
    id: "vision",
    name: "SOUND MUSEUM VISION",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/vision.jpg",
    genre: ["TECHNO", "HOUSE"],
    capacity: 1000,
    address: "B1F 2-10-7 Dogenzaka, Shibuya-ku, Tokyo",
    lat: 35.6568,
    lng: 139.6962,
    url: "https://www.vision-tokyo.com",
    desc: "Multi-room mega-venue beneath Dogenzaka. VISION operates at scale — large-format events, international headliners, a production budget that fills every corner."
  },
  {
    id: "ageha",
    name: "AGEHA",
    city: "TOKYO",
    area: "KOTO",
    type: "club",
    image: "images/venues/ageha.jpg",
    genre: ["TECHNO", "HOUSE", "TRANCE"],
    capacity: 2500,
    address: "2-2-10 Shin-Kiba, Koto-ku, Tokyo",
    lat: 35.6425,
    lng: 139.8256,
    url: "https://www.ageha.com",
    desc: "Japan's largest club, a warehouse complex on the waterfront. The pool, the arena, the outdoor terrace at dawn — ageHa is a Tokyo rite of passage."
  },
  {
    id: "harlem",
    name: "HARLEM",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/harlem.jpg",
    genre: ["HIP-HOP", "R&B"],
    capacity: 400,
    address: "2-4 Maruyama-cho, Shibuya-ku, Tokyo",
    lat: 35.6583,
    lng: 139.6945,
    url: "https://www.harlem.co.jp",
    desc: "Shibuya's long-standing hip-hop institution. Two decades of culture, community, and unbroken lineage in a scene that moves fast and forgets faster."
  },
  {
    id: "atom",
    name: "ATOM TOKYO",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/atom.jpg",
    genre: ["HOUSE", "EDM"],
    capacity: 1200,
    address: "4F 2-4 Maruyama-cho, Shibuya-ku, Tokyo",
    lat: 35.6581,
    lng: 139.6940,
    url: "https://atom-tokyo.com",
    desc: "High-capacity Shibuya party house. ATOM draws the crowd that wants to dance big — multiple floors, clean production, and a door that stays open late."
  },
  {
    id: "eleven",
    name: "ELEVEN",
    city: "TOKYO",
    area: "MINAMI-AOYAMA",
    type: "club",
    image: "images/venues/eleven.jpg",
    genre: ["HOUSE", "TECHNO"],
    capacity: 400,
    address: "B1F 3-10-3 Minami-Aoyama, Minato-ku, Tokyo",
    lat: 35.6649,
    lng: 139.7173,
    desc: "Aoyama's refined underground. A room with taste — deep house, melodic techno, and a crowd that knows the difference. Quality over spectacle, always."
  },
  {
    id: "saloon",
    name: "SALOON",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/saloon.jpg",
    genre: ["HOUSE", "TECHNO"],
    capacity: 200,
    address: "2-12-13 Shibuya, Shibuya-ku, Tokyo",
    lat: 35.6570,
    lng: 139.7020,
    desc: "Compact Shibuya venue with a loyal following. SALOON keeps it tight — focused bookings, warm sound, and the kind of intimacy that big rooms can't replicate."
  },
  {
    id: "solfa",
    name: "SOLFA",
    city: "TOKYO",
    area: "NAKAMEGURO",
    type: "bar",
    image: "images/venues/solfa.jpg",
    genre: ["HOUSE", "TECHNO"],
    capacity: 150,
    address: "B1F 1-37-6 Kamimeguro, Meguro-ku, Tokyo",
    lat: 35.6440,
    lng: 139.6978,
    desc: "Basement-level Nakameguro gem. Solfa thrives on restraint — small capacity, careful programming, and a sound system tuned for the room it lives in."
  },
  {
    id: "unit",
    name: "UNIT",
    city: "TOKYO",
    area: "DAIKANYAMA",
    type: "club",
    image: "images/venues/unit.jpg",
    genre: ["INDIE", "ELECTRONIC", "TECHNO"],
    capacity: 500,
    address: "1-34-17 Ebisu-Nishi, Shibuya-ku, Tokyo",
    lat: 35.6490,
    lng: 139.7015,
    url: "https://www.unit-tokyo.com",
    desc: "Daikanyama's anchor venue. UNIT bridges live music and club culture with a basement room that has hosted everything from noise to techno to indie. Versatile and vital."
  },
  {
    id: "liquidroom",
    name: "LIQUIDROOM",
    city: "TOKYO",
    area: "EBISU",
    type: "club",
    image: "images/venues/liquidroom.jpg",
    genre: ["LIVE", "CLUB"],
    capacity: 900,
    address: "3-16-6 Higashi, Shibuya-ku, Tokyo",
    lat: 35.6475,
    lng: 139.7115,
    url: "https://www.liquidroom.net",
    desc: "Ebisu's premier live music venue. LIQUIDROOM is where Japan's music scene tests its range — electronic, rock, experimental, everything. The room earns its reputation nightly."
  },
  {
    id: "velours",
    name: "VELOURS",
    city: "TOKYO",
    area: "SHINJUKU",
    type: "club",
    image: "images/venues/velours.jpg",
    genre: ["HOUSE", "TECHNO"],
    capacity: 300,
    address: "1-8-1 Kabukicho, Shinjuku-ku, Tokyo",
    lat: 35.6948,
    lng: 139.7029,
    desc: "A Kabukicho basement with serious sound credentials. Velours programs with intent — deep, minimal, and hypnotic. The kind of room you stumble into and don't leave."
  },
  {
    id: "shinjuku-loft",
    name: "SHINJUKU LOFT",
    city: "TOKYO",
    area: "SHINJUKU",
    type: "club",
    image: "images/venues/shinjuku-loft.jpg",
    genre: ["LIVE", "ALTERNATIVE"],
    capacity: 500,
    address: "B2F 1-12-9 Kabukicho, Shinjuku-ku, Tokyo",
    lat: 35.6955,
    lng: 139.7015,
    url: "https://www.loft-prj.co.jp/loft",
    desc: "A Tokyo institution since 1976. Shinjuku Loft is a live house with history embedded in its walls — punk, noise, alternative, and everything that refuses to fit."
  },
  {
    id: "clubasia",
    name: "CLUBASIA",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/clubasia.jpg",
    genre: ["VARIOUS"],
    capacity: 700,
    address: "1-8 Maruyama-cho, Shibuya-ku, Tokyo",
    lat: 35.6578,
    lng: 139.6935,
    url: "https://clubasia.co.jp",
    desc: "Shibuya multi-purpose venue with a history that spans genres. clubasia is the room that says yes — to techno, to reggae, to punk, to whatever the night demands."
  },
  {
    id: "the-room",
    name: "THE ROOM",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "bar",
    image: "images/venues/the-room.jpg",
    genre: ["HOUSE", "SOUL"],
    capacity: 100,
    address: "B1F 2-1 Sakuragaoka-cho, Shibuya-ku, Tokyo",
    lat: 35.6555,
    lng: 139.6990,
    desc: "A listening room disguised as a club. The Room runs on vinyl culture, deep house, and soul — curated nights for heads who care about selection over volume."
  },
  {
    id: "mitsuki",
    name: "MITSUKI",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/mitsuki.jpg",
    genre: ["TECHNO", "MINIMAL"],
    capacity: 150,
    address: "2-19-3 Dogenzaka, Shibuya-ku, Tokyo",
    lat: 35.6560,
    lng: 139.6932,
    desc: "Minimal in every sense. MITSUKI strips it back — clean lines, focused sound, and a crowd that came for the music. No frills, no apologies."
  },
  {
    id: "oath",
    name: "OATH",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/oath.jpg",
    genre: ["TECHNO", "HOUSE"],
    capacity: 200,
    address: "B1F 6-6 Udagawa-cho, Shibuya-ku, Tokyo",
    lat: 35.6610,
    lng: 139.6942,
    desc: "A Shibuya basement with weight. Oath programs with precision — resident-led nights, guest selectors who understand the room, and a system that rewards attention."
  },
  {
    id: "bar-bossa",
    name: "BAR BOSSA",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "bar",
    image: "images/venues/bar-bossa.jpg",
    genre: ["BOSSA NOVA", "JAZZ"],
    capacity: 40,
    address: "1-15-6 Jinnan, Shibuya-ku, Tokyo",
    lat: 35.6630,
    lng: 139.6990,
    desc: "Not a club. A bar with a turntable and a philosophy. Bossa nova, Brazilian jazz, and conversation at a volume that lets the music breathe."
  },
  {
    id: "www",
    name: "WWW",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/www.jpg",
    genre: ["INDIE", "ELECTRONIC"],
    capacity: 300,
    address: "13-17 Udagawa-cho, Shibuya-ku, Tokyo",
    lat: 35.6613,
    lng: 139.6960,
    url: "https://www-shibuya.jp",
    desc: "Shibuya live venue with electronic leanings. WWW curates across indie, electronic, and everything in between — mid-scale and precisely positioned."
  },
  {
    id: "www-x",
    name: "WWW X",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/www-x.jpg",
    genre: ["INDIE", "ELECTRONIC"],
    capacity: 700,
    address: "13-17 Udagawa-cho, Shibuya-ku, Tokyo",
    lat: 35.6615,
    lng: 139.6955,
    url: "https://www-shibuya.jp",
    desc: "The bigger sibling upstairs. WWW X takes the same curatorial lens and scales it — larger shows, louder nights, but the same sensibility at the controls."
  },
  {
    id: "o-east",
    name: "SPOTIFY O-EAST",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/o-east.jpg",
    genre: ["LIVE", "CLUB"],
    capacity: 1300,
    address: "2-14-8 Dogenzaka, Shibuya-ku, Tokyo",
    lat: 35.6572,
    lng: 139.6928,
    url: "https://shibuya-o.com",
    desc: "Shibuya's large-format live venue. O-East hosts the shows that need room — touring acts, festival pre-parties, and all-night events that fill every corner."
  },
  {
    id: "bonobo",
    name: "BONOBO",
    city: "TOKYO",
    area: "NAKAMEGURO",
    type: "bar",
    image: "images/venues/bonobo.jpg",
    genre: ["JAZZ", "HOUSE", "SOUL"],
    capacity: 80,
    address: "1-1-5 Kamimeguro, Meguro-ku, Tokyo",
    lat: 35.6455,
    lng: 139.6960,
    desc: "A treehouse bar on the Meguro River. Bonobo is vinyl-only, candle-lit, and operates on a frequency that rewards patience. Jazz, soul, deep house — always at human scale."
  },
  {
    id: "forestlimit",
    name: "FORESTLIMIT",
    city: "TOKYO",
    area: "HATAGAYA",
    type: "bar",
    image: "images/venues/forestlimit.jpg",
    genre: ["EXPERIMENTAL", "AMBIENT"],
    capacity: 80,
    address: "1-2-14 Nishihara, Shibuya-ku, Tokyo",
    lat: 35.6725,
    lng: 139.6780,
    instagram: "https://www.instagram.com/forestlimit/",
    desc: "Micro-venue in a quiet neighborhood. Forestlimit is a space for experimental music, sound art, and intimate DJ sets. One of the most unique listening rooms in the city."
  },
  {
    id: "air",
    name: "AIR",
    city: "TOKYO",
    area: "DAIKANYAMA",
    type: "club",
    image: "images/venues/air.jpg",
    genre: ["HOUSE", "TECHNO"],
    capacity: 300,
    address: "2-11 Sarugaku-cho, Shibuya-ku, Tokyo",
    lat: 35.6500,
    lng: 139.7040,
    desc: "Daikanyama's original dance floor. Air built its reputation on house and techno programmed with restraint — quality sound, considered bookings, and a room that breathes."
  },
  {
    id: "vent",
    name: "VENT",
    city: "TOKYO",
    area: "OMOTESANDO",
    type: "club",
    image: "images/venues/vent.jpg",
    genre: ["TECHNO", "MINIMAL"],
    capacity: 200,
    url: "https://vent-tokyo.net",
    instagram: "https://www.instagram.com/vent_tokyo/",
    desc: "A refined, boutique club experience in the heart of Omotesando. Focused on quality sound and curated lineups. An essential stop for serious music heads in Tokyo."
  },
  {
    id: "warehouse-702",
    name: "WAREHOUSE 702",
    city: "TOKYO",
    area: "TENNOZU",
    type: "club",
    image: "images/venues/warehouse-702.jpg",
    genre: ["TECHNO", "INDUSTRIAL"],
    capacity: 800,
    desc: "Raw industrial warehouse space transformed into a temporary event venue. Concrete floors, exposed steel, and a sound system built for heavy techno. Not a permanent club — events are announced."
  },

  // ── OSAKA ──────────────────────────────────────────────
  {
    id: "circus-osaka",
    name: "CIRCUS",
    city: "OSAKA",
    area: "SHINSAIBASHI",
    type: "club",
    image: "images/venues/circus-osaka.jpg",
    genre: ["HOUSE", "TECHNO", "EXPERIMENTAL"],
    capacity: 250,
    url: "https://circus-osaka.com",
    instagram: "https://www.instagram.com/circus_osaka/",
    desc: "Osaka's cultural hub for underground electronic music. Intimate setting, impeccable bookings, and a community-driven atmosphere that defines the Kansai scene."
  },

  // ── KYOTO ──────────────────────────────────────────────
  {
    id: "club-metro",
    name: "CLUB METRO",
    city: "KYOTO",
    area: "JINGU-MARUTAMACHI",
    type: "club",
    image: "images/venues/club-metro.jpg",
    genre: ["TECHNO", "AMBIENT", "EXPERIMENTAL"],
    capacity: 150,
    instagram: "https://www.instagram.com/clubmetrokyoto/",
    desc: "Kyoto's longest-running underground club. A basement institution operating since 1990, known for leftfield and experimental bookings alongside techno and ambient nights."
  },
];
