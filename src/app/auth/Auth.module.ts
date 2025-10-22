import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './Auth.service';
import { AuthController } from './Auth.controller';
import { GoogleStrategy } from './strategies/Google.strategy';
import { JwtStrategy } from './strategies/Jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>('auth.jwtExpiresIn') || '7d';
        return {
          secret: configService.get<string>('auth.jwtSecret'),
          signOptions: {
            expiresIn: expiresIn as any, // Type assertion for JWT module compatibility
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
