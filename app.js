// ===== INTEL DASHBOARD v3.0 — DATA =====

const SCENARIOS = [
    { id: 'S1', group: 'diplomasi', barClass: 'bar-diplomatik', name: 'Gencatan Senjata Taktis Hizbullah-Israel (Blue Line)', baseline: 38, base: 38, current: 38, tags: ['de-eskalasi', 'netral'], confBase: 'med', challenge: 'Kalkulasi meleset: Penilaian intelijen IDF sering gagal mengukur otonomi komandan lapangan Hizbullah (Unit Radwan) yang dapat memicu provokasi faksi secara mandiri di luar rantai komando Beqaa Valley.' },
    { id: 'S2', group: 'diplomasi', barClass: 'bar-diplomatik', name: 'Resolusi Back-Channel di Oman (Doha-Muscat Track)', baseline: 22, base: 22, current: 22, tags: ['de-eskalasi'], confBase: 'low', challenge: 'Asumsi linear: Kesepakatan ekonomi-untuk-keamanan (sanksi dicabut sebagian) mengasumsikan faksi Konservatif Garis Keras IRGC di Majlis tunduk penuh pada kalkulasi ekonomi pemerintahan moderat Iran.' },
    { id: 'S3', group: 'diplomasi', barClass: 'bar-diplomatik', name: 'Rusia-China Paksakan Garis Merah De-eskalasi (Resolusi DK PBB)', baseline: 15, base: 15, current: 15, tags: ['netral'], confBase: 'low', challenge: 'Mirror-imaging bias: AS dan Israel berasumsi Beijing/Moskow mengutamakan stabilitas global murni, padahal eskalasi terkendali di Timur Tengah justru menguras fokus militer AS dari Indo-Pasifik dan Ukraina.' },
    { id: 'S4', group: 'militer', barClass: 'bar-militer', name: 'Pre-emptive Strike Udara IDF ke Fordow & Natanz', baseline: 28, base: 28, current: 28, tags: ['eskalasi', 'tinggi'], confBase: 'med', challenge: 'Optimisme berlebih operasional: Fasilitas pengayaan Fordow tertanam 80 meter di bawah pegunungan; tanpa GBU-57 MOP (Massive Ordnance Penetrator) ganda dari USAF, efektivitas payload bunker buster F-15I/F-35I Israel sangat diragukan secara fisika.' },
    { id: 'S5', group: 'militer', barClass: 'bar-militer', name: 'Serangan Balasan Rudal Balistik IRGC ke Fasilitas Udara Nevatim (Israel)', baseline: 35, base: 35, current: 35, tags: ['eskalasi'], confBase: 'high', challenge: 'Kurangnya imajinasi skenario: Paradigma "Strategic Patience" Iran diasumsikan kaku. Pasca operasi "True Promise", doktrin Iran telah bergeser dari proksi ke respon kinetik langsung untuk memulihkan deterrence psikologis domestik.' },
    { id: 'S6', group: 'militer', barClass: 'bar-militer', name: 'Operasi Darat Israel Skala Terbatas ke Lebanon Selatan', baseline: 20, base: 20, current: 20, tags: ['eskalasi', 'tinggi'], confBase: 'med', challenge: 'Mispersepsi Attrition: Menguras arsenal Hizbullah lewat operasi udara dinilai cukup. Kenyataannya, infrastruktur terowongan bawah tanah di selatan Litani membuat peperangan darat IDF akan asimetris dan menyerap pasukan cadangan secara fatal.' },
    { id: 'S7', group: 'militer', barClass: 'bar-militer', name: 'Operasi Udara Koalisi AS (CENTCOM) Mencederai Logistik Houthi', baseline: 42, base: 42, current: 42, tags: ['eskalasi'], confBase: 'high', challenge: 'Targeting Fallacy: Serangan ke peluncur rudal statis dinilai efektif menurunkan C2 Houthi. Namun komando Houthi menggunakan desentralisasi ekstrem dan manufaktur komponen mandiri bawah tanah yang membuatnya kebal (resilien) pada serangan presisi.' },
    { id: 'S8', group: 'ekonomi', barClass: 'bar-ekonomi', name: 'Blokade Parsial Selat Hormuz (Mining & FAC Swarm)', baseline: 18, base: 18, current: 18, tags: ['eskalasi', 'tinggi'], confBase: 'med', challenge: 'Kebutaan strategis: Analisis arus utama beranggapan Iran tidak akan memblokade rute ekspor minyak utamanya ke China. Tetapi, memotong 20% suplai global dapat memicu hiperinflasi seketika, memaksa AS menekan Israel tanpa Iran harus menembakkan satu peluru konvensional pun.' },
    { id: 'S9', group: 'ekonomi', barClass: 'bar-ekonomi', name: 'Algoritma Finansial Merespons Ketegangan: Brent Lompati USD 115', baseline: 32, base: 32, current: 32, tags: ['eskalasi'], confBase: 'high', challenge: 'Kapasitas cadangan (spare capacity) Aramco/ADNOC dinilai dapat menyerap guncangan. Namun kepanikan algoritma trading pada pasar berjangka memproses sentimen I&W 10x lebih memutus rasionalitas supply-demand fisik murni.' },
    { id: 'S10', group: 'ekonomi', barClass: 'bar-ekonomi', name: 'OFAC Treasury AS Memperketat Pemeriksaan Entitas Penyelundup Armada Gelap ("Dark Fleet")', baseline: 55, base: 55, current: 55, tags: ['eskalasi', 'netral'], confBase: 'high', challenge: 'Keyakinan Buta pada Sanksi: Kampanye tekanan maksimum mengasumsikan aktor akan menyerah. Iran justru telah meresmikan asuransi dan rute perkapalan bayangan non-dolar yang sepenuhnya tebal dari instrumen yurisdiksi OFAC AS.' },
    { id: 'S11', group: 'ekstrem', barClass: 'bar-ekstrem', name: 'Pergeseran Politik Internal Mendadak: Transisi Kekuasaan Khamenei', baseline: 12, base: 12, current: 12, tags: ['tinggi'], confBase: 'spec', challenge: 'Miskalkulasi Fragmentasi: Intelijen Barat mengestimasikan kekosongan kekuasaan akan mendisrupsi Rantai Komando. Realitasnya dewan pelaksana IRGC sangat terstruktur secara institusional; suksesi justru memungkinan faksi korps garis keras mengambil total kontrol eksekutif.' },
    { id: 'S12', group: 'ekstrem', barClass: 'bar-ekstrem', name: 'Israel Deklarasikan Opsi "Samson" (Penggunaan Kapabilitas Nuklir Taktis)', baseline: 4, base: 4, current: 4, tags: ['eskalasi', 'tinggi'], confBase: 'spec', challenge: "Kemustahilan Tabu: Menganalisa bahwa threshold penggunaan nuklir masih stabil. Jika pertahanan udara David Sling / Arrow jebol secara simultan oleh ribuan hulu ledak, pandangan survival absolut Israel ('ain breira) dapat melampaui tabu nuklir militer modern." },
];

