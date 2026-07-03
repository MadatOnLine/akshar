export function errorHandler(err, _req, res, _next) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ ok: false, error: 'Internal server error' });
}
//# sourceMappingURL=error-handler.js.map