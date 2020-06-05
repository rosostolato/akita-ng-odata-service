import { EntityState } from '@datorama/akita';

export interface ODataEntityState<E = any, IDType = any> extends EntityState<E, IDType> {
  '@odata.context': string;
  '@odata.count': number;
}
