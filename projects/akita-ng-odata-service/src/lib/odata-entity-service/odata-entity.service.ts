import { getEntityType, AddEntitiesOptions, getIDType, isDefined } from '@datorama/akita';
import { NgEntityService, HttpConfig, Msg, isID, HttpMethod } from '@datorama/akita-ng-entity-service';
import { HttpParams } from '@angular/common/http';
import { ODataQuery } from 'odata-fluent-query';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { ODataEntityState } from '../odata-entity-state/odata-entity-state';
import { isODataCollection } from '../utils/odata-utils';

import {
  ODataSingleResult,
  ODataCollectionResult,
  ODataActionConfig
} from '../utils/types';

export type ODataEntityConfig<T> = HttpConfig & {
  append?: boolean;
  upsert?: boolean;
} & Msg & {
  query?: ODataQuery<T>;
};

export class ODataEntityService<S extends ODataEntityState> extends NgEntityService<S> {
  /**
   *
   * Get all or one entity - Creates a GET request
   *
   * service.get().subscribe()
   * service.get({ headers, params, url })
   *
   * service.get(id)
   * service.get(id, { headers, params, url })
   *
   */
  get<T = getEntityType<S>>(config?: ODataEntityConfig<T>): Observable<T[]>;
  get<T = getEntityType<S>>(id?: getEntityType<S>['id'], config?: ODataEntityConfig<T>): Observable<T>;
  get<T = getEntityType<S>>(idOrConfig?: getEntityType<S>['id'] | HttpConfig, config?: ODataEntityConfig<T>): Observable<T | T[]> {
    const isSingle = isID(idOrConfig);

    config = (isSingle ? config : idOrConfig) || {} as ODataEntityConfig<T>;

    // if (isSingle) {
    //   config.mapResponseFn = config.mapResponseFn || ((res: ODataSingleResult<T>) => {
    //     delete res['@odata.context'];
    //     return res;
    //   });
    // } else {
    //   config.mapResponseFn = config.mapResponseFn || ((res: ODataCollectionResult<T>) => res.value);
    // }

    config.mapResponseFn = config.mapResponseFn || this.mapOdataResponse;

    if (!config.url) {
      config.url = isSingle ? `${this.api}(${idOrConfig})` : this.api;
    }

    if (config.query) {
      config.params = config.query.toObject();
    }

    return super.get(
      (isSingle ? idOrConfig : config) as any,
      config
    );
  }

  /**
   *
   * Add a new entity - Creates a POST request
   *
   * service.add(entity)
   * service.add(entity, config)
   *
   */
  add<T = getEntityType<S>>(
    entity: getEntityType<S>,
    config?: HttpConfig & Pick<AddEntitiesOptions, 'prepend'> & Msg & {
      query?: ODataQuery<T>
    }
  ): Observable<T> {
    config = config || {};

    // config.mapResponseFn = config.mapResponseFn || ((res: ODataSingleResult<T>) => {
    //   delete res['@odata.context'];
    //   return res;
    // });

    config.mapResponseFn = config.mapResponseFn || this.mapOdataResponse;

    if (config.query) {
      config.params = config.query.toObject();
    }

    return super.add(entity, config);
  }

  /**
   *
   * Update an entity - Creates a PUT/PATCH request
   *
   * service.update(id, entity)
   * service.update(id, entity, config)
   *
   */
  update<T = getEntityType<S>>(
    id: getIDType<S>,
    entity: Partial<getEntityType<S>>,
    config?: HttpConfig & Msg & {
      method?: HttpMethod.PUT | HttpMethod.PATCH;
    } & {
      query?: ODataQuery<T>
    }
  ): Observable<T> {
    config = config || { method: this.httpMethods.PATCH };

    if (!config.method) {
      config.method = this.httpMethods.PATCH;
    }

    config.mapResponseFn = config.mapResponseFn || ((res: ODataSingleResult<T>) => {
      if (res) {
        delete res['@odata.context'];
        return res;
      }

      return entity;
    });

    if (config.query) {
      config.params = config.query.toObject();
    }

    return super.update(id, entity, config as any);
  }