const ESCALATION_CHRONOLOGY = [
    { time: '12 MAR 2026', title: 'IMINT: Bukti Bunker Baru di Pegunungan Natanz', impact: 'CRITICAL', causality: 'Pemicu Awal: Aktivitas ekskavasi kedalaman >80m membatalkan utilitas pay-load armada udara IAF (Israeli Air Force), memicu percepatan "Window of Opportunity" serangan Israel sebelum fasilitas kebal total.' },
    { time: '14 MAR 2026', title: 'Aktivasi Status Siaga Tertinggi (DEFCON setara) IDF', impact: 'ESKALASI', causality: 'Reaksi Langsung: Pasukan Udara IAF mengudara 24/7. Seluruh sistem pertahanan multi-layer (Arrow, David Sling, Iron Dome) melakukan rekam ulang trayektori masuk (inbound) secara sinkron.' },
    { time: '18 MAR 2026', title: 'Distribusi Cepat Komponen C2 Hezbollah (Lebanon)', impact: 'WATCH', causality: 'Respon Desentralisasi: Mengetahui IDF siap menyerang fasilitas komando strategis, IRGC menginstruksikan jaringan proksinya di Lebanon selatan untuk membongkar infrastruktur tersentralisasi menjadi aset mobile tersembunyi.' },
    { time: '20 MAR 2026', title: 'Keputusan Cepat Pentagon: Eksekusi Operasi Nimitz', impact: 'DETERRENCE', causality: 'Manuver Postur AS: Untuk mencegah kalkulasi sepihak Israel yang dapat membakar kawasan, CENTCOM AS memaksakan kehadiran (Carrier presence) armada pimpinan USS Nimitz ke garis depan untuk menanamkan sinyal "Strategic Deterrence" pada Iran & proksinya.' },
    { time: '23 MAR 2026', title: 'Taktik Swarming Houthi Mengunci Laju Tanker Eropa', impact: 'ESKALASI', causality: 'Uji Coba Asimetris (Pushback): IRGC menugaskan Houthi untuk mendisrupsi suplai komersial Barat via rudal permukaan & swarm-drone. Tujuannya: Membuktikan pada AS bahwa Iran mengontrol kunci urat nadi hiperinflasi logistik dunia.' },
    { time: '28 MAR 2026', title: 'Intervensi Diplomasi Tertutup Utusan Khusus China', impact: 'DE-ESKALASI', causality: 'Pemindahan Medan Pertempuran: Lonjakan masif asuransi kargo ke Asia membahayakan rencana pertumbuhan PDB China. Beijing bertindak, memanggil seluruh duta diplomatik dan menjanjikan paket investasi tertutup pada Teheran jika proksinya ditarik mundur sementara.' }
];

const IW_INDICATORS = [
    { cat: 'MILITER', cr: 'CR-001', name: 'Rotasi UAV Shahed-136 di Suriah Selatan', threshold: '> 50 Unit', unit: 'Unit', base: 40, val: 72, watchThresh: 40, triggerThresh: 50, inverse: false },
    { cat: 'MILITER', cr: 'CR-002', name: 'Kesiapan Baterai Iron Dome Utara', threshold: '< 40%', unit: '%', base: 80, val: 65, watchThresh: 60, triggerThresh: 40, inverse: true },
    { cat: 'MILITER', cr: 'CR-003', name: 'Pengerahan F-35I Adir ke Pangkalan Ramon', threshold: '> 2 Skuadron', unit: 'Sqd', base: 0, val: 1.5, watchThresh: 1, triggerThresh: 2, inverse: false },
    { cat: 'MILITER', cr: 'CR-004', name: 'Unit Radwan Hezbollah Melewati Sungai Litani', threshold: '> 500 Personel', unit: 'Personel', base: 50, val: 250, watchThresh: 300, triggerThresh: 500, inverse: false },
    { cat: 'MILITER', cr: 'CR-005', name: 'Rotasi Kapal Induk AS (CENTCOM AOR)', threshold: '> 1 CSG', unit: 'CSG', base: 1, val: 2, watchThresh: 1.5, triggerThresh: 2, inverse: false },
    { cat: 'DIPLOMATIK', cr: 'CR-006', name: 'Evakuasi Staf Non-Esensial Kedubes AS di Beirut', threshold: '> Lvl 3', unit: 'Level', base: 2, val: 4, watchThresh: 3, triggerThresh: 4, inverse: false },
    { cat: 'DIPLOMATIK', cr: 'CR-007', name: 'Kegagalan Inspeksi Menyeluruh IAEA di Natanz', threshold: '> 48 Jam', unit: 'Jam', base: 0, val: 56, watchThresh: 24, triggerThresh: 48, inverse: false },
    { cat: 'DIPLOMATIK', cr: 'CR-008', name: 'Pembicaraan Back-Channel Qatar-Oman Mandek', threshold: '< 30 Aktivitas', unit: 'Index', base: 70, val: 45, watchThresh: 50, triggerThresh: 30, inverse: true },
    { cat: 'EKONOMI', cr: 'CR-009', name: 'Anomali Trafik SWIFT Bank Sentral Iran (CBI)', threshold: '> 80% Drop', unit: '% Drop', base: 5, val: 45, watchThresh: 50, triggerThresh: 80, inverse: false },
    { cat: 'EKONOMI', cr: 'CR-010', name: 'Premi Asuransi Perang Selat Hormuz', threshold: '> 1.0%', unit: '%', base: 0.2, val: 0.85, watchThresh: 0.5, triggerThresh: 1.0, inverse: false },
    { cat: 'EKONOMI', cr: 'CR-011', name: 'Gangguan Rantai Pasok Chip Drone Iran', threshold: '< 40 Index', unit: 'Index', base: 85, val: 65, watchThresh: 60, triggerThresh: 40, inverse: true },
    { cat: 'EKONOMI', cr: 'CR-012', name: 'Harga Brent Crude Oil Rawan Eskalasi', threshold: '> $100', unit: 'USD', base: 75, val: 98.4, watchThresh: 90, triggerThresh: 100, inverse: false },
    { cat: 'INTELIJEN', cr: 'CR-013', name: 'Komunikasi C2 Terenkripsi IRGC Khatam al-Anbiya', threshold: '> 400 Vol', unit: 'Vol', base: 100, val: 450, watchThresh: 250, triggerThresh: 400, inverse: false },
    { cat: 'INTELIJEN', cr: 'CR-014', name: 'Aktivitas Penggalian Fasilitas Bawah Tanah Fordow', threshold: '> 80m', unit: 'm', base: 30, val: 82, watchThresh: 60, triggerThresh: 80, inverse: false },
    { cat: 'INTELIJEN', cr: 'CR-015', name: 'Aktivasi Sleeper Cell Jaringan Quds di Eropa', threshold: '> 50 Tx', unit: 'Tx', base: 5, val: 25, watchThresh: 20, triggerThresh: 50, inverse: false },
    { cat: 'INTELIJEN', cr: 'CR-016', name: 'Persiapan Sistem Pertahanan Udara S-400 Rusia', threshold: '> 5 Flight', unit: 'Flight', base: 0, val: 1, watchThresh: 2, triggerThresh: 5, inverse: false },
];

