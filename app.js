// ===== INTEL DASHBOARD v3.0 — DATA =====

const SCENARIOS = [
    { id: 'S1', group: 'diplomasi', barClass: 'bar-diplomatik', name: 'Gencatan Senjata Israel–Hizbullah Bertahan', baseline: 38, current: 38, tags: ['de-eskalasi', 'netral'], confBase: 'med', challenge: 'Gencatan senjata rapuh. Faksi radikal di kedua pihak mungkin secara independen memicu provokasi yang memaksa sentral komando untuk bereaksi.' },
    { id: 'S2', group: 'diplomasi', barClass: 'bar-diplomatik', name: 'Mediasi Qatar/Mesir Menghasilkan Perjanjian Gaza', baseline: 22, current: 22, tags: ['de-eskalasi'], confBase: 'low', challenge: 'Hamas mungkin menolak term yang tidak mencakup penarikan IDF total, dan Israel tidak akan menerima klausa yang mempertahankan Hamas sebagai governing entitas.' },
    { id: 'S3', group: 'diplomasi', barClass: 'bar-diplomatik', name: 'China-Rusia Mediasi Ketegangan Iran-AS', baseline: 15, current: 15, tags: ['netral'], confBase: 'low', challenge: 'Otoritas China di region bersifat transaksional (ekonomi), bukan security guarantor. AS mungkin secara aktif menggagalkan hegemoni mediasi ini.' },
    { id: 'S4', group: 'militer', barClass: 'bar-militer', name: 'Serangan Udara Israel ke Fasilitas Nuklir Iran', baseline: 28, current: 28, tags: ['eskalasi', 'tinggi'], confBase: 'med', challenge: 'Risiko operasional terlalu tinggi tanpa dukungan logistik AS. Fasilitas seperti Fordow kebal terhadap bunker buster konvensional.' },
    { id: 'S5', group: 'militer', barClass: 'bar-militer', name: 'Pembalasan Rudal Iran ke Pangkalan AS Irak/Suriah', baseline: 35, current: 35, tags: ['eskalasi'], confBase: 'high', challenge: 'Iran menyadari red-line AS. Menyerang personel Amerika secara langsung akan memicu intervensi militer konvensional yang selama ini dihindari Iran.' },
    { id: 'S6', group: 'militer', barClass: 'bar-militer', name: 'Eskalasi Frontal: Hezbollah Reaktivasi Penuh', baseline: 20, current: 20, tags: ['eskalasi', 'tinggi'], confBase: 'med', challenge: 'Lebanon sedang krisis ekonomi destruktif. Perang frontal penuh akan menghancurkan basis dukungan domestik Hezbollah sepenuhnya.' },
    { id: 'S7', group: 'militer', barClass: 'bar-militer', name: 'Operasi AS Langsung vs Proksi Iran di Yaman', baseline: 42, current: 42, tags: ['eskalasi'], confBase: 'high', challenge: 'Strike udara AS ke Houthi gagal menciptakan deterrence strategis selama ini. Hanya membuang amunisi mahal tanpa mengubah supply lines asimetris Houthi.' },
    { id: 'S8', group: 'ekonomi', barClass: 'bar-ekonomi', name: 'Blokade Selat Hormuz (Parsial ≥14 hari)', baseline: 18, current: 18, tags: ['eskalasi', 'tinggi'], confBase: 'med', challenge: 'Lebih dari 80% minyak yang melewati Hormuz menuju Asia (China/India). Menutup selat akan langsung mengasingkan sekutu ekonomi terbesar Iran.' },
    { id: 'S9', group: 'ekonomi', barClass: 'bar-ekonomi', name: 'Harga Minyak Tembus USD 120/barel', baseline: 32, current: 32, tags: ['eskalasi'], confBase: 'high', challenge: 'Kapasitas cadangan (spare capacity) OPEC+ (terutama Saudi & UAE) masih cukup besar untuk menutupi shock jangka pendek dan mencegah demand destruction.' },
    { id: 'S10', group: 'ekonomi', barClass: 'bar-ekonomi', name: 'Sanksi Baru AS: Embargo Energi Iran Diperketat', baseline: 55, current: 55, tags: ['eskalasi', 'netral'], confBase: 'high', challenge: 'Sanksi sudah maksimal (kampanye "Maximum Pressure"). Entitas penyelundup minyak Iran telah memiliki infrastruktur dark-fleet independen ke China.' },
    { id: 'S11', group: 'ekstrem', barClass: 'bar-ekstrem', name: 'Suksesi Kekuasaan Iran: Khamenei Tidak Aktif', baseline: 12, current: 12, tags: ['tinggi'], confBase: 'spec', challenge: 'IRGC memiliki struktur komando yang sangat terlembaga. Transisi kekuasaan ke Pemimpin Tertinggi baru kemungkinan berjalan sangat dikontrol tanpa kevakuman.' },
    { id: 'S12', group: 'ekstrem', barClass: 'bar-ekstrem', name: 'Konflik Nuklir Terbatas (Threshold crossed)', baseline: 4, current: 4, tags: ['eskalasi', 'tinggi'], confBase: 'spec', challenge: 'Pembuatan senjata fisis memakan waktu hitungan bulan paska breakout time. Terlalu mudah terdeteksi oleh intelijen Barat/Israel untuk menjadi kejutan strategis.' },
];

