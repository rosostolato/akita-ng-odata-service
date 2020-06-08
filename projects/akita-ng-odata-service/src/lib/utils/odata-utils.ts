import { ODataCollectionResult } from './types';
import { isArray } from '@datorama/akita';

export function isODataCollection<T>(x: any): x is ODataCollectionResult<T> {
  const nonOdataKeys = Object.keys(x).filter(key => !key.startsWith('@odata'));

  if (nonOdataKeys.length === 1 && nonOdataKeys[0] === 'value' && isArray(x.value)) {
    return true;
  }

  return false;
}
