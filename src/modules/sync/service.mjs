import { AppError } from '../../lib/errors.mjs';
import { prisma } from '../../lib/prisma.mjs';
import { broadcastToUser } from '../realtime/hub.mjs';

function parseDate(value) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function recordChange(userId, entityType, entityId, op, tx = prisma) {
  const change = await tx.syncChangeLog.create({
    data: {
      userId,
      entityType,
      entityId,
      op,
    },
  });

  broadcastToUser(
    userId,
    entityType === 'preference' ? 'preferences.updated' : 'sync.updated',
    {
      version: Number(change.version),
      entityType: change.entityType,
      entityId: change.entityId,
      op: change.op,
      changedAt: change.changedAt.toISOString(),
    },
  );

  return change;
}

async function upsertPreference(userId, data) {
  const row = await prisma.userPreference.upsert({
    where: { userId },
    update: {
      themeMode: String(data.themeMode ?? 'system'),
      fontScale: Number(data.fontScale ?? 1),
      selectedSourceBaseUrl: data.selectedSourceBaseUrl
        ? String(data.selectedSourceBaseUrl).trim()
        : null,
      sourceMode: String(data.sourceMode ?? 'single'),
      selectedGroupId: data.selectedGroupId ? String(data.selectedGroupId).trim() : null,
      updatedAt: parseDate(data.updatedAt),
    },
    create: {
      userId,
      themeMode: String(data.themeMode ?? 'system'),
      fontScale: Number(data.fontScale ?? 1),
      selectedSourceBaseUrl: data.selectedSourceBaseUrl
        ? String(data.selectedSourceBaseUrl).trim()
        : null,
      sourceMode: String(data.sourceMode ?? 'single'),
      selectedGroupId: data.selectedGroupId ? String(data.selectedGroupId).trim() : null,
      updatedAt: parseDate(data.updatedAt),
    },
  });

  await recordChange(userId, 'preference', userId, 'upsert');
  return row;
}

async function upsertSource(userId, data) {
  const id = String(data.id ?? `${userId}:${String(data.baseUrl ?? '').trim()}`);
  const row = await prisma.userSource.upsert({
    where: { id },
    update: {
      baseUrl: String(data.baseUrl ?? '').trim(),
      name: String(data.name ?? '').trim() || String(data.baseUrl ?? '').trim(),
      updatedAt: parseDate(data.updatedAt),
      deletedAt: data.deletedAt ? parseDate(data.deletedAt) : null,
    },
    create: {
      id,
      userId,
      baseUrl: String(data.baseUrl ?? '').trim(),
      name: String(data.name ?? '').trim() || String(data.baseUrl ?? '').trim(),
      createdAt: parseDate(data.createdAt),
      updatedAt: parseDate(data.updatedAt),
      deletedAt: data.deletedAt ? parseDate(data.deletedAt) : null,
    },
  });
  await recordChange(userId, 'source', row.id, row.deletedAt ? 'delete' : 'upsert');
  return row;
}

async function upsertSourceGroup(userId, data) {
  const id = String(data.id ?? '').trim();
  if (!id) {
    throw new AppError('source_group.id is required.', {
      statusCode: 400,
      code: 'invalid_source_group',
    });
  }

  await prisma.$transaction(async (tx) => {
    const row = await tx.userSourceGroup.upsert({
      where: { id },
      update: {
        name: String(data.name ?? '').trim() || 'Untitled group',
        updatedAt: parseDate(data.updatedAt),
        deletedAt: data.deletedAt ? parseDate(data.deletedAt) : null,
      },
      create: {
        id,
        userId,
        name: String(data.name ?? '').trim() || 'Untitled group',
        createdAt: parseDate(data.createdAt),
        updatedAt: parseDate(data.updatedAt),
        deletedAt: data.deletedAt ? parseDate(data.deletedAt) : null,
      },
    });

    if (Array.isArray(data.sourceIds)) {
      await tx.userSourceGroupMember.deleteMany({ where: { groupId: id } });
      for (let index = 0; index < data.sourceIds.length; index += 1) {
        await tx.userSourceGroupMember.create({
          data: {
            groupId: id,
            sourceId: String(data.sourceIds[index]),
            sortOrder: index,
          },
        });
      }
    }

    await recordChange(userId, 'source_group', row.id, row.deletedAt ? 'delete' : 'upsert', tx);
  });

  return prisma.userSourceGroup.findUnique({
    where: { id },
    include: { members: { orderBy: { sortOrder: 'asc' } } },
  });
}

