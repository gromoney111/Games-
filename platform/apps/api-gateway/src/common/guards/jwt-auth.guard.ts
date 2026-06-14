import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface RequestUser {
  userId: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      const payload = await this.validateToken(token);
      // Attach user context to request
      request.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      } as RequestUser;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers?.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      return undefined;
    }

    return token;
  }

  private async validateToken(token: string): Promise<JwtPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Malformed token');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header
    const header = JSON.parse(
      Buffer.from(headerB64, 'base64url').toString('utf8'),
    );

    // Verify algorithm is RS256
    if (header.alg !== 'RS256') {
      throw new UnauthorizedException('Unsupported token algorithm');
    }

    // Verify RS256 signature using public key
    const publicKey = this.configService.get<string>('app.jwt.publicKey');
    if (!publicKey) {
      throw new UnauthorizedException('JWT verification not configured');
    }

    const signatureValid = this.verifyRS256Signature(
      `${headerB64}.${payloadB64}`,
      signatureB64,
      publicKey,
    );

    if (!signatureValid) {
      throw new UnauthorizedException('Invalid token signature');
    }

    // Decode payload
    const payload: JwtPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    );

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new UnauthorizedException('Token has expired');
    }

    // Verify issuer
    const expectedIssuer = this.configService.get<string>('app.jwt.issuer');
    if (expectedIssuer && payload.iss !== expectedIssuer) {
      throw new UnauthorizedException('Invalid token issuer');
    }

    // Verify audience
    const expectedAudience = this.configService.get<string>('app.jwt.audience');
    if (expectedAudience && payload.aud !== expectedAudience) {
      throw new UnauthorizedException('Invalid token audience');
    }

    // Validate required claims
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('Token missing required claims');
    }

    return payload;
  }

  private verifyRS256Signature(
    data: string,
    signature: string,
    publicKey: string,
  ): boolean {
    try {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(data);
      verifier.end();
      return verifier.verify(publicKey, signature, 'base64url');
    } catch {
      return false;
    }
  }
}
