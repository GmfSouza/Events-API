import { JwtStrategy } from './jwt.strategy';
import { Logger, UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let configService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        return undefined;
      }),
    };
  });

  it('should be defined and log initialization', () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    const strategy = new JwtStrategy(configService);
    expect(strategy).toBeDefined();
    expect(logSpy).toHaveBeenCalledWith('JwtStrategy initialized');
  });

  it('should throw if JWT_SECRET is not defined', () => {
    configService.get = jest.fn(() => undefined);
    expect(() => new JwtStrategy(configService)).toThrow(
      'JWT_SECRET is not defined in environment variables'
    );
  });

  it('should validate and return user object for valid payload', async () => {
    const strategy = new JwtStrategy(configService);
    const payload = { sub: '123', email: 'test@test.com', role: 'admin' };
    const result = await strategy.validate(payload as any);
    expect(result).toEqual({
      userId: '123',
      email: 'test@test.com',
      role: 'admin',
    });
  });

  it('should throw UnauthorizedException for missing payload', async () => {
    const strategy = new JwtStrategy(configService);
    await expect(strategy.validate(undefined as any)).rejects.toThrow(UnauthorizedException);
    expect(Logger.prototype.warn).toHaveBeenCalledWith('Invalid JWT payload received');
  });

  it('should throw UnauthorizedException for payload missing sub', async () => {
    const strategy = new JwtStrategy(configService);
    await expect(
      strategy.validate({ email: 'test@test.com', role: 'admin' } as any)
    ).rejects.toThrow(UnauthorizedException);
    expect(Logger.prototype.warn).toHaveBeenCalledWith('Invalid JWT payload received');
  });

  it('should throw UnauthorizedException for payload missing email', async () => {
    const strategy = new JwtStrategy(configService);
    await expect(
      strategy.validate({ sub: '123', role: 'admin' } as any)
    ).rejects.toThrow(UnauthorizedException);
    expect(Logger.prototype.warn).toHaveBeenCalledWith('Invalid JWT payload received');
  });

  it('should throw UnauthorizedException for payload missing role', async () => {
    const strategy = new JwtStrategy(configService);
    await expect(
      strategy.validate({ sub: '123', email: 'test@test.com' } as any)
    ).rejects.toThrow(UnauthorizedException);
    expect(Logger.prototype.warn).toHaveBeenCalledWith('Invalid JWT payload received');
  });
});