  function<T>(functionName: string, config: ODataActionConfig<T, S>): Observable<T>;
  function<T>(id: getEntityType<S>['id'], functionName: string, config: ODataActionConfig<T, S>): Observable<T>;
  function<T>(
    idOrFunc: getEntityType<S>['id'] | string,
    actionOrConfig: string | ODataActionConfig<T, S>,
    config?: ODataActionConfig<T, S>
  ): Observable<T> {
    const isSingle = typeof actionOrConfig === 'string';

    this.loader.dispatch({
      loading: true,
      method: HttpMethod.GET,
      storeName: this.store.storeName,
      entityId: isSingle ? idOrFunc : null
    });

    let observer: Observable<any>;

    if (isSingle) {
      const odataParams = Object.keys(config.params || {}).map(k => `${k}=${config.params[k]}`).join(',');
      const url = `${this.resolveUrl(config, idOrFunc)}/${config.namespace ? config.namespace + '.' : ''}${actionOrConfig}(${odataParams})`;

      observer = this.getHttp().get<any>(url, {
        params: new HttpParams({
          fromString: config.query && config.query.toString()
        })
      }).pipe(
        map(this.mapOdataResponse),
        tap(res => config.storeUpdater && config.storeUpdater(this.store, res))
      );
    } else {
      config = actionOrConfig as any;
      const params = Object.keys(config.params || {}).map(k => `${k}=${config.params[k]}`).join(',');
      const url = `${this.resolveUrl(config)}/${config.namespace ? config.namespace + '.' : ''}${idOrFunc}(${params})`;

      observer = this.getHttp().get<any>(url, {
        params: new HttpParams({
          fromString: config.query && config.query.toString()
        })
      }).pipe(
        map(this.mapOdataResponse),
        tap(res => config.storeUpdater && config.storeUpdater(this.store, res))
      );
    }

    return observer.pipe(
      tap(() => this.loader.dispatch({
        loading: false,
        method: HttpMethod.GET,
        storeName: this.store.storeName,
        entityId: isSingle ? idOrFunc : null
      }))
    );
  }

  action<T>(actionName: string, config: ODataActionConfig<T, S>): Observable<T>;
  action<T>(id: getEntityType<S>['id'], actionName: string, config: ODataActionConfig<T, S>): Observable<T>;
  action<T>(
    idOrAction: getEntityType<S>['id'] | string,
    actionOrConfig: string | ODataActionConfig<T, S>,
    config?: ODataActionConfig<T, S>
  ): Observable<T> {
    const isSingle = typeof actionOrConfig === 'string';

    this.loader.dispatch({
      loading: true,
      method: HttpMethod.POST,
      storeName: this.store.storeName,
      entityId: isSingle ? idOrAction : null
    });

    let observer: Observable<any>;

    if (isSingle) {
      const url = `${this.resolveUrl(config, idOrAction)}/${config.namespace ? config.namespace + '.' : ''}${actionOrConfig}`;

      observer = this.getHttp().post<any>(url, config.params, {
        params: new HttpParams({
          fromString: config.query && config.query.toString()
        })
      }).pipe(
        map(this.mapOdataResponse),
        tap(res => config.storeUpdater && config.storeUpdater(this.store, res))
      );
    } else {
      config = actionOrConfig as any;
      const url = `${this.resolveUrl(config)}/${config.namespace ? config.namespace + '.' : ''}${idOrAction}`;

      observer = this.getHttp().post<any>(url, config.params, {
        params: new HttpParams({
          fromString: config.query && config.query.toString()
        })
      }).pipe(
        map(this.mapOdataResponse),
        tap(res => config.storeUpdater && config.storeUpdater(this.store, res))
      );
    }

    return observer.pipe(
      tap(() => this.loader.dispatch({
        loading: false,
        method: HttpMethod.POST,
        storeName: this.store.storeName,
        entityId: isSingle ? idOrAction : null
      }))
    );
  }

  protected mapOdataResponse<T>(res: ODataCollectionResult<T> | ODataSingleResult<T>) {
    if (!res) return null;

    if (isODataCollection(res)) {
      this.store.update(state => ({
        ...state,
        '@odata.context': res['@odata.context'] || state['@odata.context'],
        '@odata.count': res['@odata.count'] || state['@odata.count'],
      }));

      return res.value;
    } else {
      delete res['@odata.context'];
      return res as T;
    }
  }

  protected resolveUrl(config?: HttpConfig, id?: any) {
    const customUrl = (config || {}).url;

    if (isDefined(id)) {
      return customUrl || `${this.api}(${id})`;
    }

    return customUrl || this.api;
  }

  protected get httpMethods(): { [K in HttpMethod]: K } {
    return this['mergedConfig'].httpMethods;
  }
}
