import { Global, Module, type Provider } from '@nestjs/common';
import { LocalFsObjectStorage, OBJECT_STORAGE, type ObjectStorage } from '@eazepay/shared-utils';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

const storageProvider: Provider = {
  provide: OBJECT_STORAGE,
  useFactory: (): ObjectStorage => {
    if (env.OBJECT_STORAGE === 'local-fs') {
      if (env.NODE_ENV === 'production') {
        throw new Error('OBJECT_STORAGE=local-fs is dev-only — wire S3 in production.');
      }
      return new LocalFsObjectStorage(
        env.LOCAL_FS_STORAGE_ROOT,
        env.LOCAL_FS_STORAGE_SIGNING_SECRET,
        env.LOCAL_FS_STORAGE_PUBLIC_URL,
      );
    }
    throw new Error(`OBJECT_STORAGE=${env.OBJECT_STORAGE} not yet implemented`);
  },
};

@Global()
@Module({
  providers: [storageProvider],
  exports: [OBJECT_STORAGE],
})
export class ObjectStorageModule {}