async function upsertSavedPost(userId, data) {
  const row = await prisma.userSavedPost.upsert({
    where: {
      userId_sourceBaseUrl_postId: {
        userId,
        sourceBaseUrl: String(data.sourceBaseUrl ?? '').trim(),
        postId: Number(data.postId ?? 0),
      },
    },
    update: {
      savedAt: parseDate(data.savedAt ?? data.updatedAt),
      updatedAt: parseDate(data.updatedAt),
      deletedAt: data.deletedAt ? parseDate(data.deletedAt) : null,
    },
    create: {
      userId,
      sourceBaseUrl: String(data.sourceBaseUrl ?? '').trim(),
      postId: Number(data.postId ?? 0),
      savedAt: parseDate(data.savedAt ?? data.updatedAt),
      updatedAt: parseDate(data.updatedAt),
      deletedAt: data.deletedAt ? parseDate(data.deletedAt) : null,
    },
  });
  await recordChange(userId, 'saved_post', `${row.sourceBaseUrl}:${row.postId}`, row.deletedAt ? 'delete' : 'upsert');
  return row;
}

async function upsertLikedPost(userId, data) {
  const row = await prisma.userLikedPost.upsert({
    where: {
      userId_sourceBaseUrl_postId: {
        userId,
        sourceBaseUrl: String(data.sourceBaseUrl ?? '').trim(),
        postId: Number(data.postId ?? 0),
      },
    },
    update: {
      likedAt: parseDate(data.likedAt ?? data.updatedAt),
      updatedAt: parseDate(data.updatedAt),
      deletedAt: data.deletedAt ? parseDate(data.deletedAt) : null,
    },
    create: {
      userId,
      sourceBaseUrl: String(data.sourceBaseUrl ?? '').trim(),
      postId: Number(data.postId ?? 0),
      likedAt: parseDate(data.likedAt ?? data.updatedAt),
      updatedAt: parseDate(data.updatedAt),
      deletedAt: data.deletedAt ? parseDate(data.deletedAt) : null,
    },
  });
  await recordChange(userId, 'liked_post', `${row.sourceBaseUrl}:${row.postId}`, row.deletedAt ? 'delete' : 'upsert');
  return row;
}

async function upsertReadingProgress(userId, data) {
  const sourceBaseUrl = String(data.sourceBaseUrl ?? '').trim();
  const postId = Number(data.postId ?? 0);
  const incomingProgress = Number(data.progress ?? 0);
  const incomingLastReadAt = parseDate(data.lastReadAt ?? data.updatedAt);
  const existing = await prisma.userReadingProgress.findUnique({
    where: {
      userId_sourceBaseUrl_postId: { userId, sourceBaseUrl, postId },
    },
  });

  let progress = incomingProgress;
  let lastReadAt = incomingLastReadAt;
  if (existing && !data.deletedAt) {
    if (existing.progress > incomingProgress) {
      progress = existing.progress;
      lastReadAt = existing.lastReadAt;
    } else if (existing.progress === incomingProgress && existing.lastReadAt > incomingLastReadAt) {
      lastReadAt = existing.lastReadAt;
    }
  }

  const row = await prisma.userReadingProgress.upsert({
    where: {
      userId_sourceBaseUrl_postId: { userId, sourceBaseUrl, postId },
    },
    update: {
      progress,
      lastReadAt,
      updatedAt: parseDate(data.updatedAt),
      deletedAt: data.deletedAt ? parseDate(data.deletedAt) : null,
    },
    create: {
      userId,
      sourceBaseUrl,
      postId,
      progress,
      lastReadAt,
      updatedAt: parseDate(data.updatedAt),
      deletedAt: data.deletedAt ? parseDate(data.deletedAt) : null,
    },
  });
  await recordChange(userId, 'reading_progress', `${row.sourceBaseUrl}:${row.postId}`, row.deletedAt ? 'delete' : 'upsert');
  return row;
}

