// Tiny hand-rolled pub/sub, no context provider needed. Any client
// component can call toast(...) to show a toast; ToastHost (mounted once
// in the portal chrome) is the only thing that listens.

let listeners = [];
let nextId = 1;

export function toast(message, tone = 'success') {
  const entry = { id: nextId++, message, tone };
  listeners.forEach((l) => l(entry));
  return entry.id;
}

export function onToast(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}
