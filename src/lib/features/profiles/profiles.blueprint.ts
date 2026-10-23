export type BlueprintCpl = { code: string; title: string; graduateAttributes: string[]; knowledgeProfiles: string[]; sortOrder: number };
export type BlueprintProfile = { code: string; name: string; summary: string; creditEstimate: string; sortOrder: number };
export type BlueprintField = { code: string; name: string; sortOrder: number };
export type BlueprintCplProfileLink = { cpl: string; profile: string };
export type BlueprintProfileFieldLink = { profile: string; field: string; relevance: 1 | 2 | 3 };

export const relevanceLabels: Record<number, string> = { 1: 'Pendukung', 2: 'Sedang', 3: 'Utama' };

const cpl: BlueprintCpl[] = [
	{
		code: 'CPL-1',
		title: 'Menjunjung nilai kemanusiaan, etika, tanggung jawab profesional, pengambilan keputusan, evaluasi dampak, kerja sama dan kolaborasi',
		graduateAttributes: ['WA-2', 'WA-6', 'WA-8', 'WA-9', 'WA-12'],
		knowledgeProfiles: ['WK-6'],
		sortOrder: 1
	},
	{
		code: 'CPL-2',
		title: 'Menerapkan matematika, sains alam, prinsip rekayasa, dan ilmu biomedis untuk menyelesaikan masalah keteknikan biomedis',
		graduateAttributes: ['WA-1', 'WA-5'],
		knowledgeProfiles: ['WK-1', 'WK-2', 'WK-3', 'WK-4'],
		sortOrder: 2
	},
	{
		code: 'CPL-3',
		title: 'Merancang sistem, komponen, atau proses biomedis dengan mempertimbangkan aspek kesehatan, keselamatan, sosial, budaya, dan lingkungan',
		graduateAttributes: ['WA-3', 'WA-7'],
		knowledgeProfiles: ['WK-3', 'WK-4', 'WK-5'],
		sortOrder: 3
	},
	{
		code: 'CPL-4',
		title: 'Merancang dan melakukan eksperimen serta menganalisis dan menginterpretasi data biomedis',
		graduateAttributes: ['WA-4', 'WA-5'],
		knowledgeProfiles: ['WK-3', 'WK-4', 'WK-6'],
		sortOrder: 4
	},
	{
		code: 'CPL-5',
		title: 'Mengenali, merumuskan, dan menganalisis permasalahan kompleks serta menyusun solusi teknik biomedis',
		graduateAttributes: ['WA-1', 'WA-2'],
		knowledgeProfiles: ['WK-1', 'WK-3', 'WK-4'],
		sortOrder: 5
	},
	{
		code: 'CPL-6',
		title: 'Berkomunikasi efektif secara lisan dan tulisan dalam bahasa Indonesia dan Inggris',
		graduateAttributes: ['WA-10'],
		knowledgeProfiles: ['WK-6'],
		sortOrder: 6
	},
	{
		code: 'CPL-7',
		title: 'Memahami etika, tanggung jawab profesional, dan dampak solusi rekayasa dalam konteks global, ekonomi, lingkungan, dan sosial',
		graduateAttributes: ['WA-6', 'WA-7', 'WA-8'],
		knowledgeProfiles: ['WK-6'],
		sortOrder: 7
	},
	{
		code: 'CPL-8',
		title: 'Menerapkan prinsip manajemen, kerja tim, dan kewirausahaan dalam konteks rekayasa biomedis',
		graduateAttributes: ['WA-9', 'WA-11'],
		knowledgeProfiles: ['WK-5', 'WK-6'],
		sortOrder: 8
	}
];

const profiles: BlueprintProfile[] = [
	{ code: 'PL1', name: 'Praktisi Profesional', summary: 'Engineer, teknisi, konsultan, dan teknofasilitator di industri, rumah sakit, dan pemerintahan.', creditEstimate: '±55–60 sks', sortOrder: 1 },
	{ code: 'PL2', name: 'Peneliti & Akademisi Awal', summary: 'Asisten periset dan calon mahasiswa pascasarjana.', creditEstimate: '±40–45 sks', sortOrder: 2 },
	{ code: 'PL3', name: 'Wirausahawan & Inovator', summary: 'Manajer dan wirausahawan teknologi kesehatan.', creditEstimate: '±30–35 sks', sortOrder: 3 },
	{ code: 'PL4', name: 'Analis Kebijakan', summary: 'Birokrat dan pengambil kebijakan publik di bidang Teknik Biomedis dan terkait.', creditEstimate: '±20–25 sks', sortOrder: 4 }
];

const fields: BlueprintField[] = [
	{ code: 'BK1', name: 'Engineer / Teknisi Biomedis', sortOrder: 1 },
	{ code: 'BK2', name: 'Konsultan & Teknofasilitator Alat Kesehatan', sortOrder: 2 },
	{ code: 'BK3', name: 'Asisten Peneliti / Periset', sortOrder: 3 },
	{ code: 'BK4', name: 'Calon Mahasiswa Pascasarjana & Akademisi Awal', sortOrder: 4 },
	{ code: 'BK5', name: 'Manajer Teknologi Kesehatan', sortOrder: 5 },
	{ code: 'BK6', name: 'Wirausahawan Teknologi Kesehatan', sortOrder: 6 },
	{ code: 'BK7', name: 'Birokrat / Pengambil Kebijakan Publik', sortOrder: 7 }
];

const cplProfileLinks: BlueprintCplProfileLink[] = [
	{ cpl: 'CPL-3', profile: 'PL1' },
	{ cpl: 'CPL-5', profile: 'PL1' },
	{ cpl: 'CPL-2', profile: 'PL2' },
	{ cpl: 'CPL-4', profile: 'PL2' },
	{ cpl: 'CPL-6', profile: 'PL3' },
	{ cpl: 'CPL-8', profile: 'PL3' },
	{ cpl: 'CPL-6', profile: 'PL4' },
	{ cpl: 'CPL-7', profile: 'PL4' }
];

const profileFieldLinks: BlueprintProfileFieldLink[] = [
	{ profile: 'PL1', field: 'BK1', relevance: 3 },
	{ profile: 'PL1', field: 'BK2', relevance: 3 },
	{ profile: 'PL3', field: 'BK2', relevance: 1 },
	{ profile: 'PL2', field: 'BK3', relevance: 3 },
	{ profile: 'PL2', field: 'BK4', relevance: 3 },
	{ profile: 'PL3', field: 'BK5', relevance: 3 },
	{ profile: 'PL1', field: 'BK5', relevance: 1 },
	{ profile: 'PL3', field: 'BK6', relevance: 3 },
	{ profile: 'PL1', field: 'BK6', relevance: 1 },
	{ profile: 'PL4', field: 'BK7', relevance: 3 },
	{ profile: 'PL3', field: 'BK7', relevance: 1 }
];

export const programBlueprint = { cpl, profiles, fields, cplProfileLinks, profileFieldLinks };
