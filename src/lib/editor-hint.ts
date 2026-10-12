/**
 * Set by the proxy while someone is signed in to the dashboard, so the public
 * pages (static, the same for everyone) can show them an Edit button. It is
 * only a hint and grants nothing: the dashboard checks the session and the
 * admin role itself.
 */
export const EDITOR_HINT_COOKIE = 'editor-hint'
