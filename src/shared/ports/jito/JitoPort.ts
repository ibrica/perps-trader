import { SendBundleOptions } from './SendBundleOptions';
import { SendBundleResponse } from './SendBundleResponse';

export abstract class JitoPort {
  abstract sendBundle(
    options: SendBundleOptions,
  ): Promise<SendBundleResponse | Error>;
}