const ACH_HYPOTHESES = [
    { id: 'H1', name: 'Tahap 1: Strategic Patience & Diplomasi Terselubung', short: 'S. PATIENCE' },
    { id: 'H2', name: 'Tahap 2: Pre-emptive Strike Israel (Target Nuklir)', short: 'PREEMPTIVE' },
    { id: 'H3', name: 'Tahap 3: Status Quo Berdarah (Proxy War Intensif)', short: 'PROXY WAR' },
    { id: 'H4', name: 'Tahap 4: Iran "Breakout" Penuh ke Senjata Nuklir', short: 'BREAKOUT' },
    { id: 'H5', name: 'Tahap 5: Eskalasi Multi-Front Kinetik (Mencakup Lebanon-Yaman)', short: 'MULTI-FRONT' },
    { id: 'H6', name: 'Tahap 6: AS Intervensi Langsung (Decapitation Strike)', short: 'US STRIKE' },
];
const ACH_EVIDENCE = [
    { ev: 'Citra SAR mendeteksi penggalian bunker baru sedalam 80m di Natanz.', cells: ['I', 'C', 'N', 'C', 'N', 'C'], weight: 2 },
    { ev: 'Pemutusan kamera IAEA di fasilitas perakitan sentrifugal canggih (IR-6).', cells: ['I', 'C', 'I', 'C', 'N', 'I'], weight: 2 },
    { ev: 'USS Dwight D. Eisenhower memperpanjang masa tugas di region.', cells: ['C', 'C', 'I', 'I', 'C', 'C'], weight: 1 },
    { ev: 'Serangan siber masif pada sistem distribusi pasokan air di Tel Aviv.', cells: ['I', 'I', 'C', 'N', 'C', 'I'], weight: 1 },
    { ev: 'Militan Houthi menggunakan rudal hipersonik pertama terhadap kapal komersial.', cells: ['I', 'N', 'C', 'I', 'C', 'N'], weight: 2 },
    { ev: 'Pertemuan rahasia negosiator Iran dengan diplomat Uni Eropa di Muscat.', cells: ['C', 'I', 'N', 'I', 'N', 'I'], weight: 1 },
    { ev: 'Kunjungan mendadak Direktur CIA William Burns ke markas Mossad di Tel Aviv.', cells: ['N', 'C', 'N', 'I', 'C', 'C'], weight: 1 },
    { ev: 'Hezbollah memindahkan unit antitank Kornet ke garis depan Litani.', cells: ['I', 'C', 'C', 'I', 'C', 'N'], weight: 2 },
    { ev: 'Rusia menjadwalkan pengiriman jet tempur Su-35 ke Iran minggu depan.', cells: ['I', 'C', 'C', 'C', 'C', 'I'], weight: 2 },
    { ev: 'IRGC mempublikasikan video simulasi serangan rudal Kheibar ke pangkalan Nevatim.', cells: ['I', 'C', 'C', 'N', 'C', 'N'], weight: 1 },
    { ev: 'Kongres AS mempertimbangkan draf Otorisasi Penggunaan Militer (AUMF) baru.', cells: ['I', 'C', 'I', 'I', 'N', 'C'], weight: 2 },
    { ev: 'Pernyataan ambigu Ayatollah Khamenei tentang "Fleksibilitas Pahlawan".', cells: ['C', 'I', 'I', 'I', 'N', 'I'], weight: 1 },
];

