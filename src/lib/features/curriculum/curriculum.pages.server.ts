import type { Database } from '#lib/shared/db/client.server.ts';
import { orNotFound, runAction, formValues } from '#lib/shared/http/action.server.ts';
import { NotFoundError } from '#lib/shared/http/errors.ts';
import { courseOfferings, courses } from '#lib/features/academic/academic.schema.ts';
import { recomputeOfferings } from '#lib/features/outcomes/index.server.ts';
import { requireRole } from '#lib/features/auth/index.server.ts';
import type { SessionUser } from '#lib/features/auth/index.ts';
import { eq } from 'drizzle-orm';
import { listCoursesWithCpmkCounts, listCourseCplMappings, listCpl, listCpmkByCourse, listCpmkCplMappings, listPolicies } from './curriculum.queries.server.ts';
import {
	activatePolicy,
	cloneActivePolicyAsDraft,
	createCpl,
	createCpmk,
	createDraftPolicy,
	removeCourseCplMapping,
	removeCpmkCplMapping,
	setCourseCplMapping,
	setCplTarget,
	setCpmkCplMapping,
	updateCpl,
	updateDraftPolicy
} from './curriculum.service.server.ts';

type Locals = { user: SessionUser | null };
type Event = { request: Request; locals: Locals; params: Record<string, string> };

const actorOf = (locals: Locals) => {
	const user = requireRole(locals, 'super_admin');
	return { id: user.id, role: user.role };
};

const policyFields = ['name', 'scaleMax', 'achievementThreshold', 'classAchievementRatio', 'weightTolerance', 'aggregationMethod', 'notes'];

export async function curriculumIndexLoad(db: Database, { locals, url }: { locals: Locals; url: URL }) {
	actorOf(locals);
	const [cpl, courseList, policies] = await Promise.all([listCpl(db), listCoursesWithCpmkCounts(db), listPolicies(db)]);
	const editId = url.searchParams.get('ubah');
	return { cpl, courses: courseList, policies, editing: editId ? (cpl.find((c) => c.id === editId) ?? null) : null };
}

export function curriculumIndexActions(db: Database) {
	return {
		createCpl: async ({ request, locals }: Event) => {
			const actor = actorOf(locals);
			const data = await request.formData();
			const result = await runAction(() => createCpl(db, actor, Object.fromEntries(data)), formValues(data, ['code', 'title', 'description', 'graduateAttributes', 'knowledgeProfiles', 'sortOrder']));
			return result.ok ? { success: `${result.value.code} dibuat.`, area: 'cpl' } : result.failure;
		},
		updateCpl: async ({ request, locals }: Event) => {
			const actor = actorOf(locals);
			const data = await request.formData();
			const result = await runAction(() => updateCpl(db, actor, String(data.get('id') ?? ''), Object.fromEntries(data)), formValues(data, ['code', 'title', 'description', 'graduateAttributes', 'knowledgeProfiles', 'sortOrder']));
			return result.ok ? { success: `${result.value.code} diperbarui.`, area: 'cpl' } : result.failure;
		},
		createDraft: async ({ request, locals }: Event) => {
			const actor = actorOf(locals);
			const data = await request.formData();
			const result = await runAction(() => createDraftPolicy(db, actor, Object.fromEntries(data)), formValues(data, policyFields));
			return result.ok ? { success: `Draf kebijakan versi ${result.value.version} dibuat.`, area: 'policy' } : result.failure;
		},
		cloneActive: async ({ locals }: Event) => {
			const actor = actorOf(locals);
			const result = await runAction(() => cloneActivePolicyAsDraft(db, actor));
			return result.ok ? { success: `Kebijakan aktif disalin menjadi draf versi ${result.value.version}.`, area: 'policy' } : result.failure;
		},
		updateDraft: async ({ request, locals }: Event) => {
			const actor = actorOf(locals);
			const data = await request.formData();
			const result = await runAction(() => updateDraftPolicy(db, actor, String(data.get('policyId') ?? ''), Object.fromEntries(data)), formValues(data, policyFields));
			return result.ok ? { success: `Draf versi ${result.value.version} disimpan.`, area: 'policy' } : result.failure;
		},
		setTarget: async ({ request, locals }: Event) => {
			const actor = actorOf(locals);
			const data = await request.formData();
			const result = await runAction(() => setCplTarget(db, actor, { policyId: data.get('policyId'), cplId: data.get('cplId'), target: data.get('target') }), formValues(data, ['target']));
			return result.ok ? { success: 'Target CPL disimpan.', area: 'policy' } : result.failure;
		},
		activate: async ({ request, locals }: Event) => {
			const actor = actorOf(locals);
			const data = await request.formData();
			const result = await runAction(() => activatePolicy(db, actor, String(data.get('policyId') ?? '')));
			return result.ok ? { success: `Kebijakan versi ${result.value.version} kini aktif.`, area: 'policy' } : result.failure;
		}
	};
}

