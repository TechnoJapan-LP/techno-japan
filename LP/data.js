/* ==========================================================
   TECHNO JAPAN — SHARED DATA

   Edit this file to update artists, events, and venues across all pages.
   events.html, artists.html, venues.html, discover.html, and map.html
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
    country: "JAPAN",
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
    country: "JAPAN",
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
    country: "JAPAN",
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
    country: "JAPAN",
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
    country: "JAPAN",
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
    country: "FRANCE",
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
   FESTIVALS

   {
     id:        "unique-id",
     name:      "FESTIVAL NAME",
     date:      "2026-07-19",               // or date range "2026-07-19/2026-07-21"
     location:  "NAEBA SKI RESORT",
     city:      "NIIGATA",
     image:     "images/festivals/rural.jpg", // optional
     genre:     ["TECHNO", "HOUSE"],
     desc:      "Description...",
     url:       "https://...",                // optional — official site
     lineup:    ["dj-nobu", "ken-ishii"],     // artist IDs from ARTISTS array
   }
   ---------------------------------------------------------- */

const FESTIVALS = [
  {
    id: "rural-festival",
    type: "festival",
    name: "RURAL FESTIVAL 2026",
    date: "2026-07-19/2026-07-21",
    location: "NAEBA SKI RESORT",
    city: "NIIGATA",
    lat: 36.8428,
    lng: 138.6822,
    image: "images/festivals/rural.jpg",
    flyer: "images/festivals/rural-flyer.jpg",
    heroGradient: "linear-gradient(135deg, #0a1a0a 0%, #1a3a2a 40%, #0d2818 70%, #050f08 100%)",
    genre: ["TECHNO", "HOUSE", "AMBIENT"],
    desc: "Three-day open-air festival deep in the mountains of Niigata. Multiple stages, international headliners, and a community-driven atmosphere that has made it Japan's most revered electronic music gathering.",
    url: "https://rural-jp.com",
    ticketUrl: "",
    lineup: ["ken-ishii", "dj-nobu", "wata-igarashi", "kotsu"],
    editions: [
      { year: 2025, date: "2025-07-19/2025-07-21", lineup: ["DJ NOBU", "WATA IGARASHI", "GONNO", "CYK"] },
      { year: 2024, date: "2024-07-20/2024-07-22", lineup: ["KEN ISHII", "KOTSU", "FUMIYA TANAKA", "HARUKA"] },
      { year: 2023, date: "2023-07-15/2023-07-17", lineup: ["DJ NOBU", "YOSHINORI HAYASHI", "MAMA SNAKE"] }
    ]
  },
  {
    id: "labyrinth",
    type: "rave",
    name: "LABYRINTH",
    date: "2026-09-12/2026-09-14",
    location: "NAEBA",
    city: "NIIGATA",
    lat: 36.8428,
    lng: 138.6822,
    image: "images/festivals/labyrinth.jpg",
    flyer: "images/festivals/labyrinth-flyer.jpg",
    heroGradient: "linear-gradient(135deg, #0a0a14 0%, #12102a 40%, #1a0e28 70%, #080810 100%)",
    genre: ["TECHNO", "HOUSE", "OTHERS"],
    desc: "Curated by DJ Nobu, Labyrinth is a boutique outdoor festival renowned for its uncompromising sound and intimate scale. Deep in the forest, far from the mainstream.",
    url: "https://labyrinth-jp.com",
    ticketUrl: "",
    lineup: ["dj-nobu", "wata-igarashi"],
    editions: [
      { year: 2025, date: "2025-09-13/2025-09-15", lineup: ["DJ NOBU", "WATA IGARASHI", "MARCEL DETTMANN"] },
      { year: 2024, date: "2024-09-14/2024-09-16", lineup: ["DJ NOBU", "SURGEON", "DONATO DOZZY"] },
      { year: 2023, date: "2023-09-09/2023-09-11", lineup: ["DJ NOBU", "OBJEKT", "AURORA HALAL"] }
    ]
  },
  {
    id: "festival-de-frue",
    type: "festival",
    name: "FESTIVAL de FRUE",
    date: "2026-11-07/2026-11-08",
    location: "TSUKIGASE OUTDOOR STAGE",
    city: "SHIZUOKA",
    lat: 34.8890,
    lng: 137.9530,
    image: "images/festivals/frue.jpg",
    flyer: "images/festivals/frue-flyer.jpg",
    heroGradient: "linear-gradient(135deg, #14100a 0%, #2a1e0e 40%, #1e1408 70%, #0a0806 100%)",
    genre: ["OTHERS", "AMBIENT", "HOUSE"],
    desc: "An eclectic gathering at the foothills of Shizuoka. Frue blends electronic, acoustic, and experimental music in a serene natural setting. A festival for listeners and dancers alike.",
    ticketUrl: "",
    lineup: ["cabanne"],
    editions: [
      { year: 2024, date: "2024-11-02/2024-11-03", lineup: ["CABANNE", "YOSHINORI HAYASHI", "CHIHEI HATAKEYAMA"] },
      { year: 2023, date: "2023-11-04/2023-11-05", lineup: ["VISIBLE CLOAKS", "MIDORI TAKADA", "DJ SPRINKLES"] }
    ]
  },
  {
    id: "rainbow-disco-club",
    type: "festival",
    name: "RAINBOW DISCO CLUB",
    date: "2026-04-25/2026-04-27",
    location: "HIGASHI-IZU CROSS COUNTRY COURSE",
    city: "SHIZUOKA",
    lat: 34.7756,
    lng: 139.0700,
    image: "images/festivals/rdc.jpg",
    flyer: "images/festivals/rdc-flyer.jpg",
    heroGradient: "linear-gradient(135deg, #1a0a1e 0%, #2e1040 40%, #1e0830 70%, #0a0410 100%)",
    genre: ["HOUSE", "TECHNO", "OTHERS"],
    desc: "Japan's iconic boutique festival celebrating dance music culture. A sun-soaked weekend of house, techno, and everything in between — overlooking the Pacific Ocean.",
    url: "https://rainbowdiscoclub.com",
    ticketUrl: "",
    lineup: ["mayurashka"],
    editions: [
      { year: 2025, date: "2025-04-26/2025-04-28", lineup: ["MAYURASHKA", "HUNEE", "SOICHI TERADA", "YOUNG MARCO"] },
      { year: 2024, date: "2024-04-27/2024-04-29", lineup: ["KERRI CHANDLER", "FUMIYA TANAKA", "SAUCE81"] },
      { year: 2023, date: "2023-04-29/2023-04-30", lineup: ["LARRY HEARD", "ANTAL", "CYK"] }
    ]
  },
  {
    id: "fuji-rock",
    type: "festival",
    name: "FUJI ROCK FESTIVAL",
    date: "2026-07-24/2026-07-26",
    location: "NAEBA SKI RESORT",
    city: "NIIGATA",
    lat: 36.8428,
    lng: 138.6822,
    image: "images/festivals/fujirock.jpg",
    flyer: "images/festivals/fujirock-flyer.jpg",
    heroGradient: "linear-gradient(135deg, #0a0e14 0%, #0e1a2a 40%, #0a1420 70%, #060a10 100%)",
    genre: ["OTHERS", "TECHNO", "LIVE"],
    desc: "Japan's largest outdoor music festival. While spanning all genres, Fuji Rock's Red Marquee and Field of Heaven stages have long championed underground electronic music.",
    url: "https://fujirock-eng.com",
    ticketUrl: "",
    editions: [
      { year: 2025, date: "2025-07-25/2025-07-27", lineup: ["THE CURE", "APHEX TWIN", "KRAFTWERK"] },
      { year: 2024, date: "2024-07-26/2024-07-28", lineup: ["THE KILLERS", "SKRILLEX", "NOISIA"] },
      { year: 2023, date: "2023-07-28/2023-07-30", lineup: ["FOO FIGHTERS", "LIZZO", "DANIEL AVERY"] }
    ]
  }
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
  {
    id: "womb",
    name: "WOMB",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/womb.jpeg",
    genre: ["TECHNO", "HOUSE", "MINIMAL"],
    capacity: 800,
    address: "2-16 Maruyama-cho, Shibuya-ku, Tokyo",
    lat: 35.6583,
    lng: 139.695,
    url: "https://www.womb.co.jp/",
    instagram: "https://www.instagram.com/womb_tokyo/",
    desc: "WOMB stands as Tokyo's most iconic techno institution, housed in a striking underground space in Shibuya with a world-class sound system that has drawn international artists for over two decades. The venue's distinctive curved main floor and precise acoustics have cemented its reputation as a pilgrimage site for serious dance music enthusiasts."
  },
  {
    id: "circus-tokyo",
    name: "CIRCUS TOKYO",
    city: "TOKYO",
    area: "SHIBUAYA",
    type: "club",
    image: "images/venues/circus-tokyo.jpeg",
    genre: ["TECHNO", "HOUSE", "MINIMAL", "BASS", "OTHERS"],
    capacity: 300,
    address: "3-26-16 Shibuya, Shibuya-ku, Tokyo",
    lat: 35.6542,
    lng: 139.7056,
    url: "https://circus-tokyo.jp/",
    instagram: "https://www.instagram.com/circus_tokyo/",
    desc: "CIRCUS TOKYO operates as a refined underground space in the heart of Shibuya, known for its carefully curated techno programming and intimate atmosphere. The venue attracts both established international artists and emerging local talent, maintaining a reputation for quality sound systems and discerning crowds. Its compact layout creates an immersive environment where the focus remains firmly on the music."
  },
  {
    id: "saloon",
    name: "SALOON",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/saloon.jpeg",
    genre: ["TECHNO", "HOUSE", "OTHERS"],
    capacity: 150,
    address: "Za-House Building B3F, 1-34-17 Ebisu-Nishi, Shibuya-ku, Tokyo",
    lat: 35.6471,
    lng: 139.7023,
    url: "https://saloon-tokyo.com/",
    instagram: "https://www.instagram.com/saloon_tokyo/",
    desc: "SALOON operates as a compact basement club in Shibuya, known for its intimate atmosphere and carefully curated lineups spanning techno, house, and experimental electronic music. The venue's low ceilings and minimal lighting create an immersive environment that prioritizes sound quality and dancefloor intimacy over spectacle. Its programming often features both emerging local talent and respected international artists within Tokyo's underground circuit."
  },
  {
    id: "solfa",
    name: "SOLFA",
    city: "TOKYO",
    area: "NAKAMEGURO",
    type: "club",
    image: "images/venues/solfa.jpeg",
    genre: ["TECHNO", "HOUSE", "LIVE", "OTHERS"],
    capacity: 200,
    address: "Oak Build, 1-20-5 Aobadai, Meguro-ku, Tokyo.",
    lat: 35.647,
    lng: 139.6981,
    url: "https://nakameguro-solfa.com/",
    instagram: "https://www.instagram.com/solfa_nakameguro/",
    desc: "SOLFA occupies a basement space in Nakameguro, offering an intimate setting for electronic music with a sound system that prioritizes clarity over volume. The venue has cultivated a reputation for quality bookings across house and techno, attracting both local selectors and international artists to its compact dancefloor. Its understated approach and commitment to proper sound design has made it a respected destination within Tokyo's discerning underground community."
  },
  {
    id: "unit",
    name: "UNIT",
    city: "TOKYO",
    area: "DAIKANYAMA",
    type: "livehouse",
    image: "images/venues/unit.jpeg",
    genre: ["TECHNO", "HOUSE", "LIVE", "OTHERS"],
    capacity: 200,
    address: "ZaHOUSE, 1-34-17 Ebisu-Nishi, Shibuya-ku, Tokyo",
    lat: 35.6471,
    lng: 139.7023,
    url: "https://www.unit-tokyo.com/",
    instagram: "https://www.instagram.com/unit_tokyo/",
    desc: "UNIT stands as one of Tokyo's most respected underground venues, housed in a basement space in Daikanyama that prioritizes sound quality and intimate atmosphere over flashy production. The club's carefully curated programming spans techno, house, and experimental electronics, attracting both established international artists and Japan's finest selectors. Its compact layout and dedicated sound system create an immersive environment where music takes precedence over spectacle."
  },
  {
    id: "liquidroom",
    name: "LIQUIDROOM",
    city: "TOKYO",
    area: "EBISU",
    type: "livehouse",
    image: "images/venues/liquidroom.jpg",
    genre: ["TECHNO", "HOUSE", "LIVE", "OTHERS"],
    capacity: 900,
    address: "3-16-6 Higashi, Shibuya-ku, Tokyo",
    lat: 35.6491,
    lng: 139.7106,
    url: "https://www.liquidroom.net/",
    instagram: "https://www.instagram.com/liquidroom_ebisu/",
    desc: "Situated in Ebisu, LIQUIDROOM stands as one of Tokyo's most respected mid-sized venues, hosting everything from international electronic acts to Japan's underground scene regulars. The club's sound system and intimate yet spacious layout have made it a consistent draw for both artists and dedicated ravers since the early 2000s. Its programming spans techno, house, and experimental electronic music with a curatorial approach that balances accessibility with underground credibility."
  },
  {
    id: "clubasia",
    name: "CLUBASIA",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/clubasia.jpg",
    genre: ["TECHNO", "LIVE", "OTHERS"],
    capacity: 800,
    address: "1-8 Maruyama-cho, Shibuya-ku, Tokyo",
    lat: 35.659,
    lng: 139.6953,
    url: "https://clubasia.jp/",
    instagram: "https://www.instagram.com/clubasia/",
    desc: "A cornerstone of Shibuya's club landscape since the late 90s, CLUBASIA spans multiple floors with its main room hosting everything from techno nights to hip-hop showcases. The venue's adaptable layout and central location have made it a reliable stop for both local crews and touring international acts seeking a mid-sized room with solid sound."
  },
  {
    id: "mitsuki",
    name: "MITSUKI",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/mitsuki.jpg",
    genre: ["TECHNO", "HOUSE"],
    capacity: 200,
    address: "Nagashima Daiichi Building B1, 1-22-12 Dogenzaka, Shibuya-ku, Tokyo",
    lat: 35.6565,
    lng: 139.6957,
    url: "https://mitsuki-tokyo.com/",
    instagram: "https://www.instagram.com/mitsuki_tokyo/",
    desc: "MITSUKI operates as an intimate basement club in Tokyo's nightlife landscape, known for its focused programming of underground electronic music. The venue maintains a stripped-down aesthetic that prioritizes sound quality and dancefloor intimacy over spectacle."
  },
  {
    id: "the-room",
    name: "THE ROOM",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "bar",
    image: "images/venues/the-room.jpeg",
    genre: ["HOUSE", "OTHERS", "LIVE"],
    capacity: 80,
    address: "15-19 Sakuragaoka-cho, Shibuya-ku, Tokyo, Daihachi Toto Building",
    lat: 35.6565,
    lng: 139.7016,
    url: "https://theroom.jp/",
    instagram: "https://www.instagram.com/theroom_shibuya/",
    desc: "This intimate Shibuya basement bar operates as a low-key refuge for serious music heads, programming everything from deep house to experimental electronics. The space maintains a deliberately understated atmosphere, drawing a knowing crowd that values sound quality over spectacle. Its compact layout creates an almost living room-like intimacy between DJs and dancers."
  },
  {
    id: "oath",
    name: "OATH",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "bar",
    image: "images/venues/oath.jpeg",
    genre: ["HOUSE", "MINIMAL", "TECHNO"],
    capacity: 100,
    address: "1-6-5 Dogenzaka, Shibuya-ku, Tokyo, B1F",
    lat: 35.6577,
    lng: 139.6992,
    url: "https://www.djbar-oath.com/",
    instagram: "https://www.instagram.com/shibuya_oath/",
    desc: "OATH operates as a DJ bar in Shibuya, maintaining an intimate setting where selectors can explore deeper cuts without the pressure of peak-time crowd dynamics. The venue's compact layout fosters close interaction between artists and audience, creating space for more experimental programming alongside established underground sounds."
  },
  {
    id: "www",
    name: "WWW",
    city: "TOKYO",
    area: "SHIBUAY",
    type: "livehouse",
    image: "images/venues/www.jpeg",
    genre: ["TECHNO", "HOUSE", "LIVE", "OTHERS"],
    capacity: 450,
    address: "Cinema Rise Building B1F, 13-17 Udagawa-cho, Shibuya-ku, Tokyo",
    lat: 35.6615,
    lng: 139.6988,
    url: "https://www-shibuya.jp/",
    instagram: "https://www.instagram.com/www_shibuya/",
    desc: "WWW operates as Shibuya's intimate livehouse where electronic acts perform in a room that prioritizes sound quality over spectacle. The venue's compact layout creates an immersive environment where the boundary between performer and audience dissolves, making it a preferred spot for both established artists and emerging talent to test new material."
  },
  {
    id: "o-east",
    name: "SPOTIFY O-EAST",
    city: "TOKYO",
    area: "SHIBUAYA",
    type: "livehouse",
    image: "images/venues/o-east.jpeg",
    genre: ["TECHNO", "HOUSE", "MINIMAL", "LIVE", "OTHERS"],
    capacity: 1300,
    address: "2-14-8 Dogenzaka, Shibuya-ku, Tokyo",
    lat: 35.6587,
    lng: 139.6956,
    url: "https://shibuya-o.com/east/",
    instagram: "https://www.instagram.com/midnight_east/",
    desc: "One of Shibuya's most established mid-sized venues, O-East has hosted everything from indie rock to underground electronic acts since the late 90s. The space maintains a no-frills approach with solid sound and sightlines that work equally well for live bands and DJ sets. Part of the broader O-family of venues, it sits at the sweet spot between intimate club and proper concert hall."
  },
  {
    id: "bonobo",
    name: "BONOBO",
    city: "TOKYO",
    area: "JINGUMAE",
    type: "bar",
    image: "images/venues/bonobo.jpg",
    genre: ["TECHNO", "HOUSE", "MINIMAL", "AMBIENT", "OTHERS"],
    capacity: 100,
    address: "2-23-4 Jingumae, Shibuya-ku, Tokyo",
    lat: 35.6746,
    lng: 139.7111,
    instagram: "https://www.instagram.com/jingumaebonobo/",
    desc: "A cozy neighborhood bar in Jingu-mae that doubles as an intimate venue for electronic music. The space attracts a discerning crowd drawn to its carefully curated sound and unpretentious atmosphere. Its compact size creates an unusually close connection between artists and audience."
  },
  {
    id: "forestlimit",
    name: "FORESTLIMIT",
    city: "TOKYO",
    area: "HATAGAYA",
    type: "club",
    image: "images/venues/forestlimit.jpg",
    genre: ["TECHNO", "AMBIENT"],
    capacity: 80,
    address: "KODA Building B1F 102, 2-8-15 Hatagaya, Shibuya-ku, Tokyo",
    lat: 35.678,
    lng: 139.6771,
    url: "https://www.forestlimit.com/",
    instagram: "https://www.instagram.com/forestlimit_info/",
    desc: "FORESTLIMIT operates as an intimate basement club in Shibuya, carving out space for experimental electronic music and avant-garde sound art. The venue's stripped-down aesthetic and carefully curated programming attracts artists and audiences seeking alternatives to Tokyo's mainstream club circuit. Its compact layout creates an immersive environment where the boundary between performer and audience dissolves."
  },
  {
    id: "vent",
    name: "VENT",
    city: "TOKYO",
    area: "OMOTESANDO",
    type: "club",
    image: "images/venues/vent.jpeg",
    genre: ["TECHNO", "HOUSE"],
    capacity: 400,
    address: "3-18-19 Minami-Aoyama, Minato-ku, Tokyo",
    lat: 35.6652,
    lng: 139.7129,
    url: "http://vent-tokyo.net/",
    instagram: "https://www.instagram.com/vent.tokyo/",
    desc: "A intimate basement club in Shibuya that has carved out a reputation for uncompromising techno programming since opening in 2016. The venue's stark concrete interior and precise sound system create an environment where the music takes absolute priority over everything else."
  },
  {
    id: "circus-osaka",
    name: "CIRCUS OSAKA",
    city: "OSAKA",
    area: "SHINSAIBASHI",
    type: "club",
    image: "images/venues/circus-osaka.jpeg",
    genre: ["TECHNO", "HOUSE", "BASS", "OTHERS"],
    capacity: 200,
    address: "2F, Nakanishi Building, 1-8-16 Nishishinsaibashi, Chuo-ku, Osaka City, Osaka Prefecture",
    lat: 34.675,
    lng: 135.4989,
    url: "https://circus-osaka.com/",
    instagram: "https://www.instagram.com/circus_osaka/",
    desc: "CIRCUS OSAKA operates as one of Osaka's key underground techno destinations, housed in a compact basement space that prioritizes sound system quality over size. The venue consistently programs cutting-edge international and domestic techno acts, maintaining its reputation as a serious club for dedicated heads in the Kansai region."
  },
  {
    id: "club-joule",
    name: "CLUB JOULE",
    city: "OSAKA",
    area: "SHINSAIBASHI",
    type: "club",
    image: "images/venues/club-joule.jpeg",
    genre: ["TECHNO", "HOUSE", "LIVE", "OTHERS"],
    capacity: 500,
    address: "1st, 2nd, 3rd, 4th, and 5th floors, 2-11-7 Nishishinsaibashi, Chuo-ku, Osaka City, Osaka Prefecture",
    lat: 34.6713,
    lng: 135.4979,
    url: "https://club-joule.com/ja/",
    instagram: "https://www.instagram.com/clubjoule_official/",
    desc: "Club Joule operates as one of Osaka's key underground techno spaces, housed in a basement setting that prioritizes sound system quality over aesthetic flourishes. The venue maintains a stripped-back approach that lets the music define the experience, regularly hosting both international techno acts and Japan's leading electronic artists. Its intimate layout creates an intense dance floor dynamic that has made it a fixture in Kansai's techno circuit."
  },
  {
    id: "compufunk",
    name: "COMPUFUNK RECORDS",
    city: "OSAKA",
    area: "KITAHAMA",
    type: "club",
    image: "images/venues/compufunk.jpeg",
    genre: ["TECHNO", "HOUSE", "MINIMAL", "BASS", "AMBIENT"],
    capacity: 100,
    address: "2F, GROW Kitahama Building (Kitahama Building No. 2), 1-29 Kitahama Higashi, Chuo-ku, Osaka City, Osaka Prefecture",
    lat: 34.6904,
    lng: 135.5122,
    url: "https://www.instagram.com/djcompufunk/",
    instagram: "https://www.compufunk.com/?mode=f3",
    desc: "COMPUFUNK RECORDS operates as both record shop and intimate club space in Osaka's underground circuit. The venue maintains a focused approach to analog-driven electronic music, with DJ Compufunk's deep knowledge of obscure funk, electro and early techno informing both the shop's selection and club programming. Its compact dimensions create an immersive listening environment that prioritizes sound quality over scale."
  },
  {
    id: "noon",
    name: "NOON + CAFE",
    city: "OSAKA",
    area: "UMEDA",
    type: "bar",
    image: "images/venues/noon.jpeg",
    genre: ["TECHNO", "HOUSE", "LIVE", "OTHERS"],
    capacity: 100,
    address: "3-3-8 Nakazakinishi, Kita-ku, Osaka City, Osaka Prefecture",
    lat: 34.7071,
    lng: 135.5016,
    url: "https://noon-cafe.com/",
    instagram: "https://www.instagram.com/noon_cafe_nakazaki/",
    desc: "A intimate bar and cafe hybrid in Osaka's Nakazakicho district that bridges daytime coffee culture with late-night music sessions. The compact space hosts DJ sets and small gatherings that feel more like private parties than formal club nights. Known for its carefully curated selection of underground electronic music and relaxed atmosphere that attracts both local diggers and visiting artists."
  },
  {
    id: "triangle",
    name: "TRIANGLE",
    city: "OSAKA",
    area: "SHINSAIBASHI",
    type: "club",
    image: "images/venues/triangle.jpeg",
    genre: ["TECHNO", "HOUSE", "OTHERS"],
    capacity: 250,
    address: "2-18-5 Nishishinsaibashi, Chuo-ku, Osaka City, Osaka Prefecture",
    lat: 34.6722,
    lng: 135.4976,
    url: "https://triangle-osaka.jp/",
    instagram: "https://www.instagram.com/triangleosaka/",
    desc: "Triangle operates as one of Osaka's more intimate underground spaces, housed in a compact basement setting that prioritizes sound quality over scale. The venue has built a reputation for carefully curated lineups that span deeper spectrum techno and experimental electronic music, attracting both local selectors and international acts seeking a more focused environment than the city's larger clubs."
  },
  {
    id: "sunhall",
    name: "SUNHALL",
    city: "OSAKA",
    area: "SHINSAIBASHI",
    type: "livehouse",
    image: "images/venues/sunhall.jpeg",
    genre: ["OTHERS"],
    capacity: 400,
    address: "Big Step South B2, 2-9-28 Nishishinsaibashi, Chuo-ku, Osaka City, Osaka Prefecture",
    lat: 34.6709,
    lng: 135.4984,
    url: "https://sunhall.jp/",
    instagram: "https://www.instagram.com/sunhall.info/",
    desc: "SUNHALL operates as one of Osaka's essential mid-sized venues, bridging the gap between intimate club spaces and larger concert halls. The venue has built its reputation hosting both local underground acts and touring international artists, maintaining a sound system that serves everything from experimental electronics to harder techno lineups. Its consistent programming and accessible Nippombashi location have made it a reliable fixture in Kansai's electronic music circuit."
  },
  {
    id: "club-metro",
    name: "CLUB METRO",
    city: "KYOTO",
    area: "JINGU-MARUTAMACHI",
    type: "club",
    image: "images/venues/club-metro.jpeg",
    genre: ["TECHNO", "HOUSE", "LIVE", "AMBIENT"],
    capacity: 300,
    address: "82 Shimotsutsumi-cho, Sakyo-ku, Kyoto City, Kyoto Prefecture, BF",
    lat: 35.017,
    lng: 135.7727,
    url: "https://www.metro.ne.jp/",
    instagram: "https://www.instagram.com/metro_kyoto/",
    desc: "Metro has anchored Kyoto's underground scene since the early 90s, operating from a converted basement space near Kawaramachi. The club's intimate concrete interior and carefully curated bookings have made it a essential stop for touring artists and a cornerstone of Kansai's electronic music culture."
  }
];