const PAYOFF_DATA = {
    iran: {
        title: 'IRGC vs IDF (Escalation Ladder)', rowActor: 'IRAN (IRGC)', colActor: 'ISRAEL (IDF)',
        cells: [
            { rv: '+40', rdesc: 'Sifat Asimetris Sukses', cv: '-60', cdesc: 'Kegagalan Dome/Arrow', isNash: false },
            { rv: '-20', rdesc: 'Kegagalan Serangan', cv: '+50', cdesc: 'Legitimasi Serang Balik', isNash: false },
            { rv: '+15', rdesc: 'Status Quo Menguntungkan', cv: '+10', cdesc: 'Stabilitas Sementara', isNash: true },
            { rv: '-45', rdesc: 'Destruksi Ekonomi', cv: '+20', cdesc: 'Kemenangan Taktis', isNash: false },
        ],
        rowLabels: ['LAUNCH SWARM STRIKE', 'STRATEGIC PATIENCE'], colLabels: ['PRE-EMPTIVE STRIKE', 'DEFENSIVE POSTURE'],
        nash: 'Nash Equilibrium (Patience, Defensive) dirusak jika Iran merasa window nuklirnya dikesampingkan (Threshold Crossed).',
        dominant: 'Strategi IRGC: Mengandalkan proksi (Patience) kecuali eksistensi rezim terancam langsung.'
    },
    israel: {
        title: 'ISRAEL vs IRAN (Nuclear Threshold)', rowActor: 'ISRAEL', colActor: 'IRAN',
        cells: [
            { rv: '+60', rdesc: 'Degradasi Program', cv: '-80', cdesc: 'Fasilitas Hancur', isNash: false },
            { rv: '-40', rdesc: 'Biaya Intersepsi Masif', cv: '+40', cdesc: 'Legitimasi Reaktor', isNash: false },
            { rv: '+15', rdesc: 'Deterrence Bertahan', cv: '+10', cdesc: 'Pengembangan Rahasia', isNash: true },
            { rv: '-80', rdesc: 'Ancaman Eksistensial', cv: '+100', cdesc: 'Nuclear Breakout', isNash: false },
        ],
        rowLabels: ['STRIKE FORDOW/NATANZ', 'MAINTAIN DETERRENCE'], colLabels: ['RESUME 90% WEAPONIZATION', 'FREEZE AT 60%'],
        nash: 'Nash Equilibrium (Maintain, Freeze) sangat rapuh. Intelijen sepihak bisa memicu Red Line Israel.',
        dominant: 'Strategi Israel: STRIKE (Kinetic/Cyber) wajib dilakukan jika Iran melewati 90%, mengabaikan keberatan AS.'
    },
    us: {
        title: 'AS (CENTCOM) vs IRAN', rowActor: 'AS', colActor: 'IRAN',
        cells: [
            { rv: '+30', rdesc: 'Degradasi Militer Iran', cv: '-70', cdesc: 'Runtuhnya Daya Udara', isNash: false },
            { rv: '-20', rdesc: 'Terjebak Perang Baru', cv: '+15', cdesc: 'Rally-Around-The-Flag', isNash: false },
            { rv: '+25', rdesc: 'Fokus Indo-Pasifik', cv: '+20', cdesc: 'Ruang Napas Ekonomi', isNash: true },
            { rv: '-35', rdesc: 'Kematian Pasukan AS', cv: '+40', cdesc: 'Pamer Kekuatan Proksi', isNash: false },
        ],
        rowLabels: ['DIRECT TARGETED STRIKES', 'OFFSHORE BALANCING (CBGs)'], colLabels: ['ATTACK US ASSETS', 'AVOID DIRECT US CONTACT'],
        nash: 'Nash Equilibrium (Offshore, Avoid) melayani pilar doktrin Grand Strategy multi-front Washington.',
        dominant: 'Strategi dominan AS: Tahan Israel & Iran dengan pamer armada laut raksasa, hindari operasi Darat.'
    },
    china: {
        title: 'CHINA (Strategic Pivot) vs AS', rowActor: 'CHINA', colActor: 'AS',
        cells: [
            { rv: '+50', rdesc: 'Pengamanan Energi', cv: '-10', cdesc: 'Penyusutan Diplomasi', isNash: true },
            { rv: '+20', rdesc: 'Kuras Resource AS', cv: '-40', cdesc: 'Fokus AS Terbagi', isNash: false },
            { rv: '-30', rdesc: 'Krisis Logistik Minyak', cv: '+30', cdesc: 'Navigasi Bebas Tercapai', isNash: false },
            { rv: '+10', rdesc: 'Free Riding Stabil', cv: '+20', cdesc: 'Hegemoni AS Terjaga', isNash: false },
        ],
        rowLabels: ['PRO-ACTIVE MEDIATION (BEIJING)', 'PASSIVE (LET US BLEED)'], colLabels: ['PURSUE DIPLOMACY', 'SUPPORT KINETIC STRIKE'],
        nash: 'Nash Equilibrium (Pro-Active, Diplomacy) mentransformasi peran Beijing di Timur Tengah.',
        dominant: 'Strategi dominan China: Menjadi pejamin ("Security Guarantor") ekonomi de-facto timur tengah.'
    },
};

const WARGAME_SCENARIOS = [
    { name: 'Operasi "Clear Sky": USAF & IAF gempur instalasi SAM S-400', util1: 85, util2: 25, col1: '#ff3355', col2: '#00d4ff', l1: 'Efektivitas Koalisi', l2: 'Resiliensi Pertahanan' },
    { name: 'Skenario "True Promise II": Swarm 500+ Rudal Balistik ke Israel', util1: 45, util2: 60, col1: '#ff8c00', col2: '#b966ff', l1: 'Impact Kinetik Iran', l2: 'Intersepsi Arrow 3' },
    { name: 'De-eskalasi via Oman: Kesepakatan "Freeze for Freeze" 60 hari', util1: 75, util2: 55, col1: '#00e676', col2: '#00d4ff', l1: 'Penerimaan Iran', l2: 'Dukungan Kabinet IL' },
    { name: 'Red Sea Chokehold: Houthi hancurkan fasilitas desalinasi vital Saudi', util1: 30, util2: 90, col1: '#ffd700', col2: '#ff3355', l1: 'Gain Strategis Asimetris', l2: 'Resolusi Keras DK PBB' },
];

const NET_DIMS = ['Proyeksi Pertahanan Udara', 'Siber/EW (Electronic Warfare)', 'Ketahanan Finansial', 'Jaringan Proksi (Asimetris)', 'Kemampuan Produksi Rudal', 'Diplomatic Shielding (UNSC)'];
const NET_DATA = {
    iran: [45, 65, 30, 95, 88, 55],
    israel: [95, 90, 75, 40, 70, 85],
    us: [100, 98, 90, 50, 95, 90],
};

