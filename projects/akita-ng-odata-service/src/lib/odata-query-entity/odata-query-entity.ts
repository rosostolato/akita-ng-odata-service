import { QueryEntity, getEntityType, getIDType } from '@datorama/akita';
import { ODataEntityState } from '../odata-entity-state/odata-entity-state';

export class ODataQueryEntity<S extends ODataEntityState, EntityType = getEntityType<S>, IDType = getIDType<S>>
  extends QueryEntity<S, EntityType, IDType> {
  /** get current state's `@odata.context` value */
  getODataContext() {
    const state = this.getValue();
    return state['@odata.context'];
  }

  /** get current state's `@odata.count` value */
  getODataCount() {
    const state = this.getValue();
    return state['@odata.count'];
  }

  /** select state's `@odata.context` value */
  selectODataContext() {
    return this.select(s => s['@odata.context']);
  }

  /** select state's `@odata.count` value */
  selectODataCount() {
    return this.select(s => s['@odata.count']);
  }

}
