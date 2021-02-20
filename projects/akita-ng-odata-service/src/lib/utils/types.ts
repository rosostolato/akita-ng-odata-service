import { EntityStore } from '@datorama/akita';
import { ODataQuery } from 'odata-fluent-query';

export interface ODataCollectionResult<T> {
  '@odata.context': string;
  '@odata.count'?: number;
  value: T[];
}

export type ODataSingleResult<T> = T & {
  '@odata.context': string;
};

/**
 * OData action config object
 * T extends model used to query
 * S extends store state model
 */
export interface ODataActionConfig<T, S> {
  url?: string;
  query?: ODataQuery<T extends (infer A)[] ? A : T>;
  params?: { [prop: string]: any };
  namespace?: string;
  storeUpdater?: (store: EntityStore<S>, response: T) => void;
}
