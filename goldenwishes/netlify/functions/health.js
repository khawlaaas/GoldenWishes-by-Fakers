/* GET /api/health — is the server configured? Never returns the key itself. */
const { config, json } = require('../lib/nvidia');

exports.handler = async () => {
    const c = config();
    return json(200, {
        ok: true,
        hasKey: c.hasKey,
        demoFallback: c.demoFallback,
        chatModel: c.chatModel,
        embedModel: c.embedModel,
        time: new Date().toISOString(),
    });
};