async function upsertAiSummary(userId, data) {
  const row = await prisma.userAiSummary.upsert({
    where: {
      userId_sourceBaseUrl_postId: {
        userId,
        sourceBaseUrl: String(data.sourceBaseUrl ?? '').trim(),
        postId: Number(data.postId ?? 0),
      },
    },
    update: {
      summary: String(data.summary ?? ''),
      keyPointsJson: JSON.stringify(Array.isArray(data.keyPoints) ? data.keyPoints : []),
      keywordsJson: JSON.stringify(Array.isArray(data.keywords) ? data.keywords : []),
      provider: data.provider ? String(data.provider) : null,
      model: data.model ? String(data.model) : null,
      updatedAt: parseDate(data.updatedAt),
      deletedAt: data.deletedAt ? parseDate(data.deletedAt) : null,
    },
    create: {
      userId,
      sourceBaseUrl: String(data.sourceBaseUrl ?? '').trim(),
      postId: Number(data.postId ?? 0),
      summary: String(data.summary ?? ''),
      keyPointsJson: JSON.stringify(Array.isArray(data.keyPoints) ? data.keyPoints : []),
      keywordsJson: JSON.stringify(Array.isArray(data.keywords) ? data.keywords : []),
      provider: data.provider ? String(data.provider) : null,
      model: data.model ? String(data.model) : null,
      updatedAt: parseDate(data.updatedAt),
      deletedAt: data.deletedAt ? parseDate(data.deletedAt) : null,
    },
  });
  await recordChange(userId, 'ai_summary', `${row.sourceBaseUrl}:${row.postId}`, row.deletedAt ? 'delete' : 'upsert');
  return row;
}

async function upsertAiThread(userId, data) {
  const id = String(data.id ?? '').trim();
  if (!id) {
    throw new AppError('ai_thread.id is required.', {
      statusCode: 400,
      code: 'invalid_ai_thread',
    });
  }

  await prisma.$transaction(async (tx) => {
    const row = await tx.userAiThread.upsert({
      where: { id },
      update: {
        sourceBaseUrl: String(data.sourceBaseUrl ?? '').trim(),
        postId: Number(data.postId ?? 0),
        updatedAt: parseDate(data.updatedAt),
        deletedAt: data.deletedAt ? parseDate(data.deletedAt) : null,
      },
      create: {
        id,
        userId,
        sourceBaseUrl: String(data.sourceBaseUrl ?? '').trim(),
        postId: Number(data.postId ?? 0),
        createdAt: parseDate(data.createdAt),
        updatedAt: parseDate(data.updatedAt),
        deletedAt: data.deletedAt ? parseDate(data.deletedAt) : null,
      },
    });

    if (Array.isArray(data.messages)) {
      for (const message of data.messages) {
        const messageId = String(message.id ?? '').trim();
        if (!messageId) {
          continue;
        }
        await tx.userAiMessage.upsert({
          where: { id: messageId },
          update: {
            role: String(message.role ?? 'assistant'),
            content: String(message.content ?? ''),
            createdAt: parseDate(message.createdAt),
            updatedAt: parseDate(message.updatedAt ?? message.createdAt),
            deletedAt: message.deletedAt ? parseDate(message.deletedAt) : null,
          },
          create: {
            id: messageId,
            threadId: row.id,
            role: String(message.role ?? 'assistant'),
            content: String(message.content ?? ''),
            createdAt: parseDate(message.createdAt),
            updatedAt: parseDate(message.updatedAt ?? message.createdAt),
            deletedAt: message.deletedAt ? parseDate(message.deletedAt) : null,
          },
        });
      }
    }

    await recordChange(userId, 'ai_thread', row.id, row.deletedAt ? 'delete' : 'upsert', tx);
  });

  return prisma.userAiThread.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
}