const CONE_MONTHS = ['K+30 Hari', 'K+60 Hari', 'K+120 Hari', 'K+180 Hari', 'K+365 Hari'];
const CONE_WORST = [
    'Operasi "True Promise II" skala besar; Pertahanan Arrow kelebihan persenjataan (over-saturation).',
    'Pengeboman IAF melumpuhkan infrastruktur pengayaan nuklir Natanz sepenuhnya.',
    'Hizbullah melepaskan artileri presisi jarak jauh Fateh-110 menargetkan infrastruktur sipil Tel Aviv.',
    'Blokade Maritim Hormuz. Kapal Induk USS Nimitz terlibat kontak senjata kinetik.',
    'Skenario S-12 memicu penetapan "Opsi Samson" (Nuklir Taktis) oleh Kabinet Keamanan Israel.',
];
const CONE_LIKELY = [
    'Pertukaran serangan siber mendegradasi layanan publik di Haifa dan Teheran secara diam-diam.',
    'Insiden maritim asimetris Houthi vs AS tetap terlokalisasi dalam batas konvensional Laut Merah.',
    'Pembicaraan "Back-Channel" di Muscat menghasilkan dokumen de-eskalasi tak tertulis.',
    'Peningkatan drastis OFAC Treasury AS ("Secondary Sanctions") pada tanker-tanker bayangan China.',
    'Status Quo Berdarah: Perang bayangan asimetris antar-badan intelijen terus merebak tanpa henti.',
];
const CONE_BEST = [
    'Intervensi cepat Utusan Khusus China memfasilitasi rekonsiliasi pragmatis Iran-Saudi-Emirat.',
    'IAEA mengembalikan kamera transmisi otomatis di semua fasilitas perakitan rotor IR-6 maju.',
    'Faksi politis sentris Iran sukses mendinginkan retorika sayap keras paramiliter dalam negeri.',
    'Perjanjian Gencatan Senjata permanen Gaza menghilangkan pretext moral pemicu proksi utara.',
    'Adopsi parsial formula stabilitas makroekonomi (pencabutan sebagian pemblokiran rekening).',
];
const CONE_MILESTONES = [
    { date: 'Batas Konfirmasi IAEA', text: 'Resolusi Dewan Pelaksana IAEA terkait Temuan Forensik Nuklir' },
    { date: 'Cetak Biru Red Line', text: 'Estimasi Mandiri (NIE) AS mengenai "Breakout Time" Senjata Iran' },
    { date: 'Laporan Rotasi Laut', text: 'Pergantian Posisi Battle Group Armada Kelima AS di Bahrain' },
    { date: 'Shock Indikator Pasar', text: 'Pemantauan Puncak Panik Algoritmik Minyak Mentah Kuartal III' },
    { date: 'Siklus Politik Kritis', text: 'Transisi Institusional Majlis Pemimpin Ahli (Assembly of Experts)' },
];

const SIGINT_SOURCES = [
    { name: 'X / @DeItaone', tier: 't1', strength: 99, topic: 'Breaking Markets & Geo', speciality: ['OSINT', 'COMINT'], freshMins: 1, anomaly: true },
    { name: 'Reuters', tier: 't1', strength: 88, topic: 'Diplomasi & Ekonomi', speciality: ['OSINT', 'COMINT'], freshMins: 3, anomaly: false },
    { name: 'Associated Press', tier: 't1', strength: 85, topic: 'Breaking News Militer', speciality: ['OSINT'], freshMins: 7, anomaly: false },
    { name: 'ISW (Institute for Study of War)', tier: 't1', strength: 92, topic: 'Battle Assessment', speciality: ['IMINT', 'OSINT'], freshMins: 45, anomaly: false },
    { name: 'IAEA Reports', tier: 't1', strength: 97, topic: 'Program Nuklir Iran', speciality: ['SIGINT', 'HUMINT'], freshMins: 120, anomaly: false },
    { name: 'Bellingcat OSINT', tier: 't1', strength: 83, topic: 'Verifikasi Visual & IMINT', speciality: ['IMINT', 'OSINT'], freshMins: 22, anomaly: false },
    { name: 'UN OCHA/News', tier: 't1', strength: 79, topic: 'Humanitarian & Diplomasi', speciality: ['OSINT'], freshMins: 60, anomaly: false },
    { name: 'ISS (Intl Institute Strategic Studies)', tier: 't2', strength: 74, topic: 'Net Assessment & Strategy', speciality: ['OSINT'], freshMins: 480, anomaly: false },
    { name: 'USNAVCENT / CentCom', tier: 't2', strength: 81, topic: 'Naval & Air Operations', speciality: ['SIGINT', 'COMINT'], freshMins: 35, anomaly: true },
];

const VERIFIED_NEWS = [
    { headline: 'BREAKING: Laporan intelijen mengindikasikan pergerakan aset strategis di dekat fasilitas nuklir Iran, sebut sumber anonim (via Terminal)', source: 'X / @DeItaone', link: 'https://x.com/DeItaone', impact: 'eskalasi', analysis: 'Sumber pasar finansial tercepat. Reaksi market instan. S4+5%, S9+6%.', time: 1, intel: 'OSINT', cred: 9 },
    { headline: 'Iran Konfirmasi Pengayaan Uranium 84% di Fordow — IAEA Minta Inspeksi Darurat', source: 'Reuters', link: 'https://www.reuters.com/world/middle-east/', impact: 'eskalasi', analysis: 'Hard threshold nuklir dilewati. S4+6%, S12+2%.', time: 5, intel: 'SIGINT', cred: 9 },
    { headline: 'USS Nimitz & Task Force 50 Bergerak ke Teluk Persia, Pentagon Konfirmasi', source: 'AP/USNAVCENT', link: 'https://www.centcom.mil/', impact: 'eskalasi', analysis: 'Pre-positioning naval force. S7+4%, S5+2%.', time: 14, intel: 'IMINT', cred: 9 },
    { headline: 'Drone Houthi Serang Tanker LNG Yunani, 23 Kru Dievakuasi', source: 'Reuters/Lloyd\'s', link: 'https://lloydslist.com/', impact: 'eskalasi', analysis: 'Supplai LNG terganggu. S8+4%, S9+3%.', time: 22, intel: 'OSINT', cred: 8 },
    { headline: 'Qatar Umumkan Hamas Setujui Kerangka Gencatan Senjata Fasa 2', source: 'Al Jazeera/AFP', link: 'https://www.aljazeera.com/', impact: 'deeskalasi', analysis: 'Momentum diplomatik positif. S2+7%, S1+3%.', time: 31, intel: 'HUMINT', cred: 8 },
    { headline: 'Menlu Wang Yi Kunjungi Teheran, Tawarkan Paket Mediasi Komprehensif China', source: 'Reuters/Xinhua', link: 'https://english.news.cn/', impact: 'deeskalasi', analysis: 'Engagement China. S3+5%, tekanan diplomatik naik.', time: 47, intel: 'OSINT', cred: 7 },
    { headline: 'Harga Brent Naik 4.2% ke USD 98.7/Barel Pasca Laporan IAEA', source: 'Bloomberg', link: 'https://www.bloomberg.com/markets/commodities', impact: 'eskalasi', analysis: 'Market pricing risiko supply. S9+4%.', time: 18, intel: 'OSINT', cred: 9 },
    { headline: 'IDF Konfirmasi Sortie F-35 Meningkat 37%, Latihan Strike Jarak Jauh', source: 'ISW/Times of Israel', link: 'https://www.understandingwar.org/', impact: 'eskalasi', analysis: 'Persiapan operasional terindikasi. S4+3%.', time: 38, intel: 'IMINT', cred: 7 },
    { headline: 'UNIFIL: Joint Patrol Cegah 3 Insiden di Blue Line Lebanon-Israel', source: 'UN News', link: 'https://news.un.org/', impact: 'deeskalasi', analysis: 'Mekanisme gencatan efektif. S1+3%, S6-2%.', time: 55, intel: 'OSINT', cred: 8 },
];

