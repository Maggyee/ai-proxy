import { applyChanges, buildBootstrap, getChanges } from './service.mjs';

export async function syncRoutes(fastify) {
  fastify.get('/api/sync/bootstrap', { preHandler: [fastify.requireAuth] }, async (request) =>
    buildBootstrap(request.currentUser.id));

  fastify.get('/api/sync/changes', { preHandler: [fastify.requireAuth] }, async (request) => {
    const sinceVersion = Number(request.query?.sinceVersion ?? 0) || 0;
    return getChanges(request.currentUser.id, sinceVersion);
  });

  fastify.post('/api/sync/push', { preHandler: [fastify.requireAuth] }, async (request) =>
    applyChanges(request.currentUser.id, request.body?.changes ?? []));

  fastify.post('/api/sync/reconcile', { preHandler: [fastify.requireAuth] }, async (request) => {
    const result = await applyChanges(request.currentUser.id, request.body?.changes ?? []);
    const bootstrap = await buildBootstrap(request.currentUser.id);

    return {
      ok: true,
      applied: result.applied,
      latestVersion: result.latestVersion,
      data: bootstrap.data,
    };
  });
}