const ESCALATION_CHRONOLOGY = [
    { time: '12 MAR 2026', title: 'Iran Enrichment Tembus 84%', impact: 'CRITICAL', causality: 'Pemicu Awal: Laporan rahasia IAEA bocor ke media menunjukkan partikel uranium di Fordow mencapai level weapons-grade (84%), mendekati 90% threshold. Memaksa revisi mendadak postur kesiapan Israel.' },
    { time: '14 MAR 2026', title: 'IDF Mengerahkan Sortie F-35 Ekstra (+37%)', impact: 'ESKALASI', causality: 'Reaksi Langsung atas Enrichment: Israel meningkatkan patroli udara dan simulasi strike jarak jauh sebagai deterrence kredibel terhadap fasilitas Teheran.' },
    { time: '18 MAR 2026', title: 'Pemindahan Aset Rudal Hizbullah', impact: 'WATCH', causality: 'Antisipasi Pre-emptive Israel: IRGC menginstruksikan proksinya di Lebanon selatan untuk menyiagakan roket presisi tinggi agar tidak hancur saat digempur Israel.' },
    { time: '20 MAR 2026', title: 'AS Kirim USS Nimitz via Bab el-Mandeb', impact: 'DETERRENCE', causality: 'Penyeimbang Regional: Pentagon menggeser Carrier Battle Group dari Mediterania ke Laut Arab setelah intercept komunikasi sandi merah komando maritim Iran.' },
    { time: '23 MAR 2026', title: 'Houthi Targetkan Tanker (Bendera Panama)', impact: 'ESKALASI', causality: 'Pesan Asimetris Iran: Daripada menghadapi USS Nimitz langsung, jaringan proksi Teheran (Houthi) memblokade chokepoint logistik sekutu Barat.' },
    { time: '28 MAR 2026', title: 'Diplomasi Darurat Wang Yi di Teheran', impact: 'DE-ESKALASI', causality: 'Kepentingan Ekonomi Terancam: Harga asuransi kargo ke Asia melonjak akibat insiden Red Sea, memaksa China secara pasif-agresif menekan Iran menahan proksinya.' }
];

