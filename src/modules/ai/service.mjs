import { AppError } from '../../lib/errors.mjs';
import { prisma } from '../../lib/prisma.mjs';
import { createId } from '../../lib/utils.mjs';
import { recordChange } from '../sync/service.mjs';

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
};

function ensurePost(post) {
  if (!post || typeof post !== 'object') {
    throw new AppError('Missing post payload.', {
      statusCode: 400,
      code: 'missing_post',
    });
  }

  return {
    id: Number(post.id ?? 0) || 0,
    sourceBaseUrl: String(post.sourceBaseUrl ?? '').trim(),
    title: String(post.title ?? '').trim(),
    author: String(post.author ?? '').trim(),
    categories: Array.isArray(post.categories)
      ? post.categories.map((item) => String(item)).filter(Boolean)
      : [],
    date: String(post.date ?? '').trim(),
    excerpt: String(post.excerpt ?? '').trim(),
    link: String(post.link ?? '').trim(),
    contentHtml: String(post.contentHtml ?? ''),
  };
}

function ensureUserMessage(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    throw new AppError('Missing userMessage.', {
      statusCode: 400,
      code: 'missing_user_message',
    });
  }
  return text;
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map((item) => ({
      role: String(item?.role ?? '').trim(),
      content: String(item?.content ?? '').trim(),
    }))
    .filter((item) => item.content && (item.role === 'user' || item.role === 'assistant'));
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function buildArticleContext(post) {
  const plainText = truncate(stripHtml(post.contentHtml), 8000);
  const categories = post.categories.length > 0 ? post.categories.join('、') : '未分类';
  const date = post.date || '未知日期';

  return [
    `文章标题：${post.title || 'Untitled'}`,
    `作者：${post.author || 'Unknown author'}`,
    `分类：${categories}`,
    `发布日期：${date}`,
    '',
    '文章正文：',
    plainText || '文章正文为空。',
  ].join('\n');
}

function buildSummaryPrompt(post) {
  return [
    '你是 Nishiki 博客的 AI 伴读助手。',
    '请基于下面的文章内容，生成一份简洁、准确的中文摘要。',
    '',
    buildArticleContext(post),
    '',
    '请严格使用这个格式回答：',
    '【摘要】',
    '用 2-3 句话概括文章核心内容。',
    '',
    '【关键要点】',
    '- 要点一',
    '- 要点二',
    '- 要点三',
    '',
    '【关键词】',
    '关键词1、关键词2、关键词3',
  ].join('\n');
}

function buildChatPrompt(post, userMessage, history) {
  const transcript = history.length === 0
    ? '暂无历史对话。'
    : history
        .map((item) => `${item.role === 'user' ? '用户' : '助手'}：${item.content}`)
        .join('\n');

  return [
    '你是 Nishiki 博客的 AI 伴读助手。',
    '你只能基于当前文章内容回答问题。',
    '如果问题超出文章范围，请明确说明，并尽量把讨论拉回文章内容。',
    '请使用中文，回答尽量简洁、准确。',
    '',
    buildArticleContext(post),
    '',
    '历史对话：',
    transcript,
    '',
    `用户最新问题：${userMessage}`,
  ].join('\n');
}

function mapGeminiError(statusCode, payload, model) {
  const error = payload?.error ?? {};
  const message = String(error.message ?? `Gemini request failed with status ${statusCode}.`);
  throw new AppError(message, {
    statusCode,
    code: String(error.status ?? 'gemini_error'),
    details: {
      provider: 'gemini',
      model,
      statusCode,
      upstreamCode: error.code ?? null,
      upstreamDetails: error.details ?? null,
    },
  });
}

function extractGeminiText(payload, model) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const parts = candidates[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const text = parts
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
    if (text) {
      return text;
    }
  }

  const blockReason = payload?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new AppError(`Gemini blocked the prompt: ${blockReason}`, {
      statusCode: 422,
      code: 'gemini_blocked',
      details: { provider: 'gemini', model, blockReason },
    });
  }

  throw new AppError('Gemini returned an empty response.', {
    statusCode: 502,
    code: 'empty_ai_response',
    details: { provider: 'gemini', model },
  });
}