const PROPAGANDA_NEWS = [
    { headline: 'IRGC: Satuan Pertahanan Udara Lokal Kami Mampu Menjatuhkan B-2 Spirit AS Kapanpun', source: 'IRNA (State Media)', link: 'https://en.irna.ir/', flag: 'STATE MEDIA AMPLIFICATION', analysis: 'Pernyataan deterrence hiperbolis dari media pemerintah Iran. B-2 Spirit beroperasi pada ketinggian dan penampang radar (RCS) yang tak kasat mata bagi sistem S-300 PMU-2 Iran saat ini.', cred: 2 },
    { headline: 'Saluran Berita Israel Meragukan Kesetiaan Menteri Pertahanan pada Saat Kritis', source: 'Channel 14 (Israel)', link: '#', flag: 'DOMESTIC PARTISAN NARRATIVE', analysis: 'Politisasi masa krisis di dalam negeri Israel. Mengikis sentralisasi komando darurat (War Cabinet) tapi belum mencerminkan disintegrasi operasional komando militer (IDF).', cred: 4 },
    { headline: 'Telegram: Peringatan Merah! Jenderal Qaani Berikan Kode Angka Biner untuk Penyekatan Selat', source: 'Telegram Channel (Anon)', link: '#', flag: 'PSYOPS NARRATIVE', analysis: 'Pola khas kampanye disinformasi "White Noise". Dirancang untuk memicu aksi jual panik pada bursa komoditas energi regional.', cred: 1 },
    { headline: 'Dokumenter Konspirasi: Pangkalan Udara Al-Udeid AS Telah Diam-diam Dikuasai Milisi Irak', source: 'Press TV (Iran State)', link: 'https://www.presstv.ir/', flag: 'ATROCITY FABRICATION', analysis: 'Narasi berlawanan dengan konfirmasi citra satelit (IMINT) 24 jam terakhir yang menunjukkan aktivitas USAF normatif di Qatar.', cred: 1 },
    { headline: 'Kabar Angin Intelijen: Khamenei Kritis Dirawat di ICU Rahasia Bunker Tabriz', source: 'OSINT Spekulatif/X', link: 'https://x.com/', flag: 'SINGLE SOURCE / UNVERIFIED', analysis: 'Repetisi rumor bulanan. Tidak ada anomali rotasi Paspampres IRGC Ansar al-Mahdi yang terdeteksi via sistem pelacakan sinyal.', cred: 3 },
];

const UNVERIFIED_NEWS = [
    { headline: 'Bocoran: Dokumen PDF markas Mossad menunjukkan 7 fasilitas nuklir Iran telah dimarkir dengan cat isotop luminesen untuk targeting laser darat', label: 'BOCORAN', impact: 'Jika valid: Degradasi instan payung pertahanan kamuflase Iran (S4: +12%)' },
    { headline: 'Sinyal HF (High-Frequency) Terintersep: Komandan Armada ke-5 AS meminta kode peluncuran pencegat SM-3', label: 'RUMOR', impact: 'Jika valid: Antisipasi serangan rudal balistik atmosfer luar yang iminen (S5: +15%)' },
    { headline: 'Intelijen Mata-mata: 500 unit rudal anti-kapal Yakhont (P-800 Oniks) telah diseberangkan Hezbollah ke selatan sungai Litani melalui terowongan Suriah', label: 'SINGLE SOURCE', impact: 'Jika valid: Ancaman asimetris total pada blockade pesisir Laut Tengah (S6: +8%)' },
    { headline: 'Diplomat Kedutaan Swiss (Intermediari AS) terlihat meninggalkan Kementerian Luar Negeri Teheran dengan kawalan IRGC ketat', label: 'UNCONFIRMED', impact: 'Jika valid: Negosiasi back-channel aktif menunda fase kinetik 48 jam ke depan (S1: +10%)' },
];

const ANALYST_SUMMARIES = [
    'BLUF (Bottom Line Up Front): I&W tingkat Krisis CR-007 (pemutusan kamera IAEA) digabungkan dengan manuver armada kapal induk ganda (USS Nimitz & Dwight D. Eisenhower) menyempitkan ruang perhitungan damai. Analisis Hypothesis (ACH) merekomendasikan transisi mendesak ke H4 (Breakout) atau H5 (Eskalasi Multi-Front) akibat reduksitonalitas opsi non-kinetik. Confidence: HIGH.',
    'RED TEAM ASSESSMENT: Keseimbangan "Strategic Patience" (Patience vs Defensive) baru saja dilanggar. Israel melihat "Window of Opportunity" mereka tertutup dengan penggalian 80 meter di fasilitas Natanz. Nash Equilibrium tak lagi merujuk pada de-eskalasi; pergeseran nilai taktis Payoff Matrix mewajibkan Israel melempar manuver Pre-Emptive, terlepas dari kebersediaan Washington memberikan dukungan langsung.',
    'FUSION NET ASSESSMENT: Meskipun AS dan Israel memegang keunggulan superioritas kualitatif mutlak pada dimensi Udara, Siber (95+), dan Kinetik, Teheran telah sepenuhnya menetralisasi disadvantage tersebut melalui arsitektur Asimetris Proksi (skor 95). Ketiadaan aset berharga statis yang dapat dihancurkan AS di Yaman menjadikan blokade logistik Houthi secara strategis hampir mustahil dianulir lewat pengeboman klasik udara.',
    'PLAUSIBILITY PATHING: Proyeksi horizon 30 hingga 60 hari menyempit tajam menuju perpaduan konflik gesekan (Attritional Warfare). Kondisi ideal (Mediasi Penuh) diblokir oleh kelumpuhan arsitektur diplomasi DK PBB. Titik tumpu rasional bergeser pada "Status Quo Berdarah" — sebuah ekuilibrium bayangan di mana serangan siber dan saling sabotase infrastruktur dikalibrasi harian demi mencegah aktivasi perang termonuklir terbuka.',
];