const IW_INDICATORS = [
    { cat: 'MILITER', cr: 'CR-001', name: 'Mobilisasi IRGC Skala Besar', threshold: '> 3 Divisi aktif', reading: '2 Divisi siaga', status: 'watch', trend: 'up' },
    { cat: 'MILITER', cr: 'CR-002', name: 'Aktivasi Sistem Rudal Balistik Iran', threshold: 'Radar lock on Israel/AS bases', reading: 'Latihan rutin R-17', status: 'watch', trend: 'flat' },
    { cat: 'MILITER', cr: 'CR-003', name: 'Sortie IDF F-35 Meningkat >40%', threshold: '> 40% dari baseline', reading: '+37% (3-hari)', status: 'watch', trend: 'up' },
    { cat: 'MILITER', cr: 'CR-004', name: 'Hezbollah Pindahkan Roket ke Depan', threshold: 'Unit > 5km dari Blue Line', reading: 'Konfirmasi 2 unit', status: 'triggered', trend: 'up' },
    { cat: 'MILITER', cr: 'CR-005', name: 'Pengerahan Carrier Battle Group AS', threshold: '≥ 2 CBG di Teluk Persia', reading: '1 CBG aktif (USS Nimitz)', status: 'watch', trend: 'up' },
    { cat: 'DIPLOMATIK', cr: 'CR-006', name: 'Penarikan Duta Besar Iran dari Eropa', threshold: '≥ 3 negara', reading: '0 penarikan', status: 'clear', trend: 'flat' },
    { cat: 'DIPLOMATIK', cr: 'CR-007', name: 'Kegagalan Negosiasi JCPOA Baru', threshold: 'IAEA laporan non-compliance', reading: 'IAEA: enrichment 84%', status: 'triggered', trend: 'up' },
    { cat: 'DIPLOMATIK', cr: 'CR-008', name: 'Isolasi Diplomatik Iran di UNSC', threshold: 'Veto China/Rusia gagal', reading: 'China blocking aktif', status: 'clear', trend: 'flat' },
    { cat: 'EKONOMI', cr: 'CR-009', name: 'Harga Minyak > USD 100/barel', threshold: 'Brent Crude > $100', reading: '$98.7/barel (+4.2%)', status: 'watch', trend: 'up' },
    { cat: 'EKONOMI', cr: 'CR-010', name: 'Asuransi Maritim Hormuz Naik >200%', threshold: 'Premium > 3x normal', reading: 'Premium +180%', status: 'watch', trend: 'up' },
    { cat: 'EKONOMI', cr: 'CR-011', name: 'Rial Iran Anjlok >15% dalam 30 hari', threshold: '> 15% depreciation', reading: '-9% (30 hari)', status: 'watch', trend: 'up' },
    { cat: 'EKONOMI', cr: 'CR-012', name: 'Tanker Berhenti Transit Hormuz', threshold: '> 30% volume harian', reading: '-8% volume normal', status: 'clear', trend: 'up' },
    { cat: 'INTELIJEN', cr: 'CR-013', name: 'Komunikasi IRGC Terenkripsi Meningkat', threshold: 'Spike >300% SIGINT', reading: '+240% baseline', status: 'watch', trend: 'up' },
    { cat: 'INTELIJEN', cr: 'CR-014', name: 'Pergerakan Malam Konvoi Hezbollah', threshold: '> 5 konvoi/malam', reading: '3 konvoi /malam', status: 'watch', trend: 'up' },
    { cat: 'INTELIJEN', cr: 'CR-015', name: 'Pengaktifan Proksi Yaman Skala Penuh', threshold: '> 12 serangan/minggu', reading: '9 serangan/minggu', status: 'watch', trend: 'up' },
    { cat: 'INTELIJEN', cr: 'CR-016', name: 'Bunker VIP IRGC Diaktifkan', threshold: 'Konfirmasi IMINT', reading: 'UNCONFIRMED signal', status: 'unknown', trend: 'flat' },
];

