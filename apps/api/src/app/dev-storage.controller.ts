import {
  Controller,
  Get,
  Headers,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@eazepay/service-auth';
import {
  LocalFsObjectStorage,
  NotFound,
  Unauthorized,
} from '@eazepay/shared-utils';
import type { FastifyReply } from 'fastify';
import { OBJECT_STORAGE } from '@eazepay/shared-utils';
import { Inject } from '@nestjs/common';
import type { ObjectStorage } from '@eazepay/shared-utils';

/**
 * DEV ONLY signed-read endpoint backing LocalFsObjectStorage's
 * presigned URLs. Verifies the HMAC signature + expiry before serving
 * bytes. Production uses S3 presigned URLs that AWS verifies natively;
 * this controller is mounted only when OBJECT_STORAGE resolves to
 * LocalFsObjectStorage (apps/api guards in app.module).
 */
@ApiTags('dev-storage')
@Public()
@Controller('dev-storage')
export class DevStorageController {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  @Get(':bucket/*')
  @ApiOperation({
    summary: 'DEV ONLY: serve a previously presigned read URL after HMAC check',
  })
  async read(
    @Param('bucket') bucket: string,
    @Param('*') key: string,
    @Query('sig') sig: string,
    @Query('exp') exp: string,
    @Query('fn') filename: string | undefined,
    @Headers('user-agent') _userAgent: string | undefined,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    // The caller passes (bucket, encoded-key, sig, exp). We rely on the
    // adapter's verifySignature for constant-time HMAC compare.
    if (!(this.storage instanceof LocalFsObjectStorage)) {
      throw NotFound({ code: 'dev_storage_not_active' });
    }
    if (!sig || !exp) throw Unauthorized({ code: 'missing_signature' });
    const expNum = Number(exp);
    if (!this.storage.verifySignature(bucket, key, expNum, sig)) {
      throw Unauthorized({ code: 'invalid_signature' });
    }
    if (!(await this.storage.exists(bucket, key))) {
      throw NotFound({ code: 'object_not_found' });
    }
    const bytes = await this.storage.get({ bucket, key });
    void reply
      .header('content-type', 'application/octet-stream')
      .header(
        'content-disposition',
        filename
          ? `attachment; filename="${filename.replace(/"/g, '')}"`
          : 'attachment',
      )
      .send(bytes);
  }
}
