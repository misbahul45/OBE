import type { Database } from '#lib/shared/db/client.server.ts';
import { fail, type ActionFailure } from '@sveltejs/kit';
import { orNotFound, runAction, type FormFailure } from '#lib/shared/http/action.server.ts';
import { assertOfferingAccess } from '#lib/features/academic/index.server.ts';
import { deleteComponent, recomputeForActor, saveComponent, setComponentCpmk, type CpmkSelection } from '#lib/features/assessment/index.server.ts';
import { listComponents, listCpmkByCourse } from '#lib/features/curriculum/index.server.ts';
import { getOfferingAnalytics, getOfferingRoster } from '#lib/features/outcomes/index.server.ts';
import { requireRole } from '#lib/features/auth/index.server.ts';
import type { AppRole, SessionUser } from '#lib/features/auth/index.ts';

type Locals = { user: SessionUser | null };
type Event = { request: Request; locals: Locals; params: { offeringId: string } };

const actorOf = (locals: Locals, role: AppRole) => {
	const user = requireRole(locals, role);
	return { id: user.id, role: user.role };
};

export async function offeringPageLoad(db: Database, { locals, params }: { locals: Locals; params: { offeringId: string } }, role: AppRole) {
	const actor = actorOf(locals, role);
	return orNotFound(async () => {
		await assertOfferingAccess(db, actor, params.offeringId);
		const analytics = await getOfferingAnalytics(db, params.offeringId);
		const [roster, structure, cpmkOptions] = await Promise.all([
			getOfferingRoster(db, params.offeringId),
			listComponents(db, params.offeringId),
			listCpmkByCourse(db, analytics.offering.courseId)
		]);
		return {
			analytics,
			roster,
			components: structure.components.map((c) => ({
				id: c.id,
				code: c.code,
				name: c.name,
				type: c.type,
				weightPercent: c.weightPercent,
				maxScore: c.maxScore,
				isRequired: c.isRequired,
				isActive: c.isActive,
				cpmkMappings: c.cpmkMappings.map((m) => ({ cpmkId: m.cpmkId, coefficient: m.coefficient }))
			})),
			cpmkOptions: cpmkOptions.filter((c) => c.isActive).map((c) => ({ id: c.id, code: c.code }))
		};
	});
}

type Outcome = ActionFailure<FormFailure> | { success: string; component?: string };

const text = (data: FormData, name: string) => String(data.get(name) ?? '');

function scoped(component: string | undefined, failure: ActionFailure<FormFailure>) {
	return fail(failure.status, { ...failure.data, component });
}

export function offeringPageActions(db: Database, role: AppRole) {
	return {
		saveComponent: async ({ request, locals, params }: Event): Promise<Outcome> => {
			const actor = actorOf(locals, role);
			const data = await request.formData();
			const code = text(data, 'code');
			const result = await runAction(() =>
				saveComponent(db, actor, {
					offeringId: params.offeringId,
					code,
					name: text(data, 'name'),
					type: text(data, 'type') || 'lainnya',
					weightPercent: text(data, 'weightPercent'),
					maxScore: text(data, 'maxScore') || '100',
					isRequired: data.get('isRequired') === 'on'
				})
			);
			return result.ok ? { success: `Komponen ${result.value.component.code} disimpan dan hasil dihitung ulang.`, component: result.value.component.code } : scoped(code || undefined, result.failure);
		},
		deleteComponent: async ({ request, locals }: Event): Promise<Outcome> => {
			const actor = actorOf(locals, role);
			const data = await request.formData();
			const result = await runAction(() => deleteComponent(db, actor, text(data, 'componentId')));
			if (!result.ok) return result.failure;
			return { success: result.value.removed ? 'Komponen dihapus.' : 'Komponen sudah memiliki nilai sehingga dinonaktifkan, bukan dihapus.' };
		},
		saveMapping: async ({ request, locals }: Event): Promise<Outcome> => {
			const actor = actorOf(locals, role);
			const data = await request.formData();
			const componentId = text(data, 'componentId');
			const code = text(data, 'code');
			const selections: CpmkSelection[] = [];
			for (const [key] of data.entries()) {
				const match = /^cpmk_([0-9a-f-]{36})$/.exec(key);
				if (!match) continue;
				const coefficient = Number(text(data, `coef_${match[1]}`).replace(',', '.'));
				selections.push({ cpmkId: match[1], coefficient: Number.isFinite(coefficient) && coefficient > 0 ? coefficient : 1 });
			}
			const result = await runAction(() => setComponentCpmk(db, actor, componentId, selections));
			return result.ok ? { success: `Pemetaan CPMK komponen ${code} disimpan dan hasil dihitung ulang.`, component: code } : scoped(code, result.failure);
		},
		recompute: async ({ locals, params }: Event): Promise<Outcome> => {
			const actor = actorOf(locals, role);
			const result = await runAction(() => recomputeForActor(db, actor, params.offeringId));
			if (!result.ok) return result.failure;
			return { success: result.value.changed ? `Hasil dihitung ulang untuk ${result.value.enrollments} mahasiswa.` : 'Hasil sudah mutakhir; tidak ada perubahan.' };
		}
	};
}