const ACH_HYPOTHESES = [
    { id: 'H1', name: 'Iran Cari Window Diplomatik', short: 'DIPLOMASI' },
    { id: 'H2', name: 'Israel Siapkan Serangan Preventif', short: 'STRIKE' },
    { id: 'H3', name: 'Deterrence Stabil / Status Quo', short: 'STATUS QUO' },
    { id: 'H4', name: 'Proksi War Terbatas Berlanjut', short: 'PROKSI' },
    { id: 'H5', name: 'Eskalasi Tidak Terkontrol', short: 'ESKALASI' },
    { id: 'H6', name: 'Mediasi China Berhasil', short: 'MEDIASI' },
];
const ACH_EVIDENCE = [
    { ev: 'Iran enrichment 84% di Fordow', cells: ['I', 'C', 'N', 'N', 'C', 'I'] },
    { ev: 'Hezbollah pindah roket ke depan', cells: ['N', 'C', 'I', 'C', 'C', 'I'] },
    { ev: 'Kapal AS Task Force 50 di Teluk', cells: ['C', 'C', 'I', 'N', 'C', 'I'] },
    { ev: 'Wang Yi kunjungi Teheran', cells: ['C', 'N', 'N', 'N', 'N', 'C'] },
    { ev: 'IDF sortie meningkat 37%', cells: ['N', 'D', 'I', 'N', 'C', 'N'] },
    { ev: 'Qatar mediasi Hamas Fasa 2', cells: ['C', 'N', 'C', 'N', 'N', 'D'] },
    { ev: 'IRGC komunikasi terenkripsi +240%', cells: ['N', 'D', 'I', 'C', 'C', 'N'] },
    { ev: 'Rial Iran -9% / 30 hari', cells: ['C', 'N', 'N', 'I', 'C', 'N'] },
    { ev: 'Hezbollah menolak perluas serangan', cells: ['C', 'N', 'C', 'C', 'I', 'C'] },
    { ev: 'AS perketat embargo energi', cells: ['N', 'N', 'N', 'N', 'C', 'I'] },
    { ev: 'IAEA minta inspeksi darurat', cells: ['I', 'C', 'N', 'N', 'C', 'I'] },
    { ev: 'Back-channel Iran-AS via Swiss', cells: ['D', 'N', 'C', 'N', 'N', 'C'] },
];

const PAYOFF_DATA = {
    iran: {
        title: 'IRAN vs ISRAEL', rowActor: 'IRAN', colActor: 'ISRAEL',
        cells: [
            { rv: '+4', rdesc: 'Tekanan Max', cv: '-5', cdesc: 'Kerugian Besar', isNash: false },
            { rv: '-3', rdesc: 'Gagal Deterrence', cv: '+3', cdesc: 'Gain Strategis', isNash: false },
            { rv: '+2', rdesc: 'Status Quo', cv: '+2', cdesc: 'Status Quo', isNash: true },
            { rv: '-2', rdesc: 'Isolasi', cv: '+1', cdesc: 'Aman', isNash: false },
        ],
        rowLabels: ['ESKALASI', 'DE-ESKALASI'], colLabels: ['ESKALASI', 'DE-ESKALASI'],
        nash: 'Nash Equilibrium: (De-eskalasi, De-eskalasi) — kedua pihak rugi dari eskalasi sepihak.',
        dominant: 'Strategi dominan Iran: DE-ESKALASI jika AS tidak campur tangan langsung.'
    },
    israel: {
        title: 'ISRAEL vs IRAN', rowActor: 'ISRAEL', colActor: 'IRAN',
        cells: [
            { rv: '+5', rdesc: 'Hancurkan Nuklir', cv: '-4', cdesc: 'Kehilangan Kapabilitas', isNash: false },
            { rv: '-2', rdesc: 'Terekspos', cv: '+3', cdesc: 'Legitimasi Meningkat', isNash: false },
            { rv: '+3', rdesc: 'Aman + Deterred', cv: '+2', cdesc: 'Program Berlanjut', isNash: true },
            { rv: '-1', rdesc: 'Window Tertutup', cv: '+4', cdesc: 'Nuclear Advance', isNash: false },
        ],
        rowLabels: ['SERANG', 'TAHAN'], colLabels: ['LANJUT NUKLIR', 'HENTIKAN NUKLIR'],
        nash: 'Nash Equilibrium: (Tahan, Hentikan Nuklir) — strike optimal hanya jika Iran melewati threshold.',
        dominant: 'Strategi dominan Israel: STRIKE jika enrichment melewati 90%. Tahan = status quo optimal.'
    },
    us: {
        title: 'AS vs IRAN (Proksi)', rowActor: 'AS', colActor: 'IRAN',
        cells: [
            { rv: '+3', rdesc: 'Dominasi Regional', cv: '-4', cdesc: 'Proksi Hancur', isNash: false },
            { rv: '+1', rdesc: 'Credibility Naik', cv: '+3', cdesc: 'Proksi Berlanjut', isNash: true },
            { rv: '-2', rdesc: 'Deterrence Turun', cv: '+5', cdesc: 'Ekspansi Pengaruh', isNash: false },
            { rv: '+2', rdesc: 'Stabilitas', cv: '+2', cdesc: 'Stabilitas', isNash: false },
        ],
        rowLabels: ['INTERVENSI MILITER', 'DE-ESKALASI'], colLabels: ['ESKALASI PROKSI', 'TAHAN PROKSI'],
        nash: 'Nash Equilibrium: (De-eskalasi AS, Eskalasi Proksi) — Iran manfaatkan reluctance AS untuk intervensi langsung.',
        dominant: 'Strategi dominan AS: De-eskalasi + tekanan sanctions. Intervensi langsung terlalu costly.'
    },
    china: {
        title: 'CHINA (Mediator)', rowActor: 'CHINA', colActor: 'IRAN-ISRAEL KONFLIK',
        cells: [
            { rv: '+5', rdesc: 'Influence Max', cv: '+3', cdesc: 'Penyelesaian', isNash: true },
            { rv: '+3', rdesc: 'Kredibilitas', cv: '-2', cdesc: 'Konflik Berlanjut', isNash: false },
            { rv: '-1', rdesc: 'Marginal', cv: '+4', cdesc: 'AS Dominan', isNash: false },
            { rv: '+2', rdesc: 'Ekonomi Aman', cv: '+1', cdesc: 'Status Quo', isNash: false },
        ],
        rowLabels: ['MEDIASI AKTIF', 'PASIF / ABSTAIN'], colLabels: ['DAMAI', 'KONFLIK'],
        nash: 'Nash Equilibrium: (Mediasi Aktif, Damai) — China gain maksimum melalui peran mediator aktif.',
        dominant: 'Strategi dominan China: MEDIASI AKTIF — mengurangi pengaruh AS, membangun prestige diplomatik global.'
    },
};

