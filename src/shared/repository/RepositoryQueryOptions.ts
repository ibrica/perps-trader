import { FilterQuery, PipelineStage, QueryOptions } from 'mongoose';

export interface RepositoryQueryOptions<T = null> {
  deserialized?: boolean;
  partialDeserializeFields?: string[];
  queryOptions?: QueryOptions<T>;
  filter?: FilterQuery<T> | Record<string, never>;
  aggregate?: PipelineStage[];
  includeExcludedFields?: string[];
}

export type RepositoryQueryOptionsStrict<T = null> = Omit<
  RepositoryQueryOptions,
  'deserialized' | 'filter' | 'queryOptions'
> & {
  deserialized: boolean;
  filter: FilterQuery<T> | Record<string, never>;
  queryOptions: QueryOptions<T>;
};

export const repositoryQueryOptionsDefaultValue: RepositoryQueryOptionsStrict =
  {
    deserialized: true,
    partialDeserializeFields: undefined,
    filter: {},
    queryOptions: {
      session: undefined,
      populate: undefined,
    },
  };
