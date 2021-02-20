import {
  getEntityType,
  AddEntitiesOptions,
  getIDType,
  isDefined,
  EntityState,
  logAction,
} from '@datorama/akita';
import {
  NgEntityService,
  HttpConfig,
  Msg,
  isID,
  HttpMethod,
} from '@datorama/akita-ng-entity-service';
import { HttpParams } from '@angular/common/http';
import { ODataQuery } from 'odata-fluent-query';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { isODataCollection } from '../utils/odata-utils';
import {
  ODataSingleResult,
  ODataCollectionResult,
  ODataActionConfig,
} from '../utils/types';

export type ODataEntityConfig<T> = HttpConfig & {
  append?: boolean;
  upsert?: boolean;
} & Msg & {
    query?: ODataQuery<T>;
  };

export class ODataEntityService<
  S extends EntityState
> extends NgEntityService<S> {
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
  get<T = getEntityType<S>>(
    id?: getEntityType<S>['id'],
    config?: ODataEntityConfig<T>
  ): Observable<T>;
  get<T = getEntityType<S>>(
    idOrConfig?: getEntityType<S>['id'] | HttpConfig,
    config?: ODataEntityConfig<T>
  ): Observable<T | T[]> {
    const isSingle = isID(idOrConfig);
    const conf: ODataEntityConfig<T> = (isSingle ? config : idOrConfig) || {};

    conf.mapResponseFn = conf.mapResponseFn || this.mapOdataResponse.bind(this);

    if (!conf.url) {
      conf.url = isSingle ? `${this.api}(${idOrConfig})` : this.api;
    }

    if (conf.query) {
      conf.params = conf.query.toObject();
    }

    return super.get((isSingle ? idOrConfig : config) as any, config);
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
    config?: HttpConfig &
      Pick<AddEntitiesOptions, 'prepend'> &
      Msg & {
        query?: ODataQuery<T>;
      }
  ): Observable<T> {
    config = config || {};

    // config.mapResponseFn = config.mapResponseFn || ((res: ODataSingleResult<T>) => {
    //   delete res['@odata.context'];
    //   return res;
    // });

    config.mapResponseFn =
      config.mapResponseFn || this.mapOdataResponse.bind(this);

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
    config?: HttpConfig &
      Msg & {
        method?: HttpMethod.PUT | HttpMethod.PATCH;
      } & {
        query?: ODataQuery<T>;
      }
  ): Observable<T> {
    config = config || { method: this.httpMethods.PATCH };

    if (!config.method) {
      config.method = this.httpMethods.PATCH;
    }

    config.mapResponseFn =
      config.mapResponseFn ||
      ((res: ODataSingleResult<T>) => {
        if (res) {
          const response: Partial<ODataSingleResult<T>> = { ...res };
          delete response['@odata.context'];
          return response;
        }

        return entity;
      });

    if (config.query) {
      config.params = config.query.toObject();
    }

    return super.update(id, entity, config as any);
  }

  /**
   * call custom odata function
   * @param functionName name of the odata function
   * @param config config object that extends ODataActionConfig
   */
  function<T>(
    functionName: string,
    config: ODataActionConfig<T, S>
  ): Observable<T>;
  function<T>(
    id: getEntityType<S>['id'],
    functionName: string,
    config: ODataActionConfig<T, S>
  ): Observable<T>;
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
      entityId: isSingle ? idOrFunc : null,
    });

    let observer: Observable<any>;

    if (isSingle) {
      const conf: ODataActionConfig<T, S> = config || {};
      const odataParams = Object.keys(conf.params || {})
        .map((k) => `${k}=${conf.params![k]}`)
        .join(',');
      const url = `${this.resolveUrl(conf, idOrFunc)}/${
        conf.namespace ? conf.namespace + '.' : ''
      }${actionOrConfig}(${odataParams})`;

      observer = this.getHttp()
        .get<any>(url, {
          params: new HttpParams({
            fromString: conf.query && conf.query.toString(),
          }),
        })
        .pipe(
          map(this.mapOdataResponse.bind(this)),
          tap((res) => conf.storeUpdater && conf.storeUpdater(this.store, res))
        );
    } else {
      const conf: ODataActionConfig<T, S> = actionOrConfig as any;
      const params = Object.keys(conf.params || {})
        .map((k) => `${k}=${conf.params![k]}`)
        .join(',');
      const url = `${this.resolveUrl(conf)}/${
        conf.namespace ? conf.namespace + '.' : ''
      }${idOrFunc}(${params})`;

      observer = this.getHttp()
        .get<any>(url, {
          params: new HttpParams({
            fromString: conf.query && conf.query.toString(),
          }),
        })
        .pipe(
          map(this.mapOdataResponse.bind(this)),
          tap((res) => conf.storeUpdater && conf.storeUpdater(this.store, res))
        );
    }

    return observer.pipe(
      tap(() =>
        this.loader.dispatch({
          loading: false,
          method: HttpMethod.GET,
          storeName: this.store.storeName,
          entityId: isSingle ? idOrFunc : null,
        })
      )
    );
  }

  /**
   * call custom odata action
   * @param actionName name of the odata action
   * @param config config object that extends ODataActionConfig
   */
  action<T>(actionName: string, config: ODataActionConfig<T, S>): Observable<T>;
  action<T>(
    id: getEntityType<S>['id'],
    actionName: string,
    config: ODataActionConfig<T, S>
  ): Observable<T>;
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
      entityId: isSingle ? idOrAction : null,
    });

    let observer: Observable<any>;

    if (isSingle) {
      const conf: ODataActionConfig<T, S> = config || {};
      const url = `${this.resolveUrl(conf, idOrAction)}/${
        conf.namespace ? conf.namespace + '.' : ''
      }${actionOrConfig}`;

      observer = this.getHttp()
        .post<any>(url, conf.params, {
          params: new HttpParams({
            fromString: conf.query && conf.query.toString(),
          }),
        })
        .pipe(
          map(this.mapOdataResponse.bind(this)),
          tap((res) => conf.storeUpdater && conf.storeUpdater(this.store, res))
        );
    } else {
      const conf: ODataActionConfig<T, S> = actionOrConfig as any;
      const url = `${this.resolveUrl(conf)}/${
        conf.namespace ? conf.namespace + '.' : ''
      }${idOrAction}`;

      observer = this.getHttp()
        .post<any>(url, conf.params, {
          params: new HttpParams({
            fromString: conf.query && conf.query.toString(),
          }),
        })
        .pipe(
          map(this.mapOdataResponse.bind(this)),
          tap((res) => conf.storeUpdater && conf.storeUpdater(this.store, res))
        );
    }

    return observer.pipe(
      tap(() =>
        this.loader.dispatch({
          loading: false,
          method: HttpMethod.POST,
          storeName: this.store.storeName,
          entityId: isSingle ? idOrAction : null,
        })
      )
    );
  }

  protected mapOdataResponse<T>(
    res: ODataCollectionResult<T> | ODataSingleResult<T>
  ) {
    if (!res) {
      return null;
    }

    if (isODataCollection(res)) {
      // update state with odata properties
      this.updateOdataState(res);
      return res.value;
    } else {
      const response: Partial<ODataSingleResult<T>> = { ...res };
      delete response['@odata.context'];
      return response as T;
    }
  }

  protected updateOdataState<T>(
    res: ODataCollectionResult<T> | ODataSingleResult<T>
  ) {
    const response = res as ODataCollectionResult<T>;
    const curState = this.store.getValue();
    const changed =
      response['@odata.context'] !== curState.context ||
      (response['@odata.count'] && response['@odata.count'] !== curState.count);

    if (changed) {
      logAction('Set OData Properties');

      this.store.update((state) => ({
        ...state,
        context: response['@odata.context'] || state.context,
        count: response['@odata.count'] || state.count,
      }));
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
    // TODO: create PR for akita to make this property protected
    // tslint:disable-next-line: no-string-literal
    return this['mergedConfig'].httpMethods;
  }
}
