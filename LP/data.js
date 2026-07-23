/* ==========================================================
   TECHNO JAPAN — SHARED DATA

   Edit this file to update artists, events, and venues across all pages.
   events.html, artists.html, venues.html, news.html, and map.html
   all read from here.
   ========================================================== */

const ARTISTS = [
  {
    id: "dj-nobu",
    name: "DJ Nobu",
    city: "CHIBA",
    country: "JAPAN",
    genre: "TECHNO",
    image: "images/artists/dj-nobu.webp",
    bio: "DJ Nobu is a Tokyo-based techno artist deeply embedded in Japan's underground electronic music scene. Known for his precise technical approach and atmospheric sound design, he represents the evolution of Japanese techno with a distinctly minimalist aesthetic.",
    links: {
      instagram: "https://www.instagram.com/dj_nobu_ft/",
      soundcloud: "https://soundcloud.com/djnobu_bitta",
      bandcamp: "https://dj-nobu.bandcamp.com/album/sh",
    }
  },
  {
    id: "wata-igarashi",
    name: "WATA IGARASHI",
    city: "TOKYO",
    country: "JAPAN",
    genre: "TECHNO",
    image: "images/artists/wata-igarashi.webp",
    imagePosition: "center top",
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
    image: "images/artists/kotsu.webp",
    bio: "Osaka selector with deep roots in the Kansai underground. Fluid sets moving between deep house, minimal, and micro-house. A fixture at CIRCUS Osaka and a regular across Japan's club circuit.",
    links: {
      instagram: "https://www.instagram.com/kotsu_dj/",
      soundcloud: "https://soundcloud.com/kotsu",
    }
  },
  {
    id: "ken-ishii",
    name: "KEN ISHII",
    city: "TOKYO",
    country: "JAPAN",
    genre: "TECHNO",
    image: "images/artists/ken-ishii.webp",
    bio: "Pioneer of Japanese techno since the early '90s. Internationally recognized through releases on R&S Records and Sublime. A living legend whose influence on Japan's electronic music scene is immeasurable.",
    links: {
      instagram: "https://www.instagram.com/kenishiiofficial/",
      soundcloud: "https://soundcloud.com/ken-ishii-70drums",
      bandcamp: "https://kenishii.bandcamp.com/",
      website: "https://kenishii.com",
    }
  },
  {
    id: "dj-miku",
    name: "Dj Miku",
  },
  {
    id: "dj-kensei",
    name: "Dj Kensei",
  },
  {
    id: "dj-yogurt",
    name: "Dj Yogurt",
  },
  {
    id: "hidai",
    name: "Hidai",
  },
  {
    id: "taichi-kawahira",
    name: "Taichi Kawahira",
  },
  {
    id: "tsutomu",
    name: "Tsutomu",
  },
  {
    id: "qmico",
    name: "Qmico",
  },
  {
    id: "ga-su",
    name: "Ga Su",
  },
  {
    id: "freecinn",
    name: "Freecinn",
  },
  {
    id: "nutmeg",
    name: "Nutmeg",
  },
  {
    id: "snipe1",
    name: "Snipe1",
  },
  {
    id: "liarako",
    name: "Liarako",
  },
  {
    id: "akey",
    name: "Akey",
  },
  {
    id: "ayumu",
    name: "Ayumu",
  },
  {
    id: "captain-k",
    name: "Captain K",
  },
  {
    id: "lowki",
    name: "Lowki",
  },
  {
    id: "masa-aka-kyounote",
    name: "Masa Aka Kyounote",
  },
  {
    id: "menou-iwamaki",
    name: "Menou Iwamaki",
  },
  {
    id: "mimu",
    name: "Mimu",
  },
  {
    id: "naotsun",
    name: "Naotsun",
  },
  {
    id: "norid",
    name: "Norid",
  },
  {
    id: "sakuma",
    name: "Sakuma",
  },
  {
    id: "seco",
    name: "Seco",
  },
  {
    id: "shimoyan",
    name: "Shimoyan",
  },
  {
    id: "tada",
    name: "Tada",
  },
  {
    id: "yazzus",
    name: "Yazzus",
  },
  {
    id: "cosmic-caz",
    name: "Cosmic Caz",
  },
  {
    id: "janus-rose",
    name: "Janus Rose",
  },
  {
    id: "mayudepth",
    name: "Mayudepth",
  },
  {
    id: "akii",
    name: "Akii",
  },
  {
    id: "mio",
    name: "Mio",
  },
  {
    id: "aliceyuki",
    name: "Aliceyuki",
  },
  {
    id: "akaaki-ito",
    name: "Akaaki Ito",
  },
  {
    id: "choko",
    name: "Choko",
  },
  {
    id: "akihiro-suzuki",
    name: "Akihiro Suzuki",
  },
  {
    id: "endorphin",
    name: "Endorphin",
  },
  {
    id: "kevin-miyagi",
    name: "Kevin Miyagi",
  },
  {
    id: "psychogem",
    name: "Psychogem",
  },
  {
    id: "sho",
    name: "Sho",
  },
  {
    id: "takehiro-imaizumi",
    name: "Takehiro Imaizumi",
  },
  {
    id: "tazzy",
    name: "Tazzy",
  },
  {
    id: "tko",
    name: "Tko",
  },
  {
    id: "tmak",
    name: "Tmak",
  },
  {
    id: "yeark",
    name: "Yeark",
  },
  {
    id: "yuripon",
    name: "Yuripon",
  },
  {
    id: "ao",
    name: "青",
  },
  {
    id: "198",
    name: "198",
  },
  {
    id: "antal-hunee",
    name: "Antal b2b Hunee",
  },
  {
    id: "ben-ufo",
    name: "Ben Ufo",
  },
  {
    id: "daphni",
    name: "Daphni",
  },
  {
    id: "dj-maria",
    name: "Dj Maria.",
  },
  {
    id: "dungeoneering",
    name: "Dungeoneering",
  },
  {
    id: "feline",
    name: "Feline",
  },
  {
    id: "floating-points",
    name: "Floating Points",
  },
  {
    id: "gerd-janson",
    name: "Gerd Janson",
  },
  {
    id: "gonno",
    name: "Gonno",
  },
  {
    id: "haai",
    name: "Haai",
  },
  {
    id: "helena-hauff",
    name: "Helena Hauff",
  },
  {
    id: "jonathan-kusuma",
    name: "Jonathan Kusuma",
  },
  {
    id: "jonny-rock",
    name: "Jonny Rock",
  },
  {
    id: "kikiorix",
    name: "Kikiorix",
  },
  {
    id: "mala",
    name: "Mala",
  },
  {
    id: "nc4k",
    name: "Nc4k(Stones Taro b2b Lomax)",
  },
  {
    id: "sisi-b2b-ouissam-b2b-yamarchy",
    name: "Sisi b2b Ouissam b2b Yamarchy",
  },
  {
    id: "suze-ij",
    name: "Suze Ij",
  },
  {
    id: "four-tet",
    name: "Four Tet",
  },
  {
    id: "ojisan",
    name: "Ojisan",
  },
  {
    id: "noritake",
    name: "Noritake",
  },
  {
    id: "eric-cloutier",
    name: "Eric Cloutier",
  },
  {
    id: "caimann",
    name: "Caimann",
  },
  {
    id: "fuji",
    name: "FUJI",
  },
  {
    id: "prins-thomas",
    name: "Prins Thomas",
  },
  {
    id: "rami",
    name: "RAMI",
  },
  {
    id: "pianeti-sintetici",
    name: "Pianeti Sintetici",
  },
  {
    id: "ground",
    name: "Ground",
  },
  {
    id: "akie",
    name: "Akie",
  },
  {
    id: "adhemar",
    name: "AdhéMar",
  },
  {
    id: "allen-mock",
    name: "Allen Mock",
  },
  {
    id: "doltz",
    name: "Doltz",
  },
  {
    id: "joma",
    name: "Joma",
  },
  {
    id: "suguru-mochizuki",
    name: "Suguru Mochizuki",
  },
  {
    id: "yukimasa",
    name: "YUKIMASA",
  },
  {
    id: "tonbo",
    name: "Tonbo",
  },
  {
    id: "sunga",
    name: "SUNGA",
  },
  {
    id: "dj-yazi",
    name: "DJ Yazi",
  },
  {
    id: "iron",
    name: "Iron",
  },
  {
    id: "Kiko Dinucci",
    name: "Kiko Dinucci",
  },
  {
    id: "The Master Musicians of Joujouka",
    name: "The Master Musicians Of Joujouka",
  },
  {
    id: "Kuo from Sunset Rollercoaster",
    name: "Kuo From Sunset Rollercoaster",
  },
  {
    id: "Sylvan Esso",
    name: "Sylvan Esso",
  },
  {
    id: "Acid Pauli",
    name: "Acid Pauli",
  },
  {
    id: "Alabaster DePlume",
    name: "Alabaster DePlume",
  },
  {
    id: "Juana Molina",
    name: "Juana Molina",
  },
];

