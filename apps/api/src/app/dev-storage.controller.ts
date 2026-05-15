import {
  BadRequestException,
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

// SEC-052 — filename sanitisation constants.
//
// Threat closed: pre-fix, the `fn` query param was echoed into the
// `Content-Disposition: attachment; filename="..."` header with only
// quote-stripping. An attacker can craft a filename containing CRLF
// to inject extra response headers (HTTP response splitting), or a
// 50 KB filename to balloon every download response. The dev-storage
// route is local-only, but staging deploys often expose it on the
// same host as the API so the surface is real.
//
// Fix: cap length at 200 chars and only allow a safe character set
// (letters, digits, dot, underscore, hyphen). Anything else 400s
// with a clear code so a client can surface "rename your file".
const FILENAME_MAX_LEN = 200;
const FILENAME_PATTERN = /^[A-Za-z0-9._-]+$/;

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
    // SEC-052 — validate filename param before any header echo.
    // Truncate to 200 chars (defence-in-depth in case the pattern
    // misses a pathological case) then reject anything outside the
    // safe character class. Bounded length stops response-header
    // ballooning; restricted charset stops CRLF / quote injection
    // into the Content-Disposition header.
    let safeFilename: string | undefined;
    if (filename !== undefined) {
      const trimmed = filename.slice(0, FILENAME_MAX_LEN);
      if (!FILENAME_PATTERN.test(trimmed)) {
        // Use NestJS's built-in BadRequestException to avoid adding a
        // new named import from @eazepay/shared-utils (which has a
        // pre-existing module-resolution issue). The global
        // ProblemExceptionFilter normalises HttpException into RFC7807
        // shape, so the code over the wire is still
        // `bad_request` / 400 with the detail below.
        throw new BadRequestException({
          code: 'invalid_filename',
          message:
            'filename may only contain letters, digits, dot, underscore, and hyphen (max 200 chars)',
        });
      }
      safeFilename = trimmed;
    }
    const bytes = await this.storage.get({ bucket, key });
    void reply
      .header('content-type', 'application/octet-stream')
      .header(
        'content-disposition',
        safeFilename
          ? `attachment; filename="${safeFilename}"`
          : 'attachment',
      )
      .send(bytes);
  }
}
