import {
  AnyKeys,
  ClientSession,
  Document,
  FilterQuery,
  Model,
  PipelineStage,
  PopulateOptions,
  UpdateQuery,
} from 'mongoose';
import {
  RepositoryQueryOptions,
  repositoryQueryOptionsDefaultValue,
} from './RepositoryQueryOptions';
import { partialToObject } from '../';
import { BigIntInterceptor } from '../interceptors';
import { isNil } from '../utils';

export class BaseMongoRepository<T> {
  protected readonly excludedFields: string[] = [];

  private readonly cache = new Map<string, T>();

  constructor(protected model: Model<T>) {}

  serializeOptions(options?: RepositoryQueryOptions<T>): string {
    return new BigIntInterceptor().transform(options);
  }

  async getCached(options?: RepositoryQueryOptions<T>): Promise<T | null> {
    const serializedOptions = this.serializeOptions(options);
    if (this.cache.has(serializedOptions)) {
      return this.cache.get(serializedOptions)!;
    }

    const data = await this.getOne(options);
    if (!isNil(data)) {
      this.cache.set(serializedOptions, data);
    }
    return data;
  }

  async has(options?: RepositoryQueryOptions<T>): Promise<boolean> {
    const result = await this.getOne(options);
    return result != null;
  }

  getCollectionName(): string {
    return this.model.collection.name;
  }

  async getAll(options?: RepositoryQueryOptions<T>): Promise<Array<T>> {
    const { filter, deserialized, queryOptions, includeExcludedFields } = {
      ...repositoryQueryOptionsDefaultValue,
      ...options,
    };
    const values = await this.model
      .find(filter, null, queryOptions)
      .select(this.getExcludedFields(includeExcludedFields))
      .exec();
    return deserialized
      ? values.map((value) => this.deserialize(value))
      : values;
  }

  async getAllWithAggregate(
    options?: RepositoryQueryOptions<T>,
  ): Promise<unknown[]> {
    const { queryOptions, aggregate, partialDeserializeFields } = {
      ...repositoryQueryOptionsDefaultValue,
      ...options,
    };
    const { populate } = queryOptions;

    let values = await this.model.aggregate<T>(aggregate).exec();

    if (populate) {
      values = await this.model.populate(
        values,
        populate as PopulateOptions | Array<PopulateOptions> | string,
      );
    }

    return !isNil(partialDeserializeFields)
      ? values.map((value) =>
          this.partialDeserialize(value, partialDeserializeFields ?? []),
        )
      : values;
  }

  async getOneWithAggregate(
    options?: RepositoryQueryOptions<T>,
  ): Promise<unknown> {
    const { queryOptions, aggregate, partialDeserializeFields } = {
      ...repositoryQueryOptionsDefaultValue,
      ...options,
    };
    const { populate } = queryOptions;

    let values = await this.model.aggregate<T>(aggregate).exec();

    if (populate) {
      values = await this.model.populate(
        values,
        populate as PopulateOptions | Array<PopulateOptions> | string,
      );
    }

    return !isNil(partialDeserializeFields)
      ? this.partialDeserialize(values[0], partialDeserializeFields ?? [])
      : values[0];
  }

  async getById(
    id: string,
    options?: RepositoryQueryOptions<T>,
  ): Promise<T | null> {
    const { deserialized, queryOptions, includeExcludedFields } = {
      ...repositoryQueryOptionsDefaultValue,
      ...options,
    };
    const value = await this.model
      .findById(id, null, queryOptions)
      .select(this.getExcludedFields(includeExcludedFields))
      .exec();

    if (isNil(value)) return null;
    return deserialized ? this.deserialize(value) : value;
  }

  async getOne(options?: RepositoryQueryOptions<T>): Promise<T | null> {
    const { filter, deserialized, queryOptions, includeExcludedFields } = {
      ...repositoryQueryOptionsDefaultValue,
      ...options,
    };
    const { populate } = queryOptions;
    const value = await this.model
      .findOne(filter, null, { populate })
      .select(this.getExcludedFields(includeExcludedFields))
      .exec();

    if (isNil(value)) return null;
    return deserialized ? this.deserialize(value) : value;
  }