const EVENTS = [

];

const FESTIVALS = [

];

const VENUES = [
  {
    id: "womb",
    name: "WOMB",
    city: "TOKYO",
    area: "SHIBUYA",
    type: "club",
    image: "images/venues/womb.webp",
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
    image: "images/venues/circus-tokyo.webp",
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
    image: "images/venues/saloon.webp",
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
    image: "images/venues/solfa.webp",
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
    image: "images/venues/unit.webp",
    imagePosition: "center top",
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
    image: "images/venues/liquidroom.webp",
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
    image: "images/venues/clubasia.webp",
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
    image: "images/venues/mitsuki.webp",
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
    image: "images/venues/the-room.webp",
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
    image: "images/venues/oath.webp",
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
    area: "SHIBUYA",
    type: "livehouse",
    image: "images/venues/www.webp",
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
    area: "SHIBUYA",
    type: "livehouse",
    image: "images/venues/o-east.webp",
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
    image: "images/venues/bonobo.webp",
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
    image: "images/venues/forestlimit.webp",
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
    image: "images/venues/vent.webp",
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
    image: "images/venues/circus-osaka.webp",
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
    image: "images/venues/club-joule.webp",
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
    image: "images/venues/compufunk.webp",
    genre: ["TECHNO", "HOUSE", "MINIMAL", "BASS", "AMBIENT"],
    capacity: 100,
    address: "2F, GROW Kitahama Building (Kitahama Building No. 2), 1-29 Kitahama Higashi, Chuo-ku, Osaka City, Osaka Prefecture",
    lat: 34.6904,
    lng: 135.5122,
    url: "https://www.compufunk.com/",
    instagram: "https://www.instagram.com/djcompufunk/",
    desc: "COMPUFUNK RECORDS operates as both record shop and intimate club space in Osaka's underground circuit. The venue maintains a focused approach to analog-driven electronic music, with DJ Compufunk's deep knowledge of obscure funk, electro and early techno informing both the shop's selection and club programming. Its compact dimensions create an immersive listening environment that prioritizes sound quality over scale."
  },
  {
    id: "noon",
    name: "NOON + CAFE",
    city: "OSAKA",
    area: "UMEDA",
    type: "bar",
    image: "images/venues/noon.webp",
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
    image: "images/venues/triangle.webp",
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
    image: "images/venues/sunhall.webp",
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
    image: "images/venues/club-metro.webp",
    genre: ["TECHNO", "HOUSE", "LIVE", "AMBIENT"],
    capacity: 300,
    address: "82 Shimotsutsumi-cho, Sakyo-ku, Kyoto City, Kyoto Prefecture, BF",
    lat: 35.017,
    lng: 135.7727,
    url: "https://www.metro.ne.jp/",
    instagram: "https://www.instagram.com/metro_kyoto/",
    desc: "Metro has anchored Kyoto's underground scene since the early 90s, operating from a converted basement space near Kawaramachi. The club's intimate concrete interior and carefully curated bookings have made it a essential stop for touring artists and a cornerstone of Kansai's electronic music culture."
  },
];

