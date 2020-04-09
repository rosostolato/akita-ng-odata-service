import { ODataCollectionResult } from './types';

export function isODataCollection<T>(x: any): x is ODataCollectionResult<T> {
  if (x['@odata.context'] && Object.keys(x).length === 2 && x.value) {
    return true;
  }

  return false;
}