  async getMany(
    options?: RepositoryQueryOptions<T>,
  ): Promise<Array<T | undefined>> {
    const { filter, deserialized, queryOptions, includeExcludedFields } = {
      ...repositoryQueryOptionsDefaultValue,
      ...options,
    };
    const { populate } = queryOptions;
    const values = await this.model
      .find(filter, null, { populate })
      .select(this.getExcludedFields(includeExcludedFields))
      .exec();
    return deserialized
      ? values.map((value) => this.deserialize(value))
      : values;
  }

  async getLast(
    sortBy: string,
    filter?: FilterQuery<T> | Record<string, never>,
  ): Promise<T | undefined> {
    return (
      await this.getAll({
        queryOptions: { sort: { [sortBy]: -1 }, limit: 1 },
        filter,
      })
    )[0];
  }

  async updateById(
    id: string,
    updateDto: UpdateQuery<T>,
    options?: RepositoryQueryOptions<T>,
  ): Promise<T | null> {
    const { deserialized, queryOptions } = {
      ...repositoryQueryOptionsDefaultValue,
      ...options,
    };

    const value = await this.model
      .findByIdAndUpdate(id, updateDto, { queryOptions, new: true })
      .exec();

    if (isNil(value)) return null;
    return deserialized ? this.deserialize(value) : value;
  }

  async create(
    createDto: AnyKeys<T>,
    options?: RepositoryQueryOptions<T>,
  ): Promise<T> {
    const {
      deserialized,
      queryOptions: { session },
    } = {
      ...repositoryQueryOptionsDefaultValue,
      ...options,
    };
    const value = (await new this.model(createDto).save({ session })) as T;
    return deserialized ? this.deserialize(value) : value;
  }

  async createMany(
    createDtos: AnyKeys<T>[],
    options?: RepositoryQueryOptions<T>,
  ): Promise<Array<T | undefined>> {
    const {
      deserialized,
      queryOptions: { session },
    } = {
      ...repositoryQueryOptionsDefaultValue,
      ...options,
    };
    const values = (await this.model.insertMany(createDtos, {
      session,
    })) as T[];
    return deserialized
      ? values.map((value) => this.deserialize(value))
      : values;
  }

  async deleteOne(options?: RepositoryQueryOptions<T>): Promise<void> {
    const {
      filter,
      queryOptions: { session },
    } = {
      ...repositoryQueryOptionsDefaultValue,
      ...options,
    };
    await this.model.deleteOne(filter, { session: session ?? undefined });
  }

  async deleteMany(options?: RepositoryQueryOptions<T>): Promise<void> {
    const {
      filter,
      queryOptions: { session },
    } = {
      ...repositoryQueryOptionsDefaultValue,
      ...options,
    };
    await this.model.deleteMany(filter, { session: session ?? undefined });
  }

  async findByIdAndDelete(id: string, session?: ClientSession): Promise<void> {
    await this.model.findByIdAndDelete(id, { session });
  }

  async count(filter?: FilterQuery<T>): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async distinct<R>(field: string, filter?: FilterQuery<T>): Promise<Array<R>> {
    return (await this.model.distinct(field, filter).exec()) as R[];
  }

  protected deserialize(value: T): T {
    return (value as Document).toObject() as T;
  }

  protected partialDeserialize(value: T, fields: string[]): T | undefined {
    return !isNil(value) ? partialToObject(value, fields) : undefined;
  }

  protected getExcludedFields(
    includedFields: string[] = [],
    addPrefix = true,
  ): string[] {
    return this.excludedFields
      .filter((field) => !includedFields.includes(field))
      .map((field) => `${addPrefix ? '-' : ''}${field}`);
  }

  protected getProjection(fields: string[]): PipelineStage.Project | undefined {
    if (fields.length) {
      return {
        $project: fields.reduce((acc, field) => ({ ...acc, [field]: 0 }), {}),
      };
    }

    return undefined;
  }

  /**
   * This cannot be undone, be careful on which collection you use it
   * Therefore the method is protected, extending repository can expose the method if needed
   * */
  protected async deleteAll(session?: ClientSession): Promise<void> {
    await this.model.deleteMany({}, { session });
  }
}
