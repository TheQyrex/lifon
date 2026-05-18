// Глобальный аудио-элемент. Один на всё приложение. Компоненты управляют им
// через player-store, а аудио-события (timeupdate/ended/...) обновляют store.

let el: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();

export function bindAudio(audio: HTMLAudioElement) {
    el = audio;
    listeners.forEach((fn) => fn());
}

export function onBound(fn: () => void) {
    listeners.add(fn);
    if (el) fn();
    return () => { listeners.delete(fn); };
}

export function audio(): HTMLAudioElement | null {
    return el;
}
