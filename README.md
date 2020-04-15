# akita-ng-odata-service
Akita ❤️ Angular 📄 OData

# Akita OData
Extend codes to work with `Ng Entity Service` and `OData`.

To work with OData we need a different approach from `Ng Entity Service` implementation. For example, if you want to get one single `Post` object of `id` 5, you need to get:

`GET /Posts(1)` instead of `GET /Posts/1`

So this library will extend `Ng Entity Service` to make it possible to work with OData pattern.

## Getting Started

```
ng add @datorama/akita
npm install @datorama/akita-ng-entity-service
npm install akita-ng-odata-service
```

Let’s use [JSONPlaceholder](https://jsonplaceholder.typicode.com/) as our REST API and quickly scaffold a feature for Posts. To get started we run ng entity service generator:

`ng g af posts`

This schematics command generates an Akita `PostsStore`, `PostsQuery`, and `PostsService`. Same in Ng Entity Service, first we need to define the base api url that will be used for each request. This is done when adding the service configuration to the module:

```ts
import { 
  HttpMethod, 
  NG_ENTITY_SERVICE_CONFIG, 
  NgEntityServiceGlobalConfig 
} from '@datorama/akita-ng-entity-service';

@NgModule({
  ...
  providers: [
    {
      provide: NG_ENTITY_SERVICE_CONFIG,
      useValue: {
        baseUrl: 'https://jsonplaceholder.typicode.com'
      }
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
```

Now, instead of extend `NgEntityService` we will extend `ODataEntityService` from `akita-ng-odata-service` lib:

```ts
import { Injectable } from '@angular/core';
import { PostsState, PostsStore } from './posts.store';
import { ODataEntityService } from 'akita-ng-odata-service';

@Injectable({ providedIn: 'root' })
export class PostsService extends ODataEntityService<PostsState> {
  constructor(protected store: PostsStore) {
    super(store);
  }
}
```

## OData query

The biggest benefit of OData is to perform a custom query to your data. So in partship with [odata-fluent-query](https://github.com/rosostolato/odata-fluent-query), all methods in `ODataEntityService` have a query parameter to be optionally passed via config object. Here is an example:

```ts
import { ODataQuery } from 'odata-fluent-query';
...

@Component({
  templateUrl: './posts.component.html'
})
export class PostsPageComponent {
  /**
   * it will have data filtered by title and
   * only title and body will be fetched
   */
  posts$ = this.postsQuery.selectAll();

  constructor(
    private postsQuery: PostsQuery,
    private postsService: PostsService
  ) {}

  ngOnInit() {
    const query = new ODataQuery<Post>()
      .filter(q => q.title.startsWith('sunt'))
      .select('title', 'body');

    this.postsService.get({ query }).subscribe();
  }
}
```

For futher informations, please visit [odata-fluent-query](https://github.com/rosostolato/odata-fluent-query) github page.


## Functions and Actions

In OData, actions and functions are a way to add server-side behaviors that are not easily defined as CRUD operations on entities. `ODataEntityService` exposes `function` and `action` methods to be customized by your service.

If you configured correctly functions and actions on your backend, you will be able to implement custom calls on your service:

```ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ODataEntityService } from 'akita-ng-odata-service';
import { Post, PostsState, PostsStore } from './posts.store';

@Injectable({ providedIn: 'root' })
export class PostsService extends ODataEntityService<PostsState> {
  constructor(protected store: PostsStore) {
    super(store);
  }

  getLatestPost(): Observable<Post> {
    return this.function<Post>('GetLatestPost');
  }

  setClosed(id: number): Observable<Post> {
    return this.action(id, 'SetClosed', {
      params: { id },
      storeUpdater: store => store.update(id, {
        closed: true
      })
    });
  }
}
```