const handlers = {
  preference: upsertPreference,
  source: upsertSource,
  source_group: upsertSourceGroup,
  saved_post: upsertSavedPost,
  liked_post: upsertLikedPost,
  reading_progress: upsertReadingProgress,
  ai_summary: upsertAiSummary,
  ai_thread: upsertAiThread,
};

function serializeSource(source) {
  return {
    id: source.id,
    baseUrl: source.baseUrl,
    name: source.name,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
    deletedAt: source.deletedAt?.toISOString() ?? null,
  };
}

function serializeSourceGroup(group) {
  return {
    id: group.id,
    name: group.name,
    sourceIds: (group.members ?? []).map((member) => member.sourceId),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
    deletedAt: group.deletedAt?.toISOString() ?? null,
  };
}

function serializeAiThread(thread) {
  return {
    id: thread.id,
    sourceBaseUrl: thread.sourceBaseUrl,
    postId: thread.postId,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    deletedAt: thread.deletedAt?.toISOString() ?? null,
    messages: (thread.messages ?? []).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      deletedAt: message.deletedAt?.toISOString() ?? null,
    })),
  };
}

function serializeEntity(entityType, row) {
  if (!row) {
    return null;
  }
  switch (entityType) {
    case 'preference':
      return {
        themeMode: row.themeMode,
        fontScale: row.fontScale,
        selectedSourceBaseUrl: row.selectedSourceBaseUrl,
        sourceMode: row.sourceMode,
        selectedGroupId: row.selectedGroupId,
        updatedAt: row.updatedAt.toISOString(),
      };
    case 'source':
      return serializeSource(row);
    case 'source_group':
      return serializeSourceGroup(row);
    case 'saved_post':
      return {
        sourceBaseUrl: row.sourceBaseUrl,
        postId: row.postId,
        savedAt: row.savedAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        deletedAt: row.deletedAt?.toISOString() ?? null,
      };
    case 'liked_post':
      return {
        sourceBaseUrl: row.sourceBaseUrl,
        postId: row.postId,
        likedAt: row.likedAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        deletedAt: row.deletedAt?.toISOString() ?? null,
      };
    case 'reading_progress':
      return {
        sourceBaseUrl: row.sourceBaseUrl,
        postId: row.postId,
        progress: row.progress,
        lastReadAt: row.lastReadAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        deletedAt: row.deletedAt?.toISOString() ?? null,
      };
    case 'ai_summary':
      return {
        sourceBaseUrl: row.sourceBaseUrl,
        postId: row.postId,
        summary: row.summary,
        keyPoints: JSON.parse(row.keyPointsJson),
        keywords: JSON.parse(row.keywordsJson),
        provider: row.provider,
        model: row.model,
        updatedAt: row.updatedAt.toISOString(),
        deletedAt: row.deletedAt?.toISOString() ?? null,
      };
    case 'ai_thread':
      return serializeAiThread(row);
    default:
      return row;
  }
}

export async function buildBootstrap(userId) {
  const [
    preference,
    sources,
    sourceGroups,
    savedPosts,
    likedPosts,
    readingProgress,
    aiSummaries,
    aiThreads,
    latestChange,
  ] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId } }),
    prisma.userSource.findMany({ where: { userId }, orderBy: { updatedAt: 'asc' } }),
    prisma.userSourceGroup.findMany({
      where: { userId },
      include: { members: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { updatedAt: 'asc' },
    }),
    prisma.userSavedPost.findMany({ where: { userId }, orderBy: { updatedAt: 'asc' } }),
    prisma.userLikedPost.findMany({ where: { userId }, orderBy: { updatedAt: 'asc' } }),
    prisma.userReadingProgress.findMany({ where: { userId }, orderBy: { updatedAt: 'asc' } }),
    prisma.userAiSummary.findMany({ where: { userId }, orderBy: { updatedAt: 'asc' } }),
    prisma.userAiThread.findMany({
      where: { userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'asc' },
    }),
    prisma.syncChangeLog.findFirst({ where: { userId }, orderBy: { version: 'desc' } }),
  ]);

  return {
    ok: true,
    sinceVersion: 0,
    latestVersion: latestChange ? Number(latestChange.version) : 0,
    data: {
      preference: preference ? serializeEntity('preference', preference) : null,
      sources: sources.map(serializeSource),
      sourceGroups: sourceGroups.map(serializeSourceGroup),
      savedPosts: savedPosts.map((row) => serializeEntity('saved_post', row)),
      likedPosts: likedPosts.map((row) => serializeEntity('liked_post', row)),
      readingProgress: readingProgress.map((row) => serializeEntity('reading_progress', row)),
      aiSummaries: aiSummaries.map((row) => serializeEntity('ai_summary', row)),
      aiThreads: aiThreads.map(serializeAiThread),
    },
  };
}

