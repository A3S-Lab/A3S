import type { CatalogModel, ModelInfo, ProviderInfo } from '../../../../types/api';

export function buildModelCatalog(providers: ProviderInfo[]): CatalogModel[] {
  return providers.flatMap((provider) =>
    provider.models.map((model) => ({
      id: `${provider.name}/${model.id}`,
      name: model.name?.trim() || model.id,
      source: provider.name,
      contextWindow: model.limit?.context || null,
      reasoning: Boolean(model.reasoning),
      toolCall: model.toolCall !== false,
    }))
  );
}

export function validDefaultModel(current: string, providers: ProviderInfo[]): string {
  const references = providers.flatMap((provider) => provider.models.map((model) => `${provider.name}/${model.id}`));
  return references.includes(current) ? current : (references[0] ?? '');
}

export function createProvider(existing: ProviderInfo[]): ProviderInfo {
  const names = new Set(existing.map((provider) => provider.name));
  let name = 'new-provider';
  let suffix = 2;
  while (names.has(name)) name = `new-provider-${suffix++}`;
  return {
    name,
    apiKey: null,
    baseUrl: null,
    headers: {},
    sessionIdHeader: null,
    models: [],
  };
}

export function createModel(existing: ModelInfo[]): ModelInfo {
  const ids = new Set(existing.map((model) => model.id));
  let id = 'new-model';
  let suffix = 2;
  while (ids.has(id)) id = `new-model-${suffix++}`;
  return {
    id,
    name: id,
    family: '',
    apiKey: null,
    baseUrl: null,
    headers: {},
    sessionIdHeader: null,
    attachment: false,
    reasoning: false,
    toolCall: true,
    temperature: true,
    releaseDate: null,
    modalities: { input: ['text'], output: ['text'] },
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    limit: { context: 0, output: 0 },
  };
}