const WARGAME_SCENARIOS = [
    { name: 'Serangan Presisi Malam: IDF serang fasilitas Fordow & Natanz', util1: 72, util2: 48, col1: '#ff3355', col2: '#00d4ff', l1: 'Israel', l2: 'Iran-Response' },
    { name: 'Balasan Simetris: Iran tembak rudal ke basis AS Irak', util1: 55, util2: 61, col1: '#ff8c00', col2: '#b966ff', l1: 'Iran', l2: 'US-Retaliation' },
    { name: 'Diplomasi Darurat: Swiss mediasi ceasefire 48 jam', util1: 68, util2: 73, col1: '#00e676', col2: '#00d4ff', l1: 'Probab. Berhasil', l2: 'Probab. Gagal' },
    { name: 'Blokade Hormuz Parsial: Iran batasi tonase tanker', util1: 45, util2: 82, col1: '#ffd700', col2: '#ff3355', l1: 'Short-term Iran Gain', l2: 'Global Response Cost' },
];

const NET_DIMS = ['Kekuatan Militer', 'Kapabilitas Siber', 'Ekonomi & Sanksi', 'Proxy Networks', 'Diplomatic Capital', 'Nuklir Deterrence'];
const NET_DATA = {
    iran: [62, 55, 38, 85, 42, 70],
    israel: [78, 82, 65, 45, 58, 85],
    us: [98, 92, 88, 55, 78, 98],
};