async function fetchEntityData(userId, entityType, entityId) {
  switch (entityType) {
    case 'preference':
      return prisma.userPreference.findUnique({ where: { userId } });
    case 'source':
      return prisma.userSource.findFirst({ where: { userId, id: entityId } });
    case 'source_group':
      return prisma.userSourceGroup.findFirst({
        where: { userId, id: entityId },
        include: { members: { orderBy: { sortOrder: 'asc' } } },
      });
    case 'saved_post': {
      const [sourceBaseUrl, postIdText] = entityId.split(':');
      return prisma.userSavedPost.findUnique({
        where: {
          userId_sourceBaseUrl_postId: { userId, sourceBaseUrl, postId: Number(postIdText) },
        },
      });
    }
    case 'liked_post': {
      const [sourceBaseUrl, postIdText] = entityId.split(':');
      return prisma.userLikedPost.findUnique({
        where: {
          userId_sourceBaseUrl_postId: { userId, sourceBaseUrl, postId: Number(postIdText) },
        },
      });
    }
    case 'reading_progress': {
      const [sourceBaseUrl, postIdText] = entityId.split(':');
      return prisma.userReadingProgress.findUnique({
        where: {
          userId_sourceBaseUrl_postId: { userId, sourceBaseUrl, postId: Number(postIdText) },
        },
      });
    }
    case 'ai_summary': {
      const [sourceBaseUrl, postIdText] = entityId.split(':');
      return prisma.userAiSummary.findUnique({
        where: {
          userId_sourceBaseUrl_postId: { userId, sourceBaseUrl, postId: Number(postIdText) },
        },
      });
    }
    case 'ai_thread':
      return prisma.userAiThread.findFirst({
        where: { userId, id: entityId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    default:
      return null;
  }
}

export async function getChanges(userId, sinceVersion) {
  const rows = await prisma.syncChangeLog.findMany({
    where: {
      userId,
      version: { gt: BigInt(sinceVersion) },
    },
    orderBy: { version: 'asc' },
  });

  const changes = [];
  for (const row of rows) {
    const data = await fetchEntityData(userId, row.entityType, row.entityId);
    changes.push({
      version: Number(row.version),
      entityType: row.entityType,
      entityId: row.entityId,
      op: row.op,
      changedAt: row.changedAt.toISOString(),
      data: serializeEntity(row.entityType, data),
    });
  }

  return {
    ok: true,
    sinceVersion,
    latestVersion: changes.length > 0 ? changes[changes.length - 1].version : sinceVersion,
    changes,
  };
}

export async function applyChanges(userId, changes) {
  if (!Array.isArray(changes)) {
    throw new AppError('changes must be an array.', {
      statusCode: 400,
      code: 'invalid_changes',
    });
  }

  const applied = [];
  for (const change of changes) {
    const entityType = String(change?.entityType ?? '').trim();
    const handler = handlers[entityType];
    if (!handler) {
      throw new AppError(`Unsupported entityType: ${entityType}`, {
        statusCode: 400,
        code: 'unsupported_entity_type',
      });
    }
    const row = await handler(userId, change.data ?? {});
    applied.push({
      entityType,
      data: row ? serializeEntity(entityType, row) : null,
    });
  }

  const latestChange = await prisma.syncChangeLog.findFirst({
    where: { userId },
    orderBy: { version: 'desc' },
  });

  return {
    ok: true,
    applied,
    latestVersion: latestChange ? Number(latestChange.version) : 0,
  };
}