export async function courseCurriculumLoad(db: Database, { locals, params }: { locals: Locals; params: { courseId: string } }) {
	actorOf(locals);
	return orNotFound(async () => {
		const [course] = await db.select({ id: courses.id, code: courses.code, name: courses.name, credits: courses.credits }).from(courses).where(eq(courses.id, params.courseId)).limit(1);
		if (!course) throw new NotFoundError('Mata kuliah tidak ditemukan.');
		const [cpl, cpmk, courseMappings, cpmkMappings] = await Promise.all([listCpl(db), listCpmkByCourse(db, course.id), listCourseCplMappings(db, course.id), listCpmkCplMappings(db, course.id)]);
		return { course, cpl, cpmk, courseMappings, cpmkMappings };
	});
}

async function recomputeCourse(db: Database, actor: { id: string; role: string }, courseId: string, trigger: string) {
	const rows = await db.select({ id: courseOfferings.id }).from(courseOfferings).where(eq(courseOfferings.courseId, courseId));
	await recomputeOfferings(db, actor, rows.map((r) => r.id), trigger);
}

export function courseCurriculumActions(db: Database) {
	return {
		createCpmk: async ({ request, locals, params }: Event) => {
			const actor = actorOf(locals);
			const data = await request.formData();
			const result = await runAction(() => createCpmk(db, actor, { courseId: params.courseId, code: data.get('code'), description: data.get('description'), taxonomyLevel: data.get('taxonomyLevel') }), formValues(data, ['code', 'description', 'taxonomyLevel']));
			return result.ok ? { success: `${result.value.code} dibuat.`, area: 'cpmk' } : result.failure;
		},
		setCourseCpl: async ({ request, locals, params }: Event) => {
			const actor = actorOf(locals);
			const data = await request.formData();
			const result = await runAction(() => setCourseCplMapping(db, actor, { courseId: params.courseId, cplId: data.get('cplId'), contribution: data.get('contribution'), approvalSource: data.get('approvalSource') }), formValues(data, ['cplId', 'contribution', 'approvalSource']));
			return result.ok ? { success: 'Pemetaan mata kuliah ke CPL disimpan.', area: 'courseCpl' } : result.failure;
		},
		removeCourseCpl: async ({ request, locals }: Event) => {
			const actor = actorOf(locals);
			const data = await request.formData();
			const result = await runAction(() => removeCourseCplMapping(db, actor, String(data.get('mappingId') ?? '')));
			return result.ok ? { success: 'Pemetaan dihapus.', area: 'courseCpl' } : result.failure;
		},
		setCpmkCpl: async ({ request, locals, params }: Event) => {
			const actor = actorOf(locals);
			const data = await request.formData();
			const result = await runAction(async () => {
				const mapping = await setCpmkCplMapping(db, actor, { cpmkId: data.get('cpmkId'), cplId: data.get('cplId'), weight: data.get('weight') });
				await recomputeCourse(db, actor, params.courseId, 'cpmk_cpl_mapping');
				return mapping;
			}, formValues(data, ['cpmkId', 'cplId', 'weight']));
			return result.ok ? { success: 'Pemetaan CPMK ke CPL disimpan dan hasil CPL kelas dihitung ulang.', area: 'cpmkCpl' } : result.failure;
		},
		removeCpmkCpl: async ({ request, locals, params }: Event) => {
			const actor = actorOf(locals);
			const data = await request.formData();
			const result = await runAction(async () => {
				await removeCpmkCplMapping(db, actor, String(data.get('mappingId') ?? ''));
				await recomputeCourse(db, actor, params.courseId, 'cpmk_cpl_mapping');
			});
			return result.ok ? { success: 'Pemetaan dihapus dan hasil CPL kelas dihitung ulang.', area: 'cpmkCpl' } : result.failure;
		}
	};
}