const CONE_MONTHS = ['Mar 2026', 'Mei 2026', 'Jul 2026', 'Sep 2026', 'Des 2026'];
const CONE_WORST = [
    'Hormuz diblokade, harga minyak $130',
    'IDF serang Fordow, Iran jawab dengan rudal ke Irak',
    'Hezbollah eskalasi penuh, front Lebanon terbuka',
    'AS intevensi langsung, regional war meluas',
    'Konflik nuklir threshold tercapai — Skenario S12',
];
const CONE_LIKELY = [
    'Ketegangan tinggi, deterrence stabil',
    'Diplomasi China mulai, probab. mediasi +5%',
    'Gencatan senjata Lebanon bertahan, pengawasan ketat',
    'Sanksi bertambah, harga minyak $105-115',
    'Status quo baru: Iran freeze enrichment, status parsial',
];
const CONE_BEST = [
    'Qatar cetak terobosan Gaza Fasa 2',
    'Back-channel Iran-AS aktif, negosiasi nuklir dimulai',
    'JCPOA negosiasi baru dibuka di Jenewa',
    'Iran setuju inspeksi IAEA expanded',
    'Perjanjian parsial: de-eskalasi regional dicapai',
];
const CONE_MILESTONES = [
    { date: '15 Mar 2026', text: 'Sidang IAEA Emergency — laporan enrichment 84%' },
    { date: '1 Apr 2026', text: 'Deadline negosiasi Qatar/Hamas Fasa 2' },
    { date: '15 Jun 2026', text: 'Rotasi CBG AS di Teluk Persia' },
    { date: '1 Sep 2026', text: 'Evaluasi OPEC+ produksi kuartal 3' },
    { date: '1 Des 2026', text: 'Review Kongres AS: paket bantuan Israel' },
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
    { headline: 'BREAKING: Laporan intelijen mengindikasikan pergerakan aset strategis di dekat fasilitas nuklir Iran, sebut sumber anonim (via Terminal)', source: 'X / @DeItaone', impact: 'eskalasi', analysis: 'Sumber pasar finansial tercepat. Reaksi market instan. S4+5%, S9+6%.', time: 1, intel: 'OSINT', cred: 9 },
    { headline: 'Iran Konfirmasi Pengayaan Uranium 84% di Fordow — IAEA Minta Inspeksi Darurat', source: 'Reuters', impact: 'eskalasi', analysis: 'Hard threshold nuklir dilewati. S4+6%, S12+2%.', time: 5, intel: 'SIGINT', cred: 9 },
    { headline: 'USS Nimitz & Task Force 50 Bergerak ke Teluk Persia, Pentagon Konfirmasi', source: 'AP/USNAVCENT', impact: 'eskalasi', analysis: 'Pre-positioning naval force. S7+4%, S5+2%.', time: 14, intel: 'IMINT', cred: 9 },
    { headline: 'Drone Houthi Serang Tanker LNG Yunani, 23 Kru Dievakuasi', source: 'Reuters/Lloyd\'s', impact: 'eskalasi', analysis: 'Supplai LNG terganggu. S8+4%, S9+3%.', time: 22, intel: 'OSINT', cred: 8 },
    { headline: 'Qatar Umumkan Hamas Setujui Kerangka Gencatan Senjata Fasa 2', source: 'Al Jazeera/AFP', impact: 'deeskalasi', analysis: 'Momentum diplomatik positif. S2+7%, S1+3%.', time: 31, intel: 'HUMINT', cred: 8 },
    { headline: 'Menlu Wang Yi Kunjungi Teheran, Tawarkan Paket Mediasi Komprehensif China', source: 'Reuters/Xinhua', impact: 'deeskalasi', analysis: 'Engagement China. S3+5%, tekanan diplomatik naik.', time: 47, intel: 'OSINT', cred: 7 },
    { headline: 'Harga Brent Naik 4.2% ke USD 98.7/Barel Pasca Laporan IAEA', source: 'Bloomberg', impact: 'eskalasi', analysis: 'Market pricing risiko supply. S9+4%.', time: 18, intel: 'OSINT', cred: 9 },
    { headline: 'IDF Konfirmasi Sortie F-35 Meningkat 37%, Latihan Strike Jarak Jauh', source: 'ISW/Times of Israel', impact: 'eskalasi', analysis: 'Persiapan operasional terindikasi. S4+3%.', time: 38, intel: 'IMINT', cred: 7 },
    { headline: 'UNIFIL: Joint Patrol Cegah 3 Insiden di Blue Line Lebanon-Israel', source: 'UN News', impact: 'deeskalasi', analysis: 'Mekanisme gencatan efektif. S1+3%, S6-2%.', time: 55, intel: 'OSINT', cred: 8 },
];