const LIVE_PROPAGANDA_POOL = [
    { headline: 'FLASH: Komando Pusat IRGC rilis video animasi CGI "Kehancuran Tel Aviv", klaim sistem Arrow Israel terbukti 100% ditembus misil hipersonik buatan lokal.', source: 'Mizan News Agency', link: 'https://www.mizan.news/', flag: 'FABRIKASI', analysis: 'Operasi Psikologis (Psyops) klasik fase krisis. Menyasar disonansi kognitif populasi sipil musuh dan menaikkan moral paramiliter domestik pasca kekalahan proksi.', time: 0, cred: 1 },
    { headline: 'URGENT: Analis geopolitik sayap kanan Israel klaim Iran menyembunyikan "10 hulu ledak nuklir jadi" di bawah pusat perbelanjaan elit di Teheran utara.', source: 'Komentator Ekstrem / Podcast', link: '#', flag: 'DISINFORMASI POLARISASI', analysis: 'Pernyataan hiperbolik tanpa landasan verifikasi nuklir IAEA. Pola umum "Atrocity Fabrication" untuk melegitimasi opsi pengeboman urban berkorbanan tinggi.', time: 0, cred: 2 },
    { headline: 'TELEGRAM: Seluruh pejabat tinggi Kerajaan Arab Saudi dan Uni Emirat Arab dipastikan melarikan diri ke Eropa menyusul ancaman balasan laut proksi Houthi-Iran.', source: 'Bot Amplifikasi Anonim', link: '#', flag: 'KAMPANYE KETAKUTAN BOT', analysis: 'Amplifikasi disinformasi struktural. Citra termal penerbangan Jet VIP kerajaan sama sekali tidak menunjukkan lonjakan eksodus anomali dari bandara Riyadh/Abu Dhabi.', time: 0, cred: 1 }
];

const LIVE_UNVERIFIED_POOL = [
    { headline: 'SADAPAN V/UHF: Dua jet tempur tak dikenal dikalim mematikan transponder IFF tepat di atas perbatasan udara Irak-Suriah 4 menit yang lalu.', source: 'Amatir Radio Intersep (OSINT)', label: 'INTEL RAW / KOTOR', impact: 'Bila valid: Indikasi penetrasi ruang udara siluman (F-35I) sedang menginisiasi "Dry-Run" menuju fasilitas sentrifugal wilayah nuklir timur Iran.', time: 0 },
    { headline: 'RUMOR DARK WEB: Kelompok peretas "Anonymous" menjual akses backdoor sistem kendali kelistrikan stasiun pendingin reaktor Natanz senilai 500 Bitcoin.', label: 'RUMOR SIBER', impact: 'Bila valid: Eksekusi versi digital "Stuxnet 2.0" dapat melumpuhkan pengayaan uranium sebelum fasa bom fisik dirakit, mencegah serangan jet tempur mematikan Israel.', time: 0 },
    { headline: 'BOCORAN INTELIJEN: Transkrip satelit menangkap perdebatan sengit antara PM Benjamin Netanyahu dan Pimpinan CENTCOM AS mengenai otorisasi target.', label: 'GOSIP ELIT MATA-MATA', impact: 'Bila valid: Perpecahan serius dalam keharmonisan poros Barat. AS dinilai mencegah "Total Escalation" yang akan menenggelamkan hegemoni politik Washington di kawasan.', time: 0 }
];