async function callGemini(prompt, config) {
  if (!config.geminiApiKey) {
    throw new AppError('GEMINI_API_KEY is not configured on the proxy server.', {
      statusCode: 500,
      code: 'missing_gemini_key',
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    mapGeminiError(response.status, payload, config.geminiModel);
  }

  return {
    provider: 'gemini',
    model: config.geminiModel,
    text: extractGeminiText(payload, config.geminiModel),
  };
}

function mapOpenAIError(statusCode, payload, model) {
  const error = payload?.error ?? {};
  const message = String(error.message ?? `OpenAI request failed with status ${statusCode}.`);
  throw new AppError(message, {
    statusCode,
    code: String(error.code ?? error.type ?? 'openai_error'),
    details: {
      provider: 'openai',
      model,
      statusCode,
      upstreamType: error.type ?? null,
      upstreamCode: error.code ?? null,
      upstreamParam: error.param ?? null,
    },
  });
}

function extractOpenAIText(payload, model) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  const text = output
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .filter((item) => item?.type === 'output_text')
    .map((item) => item.text ?? '')
    .join('')
    .trim();

  if (text) {
    return text;
  }

  throw new AppError('OpenAI returned an empty response.', {
    statusCode: 502,
    code: 'empty_ai_response',
    details: { provider: 'openai', model },
  });
}

async function callOpenAI(prompt, config) {
  if (!config.openaiApiKey) {
    throw new AppError('OPENAI_API_KEY is not configured on the proxy server.', {
      statusCode: 500,
      code: 'missing_openai_key',
    });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openaiModel,
      input: prompt,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    mapOpenAIError(response.status, payload, config.openaiModel);
  }

  return {
    provider: 'openai',
    model: config.openaiModel,
    text: extractOpenAIText(payload, config.openaiModel),
  };
}

export function activeModel(config) {
  return config.provider === 'openai' ? config.openaiModel : config.geminiModel;
}

export function hasActiveKey(config) {
  return config.provider === 'openai'
    ? Boolean(config.openaiApiKey)
    : Boolean(config.geminiApiKey);
}

async function generateText(prompt, config) {
  if (config.provider === 'openai') {
    return callOpenAI(prompt, config);
  }
  if (config.provider === 'gemini') {
    return callGemini(prompt, config);
  }
  throw new AppError(`Unsupported AI_PROVIDER: ${config.provider}`, {
    statusCode: 500,
    code: 'unsupported_provider',
  });
}

// 解析 AI 返回的摘要文本，提取【摘要】【关键要点】【关键词】三个部分
function parseSummaryResponse(text) {
  let summary = '';
  let keyPoints = [];
  let keywords = [];

  // 使用 JS 的 RegExp.exec() 替代 Dart 的 .firstMatch()
  const summaryMatch = /【摘要】\s*([\s\S]*?)(?=【|$)/.exec(text);
  if (summaryMatch) {
    summary = (summaryMatch[1] ?? '').trim();
  }

  const pointsMatch = /【关键要点】\s*([\s\S]*?)(?=【|$)/.exec(text);
  if (pointsMatch) {
    keyPoints = (pointsMatch[1] ?? '')
      .split('\n')
      // 使用 JS 的 .replace() 替代 Dart 的 .replaceAll()
      .map((line) => line.replace(/^[*.\-\d+、]+\s*/, '').trim())
      .filter(Boolean);
  }

  const keywordsMatch = /【关键词】\s*([\s\S]*?)(?=【|$)/.exec(text);
  if (keywordsMatch) {
    keywords = (keywordsMatch[1] ?? '')
      .split(/[、,，\s]+/)
      .filter(Boolean);
  }

  return { summary: summary || text.trim(), keyPoints, keywords };
}

async function storeSummaryForUser(userId, post, result) {
  if (!post.id || !post.sourceBaseUrl) {
    return false;
  }

  const parsed = parseSummaryResponse(result.text);
  const row = await prisma.userAiSummary.upsert({
    where: {
      userId_sourceBaseUrl_postId: {
        userId,
        sourceBaseUrl: post.sourceBaseUrl,
        postId: post.id,
      },
    },
    update: {
      summary: parsed.summary,
      keyPointsJson: JSON.stringify(parsed.keyPoints),
      keywordsJson: JSON.stringify(parsed.keywords),
      provider: result.provider,
      model: result.model,
      updatedAt: new Date(),
      deletedAt: null,
    },
    create: {
      userId,
      sourceBaseUrl: post.sourceBaseUrl,
      postId: post.id,
      summary: parsed.summary,
      keyPointsJson: JSON.stringify(parsed.keyPoints),
      keywordsJson: JSON.stringify(parsed.keywords),
      provider: result.provider,
      model: result.model,
    },
  });

  await recordChange(userId, 'ai_summary', `${row.sourceBaseUrl}:${row.postId}`, 'upsert');
  return true;
}

async function storeChatForUser(userId, post, userMessage, reply) {
  if (!post.id || !post.sourceBaseUrl) {
    return false;
  }

  let thread = await prisma.userAiThread.findFirst({
    where: {
      userId,
      sourceBaseUrl: post.sourceBaseUrl,
      postId: post.id,
      deletedAt: null,
    },
  });

  if (!thread) {
    thread = await prisma.userAiThread.create({
      data: {
        id: createId(),
        userId,
        sourceBaseUrl: post.sourceBaseUrl,
        postId: post.id,
      },
    });
    await recordChange(userId, 'ai_thread', thread.id, 'upsert');
  }

  const createdAt = new Date();
  await prisma.$transaction([
    prisma.userAiMessage.create({
      data: {
        id: createId(),
        threadId: thread.id,
        role: 'user',
        content: userMessage,
        createdAt,
        updatedAt: createdAt,
      },
    }),
    prisma.userAiMessage.create({
      data: {
        id: createId(),
        threadId: thread.id,
        role: 'assistant',
        content: reply,
        createdAt: new Date(createdAt.getTime() + 1),
        updatedAt: new Date(createdAt.getTime() + 1),
      },
    }),
    prisma.userAiThread.update({
      where: { id: thread.id },
      data: {
        updatedAt: new Date(),
        deletedAt: null,
      },
    }),
  ]);

  await recordChange(userId, 'ai_thread', thread.id, 'upsert');
  return true;
}

export async function summarizeArticle({ body, currentUser, config }) {
  const post = ensurePost(body.post);
  const result = await generateText(buildSummaryPrompt(post), config);
  const stored = currentUser ? await storeSummaryForUser(currentUser.id, post, result) : false;

  return {
    ok: true,
    provider: result.provider,
    model: result.model,
    text: result.text,
    stored,
  };
}

export async function chatWithArticle({ body, currentUser, config }) {
  const post = ensurePost(body.post);
  const userMessage = ensureUserMessage(body.userMessage);
  const history = normalizeHistory(body.history);
  const result = await generateText(buildChatPrompt(post, userMessage, history), config);
  const stored = currentUser ? await storeChatForUser(currentUser.id, post, userMessage, result.text) : false;

  return {
    ok: true,
    provider: result.provider,
    model: result.model,
    reply: result.text,
    stored,
  };
}