const PROPAGANDA_NEWS = [
    { headline: 'IRGC: Kami Siap Tutup Hormuz dalam 12 Jam Jika Diserang', source: 'IRNA (State Media)', flag: 'STATE MEDIA AMPLIFICATION', analysis: 'Pernyataan deterrence dari media pemerintah Iran. Kemungkinan psyops untuk mempengaruhi pasar & opini internasional.', cred: 4 },
    { headline: 'Israel Klaim Iran Sudah Siapkan 1000 Rudal untuk Serangan Perdana', source: 'Channel 12 Israel', flag: 'DISINFORMATION PATTERN', analysis: 'Angka tidak terverifikasi, sumber tunggal. Pola khas informasi yang dilebih-lebihkan untuk membenarkan anggaran pertahanan.', cred: 3 },
    { headline: 'Telegram: IRGC Komandan Berikan Kode Merah untuk Operasi Selat', source: 'Telegram Channel (Anon)', flag: 'PSYOPS NARRATIVE', analysis: 'Sumber tidak dapat diverifikasi. Distribusi via saluran anonim mengindikasikan deliberate disinformation campaign.', cred: 2 },
    { headline: 'Saudi Arabia Dilaporkan Diam-diam Koordinasi dengan Iran Blokir Pangkalan AS', source: 'Press TV (Iran State)', flag: 'ATROCITY FABRICATION', analysis: 'Narasi dari media state Iran untuk memperlemah koalisi regional. Tidak ada corroborating source.', cred: 2 },
    { headline: 'Khamenei Sudah Meninggal — Transisi Kekuasaan Berlangsung Diam-diam', source: 'OSINT Spekulatif/Twitter', flag: 'SINGLE SOURCE / UNVERIFIED', analysis: 'Beredar tanpa bukti concrete. Bisa jadi: disinformation, wishful thinking, atau actual intel. Perlu konfirmasi multi-source.', cred: 3 },
];

const UNVERIFIED_NEWS = [
    { headline: 'Bocoran: Mossad Telah Identifikasi & Markir 7 Fasilitas Nuklir Iran untuk Strike Window Q2 2026', label: 'BOCORAN', impact: 'Potensi dampak S4: +8-12% jika valid' },
    { headline: 'Sumber Internal IRGC: Khamenei Delegasikan Otoritas Nuklir ke Dewan Guardian akibat Kondisi Kesehatan', label: 'SINGLE SOURCE', impact: 'Potensi dampak S11: +6%, S12: +3% jika valid' },
    { headline: 'Rumor: Hezbollah Terima 500 Rudal Anti-Kapal C-802 Baru via Suriah', label: 'RUMOR', impact: 'Potensi dampak S6: +7%, S8: +5% jika valid' },
    { headline: 'Back-channel: Iran Setujui Freeze Enrichment 60 Hari Sebagai Goodwill Jika Sanksi Certain Dicabut', label: 'UNCONFIRMED', impact: 'Potensi dampak S2: +10%, S4: -5% jika valid' },
];

const ANALYST_SUMMARIES = [
    'Aktivasi I&W CR-007 (enrichment 84%) dan CR-004 (Hezbollah repositioning) mengindikasikan eskalasi incremental — bukan lompatan besar. ACH menunjukkan H4 (Proxy War Terbatas) sebagai hipotesis paling konsisten dengan bukti saat ini. Confidence HIGH.',
    'Pengerahan CBG AS dan sortie IDF meningkat menunjukkan postur pre-positioning. Red Team analysis: Nash Equilibrium saat ini mengarah ke de-eskalasi bilateral, namun satu miscalculation dapat mengubah payoff secara drastis. Watch Window: 72 jam.',
    'Net Assessment mengkonfirmasi superioritas militer absolut AS-Israel, namun Iran memimpin di proxy networks (85/100). Strategi asimetris Iran via Hezbollah, Houthi, dan PMF tetap efektif sebagai second-strike capability yang murah.',
    'Cone of Plausibility menunjukkan most likely path menuju status quo baru dengan freeze parsial enrichment Iran. Best case dipercepat oleh mediasi China. SIGINT Fusion score 74/100 — signal kuat, noise dari media state 28%.',
];
