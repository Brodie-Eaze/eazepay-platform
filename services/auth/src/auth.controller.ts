import { Body, Controller, Headers, HttpCode, Ip, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Idempotent } from '@eazepay/shared-utils';
import { Public } from './guards/public.decorator.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import type {
  LoginResult,
  RefreshResult,
  RegisterResult,
  VerifyOtpResult,
} from './auth.types.js';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @Idempotent()
  @ApiOperation({ summary: 'Register a new consumer or merchant user account' })
  register(@Body() dto: RegisterDto): Promise<RegisterResult> {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Initiate login with identifier + password; may require MFA' })
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<LoginResult> {
    return this.auth.login(dto, ip, userAgent);
  }

  @Post('verify-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete an MFA / OTP challenge and issue tokens' })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<VerifyOtpResult> {
    return this.auth.verifyOtp(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access token' })
  refresh(@Body() dto: RefreshDto): Promise<RefreshResult> {
    return this.auth.refresh(dto);
  }
}