/* ==========================================================
   ARTICLES — Editorial content for DISCOVER page
   ========================================================== */
const ARTICLES = [
  {
    id: "transcendence-2025-report",
    title: "野外テクノパーティTranscendenceで見た次世代ジェネレーションの可能性",
    excerpt: "森林に包まれた長野の野外会場で、日本の若き主催者たちが開催したレイヴ「Transcendence」。スイスの先端テクノレーベルとのコラボレーションと、自然と完全に調和した空間演出が生み出した、次世代レイヴカルチャーの新しい景色がそこにあった。",
    body: `<h2>Transcendenceは、日本の新たなレイヴジェネレーションが創り上げたカッティングエッジなレイヴパーティだ。</h2><p><span class="ql-font-mono">都内を出発するときにはあいにくの雨だったが、現地に着く頃には気持ち良い5月の晴天に恵まれた。</span></p><p><span class="ql-font-mono">会場は、人口約600人の北相木村にある「長者の森キャンプ場」は、美しい森林に囲まれていて、忙しない都会生活に疲れた我々に安らぎを与えてくれる森林セラピーだ。</span></p><p><img src="https://lh3.googleusercontent.com/d/1s3VL1ZVlXzjS2pslw8nR4Vwt65hQvWRH=w2000"></p><p>フロアの横には小川が流れていて、川を見ながら太陽を浴びていれば、日本の山の自然の美しさの身を委ねることができる。特にDJステージの横にある立派なカラマツの木々が印象的だった。</p><p><img src="https://lh3.googleusercontent.com/d/17_sRgicAFNCiGI_1KyNsQMURMteyes8g=w2000"></p><p>今回のレイヴで目を引いたのは演出家・四尾龍郎が率いる空間演出集団RGBによる自然と完全に調和した演出だ。小川の流れに優しくそうような風に靡く布、カラマツの木々と調和したミニマムかつ変化が豊かなライティングに目を奪われた人も多いだろう。</p><p><img src="https://lh3.googleusercontent.com/d/1Ll_2VzEZt7kQP1RKGI_1-PJg-aKKFJqt=w2000"></p><p>このパーティを支えているのが、Paramountを主宰するOtodashiチームが提供するTW Audioのサウンドシステムだ。ドイツ製のコンパクトなこのサウンドシステムは、DJのセレクトする原曲のクオリティや手元の動きが想像できるような、実に「素直」なサウンドが特徴だ。 </p><p>PAブースは驚くほどミニマルで、機材を極限まで減らしてDJミキサーからスピーカーまでの間の電気信号をシンプルにまとめている。音量も大きすぎず、自分でフロアを前後すればボリュームの調整ができるため、2日間を通して音楽を楽しむことができた。</p><p><img src="https://lh3.googleusercontent.com/d/1Qj8_ypbQ1KfqjjfZvrsWv7Gz9sCwcrpA=w2000"></p><p>音楽性に関しては、先進的でチャレンジングなテクノが中心になっていた。特に、スイス発のGarçonとAgonisが主宰する「Amenthia Recordings」の2人が深夜帯のピークタイムを担った。<br>レーベル立ち上げ以来、彼らが取り組んできたドラムンリズムの概念は、脱構築テクノともいえるスタイルでフロアのクラウドを圧倒してくれた。</p><p><img src="https://lh3.googleusercontent.com/d/1uuLVI2X3tlj8M7AU-v8fTSnFaC45KDZr=w2000"></p><p>日本人のDJとしては、夕入りのトランジションタイムを務めたOCCA、朝方のビルドアップを得意なアシッドサウンドでまとめたオーガナイザーのDJ MARIA.が、しっかり彼らの選曲眼と個性を見せつけてくれた。</p><p><br>客層については、始まって数年のレイヴということもあり20代〜30代が中心で日本のレイヴの中では若めの客層と言えるだろう。また、外国人は1/4ほどで皆マナーがよい印象だった。1泊2日でエントランスフィーが良心的だったことや、シンプルで美しいプロモーションが要因と言えるだろう。</p><p><br></p><p>来年の開催もすでに楽しみになるほど、自然清らかなベニューで先進的なテクノを楽しめるTranscendence。こうして若い世代が野外を主催することで、次なるレイヴジェネレーションへカルチャーが引き継がれていく。主催者のDJ MARIA.とTakumi Inamoto、そして多くのスタッフの多大な努力とレイヴへの情熱に、改めて敬意を表したい。<img src="https://lh3.googleusercontent.com/d/1dv3v1mSEhofWCRItjF-6HoQYW1RlzhXd=w2000"></p>`,
    category: "REPORT",
    date: "2025-06-20",
    author: "Masafumi Take",
    image: "images/articles/transcendence-2025-report.webp",
    featured: true,
    views: 1500,
    readTime: 2,
    tags: ["Dj","Rave","transcendence"],
    status: "published",
  },
];