// Deliberately its own module with no 'use client' directive.
//
// This constant is read by BOTH the server layout (app/(portal)/layout.js,
// to decide whether to render the welcome overlay at all) and the client
// component that sets it. It used to live in components/WelcomeIntro.js,
// which is a client module — and when a Server Component imports a
// non-component export from a client module, Next replaces it with a
// client reference rather than the value. `cookies().get()` was
// therefore being handed something that is not a cookie name, always
// returned undefined, and the overlay re-played on every single page
// load instead of once per app open.
export const WELCOME_COOKIE = 'nxc_welcome_seen';