const LIVE_NEWS_POOL = [
    { headline: 'URGENT: Citra radar SAR terbaru menunjukkan peningkatan aktivitas perpindahan TEL balistik di Tabriz, secara langsung mengancam aset tempur AS & sekutu di regional.', source: 'Bellingcat OSINT', link: 'https://www.bellingcat.com/', impact: 'eskalasi', analysis: 'Indikator peringatan dini (I&W) krusial terhadap postur pertahanan AS/Israel. S5+8%.', time: 0, intel: 'IMINT', cred: 8 },
    { headline: 'BREAKING: Laporan siber mengidentifikasi anomali BGP di Tel Aviv. Operasi siber disruptif skala besar dicurigai dilakukan kelompok APT proxy Iran.', source: 'Reuters', link: 'https://www.reuters.com/world/middle-east/', impact: 'eskalasi', analysis: 'Dimensi asimetris Iran merespons tekanan militer konvensional Israel. S4+3%.', time: 0, intel: 'SIGINT', cred: 9 },
    { headline: 'JUST IN: Kemenlu Qatar mengonfirmasi "kemajuan substansial" pembicaraan back-channel AS-Iran di Doha guna menghindari konfrontasi proksi terbuka.', source: 'Al Jazeera', link: 'https://www.aljazeera.com/', impact: 'deeskalasi', analysis: 'Diplomatic capital terungkit menekan rem darurat eskalasi Israel-Hezbollah. S2+12%.', time: 0, intel: 'HUMINT', cred: 8 },
    { headline: 'FLASH: Harga ICE Brent melonjak lewati USD 105/barel, merespons retorika petinggi IRGC untuk memblokade Selat Hormuz merespons ancaman strike fasilitas nuklir.', source: 'Bloomberg', link: 'https://www.bloomberg.com/markets/commodities', impact: 'eskalasi', analysis: 'Panic buying atas risiko suplai energi global akibat gesekan Iran-AS-Israel. S9+5%.', time: 0, intel: 'OSINT', cred: 9 },
    { headline: 'UPDATE: Juru bicara IDF tolak mengomentari "operasi luar wilayah" menyusul ledakan misterius di fasilitas drone militer di Isfahan.', source: 'AP News', link: 'https://apnews.com/', impact: 'eskalasi', analysis: 'Pola operasi covert strike Israel klasik memangkas kapabilitas suplai drone ke proksi. S4+6%.', time: 0, intel: 'OSINT', cred: 9 },
    { headline: 'WATCH: Pentagon konfirmasi USS Nimitz & Task Force 50 memutar arah transisi merapat ke area tanggung jawab ARMADA KE-5 pasca provokasi FAC laut IRGC.', source: 'USNAVCENT / CentCom', link: 'https://www.centcom.mil/', impact: 'eskalasi', analysis: 'Proyeksi hard-power AS bersiap mengamankan choke point perdagangan navigasi internasional.', time: 0, intel: 'IMINT', cred: 9 },
    { headline: 'ANALYSIS: Laporan intelijen satelit mengkonfirmasi penarikan mundur skuadron rudal taktis Hezbollah 15km ke utara garis perbatasan Litani malam ini.', source: 'ISW (Institute for Study of War)', link: 'https://www.understandingwar.org/', impact: 'deeskalasi', analysis: 'Manuver mengulur waktu pihak proksi Iran merespons ancaman pre-emptive pengeboman utara oleh IDF.', time: 0, intel: 'IMINT', cred: 8 },
    { headline: 'DIPLOMACY: Resolusi darurat sidang DK PBB menyepakati seruan menahan diri level tertinggi; utusan AS setuju fasilitasi perundingan batas laut tak-langsung.', source: 'UN News', link: 'https://news.un.org/', impact: 'deeskalasi', analysis: 'Sikap AS menjaga stabilator konflik multi-front, mendorong Israel ke meja kalkulasi ulang.', time: 0, intel: 'OSINT', cred: 9 }
];

const KEY_ASSUMPTIONS = [
    {
        id: 'KA1',
        text: 'Iran tidak akan menyerang aset AS secara langsung',
        active: true,
        ifFalse: {
            S5: +18, S7: +22, S4: +8, S8: +12,
            S1: -15, S2: -20, S3: -10
        }
    },
    {
        id: 'KA2',
        text: 'Israel tidak akan bertindak tanpa koordinasi awal dengan Washington',
        active: true,
        ifFalse: {
            S4: +25, S6: +15, S12: +6,
            S1: -18, S2: -22, S3: -15
        }
    },
    {
        id: 'KA3',
        text: 'China akan mempertahankan postur mediator ekonomi, bukan aktor militer',
        active: true,
        ifFalse: {
            S3: +20, S10: -15,
            S4: -8, S5: -5
        }
    },
    {
        id: 'KA4',
        text: 'Hezbollah tidak akan membuka front penuh tanpa perintah langsung Teheran',
        active: true,
        ifFalse: {
            S6: +28, S5: +12, S8: +10,
            S1: -25, S4: +5
        }
    },
    {
        id: 'KA5',
        text: 'Rezim Iran memprioritaskan survival ekonomi di atas eskalasi militer',
        active: true,
        ifFalse: {
            S4: +15, S5: +20, S8: +18, S6: +10,
            S2: -20, S9: +12, S12: +5
        }
    },
];

const SNAPSHOT_HISTORY = []; // max 5 snapshots
const MAX_SNAPSHOTS = 5;

const INTEL_GAPS = [
    {
        id: 'IG-01',
        question: 'Apakah IRGC telah menerima perintah operasional dari Khamenei?',
        priority: 'KRITIS',
        status: 'OPEN', // OPEN | PARTIAL | CLOSED
        relatedScenarios: ['S4', 'S5', 'S12'],
        closedBoost: { S4: -4, S5: -4, S12: -3 }, // negative = reduces probability if confirmed negative
        collection: 'SIGINT / HUMINT Teheran'
    },
    {
        id: 'IG-02',
        question: 'Posisi dan kesiapan tempur armada AS di Teluk Persia 48 jam ke depan?',
        priority: 'TINGGI',
        status: 'OPEN',
        relatedScenarios: ['S5', 'S7'],
        closedBoost: { S5: +3, S7: +2 },
        collection: 'IMINT / MASINT Teluk'
    },
    {
        id: 'IG-03',
        question: 'Apakah saluran back-channel Qatar masih aktif pasca-insiden terakhir?',
        priority: 'TINGGI',
        status: 'OPEN',
        relatedScenarios: ['S1', 'S2', 'S10'],
        closedBoost: { S1: +5, S2: +4, S10: +2 },
        collection: 'DIPTEL / HUMINT Doha'
    },
    {
        id: 'IG-04',
        question: 'Status pengayaan uranium di Fordow — apakah melebihi 84%?',
        priority: 'KRITIS',
        status: 'PARTIAL',
        relatedScenarios: ['S3', 'S11', 'S12'],
        closedBoost: { S3: +6, S12: +8, S11: +4 },
        collection: 'IAEA Inspection / OSINT'
    },
    {
        id: 'IG-05',
        question: 'Apakah Hezbollah telah mengaktifkan sel tidur di luar Lebanon?',
        priority: 'KRITIS',
        status: 'OPEN',
        relatedScenarios: ['S6'],
        closedBoost: { S6: +10 },
        collection: 'HUMINT / FININT regional'
    },
    {
        id: 'IG-06',
        question: 'Volume transfer senjata Iran ke proksi dalam 30 hari terakhir?',
        priority: 'TINGGI',
        status: 'OPEN',
        relatedScenarios: ['S6', 'S7', 'S4'],
        closedBoost: { S6: +5, S7: +3, S4: +3 },
        collection: 'IMINT / OSINT pelabuhan'
    },
    {
        id: 'IG-07',
        question: 'Apakah China telah memberi sinyal kepada Teheran untuk menahan diri?',
        priority: 'SEDANG',
        status: 'OPEN',
        relatedScenarios: ['S3', 'S1', 'S2'],
        closedBoost: { S3: -5, S1: +4, S2: +3 },
        collection: 'DIPTEL Beijing / SIGINT'
    },
];
