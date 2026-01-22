import { writable } from 'svelte/store';

// API base defaults to the host that served the frontend
export const apiBase = writable(`http://${location.hostname}:3000`);

// Toast notifications store
function createToasts() {
	const { subscribe, update } = writable([]);

	function add(toast) {
		const id = Date.now() + Math.random().toString(36).slice(2, 9);
		const entry = { id, ...toast };
		update((t) => [...t, entry]);
		if (toast.duration !== 0) {
			const dur = typeof toast.duration === 'number' ? toast.duration : 5000;
			setTimeout(() => remove(id), dur);
		}
		return id;
	}

	function remove(id) {
		update((t) => t.filter((x) => x.id !== id));
	}

	return { subscribe, add, remove };
}

export const toasts = createToasts();

// Convenience function used by components
export function showToast(type, message, duration = 5000) {
	toasts.add({ type, message, duration });
}
