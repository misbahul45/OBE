<script lang="ts">
	type Option = { value: string; label: string; disabled?: boolean };

	let {
		id,
		name,
		options,
		value = $bindable(''),
		placeholder,
		required = false,
		disabled = false,
		invalid = false,
		describedBy,
		class: className = '',
		label,
		onchange
	}: {
		id: string;
		name: string;
		options: Option[];
		value?: string;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		invalid?: boolean;
		describedBy?: string;
		class?: string;
		label?: string;
		onchange?: (event: Event) => void;
	} = $props();
</script>

<select
	{id}
	{name}
	{required}
	{disabled}
	bind:value
	{onchange}
	aria-invalid={invalid}
	aria-describedby={describedBy}
	aria-label={label}
	class="h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive {className}"
>
	{#if placeholder !== undefined}<option value="">{placeholder}</option>{/if}
	{#each options as option (option.value)}
		<option value={option.value} disabled={option.disabled}>{option.label}</option>
	{/each}
</select>
